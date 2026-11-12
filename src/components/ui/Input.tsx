import { forwardRef, type InputHTMLAttributes } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} className={`field no-drag ${className}`} {...props} />
  ),
);
Input.displayName = "Input";
export default Input;
