# Pocket Ledger

A calm, private place to plan how far your money must stretch — and then to
keep to that plan.

Pocket Ledger answers one question: **how much can I spend each month so my
money lasts as long as I need it to?**

It runs entirely in your browser. There is no account, no server, no database
and no telemetry — your ledger lives in this browser's local storage and never
leaves the device.

## Deploying to Vercel

The app is a standard Next.js project, so Vercel needs no configuration at all.

1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Keep the detected defaults (**Framework Preset: Next.js**) and press
   **Deploy**.

That is the whole setup — there are no environment variables, no database and
no build flags to set. Pushing to `main` afterwards redeploys automatically.

From the command line instead:

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

## Running locally

Requires Node.js 18.18 or newer.

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

| Command             | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Development server with hot reload          |
| `npm run build`     | Production build                            |
| `npm start`         | Serve the production build                  |
| `npm test`          | Run the unit tests (Vitest)                 |
| `npm run lint`      | Type-check the project (`tsc --noEmit`)     |

## What's inside

| Page         | What it does                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Plan**     | Set the money you have, how many months it must cover and the costs that repeat every month; the app works out what is left to spend freely, and tracks every month against that allowance |
| **Spending** | Log what you spend, with the month's allowance and over-plan warnings right above the entries                                  |
| **Settings** | Language, appearance (light/dark plus five accent palettes), currency, categories, CSV export, JSON backup and restore          |

Money is stored as integer cents and dates as ISO strings, so totals never
drift.

Currency is display-only: pick USD, EUR, GBP, CZK, PLN, JPY or INR and every
screen redraws immediately. CZK and PLN print after the amount
(`1,234.50 Kč`); nothing is converted, so stored cents stay exact.

## Planning your money

You describe the situation once:

- **Money you have** — the pot the plan must spend from, e.g. `100 000`.
- **How many months** — the horizon, e.g. `6`.
- **Regular monthly income** — optional, for money that arrives each month.
- **Monthly costs** — the recurring expenses, e.g. rent `12 000` and food
  `5 000`.

Everything is then arithmetic you can check by hand:

```
resources      = money you have + monthly income × months
commitments    = sum of monthly costs × months
spare          = resources − commitments
free spending  = spare ÷ months            (0 if spare is negative)
```

With the example above, `17 000 × 6 = 102 000` is more than the `100 000`
available, so the plan says plainly that it **does not fit** and reports the
`2 000` shortfall instead of quietly showing a comfortable number.

The plan has four states:

| Status           | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| **Does not fit** | The recurring costs alone exceed the money, so nothing is free and the shortfall is stated    |
| **Tight**        | It fits, but free spending is under a tenth of the recurring costs                           |
| **On track**     | Every month is covered and there is real money to spend freely                               |
| **No plan yet**  | Nothing has been set, so the app explains what to enter first                                |

### Keeping to the plan

Once the plan exists you only log spending. Every entry is matched to a
category, and categories used as monthly costs count against the reserved
amount; everything else counts against free spending. Each month therefore has
a planned total — reserved costs plus free spending — and the Plan and Spending
pages show it as a progress bar:

- **Within the plan** — spending is under the month's allowance.
- **Near the limit** — at least 85% of the allowance is used.
- **Over the plan** — the month is over; the exact amount is shown and the app
  suggests taking it from next month's free spending.

"Money left" is always real money: starting money plus income for the months
that have begun, minus everything actually spent.

## Your data

Everything lives in this browser's **local storage** under the key
`pocket-ledger/v2`.

- **Export everything…** writes a CSV that opens in Excel, Numbers or any
  spreadsheet.
- **Back up…** writes a complete JSON snapshot.
- **Import a backup** restores such a snapshot, replacing the current data.
- **Reset everything** clears the ledger and starts over.

Because the data belongs to the browser, it is per device and per browser
profile. Clearing site data removes it — take a backup first. Private browsing
windows start empty and discard their data when closed.

## Language

The interface speaks **English** and **Čeština**. A new visitor gets the
language of their browser; after that the choice is saved and the picker on
**Settings → Language** switches it live.

Dates and month names follow the language too (`23/10/2026` versus
`23. 10. 2026`), and plural forms use the Czech 1 / 2–4 / 5+ rule.

Only the interface is translated. What you type stays exactly as typed, and so
do stored values such as payment methods; the categories seeded on first run
are stored in English and displayed translated, so a rename is yours in both
languages.

## Project layout

```
src/app/layout.tsx           root layout, metadata, no-flash theme script
src/app/(app)/layout.tsx     app shell (sidebar, top bar, footer)
src/app/(app)/plan/          the plan page
src/app/(app)/spending/      the spending log
src/app/(app)/settings/      appearance, categories, data management
src/lib/types.ts             records, defaults and domain types
src/lib/money.ts             parsing and formatting of integer cents
src/lib/dates.ts             ISO dates, month arithmetic, month bounds
src/lib/plan.ts              the budget model and month schedule
src/lib/store.ts             local-storage persistence and validation
src/lib/i18n.ts              translation lookup, plurals, dates
src/lib/catalogue.ts         English keys and the Czech catalogue
src/components/              shell, design-system primitives, provider
tests/                       unit tests for money, dates, plan and store
```

## Tests

```bash
npm test
```

The suite covers amount parsing (decimal commas, thousands separators,
currency symbols, half-up rounding), money formatting (prefix and suffix
currencies), ISO date parsing and month arithmetic, translation lookup with
Czech plural forms, the whole plan model (shortfalls, income, the tight
threshold, real spending per month, month verdicts), and the storage layer
(validation, category rules, moving entries when a category is deleted, JSON
round-trips and CSV export).
