"use client";

import type { ReactNode } from "react";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  padding = "p-5",
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]",
        padding,
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {children}
      </h2>
      {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
    </div>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[var(--muted)]">{children}</p>;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  onClick,
  type = "button",
  variant = "secondary",
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-dark)] border-transparent",
    secondary:
      "bg-[var(--card)] text-[var(--ink)] border-[var(--border-strong)] hover:bg-[var(--card-soft)]",
    ghost:
      "bg-transparent text-[var(--ink-soft)] border-transparent hover:bg-[var(--track)]",
    danger:
      "bg-transparent text-[var(--expense)] border-[var(--border-strong)] hover:bg-[var(--expense-soft)]",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[10px] border px-3.5 py-2 text-[13px] font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

type Tone = "accent" | "income" | "expense" | "warn" | "neutral";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    accent: "bg-[var(--accent-soft)] text-[var(--accent-dark)] dark:text-[var(--accent-glow)]",
    income: "bg-[var(--income-soft)] text-[var(--income)]",
    expense: "bg-[var(--expense-soft)] text-[var(--expense)]",
    warn: "bg-[var(--gold-soft)] text-[var(--warn)]",
    neutral: "bg-[var(--track)] text-[var(--ink-soft)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  ratio,
  tone = "accent",
  height = "h-2.5",
}: {
  ratio: number;
  tone?: Tone;
  height?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const tones: Record<Tone, string> = {
    accent: "bg-[var(--accent)]",
    income: "bg-[var(--income)]",
    expense: "bg-[var(--expense)]",
    warn: "bg-[var(--gold)]",
    neutral: "bg-[var(--muted-light)]",
  };
  return (
    <div
      className={cx("w-full overflow-hidden rounded-full bg-[var(--track)]", height)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-300", tones[tone])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "income" | "expense" | "neutral";
}) {
  const colors = {
    income: "text-[var(--income)]",
    expense: "text-[var(--expense)]",
    neutral: "text-[var(--ink)]",
  };
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p
        className={cx(
          "mt-1 text-lg font-bold tabular-nums",
          colors[tone ?? "neutral"],
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--card-soft)] px-6 py-10 text-center">
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      {children ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--muted)]">{children}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  error,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-xs font-medium text-[var(--expense)]">{error}</span>
      ) : hint ? (
        <span className="text-xs text-[var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputBase =
  "rounded-[10px] border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--accent)]";

export const inputClass = cx(inputBase, "w-full");

/** Same look without a width, so a select can size itself inside a row. */
export const inputInlineClass = cx(inputBase, "w-auto cursor-pointer");
