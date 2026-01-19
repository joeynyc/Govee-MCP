import { BatchItem, ControlCmd, DeviceInfo, DeviceRef, State } from "../util/types.js";

/**
 * Common interface for Govee device adapters (Cloud and LAN).
 * Enables transparent fallback between adapters.
 */
export interface GoveeAdapter {
  /**
   * List all devices available through this adapter.
   */
  listDevices(): Promise<DeviceInfo[]>;

  /**
   * Get the current state of a device.
   */
  getState(ref: DeviceRef): Promise<State>;

  /**
   * Send a control command to a device.
   */
  control(ref: DeviceRef, cmd: ControlCmd): Promise<void>;

  /**
   * Execute multiple commands in batch.
   */
  batch(items: BatchItem[]): Promise<void>;
}
