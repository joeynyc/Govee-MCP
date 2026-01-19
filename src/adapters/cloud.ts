import { fetch } from "undici";
import { v4 as uuidv4 } from "uuid";
import { BatchItem, ControlCmd, DeviceInfo, DeviceRef, State, GoveeApiError } from "../util/types.js";
import { createChildLogger } from "../util/logger.js";
import { withRetry } from "../util/retry.js";
import type { GoveeAdapter } from "./types.js";

const log = createChildLogger({ module: "cloud-adapter" });

function getConfig() {
  return {
    apiBase: process.env.GOVEE_API_BASE || "https://openapi.api.govee.com/router/api/v1",
    apiKey: process.env.GOVEE_API_KEY || "",
    dryRun: /^true$/i.test(process.env.GOVEE_DRY_RUN || "false"),
  };
}

function headers() {
  const { apiKey } = getConfig();
  return {
    "Content-Type": "application/json",
    "Govee-API-Key": apiKey,
  } as Record<string, string>;
}

async function post<T>(path: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { apiBase } = getConfig();
  const requestId = (payload.requestId as string) || uuidv4();
  const reqLog = log.child({ requestId, path, method: "POST" });

  return withRetry(async () => {
    reqLog.debug({ payload }, "Sending POST request");

    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload ?? {}),
    });

    if (!res.ok) {
      const errorText = await res.text();
      reqLog.error({ status: res.status, errorText }, "API request failed");
      throw new GoveeApiError(`Govee API error ${res.status}: Request failed`, res.status);
    }

    const data = await res.json() as T;
    reqLog.debug({ status: res.status }, "POST request successful");
    return data;
  });
}

async function get<T>(path: string): Promise<T> {
  const { apiBase, apiKey } = getConfig();
  const requestId = uuidv4();
  const reqLog = log.child({ requestId, path, method: "GET" });

  return withRetry(async () => {
    reqLog.debug("Sending GET request");

    const res = await fetch(`${apiBase}${path}`, {
      method: "GET",
      headers: { "Govee-API-Key": apiKey },
    });

    if (!res.ok) {
      reqLog.error({ status: res.status }, "API request failed");
      throw new GoveeApiError(`Govee API error ${res.status}: Request failed`, res.status);
    }

    const data = await res.json() as T;
    reqLog.debug({ status: res.status }, "GET request successful");
    return data;
  });
}

export class CloudAdapter implements GoveeAdapter {
  async listDevices(): Promise<DeviceInfo[]> {
    log.info("Listing devices");
    type Resp = { data?: Array<{ device: string; sku: string; deviceName: string; capabilities?: Array<{ type: string }> }> };
    const out = await get<Resp>("/user/devices");
    const devices = out?.data ?? [];
    const result = devices.map((d) => ({
      deviceId: d.device,
      model: d.sku,
      name: d.deviceName,
      capabilities: (d.capabilities || []).map((c) => c.type),
    }));
    log.info({ count: result.length }, "Devices listed successfully");
    return result;
  }

  async getState(ref: DeviceRef): Promise<State> {
    log.info({ deviceId: ref.deviceId, model: ref.model }, "Getting device state");
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
    log.debug({ deviceId: ref.deviceId, state: st }, "Device state retrieved");
    return st;
  }

  async control(ref: DeviceRef, cmd: ControlCmd): Promise<void> {
    const { dryRun } = getConfig();
    if (dryRun) {
      log.info({ ref, cmd }, "[DRY-RUN] control");
      return;
    }

    log.info({ deviceId: ref.deviceId, model: ref.model, command: cmd.name }, "Sending control command");

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

    log.debug({ deviceId: ref.deviceId, command: cmd.name }, "Control command sent successfully");
  }

  async batch(items: BatchItem[]): Promise<void> {
    const { dryRun } = getConfig();
    if (dryRun) {
      log.info({ items }, "[DRY-RUN] batch");
      return;
    }

    log.info({ count: items.length }, "Executing batch commands");
    for (const it of items) {
      await this.control({ deviceId: it.deviceId, model: it.model }, it.cmd);
      await new Promise((r) => setTimeout(r, 60));
    }
    log.debug({ count: items.length }, "Batch commands completed");
  }
}
