import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useEffect } from "react";

/* --------------------------------------------------------------- Badge */

type Tone = "green" | "amber" | "blue" | "red" | "gray";

const TONE_CLASS: Record<Tone, string> = {
  green: "badge-green",
  amber: "badge-amber",
  blue: "badge-blue",
  red: "badge-red",
  gray: "badge-gray",
};

export function Badge({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{children}</span>;
}

/* --------------------------------------------------------------- Buttons */

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger" | "ghost";
}

export function Button({
  variant = "default",
  className = "",
  ...rest
}: BtnProps) {
  const cls =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? "btn-danger"
        : variant === "ghost"
          ? "btn-ghost"
          : "";
  return (
    <button
      className={`btn ${cls} ${className}`.trim()}
      type="button"
      {...rest}
    />
  );
}

/* --------------------------------------------------------------- Fields */

function fieldShell(label: string, required: boolean, hint?: string) {
  return (
    <>
      <span className="field-label">
        {label}
        {required && <em>*</em>}
      </span>
      {hint && <small className="field-hint">{hint}</small>}
    </>
  );
}

interface FieldWrapperProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

function FieldWrapper({
  label,
  required = false,
  hint,
  children,
}: FieldWrapperProps) {
  return (
    <label className="field">
      {fieldShell(label, required, hint)}
      {children}
    </label>
  );
}

const inputCls = (invalid?: boolean) => (invalid ? "input invalid" : "input");

interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "children"> {
  label: string;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
}

export function TextField({
  label,
  required,
  hint,
  invalid,
  className,
  ...rest
}: TextFieldProps) {
  return (
    <FieldWrapper label={label} required={required} hint={hint}>
      <input className={`${inputCls(invalid)} ${className ?? ""}`.trim()} {...rest} />
    </FieldWrapper>
  );
}

interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  required?: boolean;
  hint?: string;
  options: string[];
  allowCustom?: boolean;
}

export function SelectField({
  label,
  required,
  hint,
  options,
  allowCustom,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldWrapper label={label} required={required} hint={hint}>
      <select className="input" {...rest}>
        {allowCustom && <option value="">— 请选择 / 可直接输入 —</option>}
        {!allowCustom && <option value="">请选择…</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  label: string;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
}

export function NumberField({
  label,
  required,
  hint,
  invalid,
  ...rest
}: NumberFieldProps) {
  return (
    <FieldWrapper label={label} required={required} hint={hint}>
      <input type="number" className={inputCls(invalid)} {...rest} />
    </FieldWrapper>
  );
}

interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "children"> {
  label: string;
  required?: boolean;
  hint?: string;
  invalid?: boolean;
}

export function TextAreaField({
  label,
  required,
  hint,
  invalid,
  ...rest
}: TextAreaFieldProps) {
  return (
    <FieldWrapper label={label} required={required} hint={hint}>
      <textarea className={invalid ? "input textarea invalid" : "input textarea"} {...rest} />
    </FieldWrapper>
  );
}

/* --------------------------------------------------------------- Modal */

interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 680,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: `min(${width}px, calc(100vw - 28px))` }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle}
          </div>
          <button className="modal-x" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="form-error">{children}</p>;
}
