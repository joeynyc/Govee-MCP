import { useState, useEffect, useRef } from "react";

interface ColorTempSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function ColorTempSlider({
  value,
  onChange,
  disabled,
}: ColorTempSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: number) => {
    setLocalValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>Warm</span>
        <span>{localValue}K</span>
        <span>Cool</span>
      </div>
      <input
        type="range"
        min={2000}
        max={9000}
        step={100}
        value={localValue}
        onChange={(e) => handleChange(Number(e.target.value))}
        disabled={disabled}
        className={`
          w-full h-2 rounded-full appearance-none cursor-pointer
          bg-gradient-to-r from-orange-400 via-white to-blue-300
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-zinc-800
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-zinc-800
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-white
          [&::-moz-range-thumb]:shadow-md
          [&::-moz-range-thumb]:cursor-pointer
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      />
    </div>
  );
}
