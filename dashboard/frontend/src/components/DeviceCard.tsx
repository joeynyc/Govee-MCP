import type { Device, RgbColor } from "../api/types";
import { supportsBrightness, supportsColor, supportsPower } from "../api/types";
import { PowerToggle } from "./PowerToggle";
import { BrightnessSlider } from "./BrightnessSlider";
import { ColorPicker } from "./ColorPicker";
import { ColorTempSlider } from "./ColorTempSlider";

interface DeviceCardProps {
  device: Device;
  onPowerChange: (on: boolean) => void;
  onBrightnessChange: (percent: number) => void;
  onColorChange: (color: RgbColor) => void;
  onColorTempChange: (kelvin: number) => void;
  isPending?: boolean;
}

export function DeviceCard({
  device,
  onPowerChange,
  onBrightnessChange,
  onColorChange,
  onColorTempChange,
  isPending,
}: DeviceCardProps) {
  const { state } = device;
  const isOn = state.power === "on";
  const hasPower = supportsPower(device);
  const hasBrightness = supportsBrightness(device);
  const hasColor = supportsColor(device);

  return (
    <div
      className={`
        bg-zinc-900 rounded-xl p-5 border transition-all duration-200
        ${isOn ? "border-zinc-700" : "border-zinc-800"}
        ${isPending ? "opacity-70" : ""}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-white truncate">
            {device.name || device.deviceId}
          </h3>
          <p className="text-sm text-zinc-500 truncate">{device.model}</p>
        </div>
        {hasPower && (
          <PowerToggle isOn={isOn} onChange={onPowerChange} disabled={isPending} />
        )}
      </div>

      {/* Controls - only show when device is on */}
      {isOn && (
        <div className="space-y-4">
          {/* Brightness */}
          {hasBrightness && (
            <BrightnessSlider
              value={state.brightness ?? 100}
              onChange={onBrightnessChange}
              disabled={isPending}
            />
          )}

          {/* Color */}
          {hasColor && (
            <ColorPicker
              color={state.color ?? { r: 255, g: 255, b: 255 }}
              onChange={onColorChange}
              disabled={isPending}
            />
          )}

          {/* Color Temperature */}
          {hasColor && (
            <ColorTempSlider
              value={state.colorTem ?? 4000}
              onChange={onColorTempChange}
              disabled={isPending}
            />
          )}
        </div>
      )}

      {/* Offline/Off state indicator */}
      {!isOn && hasPower && (
        <div className="text-center py-4 text-zinc-500 text-sm">
          Device is off
        </div>
      )}
    </div>
  );
}
