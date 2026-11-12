"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { t as translate, type LanguageCode } from "@/lib/i18n";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import {
  emptyLedger,
  loadLedger,
  parseLedger,
  saveLedger,
  setAppearance,
} from "@/lib/store";
import type { Appearance, LedgerData, PaletteName } from "@/lib/types";

interface LedgerContextValue {
  data: LedgerData;
  ready: boolean;
  update: (updater: (current: LedgerData) => LedgerData) => void;
  appearance: Appearance;
  setPalette: (palette: PaletteName) => void;
  setMode: (mode: "light" | "dark") => void;
  setLanguage: (language: LanguageCode) => void;
  setCurrency: (currency: string) => void;
  t: (text: string, ...values: readonly unknown[]) => string;
  money: (cents: number) => string;
  moneyCompact: (cents: number) => string;
  replaceAll: (next: LedgerData) => void;
  importData: (raw: unknown) => void;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LedgerData>(emptyLedger);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadLedger());
    setReady(true);
  }, []);

  const persist = useCallback((next: LedgerData) => {
    setData(next);
    saveLedger(next);
  }, []);

  const update = useCallback(
    (updater: (current: LedgerData) => LedgerData) => {
      setData((current) => {
        const next = updater(current);
        saveLedger(next);
        return next;
      });
    },
    [],
  );

  const appearance = data.appearance;

  // Mirror the appearance onto <html> so plain CSS tokens pick it up.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", appearance.mode === "dark");
    root.dataset.palette = appearance.palette;
    root.lang = appearance.language;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", appearance.mode === "dark" ? "#0e1622" : "#f6f8fc");
    }
  }, [appearance.mode, appearance.palette, appearance.language]);

  const value = useMemo<LedgerContextValue>(() => {
    const language = appearance.language;
    return {
      data,
      ready,
      update,
      appearance,
      setPalette: (palette) => persist(setAppearance(data, { palette })),
      setMode: (mode) => persist(setAppearance(data, { mode })),
      setLanguage: (lang) => persist(setAppearance(data, { language: lang })),
      setCurrency: (currency) => persist(setAppearance(data, { currency })),
      t: (text, ...values) => translate(language, text, ...values),
      money: (cents) => formatMoney(cents, appearance.currency),
      moneyCompact: (cents) => formatMoneyCompact(cents, appearance.currency),
      replaceAll: persist,
      importData: (raw) => persist(parseLedger(raw)),
    };
  }, [appearance, data, persist, ready, update]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const context = useContext(LedgerContext);
  if (!context) throw new Error("useLedger must be used inside LedgerProvider");
  return context;
}
