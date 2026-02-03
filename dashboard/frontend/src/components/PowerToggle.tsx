interface PowerToggleProps {
  isOn: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}

export function PowerToggle({ isOn, onChange, disabled }: PowerToggleProps) {
  return (
    <button
      onClick={() => onChange(!isOn)}
      disabled={disabled}
      className={`
        relative w-14 h-7 rounded-full transition-all duration-200
        ${isOn ? "bg-emerald-500" : "bg-zinc-700"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-90"}
      `}
      aria-label={isOn ? "Turn off" : "Turn on"}
    >
      <span
        className={`
          absolute top-1 w-5 h-5 rounded-full bg-white shadow-md
          transition-all duration-200
          ${isOn ? "left-8" : "left-1"}
        `}
      />
    </button>
  );
}
