"use client";

import { useRef, useState } from "react";

import { useLedger } from "@/components/ledger-provider";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Caption,
  Field,
  Stat,
  cx,
  inputClass,
} from "@/components/ui";
import { ValidationError } from "@/lib/errors";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money";
import {
  addCategory,
  deleteCategory,
  emptyLedger,
  exportCsv,
  parseLedger,
  updateCategory,
} from "@/lib/store";
import type { Kind, PaletteName } from "@/lib/types";

const PALETTES: Array<{ name: PaletteName; label: string; swatch: string }> = [
  { name: "emerald", label: "Emerald", swatch: "#0DA678" },
  { name: "ocean", label: "Ocean", swatch: "#1C7ED6" },
  { name: "violet", label: "Violet", swatch: "#7048E8" },
  { name: "amber", label: "Amber", swatch: "#C77C0A" },
  { name: "rose", label: "Rose", swatch: "#D6457A" },
];

export default function SettingsPage() {
  const {
    data,
    update,
    replaceAll,
    t,
    appearance,
    setMode,
    setPalette,
    setLanguage,
    setCurrency,
    ready,
  } = useLedger();

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!ready) return null;

  const onExport = () => {
    const csv = exportCsv(data.transactions, data);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pocket-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(t("Backup exported"));
  };

  const onBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pocket-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(t("Backup exported"));
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseLedger(JSON.parse(text));
      replaceAll(parsed);
      setStatus(t("Data imported"));
      setError(null);
    } catch {
      setError(t("That file is not a Pocket Ledger backup."));
      setStatus(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("Settings")}</h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          {t("Make it yours, and keep a copy of your data.")}
        </p>
      </header>

      {status ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--income-soft)] px-4 py-2.5 text-sm font-medium text-[var(--income)]">
          {status}
        </div>
      ) : null}

      <Card>
        <CardTitle>{t("Appearance")}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Mode")}>
            <div className="flex gap-2" role="group" aria-label={t("Mode")}>
              {(["light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMode(mode)}
                  aria-pressed={appearance.mode === mode}
                  className={cx(
                    "flex-1 rounded-[10px] border px-3 py-2 text-sm font-semibold transition-colors",
                    appearance.mode === mode
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)] dark:text-[var(--accent-glow)]"
                      : "border-[var(--border-strong)] bg-[var(--card)] text-[var(--ink-soft)] hover:bg-[var(--card-soft)]",
                  )}
                >
                  {mode === "light" ? t("Light") : t("Dark")}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("Colour")}>
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((palette) => (
                <button
                  key={palette.name}
                  type="button"
                  onClick={() => setPalette(palette.name)}
                  aria-pressed={appearance.palette === palette.name}
                  title={t(palette.label)}
                  className={cx(
                    "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    appearance.palette === palette.name
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border-strong)] hover:bg-[var(--card-soft)]",
                  )}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ background: palette.swatch }}
                  />
                  {t(palette.label)}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>{t("Language and currency")}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Language")} hint={t("Applies straight away — no restart needed")}>
            <select
              className={cx(inputClass, "cursor-pointer")}
              value={appearance.language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
            >
              {(Object.entries(LANGUAGES) as Array<[LanguageCode, string]>).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Currency")} hint={t("Display only — amounts stay exact")}>
            <select
              className={cx(inputClass, "cursor-pointer")}
              value={appearance.currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {CURRENCIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} {option.symbol} · {option.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <CategoriesCard
        data={data}
        onSaved={(next) => {
          setError(null);
          update(() => next);
        }}
        onError={setError}
        error={error}
      />

      <Card>
        <CardTitle>{t("Your data")}</CardTitle>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          {t(
            "Everything is stored in this browser's local storage. Clearing site data removes it, so export a backup now and then.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onExport}>
            {t("Export everything…")}
          </Button>
          <Button variant="secondary" onClick={onBackup}>
            {t("Back up…")}
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            {t("Import a backup")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImport(file);
              event.target.value = "";
            }}
          />
          {confirmReset ? (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  replaceAll(emptyLedger());
                  setConfirmReset(false);
                  setStatus(t("All data deleted"));
                }}
              >
                {t("Yes, delete it")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                {t("Keep it")}
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              {t("Reset everything")}
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {t("This cannot be undone.")}
        </p>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("Entries")} value={data.transactions.length} />
        <Stat label={t("Categories")} value={data.categories.length} />
        <Stat label={t("Version")} value="2.0" />
      </section>

      <Card>
        <CardTitle>{t("About Pocket Ledger")}</CardTitle>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          {t(
            "A calm, private place to plan how far your money must stretch. It runs entirely in your browser: no account, no server, no telemetry.",
          )}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          {t(
            "Money is stored as whole cents and dates as plain ISO strings, so totals never drift.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="accent">{t("This browser only")}</Badge>
          <Badge tone="income">{t("No tracking")}</Badge>
          <Badge tone="neutral">v2.0</Badge>
        </div>
      </Card>
    </div>
  );
}

function CategoriesCard({
  data,
  onSaved,
  onError,
  error,
}: {
  data: ReturnType<typeof useLedger>["data"];
  onSaved: (next: ReturnType<typeof useLedger>["data"]) => void;
  onError: (message: string | null) => void;
  error: string | null;
}) {
  const { t } = useLedger();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [color, setColor] = useState("#F97316");

  const add = () => {
    try {
      onSaved(addCategory(data, name, kind, color));
      setName("");
      onError(null);
    } catch (caught) {
      onError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  };

  const remove = (id: string) => {
    try {
      onSaved(deleteCategory(data, id));
      onError(null);
    } catch (caught) {
      onError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  };

  const rename = (id: string, value: string) => {
    try {
      onSaved(updateCategory(data, id, { name: value }));
      onError(null);
    } catch (caught) {
      onError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  };

  return (
    <Card>
      <CardTitle hint={`${data.categories.length}`}>{t("Categories")}</CardTitle>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {data.categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--card-soft)] px-2 py-1.5"
          >
            <input
              type="color"
              value={category.color}
              aria-label={t("Colour")}
              className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              onChange={(event) =>
                onSaved(updateCategory(data, category.id, { color: event.target.value }))
              }
            />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              defaultValue={category.name}
              aria-label={t("Name")}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value && value !== category.name) rename(category.id, value);
                else event.target.value = category.name;
              }}
            />
            <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
              {category.kind === "income" ? t("Income") : t("Expense")}
            </span>
            <button
              type="button"
              onClick={() => remove(category.id)}
              className="shrink-0 rounded px-1 text-[var(--muted)] hover:text-[var(--expense)]"
              aria-label={`${t("Delete")} ${category.name}`}
              title={t("Delete")}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_150px_auto_auto]">
        <input
          className={inputClass}
          placeholder={t("New category")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          aria-label={t("New category")}
        />
        <select
          className={cx(inputClass, "cursor-pointer")}
          value={kind}
          onChange={(event) => setKind(event.target.value as Kind)}
          aria-label={t("Type")}
        >
          <option value="expense">{t("Expense")}</option>
          <option value="income">{t("Income")}</option>
        </select>
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          aria-label={t("Colour")}
          className="h-10 w-12 cursor-pointer rounded-[10px] border border-[var(--border-strong)] bg-transparent p-0.5"
        />
        <Button variant="primary" onClick={add} disabled={!name.trim()}>
          {t("Save category")}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-[var(--expense)]">{error}</p> : null}
      <Caption>{t("Monthly costs are edited on the Plan page")}</Caption>
    </Card>
  );
}
