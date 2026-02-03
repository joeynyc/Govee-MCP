export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface DeviceState {
  power?: "on" | "off";
  brightness?: number;
  color?: RgbColor;
  colorTem?: number;
  scene?: string;
}

export interface Device {
  deviceId: string;
  model: string;
  name?: string;
  capabilities?: string[];
  state: DeviceState;
}

export function hasCapability(device: Device, capability: string): boolean {
  return device.capabilities?.some(c => c.includes(capability)) ?? false;
}

export function supportsColor(device: Device): boolean {
  return hasCapability(device, "color_setting");
}

export function supportsBrightness(device: Device): boolean {
  return hasCapability(device, "range") || hasCapability(device, "brightness");
}

export function supportsPower(device: Device): boolean {
  return hasCapability(device, "on_off");
}
