"use client";

import { useMemo, useState } from "react";

import { useLedger } from "@/components/ledger-provider";
import { MonthStepper } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Field,
  ProgressBar,
  Stat,
  cx,
  inputClass,
  inputInlineClass,
} from "@/components/ui";
import { addMonths, monthBounds, today } from "@/lib/dates";
import { ValidationError } from "@/lib/errors";
import { formatDayMonth, methodLabel, monthLabel } from "@/lib/i18n";
import { categoryLabel } from "@/lib/labels";
import { buildPlan, monthState, monthStateView, totalsInMonth } from "@/lib/plan";
import {
  addTransaction,
  deleteTransaction,
  filterTransactions,
  updateTransaction,
  type TransactionInput,
} from "@/lib/store";
import { parseAmount } from "@/lib/money";
import { METHODS, type Kind, type Transaction } from "@/lib/types";

const EMPTY_DRAFT: TransactionInput = {
  date: "",
  kind: "expense",
  amountCents: 0,
  categoryId: "",
  note: "",
  method: "Card",
};

export default function SpendingPage() {
  const { data, update, t, money, appearance, ready } = useLedger();
  const now = useMemo(() => today(), []);
  const [month, setMonth] = useState<[number, number]>([
    Number(now.slice(0, 4)),
    Number(now.slice(5, 7)),
  ]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [start, end] = monthBounds(month[0], month[1]);

  // Seeded category names are stored in English and translated for display.
  const categoryName = (category?: { name: string }, fallback = "") =>
    category ? categoryLabel(appearance.language, category.name) : fallback;

  const rows = useMemo(
    () =>
      filterTransactions(data, {
        search,
        kind: kind || null,
        categoryId: categoryId || null,
        start,
        end,
      }),
    [data, search, kind, categoryId, start, end],
  );

  const totals = useMemo(
    () => totalsInMonth(data.transactions, month[0], month[1]),
    [data.transactions, month],
  );

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

  if (!ready) return null;

  const state = monthState(plan.schedule, month[0], month[1]);
  const view = state ? monthStateView(state) : null;

  const submit = (draft: TransactionInput) => {
    try {
      update((current) =>
        editing
          ? updateTransaction(current, editing.id, draft)
          : addTransaction(current, draft),
      );
      setFormOpen(false);
      setEditing(null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  };

  const remove = (transaction: Transaction) => {
    update((current) => deleteTransaction(current, transaction.id));
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Spending")}</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {t("Log what you spend and see it against the plan")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthStepper
            label={monthLabel(appearance.language, month[0], month[1])}
            onChange={(delta) => {
              const [year, next] = addMonths(month[0], month[1], delta);
              setMonth([year, next]);
            }}
          />
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + {t("Add spending")}
          </Button>
        </div>
      </header>

      {view && state ? (
        <Card className="bg-[var(--accent-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                {t("This month's plan")}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{money(view.plannedCents)}</p>
              <p className="text-sm text-[var(--ink-soft)]">
                {t("{} of {} used", money(view.spentCents), money(view.plannedCents))}
              </p>
            </div>
            <Badge
              tone={
                view.verdict === "over" ? "expense" : view.verdict === "near" ? "warn" : "income"
              }
            >
              {view.verdict === "over"
                ? t("OVER THE PLAN")
                : view.verdict === "near"
                  ? t("NEAR THE LIMIT")
                  : t("WITHIN THE PLAN")}
            </Badge>
          </div>
          <div className="mt-3">
            <ProgressBar
              ratio={view.ratio}
              tone={view.verdict === "over" ? "expense" : view.verdict === "near" ? "warn" : "income"}
            />
          </div>
          <p
            className={cx(
              "mt-2 text-sm",
              view.overCents > 0 ? "font-semibold text-[var(--expense)]" : "text-[var(--ink-soft)]",
            )}
          >
            {view.overCents > 0
              ? t("{} over the plan for this month.", money(view.overCents))
              : t("{} still available this month.", money(view.remainingCents))}
          </p>
        </Card>
      ) : (
        <Card className="bg-[var(--card-soft)]">
          <p className="text-sm text-[var(--muted)]">
            {t("This month is outside the plan's dates. Spending is still recorded normally.")}
          </p>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("Income")} value={money(totals.income)} tone="income" />
        <Stat label={t("Expenses")} value={money(totals.expense)} tone="expense" />
        <Stat
          label={t("NET")}
          value={money(totals.net)}
          tone={totals.net < 0 ? "expense" : "income"}
          hint={`${totals.count} ${totals.count === 1 ? t("entry") : t("entries")}`}
        />
      </section>

      {formOpen ? (
        <TransactionForm
          data={data}
          initial={editing}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
            setError(null);
          }}
          onSubmit={submit}
          error={error}
          defaultDate={now}
          key={editing?.id ?? "new"}
        />
      ) : null}

      <Card padding="p-0">
        <div className="flex flex-wrap items-end gap-2 border-b border-[var(--border)] p-4">
          <div className="min-w-[180px] flex-1">
            <label className="sr-only" htmlFor="search">
              {t("Search")}
            </label>
            <input
              id="search"
              className={inputClass}
              placeholder={t("Search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className={cx(inputInlineClass, "min-w-[130px]")}
            value={kind}
            onChange={(event) => setKind(event.target.value as Kind | "")}
            aria-label={t("All types")}
          >
            <option value="">{t("All types")}</option>
            <option value="expense">{t("Expense")}</option>
            <option value="income">{t("Income")}</option>
          </select>
          <select
            className={cx(inputInlineClass, "min-w-[160px]")}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label={t("All categories")}
          >
            <option value="">{t("All categories")}</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryName(category)}
              </option>
            ))}
          </select>
          {search || kind || categoryId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setKind("");
                setCategoryId("");
              }}
            >
              {t("Clear")}
            </Button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState title={t("There is nothing to show.")}>
              {t("Nothing here yet. Try another month or clear the filters.")}
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card-soft)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-2 font-semibold">{t("Date")}</th>
                  <th className="px-3 py-2 font-semibold">{t("Category")}</th>
                  <th className="px-3 py-2 font-semibold">{t("Details")}</th>
                  <th className="px-3 py-2 font-semibold">{t("Method")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("Amount")}</th>
                  <th className="px-4 py-2 text-right font-semibold">
                    <span className="sr-only">{t("Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => {
                  const category = data.categories.find((c) => c.id === tx.categoryId);
                  return (
                    <tr
                      key={tx.id}
                      className="group border-b border-[var(--border)] last:border-0 hover:bg-[var(--card-soft)]"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-[var(--ink-soft)]">
                        {formatDayMonth(appearance.language, tx.date, true)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: category?.color ?? "#64748B" }}
                          />
                          <span className="truncate font-medium">
                            {category ? categoryName(category) : t("Unknown")}
                          </span>
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 text-[var(--muted)]">
                        {tx.note || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--muted)]">
                        {methodLabel(appearance.language, tx.method)}
                      </td>
                      <td
                        className={cx(
                          "whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums",
                          tx.kind === "income" ? "text-[var(--income)]" : "text-[var(--ink)]",
                        )}
                      >
                        {tx.kind === "income" ? "+" : "−"}
                        {money(tx.amountCents)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-[var(--muted)] hover:text-[var(--ink)]"
                            onClick={() => {
                              setEditing(tx);
                              setFormOpen(true);
                            }}
                            title={t("Edit")}
                          >
                            {t("Edit")}
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-[var(--muted)] hover:text-[var(--expense)]"
                            onClick={() => remove(tx)}
                            title={t("Delete")}
                          >
                            {t("Delete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function TransactionForm({
  data,
  initial,
  onCancel,
  onSubmit,
  error,
  defaultDate,
}: {
  data: ReturnType<typeof useLedger>["data"];
  initial: Transaction | null;
  onCancel: () => void;
  onSubmit: (draft: TransactionInput) => void;
  error: string | null;
  defaultDate: string;
}) {
  const { t } = useLedger();
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "expense");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2) : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [method, setMethod] = useState(initial?.method ?? "Card");
  const [localError, setLocalError] = useState<string | null>(null);

  const options = data.categories.filter((category) => category.kind === kind);

  const submit = () => {
    try {
      const category = categoryId || options[0]?.id || "";
      onSubmit({
        date,
        kind,
        amountCents: parseAmount(amount),
        categoryId: category,
        note,
        method,
      });
    } catch (caught) {
      setLocalError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  };

  return (
    <Card className="border-[var(--accent)]">
      <CardTitle>{initial ? t("Edit entry") : t("New entry")}</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("Type")}>
          <select
            className={cx(inputClass, "cursor-pointer")}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as Kind);
              setCategoryId("");
            }}
          >
            <option value="expense">{t("Expense")}</option>
            <option value="income">{t("Income")}</option>
          </select>
        </Field>
        <Field label={t("Date")}>
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label={t("Amount")}>
          <input
            className={inputClass}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
          />
        </Field>
        <Field label={t("Category")}>
          <select
            className={cx(inputClass, "cursor-pointer")}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{options[0]?.name ?? t("All categories")}</option>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Paid with")}>
          <select
            className={cx(inputClass, "cursor-pointer")}
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            {METHODS.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Note")}>
          <input
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("optional")}
            maxLength={500}
          />
        </Field>
      </div>
      {localError || error ? (
        <p className="mt-3 text-sm font-medium text-[var(--expense)]">{localError ?? error}</p>
      ) : null}
      <div className="mt-4 flex items-center gap-2">
        <Button variant="primary" onClick={submit}>
          {initial ? t("Save changes") : t("Save transaction")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("Cancel")}
        </Button>
      </div>
    </Card>
  );
}
