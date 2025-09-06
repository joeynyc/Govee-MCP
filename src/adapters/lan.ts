import dgram from "node:dgram";
import { BatchItem, ControlCmd, DeviceInfo, DeviceRef, State } from "../util/types.js";

/**
 * NOTE: This is a minimal placeholder. Govee LAN protocol varies by model; some use JSON over UDP 4001/4002.
 * Enable per-device "LAN Control" in the Govee app first. Then implement discovery & payloads here if desired.
 */
export class LanAdapter {
  lanEnabled = /^true$/i.test(process.env.GOVEE_LAN_ENABLED || "false");

  async listDevices(): Promise<DeviceInfo[]> {
    if (!this.lanEnabled) return [];
    // TODO: multicast discovery; return enriched info when available
    return [];
  }

  async getState(_ref: DeviceRef): Promise<State> {
    throw new Error("LAN getState not implemented");
  }

  async control(_ref: DeviceRef, _cmd: ControlCmd): Promise<void> {
    if (!this.lanEnabled) throw new Error("LAN disabled");
    // TODO: craft UDP JSON payload matching your device's LAN schema and send via dgram
    throw new Error("LAN control not implemented");
  }

  async batch(items: BatchItem[]): Promise<void> {
    for (const it of items) await this.control({ deviceId: it.deviceId, model: it.model }, it.cmd);
  }
}