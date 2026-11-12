"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLedger } from "@/components/ledger-provider";
import { Button, cx } from "@/components/ui";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money";

const NAV = [
  { href: "/plan", key: "Plan", icon: PlanIcon },
  { href: "/spending", key: "Spending", icon: SpendingIcon },
  { href: "/settings", key: "Settings", icon: SettingsIcon },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, appearance, setLanguage, setCurrency, data } = useLedger();

  const languageOptions = Object.entries(LANGUAGES) as Array<[LanguageCode, string]>;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 bg-[var(--nav)] px-4 py-4 lg:w-[236px] lg:py-6">
        <Link
          href="/plan"
          className="mb-4 flex items-center gap-2.5 rounded-xl px-2 py-1 text-[var(--nav-text-active)]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--accent)] text-white">
            <WalletIcon />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold">Pocket Ledger</span>
            <span className="block text-[11px] text-[var(--nav-muted)]">
              {t("Private. Your money, your plan, your browser.")}
            </span>
          </span>
        </Link>

        <nav className="flex gap-1 lg:flex-col" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex flex-1 items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold transition-colors lg:flex-none",
                  active
                    ? "bg-[var(--nav-active)] text-[var(--nav-text-active)]"
                    : "text-[var(--nav-text)] hover:bg-[var(--nav-hover)] hover:text-[var(--nav-text-active)]",
                )}
              >
                <Icon />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden gap-2 lg:flex">
          <label className="sr-only" htmlFor="language">
            {t("Language")}
          </label>
          <select
            id="language"
            value={appearance.language}
            onChange={(event) => setLanguage(event.target.value as LanguageCode)}
            className="w-full cursor-pointer rounded-[10px] border border-[var(--nav-hover)] bg-[var(--nav-hover)] px-2.5 py-2 text-[12px] text-[var(--nav-text)] outline-none focus-visible:outline-[var(--accent)]"
          >
            {languageOptions.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar data={data} currency={appearance.currency} onCurrency={setCurrency} />
        <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-5 sm:px-6 lg:py-7">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

function TopBar({
  data,
  currency,
  onCurrency,
}: {
  data: { transactions: Array<{ date: string }> };
  currency: string;
  onCurrency: (code: string) => void;
}) {
  const { t } = useLedger();
  const months = [...new Set(data.transactions.map((tx) => tx.date.slice(0, 7)))].sort();
  const latest = months.at(-1);

  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-3 backdrop-blur sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-tight">{t("Pocket Ledger")}</h1>
        <p className="truncate text-xs text-[var(--muted)]">
          {latest
            ? `${months.length} ${months.length === 1 ? t("month") : t("months")} ${t("of data")}`
            : t("No entries yet")}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <label className="sr-only" htmlFor="currency">
          {t("Currency")}
        </label>
        <select
          id="currency"
          value={currency}
          onChange={(event) => onCurrency(event.target.value)}
          className="cursor-pointer rounded-[10px] border border-[var(--border-strong)] bg-[var(--card)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        >
          {CURRENCIES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.code} {option.symbol}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useLedger();
  return (
    <footer className="px-4 pb-6 pt-2 text-center text-[11px] text-[var(--muted)] sm:px-6">
      {t("Your data stays in this browser · no account, no server, no tracking")}
    </footer>
  );
}

export function MonthStepper({
  label,
  onChange,
}: {
  label: string;
  onChange: (delta: number) => void;
}) {
  const { t } = useLedger();
  return (
    <div className="flex items-center gap-1 rounded-[10px] border border-[var(--border-strong)] bg-[var(--card)] p-1">
      <Button variant="ghost" onClick={() => onChange(-1)} title={t("Previous month")}>
        <span aria-hidden>‹</span>
        <span className="sr-only">{t("Previous month")}</span>
      </Button>
      <span className="min-w-[132px] text-center text-[13px] font-semibold tabular-nums">
        {label}
      </span>
      <Button variant="ghost" onClick={() => onChange(1)} title={t("Next month")}>
        <span aria-hidden>›</span>
        <span className="sr-only">{t("Next month")}</span>
      </Button>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M3 9h15" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="14" r="1.4" fill="currentColor" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5m0 14h16M8 15l3.5-4 3 2.5L19 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.4 1.4M7.9 16.1l-1.4 1.4m11 0-1.4-1.4M7.9 7.9 6.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
