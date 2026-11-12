"use client";

import { useMemo, useState } from "react";

import { useLedger } from "@/components/ledger-provider";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Caption,
  EmptyState,
  Field,
  ProgressBar,
  Stat,
  cx,
  inputClass,
} from "@/components/ui";
import { addMonths, today } from "@/lib/dates";
import { ValidationError } from "@/lib/errors";
import { monthLabel } from "@/lib/i18n";
import { categoryLabel } from "@/lib/labels";
import {
  buildPlan,
  fixedMonthlyCents,
  freeMonthlyCents,
  moneyLeftCents,
  monthState,
  monthStateView,
  planMonthItems,
  planStatus,
  shortfallCents,
} from "@/lib/plan";
import { clearPlan, savePlanSettings, setPlanItem } from "@/lib/store";
import type { LanguageCode } from "@/lib/i18n";
import type { LedgerData } from "@/lib/types";

const STATUS_TONE = { ok: "income", tight: "warn", short: "expense", unset: "neutral" } as const;

const STATUS_LABEL: Record<string, string> = {
  ok: "On track",
  tight: "Tight",
  short: "Does not fit",
  unset: "No plan yet",
};

export default function PlanPage() {
  const { data, update, t, money, appearance, ready } = useLedger();
  const now = useMemo(() => today(), []);
  const [view, setView] = useState<[number, number]>([
    Number(now.slice(0, 4)),
    Number(now.slice(5, 7)),
  ]);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(
    () =>
      buildPlan({
        configured: data.plan.configured,
        startingCents: data.plan.startingCents,
        months: data.plan.months,
        incomeCents: data.plan.incomeCents,
        startYear: data.plan.startYear,
        startMonth: data.plan.startMonth,
        items: data.planItems,
        transactions: data.transactions,
        reference: now,
      }),
    [data, now],
  );

  if (!ready) return <PageSkeleton />;

  const status = planStatus(plan);
  const fixed = fixedMonthlyCents(plan);
  const free = freeMonthlyCents(plan);
  const left = moneyLeftCents(plan);
  const state = monthState(plan.schedule, view[0], view[1]);
  const monthView = state ? monthStateView(state) : null;

  const shift = (delta: number) => {
    const [year, month] = addMonths(view[0], view[1], delta);
    setView([year, month]);
  };

  const save = (next: LedgerData) => {
    setError(null);
    update(() => next);
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Plan")}</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {t("Plan how long your money must last")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {t("Status")}
          </span>
          <Badge tone={STATUS_TONE[status]}>{t(STATUS_LABEL[status])}</Badge>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("Money you have")} value={money(plan.startingCents)} hint={t("starting money")} />
        <Stat label={t("Reserved each month")} value={money(fixed)} hint={t("for rent, food and bills")} />
        <Stat
          label={t("Free spending")}
          value={money(free)}
          hint={t("to spread across the months")}
          tone={free > 0 ? "income" : "expense"}
        />
        <Stat
          label={t("Money left")}
          value={money(left)}
          hint={t("real money right now")}
          tone={left < 0 ? "expense" : "neutral"}
        />
      </section>

      {status === "unset" ? (
        <PlanForm data={data} onSaved={save} onError={setError} error={error} />
      ) : (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <CardTitle>{t(STATUS_LABEL[status])}</CardTitle>
              <p className="text-sm text-[var(--muted)]">{t(statusNote(status))}</p>
              {shortfallCents(plan) > 0 ? (
                <p className="mt-2 text-sm font-semibold text-[var(--expense)]">
                  {t("Short by {}", money(shortfallCents(plan)))}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {t("Months covered")}
              </p>
              <p className="text-lg font-bold tabular-nums">
                {plan.months} · {monthLabel(appearance.language, plan.startYear, plan.startMonth)}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {t("Planned monthly spend")} {money(fixed + free)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {status !== "unset" ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            <Card>
              <CardTitle hint={money(fixed)}>{t("Reserved costs")}</CardTitle>
              <MonthlyCosts
                data={data}
                year={view[0]}
                month={view[1]}
                language={appearance.language}
                onSaved={save}
                onError={setError}
                error={error}
              />
            </Card>

            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{monthLabel(appearance.language, view[0], view[1])}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={() => shift(-1)} title={t("Previous month")}>
                    ‹
                  </Button>
                  <Button variant="ghost" onClick={() => shift(1)} title={t("Next month")}>
                    ›
                  </Button>
                </div>
              </div>
              {monthView && state ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-[var(--muted)]">
                      {t("Spent")} {money(monthView.spentCents)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {money(monthView.plannedCents)}
                    </span>
                  </div>
                  <ProgressBar
                    ratio={monthView.ratio}
                    tone={
                      monthView.verdict === "over"
                        ? "expense"
                        : monthView.verdict === "near"
                          ? "warn"
                          : "income"
                    }
                  />
                  <p
                    className={cx(
                      "text-sm",
                      monthView.verdict === "over"
                        ? "font-semibold text-[var(--expense)]"
                        : "text-[var(--muted)]",
                    )}
                  >
                    {monthView.overCents > 0
                      ? t(
                          "{} over. Take it from next month's free spending.",
                          money(monthView.overCents),
                        )
                      : t("{} still available this month.", money(monthView.remainingCents))}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Stat
                      label={t("Free spending")}
                      value={money(monthView.freeRemainingCents)}
                      hint={t("this month only")}
                      tone={monthView.freeRemainingCents < 0 ? "expense" : "income"}
                    />
                    <Stat
                      label={t("Reserved costs")}
                      value={money(monthView.fixedRemainingCents)}
                      hint={t("left of the reserved amount")}
                      tone={monthView.fixedRemainingCents < 0 ? "expense" : "neutral"}
                    />
                  </div>
                </div>
              ) : (
                <EmptyState title={t("This month is outside the plan's dates.")}>
                  {t("Pick another month to see how it went.")}
                </EmptyState>
              )}
            </Card>
          </div>

          <MonthTable
            plan={plan}
            language={appearance.language}
            money={money}
            onPick={setView}
            active={view}
            t={t}
          />

          <PlanForm
            data={data}
            onSaved={save}
            onError={setError}
            error={error}
            compact
            onClear={() => update((current) => clearPlan(current))}
          />
        </>
      ) : null}
    </div>
  );
}

function statusNote(status: string): string {
  switch (status) {
    case "short":
      return "The money you have cannot cover the months you planned. Lower a monthly cost, shorten the plan or add income.";
    case "tight":
      return "It fits, but the free part is tiny next to your fixed costs. One surprise would break the plan.";
    default:
      return "The plan covers every month and leaves you something to spend freely.";
  }
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--track)]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-[var(--track)]" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-[var(--track)]" />
    </div>
  );
}

