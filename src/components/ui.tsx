"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius)] border p-4 ${className}`}
      style={{ background: "var(--surface)" }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider"
      style={{ color: "var(--muted)" }}
    >
      {children}
    </h2>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: ButtonProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "#1a1208", borderColor: "transparent" },
    ghost: { background: "var(--surface-2)", color: "var(--text)" },
    danger: { background: "transparent", color: "var(--danger)" },
  };
  return (
    <button
      {...rest}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
}) {
  const style: React.CSSProperties =
    variant === "primary"
      ? { background: "var(--accent)", color: "#1a1208", borderColor: "transparent" }
      : { background: "var(--surface-2)", color: "var(--text)" };
  return (
    <Link
      href={href}
      className="inline-block rounded-full border px-4 py-2 text-sm font-medium"
      style={style}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

const CONTROL =
  "w-full rounded-lg border px-3 py-2 outline-none focus:border-[var(--accent)]";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${CONTROL} ${props.className ?? ""}`}
      style={{ background: "var(--surface-2)" }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${CONTROL} ${props.className ?? ""}`}
      style={{ background: "var(--surface-2)" }}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${CONTROL} ${props.className ?? ""}`}
      style={{ background: "var(--surface-2)" }}
    />
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div
      className="rounded-[var(--radius)] border p-3"
      style={{ background: "var(--surface)" }}
    >
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && (
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "accent";
}) {
  const colors: Record<string, string> = {
    neutral: "var(--muted)",
    ok: "var(--ok)",
    warn: "var(--warn)",
    danger: "var(--danger)",
    accent: "var(--accent)",
  };
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ color: colors[tone], borderColor: colors[tone] }}
    >
      {children}
    </span>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: "var(--muted)" }}>
        {body}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}
