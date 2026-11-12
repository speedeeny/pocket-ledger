import type { Metadata, Viewport } from "next";

import { LedgerProvider } from "@/components/ledger-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pocket Ledger",
  description:
    "Work out how much you can spend each month so your money lasts as long as you need it to. Private by design: your data never leaves your browser.",
  applicationName: "Pocket Ledger",
  keywords: ["budget", "money", "planning", "personal finance", "offline"],
  authors: [{ name: "Pocket Ledger" }],
};

export const viewport: Viewport = {
  themeColor: "#f6f8fc",
  width: "device-width",
  initialScale: 1,
};

/** Applies the saved appearance before first paint to avoid a flash. */
const themeScript = `
(function () {
  try {
    var raw = localStorage.getItem("pocket-ledger/v2");
    if (!raw) return;
    var appearance = (JSON.parse(raw) || {}).appearance || {};
    var root = document.documentElement;
    if (appearance.mode === "dark") root.classList.add("dark");
    if (appearance.palette) root.dataset.palette = appearance.palette;
    if (appearance.language) root.lang = appearance.language;
  } catch (error) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <LedgerProvider>{children}</LedgerProvider>
      </body>
    </html>
  );
}
