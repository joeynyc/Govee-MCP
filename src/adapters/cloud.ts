import { fetch } from "undici";
import { BatchItem, ControlCmd, DeviceInfo, DeviceRef, State } from "../util/types.js";

const API_BASE = process.env.GOVEE_API_BASE || "https://openapi.api.govee.com/router/api/v1";
const API_KEY = process.env.GOVEE_API_KEY || "";
const DRY_RUN = /^true$/i.test(process.env.GOVEE_DRY_RUN || "false");

function headers() {
  return {
    "Content-Type": "application/json",
    "Govee-API-Key": API_KEY,
  } as Record<string, string>;
}

async function post<T>(path: string, payload: any = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Govee API error ${res.status}: Request failed`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { "Govee-API-Key": API_KEY },
  });
  if (!res.ok) {
    throw new Error(`Govee API error ${res.status}: Request failed`);
  }
  return res.json() as Promise<T>;
}

export class CloudAdapter {
  async listDevices(): Promise<DeviceInfo[]> {
    type Resp = { data?: any[] };
    const out = await get<Resp>("/user/devices");
    const devices = out?.data ?? [];
    return devices.map((d) => ({
      deviceId: d.device,
      model: d.sku,
      name: d.deviceName,
      capabilities: (d.capabilities || []).map((c: any) => c.type),
    }));
  }

  async getState(ref: DeviceRef): Promise<State> {
    type Resp = { data?: any };
    const out = await post<Resp>("/device/state", {
      requestId: "mcp-state",
      payload: { sku: ref.model, device: ref.deviceId }
    });
    // Parse new API response format
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

  async control(ref: DeviceRef, cmd: ControlCmd): Promise<void> {
    if (DRY_RUN) {
      console.log("[DRY-RUN] control", { ref, cmd });
      return;
    }
    
    // Convert old command format to new capability format
    let capability: any;
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
      case "color":
        const rgb = (cmd.value.r << 16) | (cmd.value.g << 8) | cmd.value.b;
        capability = {
          type: "devices.capabilities.color_setting",
          instance: "colorRgb",
          value: rgb
        };
        break;
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
        throw new Error(`Unsupported command: ${(cmd as any).name}`);
    }

    await post("/device/control", {
      requestId: `mcp-${Date.now()}`,
      payload: {
        sku: ref.model,
        device: ref.deviceId,
        capability
      }
    });
  }

  async batch(items: BatchItem[]): Promise<void> {
    if (DRY_RUN) {
      console.log("[DRY-RUN] batch", items);
      return;
    }
    // Cloud API doesn't have a native batch endpoint → just sequence with minimal delay.
    for (const it of items) {
      await this.control({ deviceId: it.deviceId, model: it.model }, it.cmd);
      await new Promise((r) => setTimeout(r, 60)); // space out a bit
    }
  }
}