import { forwardRef, type InputHTMLAttributes } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`no-drag w-full rounded-lg border border-edge bg-raised px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent/60 focus:ring-1 focus:ring-accent/30 ${className}`}
      {...props}
    />
  ),
);
Input.displayName = "Input";
export default Input;
