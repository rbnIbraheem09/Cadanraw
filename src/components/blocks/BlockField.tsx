import type { CSSProperties } from "react";
/** The editable hit area follows the rendered text, leaving the rest draggable. */
export default function BlockField({
  value,
  onChange,
  label,
  placeholder = "",
  title = false,
  multiline = false,
  readOnly = false,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  title?: boolean;
  multiline?: boolean;
  readOnly?: boolean;
  style?: CSSProperties;
}) {
  const classes = `block-text-field ${title ? "is-title" : ""} ${multiline ? "is-multiline" : ""}`;
  const props = {
    "aria-label": label,
    value,
    placeholder,
    readOnly,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    style,
  };
  return (
    <span className={classes}>
      <span className="block-field-measure" aria-hidden="true" style={style}>
        {value || placeholder || " "}
        {multiline ? "\u200b" : ""}
      </span>
      {multiline ? <textarea rows={1} {...props} /> : <input {...props} />}
    </span>
  );
}
