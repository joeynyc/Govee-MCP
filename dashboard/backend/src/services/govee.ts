import { fetch } from "undici";
import { v4 as uuidv4 } from "uuid";
import { ControlCmd, DeviceInfo, DeviceRef, State, DeviceWithState, GoveeApiError, RgbColor } from "../util/types.js";
import { withRetry } from "../util/retry.js";
import { TokenBucketLimiter } from "../util/limiter.js";

function getConfig() {
  return {
    apiBase: process.env.GOVEE_API_BASE || "https://openapi.api.govee.com/router/api/v1",
    apiKey: process.env.GOVEE_API_KEY || "",
    dryRun: /^true$/i.test(process.env.GOVEE_DRY_RUN || "false"),
    allowlist: process.env.GOVEE_ALLOWLIST?.split(",").map(s => s.trim()).filter(Boolean) || null,
  };
}

function headers() {
  const { apiKey } = getConfig();
  return {
    "Content-Type": "application/json",
    "Govee-API-Key": apiKey,
  } as Record<string, string>;
}

// Rate limiter - shared across all requests
const limiter = new TokenBucketLimiter(Number(process.env.GOVEE_RATE_RPS) || 5);

async function post<T>(path: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { apiBase } = getConfig();
  const requestId = (payload.requestId as string) || uuidv4();

  await limiter.take();

  return withRetry(async () => {
    console.log(`[Govee] POST ${path}`, { requestId });

    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload ?? {}),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Govee] API error ${res.status}: ${errorText}`);
      throw new GoveeApiError(`Govee API error ${res.status}: Request failed`, res.status);
    }

    const data = await res.json() as T;
    return data;
  });
}

async function get<T>(path: string): Promise<T> {
  const { apiBase, apiKey } = getConfig();
  const requestId = uuidv4();

  await limiter.take();

  return withRetry(async () => {
    console.log(`[Govee] GET ${path}`, { requestId });

    const res = await fetch(`${apiBase}${path}`, {
      method: "GET",
      headers: { "Govee-API-Key": apiKey },
    });

    if (!res.ok) {
      console.error(`[Govee] API error ${res.status}`);
      throw new GoveeApiError(`Govee API error ${res.status}: Request failed`, res.status);
    }

    const data = await res.json() as T;
    return data;
  });
}

function isDeviceAllowed(deviceId: string): boolean {
  const { allowlist } = getConfig();
  if (!allowlist) return true;
  return allowlist.includes(deviceId);
}

export class GoveeService {
  async listDevices(): Promise<DeviceInfo[]> {
    console.log("[Govee] Listing devices");
    type Resp = { data?: Array<{ device: string; sku: string; deviceName: string; capabilities?: Array<{ type: string }> }> };
    const out = await get<Resp>("/user/devices");
    const devices = out?.data ?? [];
    const result = devices
      .filter(d => isDeviceAllowed(d.device))
      .map((d) => ({
        deviceId: d.device,
        model: d.sku,
        name: d.deviceName,
        capabilities: (d.capabilities || []).map((c) => c.type),
      }));
    console.log(`[Govee] Found ${result.length} devices`);
    return result;
  }

  async getState(ref: DeviceRef): Promise<State> {
    if (!isDeviceAllowed(ref.deviceId)) {
      throw new GoveeApiError(`Device ${ref.deviceId} not in allowlist`, 403);
    }

    console.log(`[Govee] Getting state for ${ref.deviceId}`);
    type Resp = { data?: { capabilities?: Array<{ type: string; instance?: string; state?: { value: unknown } }> } };
    const out = await post<Resp>("/device/state", {
      requestId: uuidv4(),
      payload: { sku: ref.model, device: ref.deviceId }
    });
    const caps = out?.data?.capabilities || [];
    const st: State = {};
    for (const c of caps) {
      if (c.type === "devices.capabilities.on_off") {
        st.power = c.state?.value === 1 ? "on" : "off";
      }
      if (c.type === "devices.capabilities.range" && c.instance === "brightness") {
        st.brightness = Number(c.state?.value);
      }
      if (c.type === "devices.capabilities.color_setting" && c.instance === "colorRgb") {
        const rgb = Number(c.state?.value);
        st.color = {
          r: (rgb >> 16) & 255,
          g: (rgb >> 8) & 255,
          b: rgb & 255
        };
      }
      if (c.type === "devices.capabilities.color_setting" && c.instance === "colorTemperatureK") {
        st.colorTem = Number(c.state?.value);
      }
    }
    return st;
  }

  async listDevicesWithState(): Promise<DeviceWithState[]> {
    const devices = await this.listDevices();
    const results: DeviceWithState[] = [];

    for (const device of devices) {
      try {
        const state = await this.getState({ deviceId: device.deviceId, model: device.model });
        results.push({ ...device, state });
      } catch (error) {
        console.error(`[Govee] Failed to get state for ${device.deviceId}:`, error);
        results.push({ ...device, state: {} });
      }
    }

    return results;
  }

  async control(ref: DeviceRef, cmd: ControlCmd): Promise<void> {
    if (!isDeviceAllowed(ref.deviceId)) {
      throw new GoveeApiError(`Device ${ref.deviceId} not in allowlist`, 403);
    }

    const { dryRun } = getConfig();
    if (dryRun) {
      console.log(`[Govee] [DRY-RUN] control`, { ref, cmd });
      return;
    }

    console.log(`[Govee] Sending ${cmd.name} command to ${ref.deviceId}`);

    let capability: { type: string; instance: string; value: unknown };
    switch (cmd.name) {
      case "turn":
        capability = {
          type: "devices.capabilities.on_off",
          instance: "powerSwitch",
          value: cmd.value === "on" ? 1 : 0
        };
        break;
      case "brightness":
        capability = {
          type: "devices.capabilities.range",
          instance: "brightness",
          value: cmd.value
        };
        break;
      case "color": {
        const rgb = (cmd.value.r << 16) | (cmd.value.g << 8) | cmd.value.b;
        capability = {
          type: "devices.capabilities.color_setting",
          instance: "colorRgb",
          value: rgb
        };
        break;
      }
      case "colorTem":
        capability = {
          type: "devices.capabilities.color_setting",
          instance: "colorTemperatureK",
          value: cmd.value
        };
        break;
      case "scene":
        capability = {
          type: "devices.capabilities.dynamic_scene",
          instance: "lightScene",
          value: cmd.value
        };
        break;
      default:
        throw new Error(`Unsupported command: ${(cmd as { name: string }).name}`);
    }

    await post("/device/control", {
      requestId: uuidv4(),
      payload: {
        sku: ref.model,
        device: ref.deviceId,
        capability
      }
    });

    console.log(`[Govee] Command sent successfully`);
  }

  async setPower(ref: DeviceRef, on: boolean): Promise<void> {
    await this.control(ref, { name: "turn", value: on ? "on" : "off" });
  }

  async setBrightness(ref: DeviceRef, percent: number): Promise<void> {
    await this.control(ref, { name: "brightness", value: Math.max(0, Math.min(100, percent)) });
  }

  async setColor(ref: DeviceRef, color: RgbColor): Promise<void> {
    await this.control(ref, { name: "color", value: color });
  }

  async setColorTemp(ref: DeviceRef, kelvin: number): Promise<void> {
    await this.control(ref, { name: "colorTem", value: Math.max(2000, Math.min(9000, kelvin)) });
  }
}

export const goveeService = new GoveeService();
