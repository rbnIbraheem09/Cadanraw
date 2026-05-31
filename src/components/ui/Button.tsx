import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-deep hover:brightness-110 font-semibold",
  ghost: "text-ink-dim hover:bg-raised hover:text-ink",
  danger: "bg-red-500/90 text-white hover:bg-red-500 font-semibold",
};

export default function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`no-drag inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
