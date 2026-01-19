/**
 * RGB color representation with values ranging from 0-255.
 */
export interface RgbColor {
  /** Red channel (0-255) */
  r: number;
  /** Green channel (0-255) */
  g: number;
  /** Blue channel (0-255) */
  b: number;
}

/**
 * Reference to a Govee device, containing the minimum information needed to identify it.
 */
export interface DeviceRef {
  /** Unique device identifier (MAC-like format) */
  deviceId: string;
  /** Govee model number (e.g., "H6076", "H7094") */
  model: string;
}

/**
 * Extended device information including name and capabilities.
 */
export interface DeviceInfo extends DeviceRef {
  /** Human-readable device name */
  name?: string;
  /** List of supported capability types (e.g., "power", "brightness", "color") */
  capabilities?: string[];
}

/**
 * Current state of a Govee device.
 */
export interface State {
  /** Power state */
  power?: "on" | "off";
  /** Brightness level (0-100) */
  brightness?: number;
  /** Current RGB color */
  color?: RgbColor;
  /** Color temperature in Kelvin */
  colorTem?: number;
  /** Active scene name */
  scene?: string;
}

/**
 * Control command discriminated union.
 * Each command type has a specific value format.
 */
export type ControlCmd =
  | { name: "turn"; value: "on" | "off" }
  | { name: "brightness"; value: number }
  | { name: "color"; value: RgbColor }
  | { name: "colorTem"; value: number }
  | { name: "scene"; value: string };

/**
 * Batch item combining a device reference with a control command.
 */
export interface BatchItem extends DeviceRef {
  /** The command to execute on this device */
  cmd: ControlCmd;
}

/**
 * Custom error class for Govee API errors with HTTP status code.
 * Used to determine if a request should be retried.
 */
export class GoveeApiError extends Error {
  /** HTTP status code from the API response */
  readonly statusCode: number;
  /** Whether this error is likely transient and should be retried */
  readonly isRetryable: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "GoveeApiError";
    this.statusCode = statusCode;
    // Retryable status codes: 429 (rate limited), 503 (service unavailable), 5xx (server errors)
    this.isRetryable = statusCode === 429 || statusCode === 503 || (statusCode >= 500 && statusCode < 600);
  }
}
