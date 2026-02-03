import { useState, useEffect, useRef } from "react";

interface BrightnessSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function BrightnessSlider({
  value,
  onChange,
  disabled,
}: BrightnessSliderProps) {
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
    <div className="flex items-center gap-3">
      <svg
        className="w-5 h-5 text-zinc-400 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <input
        type="range"
        min={0}
        max={100}
        value={localValue}
        onChange={(e) => handleChange(Number(e.target.value))}
        disabled={disabled}
        className={`
          flex-1 h-2 rounded-full appearance-none cursor-pointer
          bg-gradient-to-r from-zinc-700 to-amber-400
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:shadow-md
          [&::-moz-range-thumb]:cursor-pointer
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      />
      <span className="text-sm text-zinc-400 w-10 text-right">{localValue}%</span>
    </div>
  );
}
