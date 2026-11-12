import { motion } from "framer-motion";
import { useId } from "react";
import { spring } from "../../lib/motion";
import { sfx } from "../../lib/sound";

/** A switch with a spring knob. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="toggle"
      onClick={() => {
        sfx.toggle(!checked);
        onChange(!checked);
      }}
    >
      <motion.span layout transition={spring} />
    </button>
  );
}

/** Pick one of a few; the highlight slides between options. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => {
            if (o.value === value) return;
            sfx.tap();
            onChange(o.value);
          }}
        >
          {o.value === value && (
            <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={spring} />
          )}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
