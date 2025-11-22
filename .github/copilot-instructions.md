# Copilot / AI Agent Instructions — expo-sqlite-tasks

Purpose
- Small Expo React Native app that stores local expenses in SQLite (ExpenseScreen.js).
- Primary goal: assist contributors and automated agents to make safe, focused changes (DB, UI, small features) quickly.

Big picture
- Single-screen, Expo-managed React Native app. Main screen: c:\Users\austi\Documents\expo-sqlite-tasks\ExpenseScreen.js
- Database access is via a SQLite context/hooks abstraction (used as `db.execAsync`, `db.runAsync`, `db.getAllAsync`).
- Persistent data model: `expenses` table with (id, amount, category, note). UI also shows a Date field but DB schema currently lacks a `date` column — see "Common fixes" below.

Where to look first
- Expense list + CRUD patterns: ExpenseScreen.js
- Styling: inline StyleSheet in ExpenseScreen.js (dark theme colors, tailwind-like palette).
- DB helpers: search for `useSQLiteContext`, `execAsync`, `runAsync`, `getAllAsync` in the repo.

How to run & debug (typical)
- Install deps: run `npm install` or `yarn` from repo root.
- Start Expo: `npx expo start` (or `expo start` if globally installed).
- Open on device/simulator via Metro UI or QR.
- View logs: use the Expo CLI Metro logs; for native logs use `npx react-native log-android` / `log-ios` only if ejecting.
- Fast feedback loop: make small code changes, reload in Expo client.

Project-specific conventions & patterns (do these)
- DB calls are async and mutate local state; after any change that modifies the DB, call the relevant loader (e.g., `loadExpenses()` in ExpenseScreen.js).
- Use numeric coercion and validation before inserting amounts (see addExpense logic).
- Keep UI and DB code in the same screen for small features; prefer minimal migrations when altering schema.

Concrete examples & patterns

1) Typical query pattern
- SELECT: `await db.getAllAsync('SELECT * FROM expenses ORDER BY id DESC;')`
- INSERT: `await db.runAsync('INSERT INTO expenses (amount, category, note) VALUES (?, ?, ?);', [amount, category, note])`
- DELETE: `await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id])`
- Schema creation: `await db.execAsync(\`CREATE TABLE IF NOT EXISTS expenses (...)\`);`

2) Fixing the Date mismatch (common task)
- Symptom: UI has a Date field but DB doesn't store it.
- Minimal migration steps an agent can apply:
  - Add column (runs safely if column missing): `ALTER TABLE expenses ADD COLUMN date TEXT;`
  - Update table creation SQL to include `date TEXT` (so new installs create it correctly).
  - Update INSERT/SELECT statements to include `date` parameter.
- Example SQL to run once from code (guarded by try/catch):
  - `await db.execAsync('ALTER TABLE expenses ADD COLUMN date TEXT;');`

3) Safe DB change pattern
- Run an idempotent CREATE TABLE that includes new columns for fresh installs.
- For existing DBs, run `ALTER TABLE ... ADD COLUMN ...` wrapped in try/catch to avoid breaking deployed users.

Search tokens & quick jump targets
- "useSQLiteContext" — where DB context is consumed.
- "execAsync", "runAsync", "getAllAsync" — DB API surface used everywhere in this app.
- "ExpenseScreen.js" — primary screen to edit for features around expenses.

When to open a PR vs. small patch
- Small UI/db edits and migrations: single commit + brief PR referencing the DB change.
- Larger architecture changes: propose in an issue first (there is no test harness in repo).

What I won't assume
- No tests or CI config discovered — do not add heavy test infra without asking maintainers.
- Do not assume an eject from Expo; keep changes compatible with managed Expo unless explicitly requested.

If anything is unclear or you want me to include more examples (e.g., a ready-to-apply code snippet to migrate the DB and update ExpenseScreen.js), say which area to expand and I will iterate.
