import { BatchItem, ControlCmd, DeviceInfo, DeviceRef, State } from "../util/types.js";
import { createChildLogger } from "../util/logger.js";
import type { GoveeAdapter } from "./types.js";

const log = createChildLogger({ module: "lan-adapter" });

function getLanEnabled(): boolean {
  return /^true$/i.test(process.env.GOVEE_LAN_ENABLED || "false");
}

/**
 * LAN adapter for Govee devices with fallback to cloud.
 *
 * NOTE: This is a minimal placeholder. Govee LAN protocol varies by model;
 * some use JSON over UDP 4001/4002. Enable per-device "LAN Control" in the
 * Govee app first. Then implement discovery & payloads here if desired.
 */
export class LanAdapter implements GoveeAdapter {
  private fallback: GoveeAdapter | null = null;

  get lanEnabled(): boolean {
    return getLanEnabled();
  }

  /**
   * Set the fallback adapter to use when LAN operations fail.
   */
  setFallback(adapter: GoveeAdapter): void {
    this.fallback = adapter;
    log.info("Fallback adapter configured");
  }

  private async withFallback<T>(
    operation: string,
    lanOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>
  ): Promise<T> {
    if (!this.lanEnabled) {
      log.debug({ operation }, "LAN disabled, using fallback");
      return fallbackOperation();
    }

    try {
      return await lanOperation();
    } catch (error) {
      if (this.fallback) {
        log.warn({ operation, error }, "LAN operation failed, falling back to cloud");
        return fallbackOperation();
      }
      throw error;
    }
  }

  async listDevices(): Promise<DeviceInfo[]> {
    return this.withFallback(
      "listDevices",
      async () => {
        // LAN discovery not implemented - always use fallback
        throw new Error("LAN listDevices not implemented");
      },
      async () => {
        if (!this.fallback) throw new Error("No fallback adapter configured");
        return this.fallback.listDevices();
      }
    );
  }

  async getState(ref: DeviceRef): Promise<State> {
    return this.withFallback(
      "getState",
      async () => {
        throw new Error("LAN getState not implemented");
      },
      async () => {
        if (!this.fallback) throw new Error("No fallback adapter configured");
        return this.fallback.getState(ref);
      }
    );
  }

  async control(ref: DeviceRef, cmd: ControlCmd): Promise<void> {
    return this.withFallback(
      "control",
      async () => {
        if (!this.lanEnabled) throw new Error("LAN disabled");
        // TODO: craft UDP JSON payload matching your device's LAN schema and send via dgram
        throw new Error("LAN control not implemented");
      },
      async () => {
        if (!this.fallback) throw new Error("No fallback adapter configured");
        return this.fallback.control(ref, cmd);
      }
    );
  }

  async batch(items: BatchItem[]): Promise<void> {
    return this.withFallback(
      "batch",
      async () => {
        // Attempt each item via LAN
        for (const it of items) {
          await this.control({ deviceId: it.deviceId, model: it.model }, it.cmd);
        }
      },
      async () => {
        if (!this.fallback) throw new Error("No fallback adapter configured");
        return this.fallback.batch(items);
      }
    );
  }
}
