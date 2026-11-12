import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "soft" | "danger";

export default function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`btn btn-${variant} press no-drag ${className}`} {...props} />;
}
