import { useState, useEffect, useRef } from "react";
import { RgbColorPicker } from "react-colorful";
import type { RgbColor } from "../api/types";

interface ColorPickerProps {
  color: RgbColor;
  onChange: (color: RgbColor) => void;
  disabled?: boolean;
}

export function ColorPicker({ color, onChange, disabled }: ColorPickerProps) {
  const [localColor, setLocalColor] = useState(color);
  const [isExpanded, setIsExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalColor(color);
  }, [color]);

  const handleChange = (newColor: RgbColor) => {
    setLocalColor(newColor);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(newColor);
    }, 300);
  };

  const colorStr = `rgb(${localColor.r}, ${localColor.g}, ${localColor.b})`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => !disabled && setIsExpanded(!isExpanded)}
          disabled={disabled}
          className={`
            w-8 h-8 rounded-lg border-2 border-zinc-600 transition-transform
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
          `}
          style={{ backgroundColor: colorStr }}
          aria-label="Toggle color picker"
        />
        <span className="text-sm text-zinc-400">
          {isExpanded ? "Click swatch to close" : "Click to pick color"}
        </span>
      </div>

      {isExpanded && !disabled && (
        <div className="pt-2">
          <RgbColorPicker color={localColor} onChange={handleChange} />
        </div>
      )}
    </div>
  );
}
