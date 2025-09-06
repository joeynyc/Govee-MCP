export type DeviceRef = { deviceId: string; model: string };

export type DeviceInfo = DeviceRef & {
  name?: string;
  capabilities?: string[]; // e.g., ["power", "brightness", "color", "colorTem", "scene"]
};

export type State = {
  power?: "on" | "off";
  brightness?: number; // 0–100
  color?: { r: number; g: number; b: number };
  colorTem?: number; // Kelvin
  scene?: string;
};

export type ControlCmd =
  | { name: "turn"; value: "on" | "off" }
  | { name: "brightness"; value: number }
  | { name: "color"; value: { r: number; g: number; b: number } }
  | { name: "colorTem"; value: number }
  | { name: "scene"; value: string };

export type BatchItem = DeviceRef & { cmd: ControlCmd };