function PlanForm({
  data,
  onSaved,
  onError,
  error,
  compact,
  onClear,
}: {
  data: LedgerData;
  onSaved: (next: LedgerData) => void;
  onError: (message: string | null) => void;
  error: string | null;
  compact?: boolean;
  onClear?: () => void;
}) {
  const { t } = useLedger();
  const [starting, setStarting] = useState(toInput(data.plan.startingCents));
  const [months, setMonths] = useState(String(data.plan.months));
  const [income, setIncome] = useState(toInput(data.plan.incomeCents));
  const [confirmClear, setConfirmClear] = useState(false);

  const submit = () => {
    try {
      onSaved(
        savePlanSettings(data, { startingCents: starting, months, incomeCents: income }),
      );
    } catch (caught) {
      onError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  };

  return (
    <Card className={compact ? "border-dashed" : "border-[var(--accent)]"}>
      <CardTitle>{compact ? t("Change the plan") : t("Create a plan")}</CardTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("Money you have")} hint={t("for the whole period")}>
          <input
            className={inputClass}
            value={starting}
            onChange={(event) => setStarting(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
        </Field>
        <Field label={t("How many months")} hint={t("between 1 and 60")}>
          <input
            className={inputClass}
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </Field>
        <Field label={t("Regular monthly income")} hint={t("optional")}>
          <input
            className={inputClass}
            value={income}
            onChange={(event) => setIncome(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
        </Field>
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-[var(--expense)]">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={submit}>
          {t("Save plan")}
        </Button>
        {onClear ? (
          confirmClear ? (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
              >
                {t("Yes, delete it")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                {t("Keep it")}
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmClear(true)}>
              {t("Reset")}
            </Button>
          )
        ) : null}
        <Caption>{t("Nothing leaves this browser.")}</Caption>
      </div>
    </Card>
  );
}

function MonthlyCosts({
  data,
  year,
  month,
  language,
  onSaved,
  onError,
  error,
}: {
  data: LedgerData;
  year: number;
  month: number;
  language: LanguageCode;
  onSaved: (next: LedgerData) => void;
  onError: (message: string | null) => void;
  error: string | null;
}) {
  const { t, money } = useLedger();
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");

  const expenses = data.categories.filter((category) => category.kind === "expense");
  const rows = planMonthItems(data.planItems, data.transactions, year, month);
  const byId = new Map(data.categories.map((category) => [category.id, category]));

  // Seeded category names are stored in English and translated for display;
  // a name the user typed is shown as typed. See lib/labels.ts.
  const categoryName = (category?: { name: string }, fallback = "") =>
    category ? categoryLabel(language, category.name) : fallback;

  const add = () => {
    try {
      onSaved(setPlanItem(data, selected, amount));
      setAmount("");
      setSelected("");
      onError(null);
    } catch (caught) {
      onError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <EmptyState title={t("No monthly costs yet.")}>
          {t("Add rent, food and bills so the plan knows what is already taken.")}
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const category = byId.get(row.categoryId);
            const ratio = row.amountCents ? row.spentCents / row.amountCents : 0;
            return (
              <li key={row.categoryId} className="flex flex-col gap-1.5 py-2.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: category?.color ?? "#64748B" }}
                    />
                    {categoryName(category, row.categoryId)}
                  </span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {money(row.spentCents)} / {money(row.amountCents)}
                  </span>
                </div>
                <ProgressBar
                  ratio={ratio}
                  height="h-1.5"
                  tone={ratio >= 1 ? "expense" : ratio >= 0.85 ? "warn" : "accent"}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-2 pt-1 sm:grid-cols-[1fr_170px_auto]">
        <label className="sr-only" htmlFor="plan-category">
          {t("Category")}
        </label>
        <select
          id="plan-category"
          className={cx(inputClass, "cursor-pointer")}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">{t("Add a monthly cost")}</option>
          {expenses.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryName(category)}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          placeholder={t("Amount every month")}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          aria-label={t("Amount every month")}
        />
        <Button variant="primary" onClick={add} disabled={!selected || !amount.trim()}>
          {t("Save")}
        </Button>
      </div>
      {error ? <p className="text-sm font-medium text-[var(--expense)]">{error}</p> : null}
    </div>
  );
}

function MonthTable({
  plan,
  language,
  money,
  onPick,
  active,
  t,
}: {
  plan: ReturnType<typeof buildPlan>;
  language: LanguageCode;
  money: (cents: number) => string;
  onPick: (value: [number, number]) => void;
  active: [number, number];
  t: (text: string, ...values: readonly unknown[]) => string;
}) {
  return (
    <Card padding="p-0">
      <div className="px-5 pt-5">
        <CardTitle hint={t("real spending per month")}>{t("Month by month")}</CardTitle>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-y border-[var(--border)] bg-[var(--card-soft)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="px-5 py-2 font-semibold">{t("Month")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("Planned")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("Spent")}</th>
              <th className="px-5 py-2 text-right font-semibold">{t("Left")}</th>
            </tr>
          </thead>
          <tbody>
            {plan.schedule.map((state) => {
              const view = monthStateView(state);
              const isActive = state.year === active[0] && state.month === active[1];
              return (
                <tr
                  key={`${state.year}-${state.month}`}
                  onClick={() => onPick([state.year, state.month])}
                  className={cx(
                    "cursor-pointer border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--card-soft)]",
                    isActive && "bg-[var(--accent-soft)]",
                  )}
                >
                  <td className="px-5 py-2.5 font-medium">
                    {monthLabel(language, state.year, state.month)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--muted)]">
                    {money(view.plannedCents)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {state.started ? money(view.spentCents) : "—"}
                  </td>
                  <td
                    className={cx(
                      "px-5 py-2.5 text-right font-semibold tabular-nums",
                      view.overCents > 0 ? "text-[var(--expense)]" : "text-[var(--income)]",
                    )}
                  >
                    {state.started
                      ? view.overCents > 0
                        ? `−${money(view.overCents)}`
                        : money(view.remainingCents)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function toInput(cents: number): string {
  return cents ? (cents / 100).toFixed(2) : "";
}
