import type { Device } from "../api/types";
import { DeviceCard } from "./DeviceCard";
import {
  usePowerMutation,
  useBrightnessMutation,
  useColorMutation,
  useColorTempMutation,
} from "../hooks/useDevices";

interface DeviceListProps {
  devices: Device[];
}

export function DeviceList({ devices }: DeviceListProps) {
  const powerMutation = usePowerMutation();
  const brightnessMutation = useBrightnessMutation();
  const colorMutation = useColorMutation();
  const colorTempMutation = useColorTempMutation();

  if (devices.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <svg
          className="w-16 h-16 mx-auto mb-4 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <p className="text-lg font-medium">No devices found</p>
        <p className="text-sm mt-1">
          Make sure your Govee devices are connected and the API key is configured.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {devices.map((device) => (
        <DeviceCard
          key={device.deviceId}
          device={device}
          onPowerChange={(on) =>
            powerMutation.mutate({
              deviceId: device.deviceId,
              model: device.model,
              on,
            })
          }
          onBrightnessChange={(percent) =>
            brightnessMutation.mutate({
              deviceId: device.deviceId,
              model: device.model,
              percent,
            })
          }
          onColorChange={(color) =>
            colorMutation.mutate({
              deviceId: device.deviceId,
              model: device.model,
              color,
            })
          }
          onColorTempChange={(kelvin) =>
            colorTempMutation.mutate({
              deviceId: device.deviceId,
              model: device.model,
              kelvin,
            })
          }
          isPending={
            powerMutation.isPending ||
            brightnessMutation.isPending ||
            colorMutation.isPending ||
            colorTempMutation.isPending
          }
        />
      ))}
    </div>
  );
}
