chek# Memory

This file stores durable project context that should be read at the start of every task and updated during and after work.

## Project Snapshot

- Project: DM hotel booking system
- Stack: Next.js 14 App Router, Supabase, TailwindCSS, Radix UI, React Query, Zod
- Main repo guidance also exists in `CLAUDE.md`

## Working Agreements

- `rules.md` is the task entry point.
- Available skills must be checked at the start of every task, and relevant skills must be used.
- `GUARDRAIL.md` is mandatory and must always be followed.
- `MEMORY.md` must be read before each task and updated when durable context changes and when the task is finished.

## Durable Context

- Public pages live under `src/app/(public)/`
- Admin dashboard pages live under `src/app/admin/(dashboard)/`
- API routes live under `src/app/api/`
- Supabase migrations live under `supabase/migrations/`
- The global Codex `supabase` MCP server is configured for project ref `yqsjczhiemzngudppkhg` with docs, account, database, debugging, development, functions, branching, and storage features enabled.
- When `auto_close_shifts` is set to manual (`false`), the active shift ledger is intended to remain open after the scheduled end time until staff close it manually.
- The current shift API now reports manual overtime as elapsed overtime minutes plus a warning, rather than forcing the display to `0 mins`.
- The close-shift modal has an internal vertical scroll constraint for short viewport heights to keep the confirmation controls reachable.
- Booking edit pricing now recalculates from room configuration when type or discount inputs change, instead of trusting the previously stored booking total.
- Only LGU has a dedicated alternate room-rate configuration today; normal and special bookings both use the standard room rates unless a separate special-rate feature is added later.
- Reports now use a shift-centered cash-on-hand architecture tied to `shift_logs`, with persisted snapshot headers in `shift_cash_reports`, per-booking activity rows in `shift_cash_report_rows`, and turnover carry records in `shift_cash_report_turnovers`.
- Shift cash reports aggregate one row per booking per shift from booking-linked `payments` and `receivable_payments` referenced by `shift_transactions`; walk-in and dine-in restaurant sales are excluded from this report, while room-service charges remain part of the booking context through `restaurant_charges_total`.
- Incoming turnover is keyed by target `shift_id` plus `target_date`, and it is only materialized after the source shift ledger is closed.
- Shift cash turnover now represents remaining collectible balance, not the amount already collected in the prior shift. Checked-in bookings with unresolved `balance_due` continue turning over across consecutive shift closes until they are checked out or fully settled; reservations that are not yet checked in are still excluded from turnover.
- The admin reports page now treats the shift cash report as the primary workflow and keeps the older revenue and expense analytics as a secondary tab.
- XLSX export for shift cash reports now uses `exceljs` with `public/assets/files/CASH-ON-HAND-REPORT.xlsx` as the base template, expanded to separate Cash, GCash, Card, Cheque, QRPh, and Ref No. columns.
- In the shift cash report export, the `Ref No.` column is reserved for supported non-cash references only; cash and card rows should not contribute reference numbers, and the prepared-by name in the workbook footer should come from the currently authenticated admin generating the export.
- The shift cash report workbook now explicitly defines border styles for the expanded six-column payment section (`Cash` through `Ref No.`), uppercases the prepared-by footer name, and protects the worksheet to make the exported file read-only for normal staff editing.
- The shift cash report workbook now applies compact styling to activity and turnover check-in/check-out date-time cells by shrinking the font and enabling `shrinkToFit`, so timestamps stay visible within the locked template columns.
- The shift cash report service is rollout-safe: if the new shift report tables are not migrated yet, current and historical report reads fall back to live/no-turnover behavior instead of throwing a 500. Applying the migration is still required to enable persisted snapshots and turnover data.
- The shift cash report service now avoids nested PostgREST relationship selects for bookings, receivable payments, turnover source shifts, and report shift lookups; it resolves related rows with explicit table reads in code to reduce runtime 500s during rollout or schema-cache drift.
- Shift cash report access reuses the existing RBAC permissions `reports.read` and `reports.export`; no new report-specific permission keys or role migrations were added for this feature.
- The reports page bootstrap flow is sensitive to hook stability: the initial data loader must not depend on `selectedReport`/`selectedShiftId`, and the first analytics fetch must not be immediately repeated by the `period` effect, otherwise the page visibly flickers on first load.
- Restaurant order payments now store a dedicated `payment_reference` on `restaurant_orders`; the admin payment modal requires it for `GCash` and `Card`, clears it for `Cash`, and the PATCH route validates that non-cash restaurant payments cannot be marked paid without a reference number.
- `booking_extras` is now the single booking-addons model for both predefined extras and ad-hoc front-desk charges. Supported live types are `Extra Bed`, `Extra Person`, `Extra Pillow`, `Extra Blanket`, `Extra Towel - Bath`, `Extra Towel - Hand`, legacy `Extra Towel`, and `Custom Charge`; `Custom Charge` rows carry a staff-provided `custom_label`.
- Shift cash reports now classify booking extras with shared helpers: `BED` = `Extra Bed`, `PERSON` = `Extra Person`, `LINENS` = pillow/blanket/towel variants, and `CHARGE` = `Custom Charge` plus any other non-bed/person/linen booking extra.
- Restaurant menu items can now be flagged with `restaurant_menu.is_minimart`, and `restaurant_order_items.is_minimart` snapshots that flag per line at order creation so historical shift cash reports split `MINIMART` vs `FOOD` from room-service line items without being affected by later menu reclassification.
- Restaurant menu items can also carry an optional `staff_price`. The restaurant add-order flow now supports a `Use Staff Price` mode that applies `staff_price` dynamically to every selected line item, rejects items that do not have a configured staff price, and is mutually exclusive with the LGU pricing toggle.
- Shift cash report row generation now derives `MINIMART` and `FOOD` from booking-linked restaurant order-item snapshots when available, with a safe fallback to `bookings.restaurant_charges_total` as `FOOD` for older data that predates the minimart snapshot fields.
- Admin destructive and cancellation actions should use the in-app confirmation modal pattern (`ConfirmActionDialog`) instead of native browser `confirm()` dialogs or immediate execution. This has now been applied to discounts delete, reviews delete, bookings cancel, restaurant cancel-order, and recipe ingredient removal.

## Known Constraints

- Preserve unrelated user changes.
- Keep service-role Supabase usage server-side only.
- Validate important claims with code or command output before stating them as fact.

## Recent Completed Tasks

- 2026-04-10: Created `rules.md`, `GUARDRAIL.md`, and `MEMORY.md` in the repo root. Added a standing rule to always follow guardrails and to read and update memory at task start and task completion.
- 2026-04-10: Updated `rules.md` to require checking available skills at the start of every task and using relevant skills before substantial work.
- 2026-04-10: Updated the global Codex Supabase MCP server to project ref `yqsjczhiemzngudppkhg`, confirmed `remote_mcp_client_enabled = true`, and completed Supabase MCP OAuth login. The Supabase skill was already installed, so no extra skill install was needed.
- 2026-04-10: Verified that manual shift ledger mode does not auto-close the active shift after schedule end, added overtime elapsed-time warnings to the shift UI/API, and fixed the close-ledger modal to scroll on short screens. Targeted Vitest and ESLint checks passed for the touched files.
- 2026-04-10: Fixed booking edit pricing so changing booking type between LGU and normal/special recalculates the room total and balance due from room rates. Added a shared booking pricing helper plus targeted API/unit tests, and confirmed the touched files pass ESLint.
- 2026-04-10: Implemented the per-shift cash-on-hand report overhaul. Added report snapshot and turnover migrations, a shift cash report builder/export service, report read/export API routes, shift-close snapshot finalization with safe fallback, and a new shift-first reports UI with analytics kept as a secondary tab. Targeted ESLint and Vitest checks passed for the new report routes and shift close integration.
- 2026-04-10: Patched the shift cash report service to tolerate unmigrated `shift_cash_reports` tables during rollout, preventing `/api/reports/shifts/current` from failing with a 500 before the migration is applied. Targeted ESLint and Vitest checks passed again after the fix.
- 2026-04-10: Refactored the shift cash report service to replace nested Supabase relationship selects with explicit table reads for bookings, receivables, turnover source shifts, and shift metadata, and added server logging on `/api/reports/shifts/current` failures. Targeted ESLint passed and the focused Vitest suite for report and shift-close routes passed again.
- 2026-04-11: Updated shift report export behavior so `Ref No.` only carries allowed non-cash payment references and the workbook `PREPARED BY` name is populated from the authenticated admin exporting the file. Added a focused export-route test and reran the targeted report/shift Vitest suite plus ESLint.
- 2026-04-11: Fixed missing payment-grid borders for `Cheque`, `QRPH`, and `Ref No.` in the generated shift report workbook, uppercased the prepared-by footer name, and added worksheet protection so the exported Excel file opens read-only for normal edits. Added a direct workbook-generation test and reran the focused report/shift test suite plus ESLint.
- 2026-04-11: Fixed the reports page first-load flicker by stabilizing the bootstrap fetch callbacks, removing the `selectedReport`/`selectedShiftId` dependency loop from `fetchShiftData`, and skipping the redundant first analytics refetch from the `period` effect. Added a focused reports-page test to verify the current shift, history, and revenue endpoints are each requested only once on mount.
- 2026-04-11: Compacted the shift report export check-in/check-out date-time cells by lowering their font size and enabling Excel `shrinkToFit` for both activity rows and turnover rows, then verified the workbook behavior with the focused workbook Vitest plus ESLint.
- 2026-04-11: Added restaurant non-cash payment references by introducing `restaurant_orders.payment_reference`, wiring the admin record-payment modal to require a reference number for `GCash` and `Card`, tightening the restaurant order PATCH route with Zod validation, and adding focused route tests plus ESLint verification.
- 2026-04-11: Realigned shift cash turnover to carry remaining collectibles instead of prior-shift receipts. Added a `collectible_amount` turnover column/migration, made open checked-in bookings continue rolling forward across shift closes until settled or checked out, updated the reports UI/export wording to show collectibles, and verified with focused turnover/page/workbook tests plus ESLint.
- 2026-04-11: Realigned shift cash report extras and restaurant charge allocation with current front-desk operations. Added migration `042_shift_report_extras_minimart_alignment.sql`, expanded `booking_extras` to support split towel types plus `Custom Charge` with `custom_label`, added minimart flags on `restaurant_menu` and `restaurant_order_items`, extended the Manage Extras flow to add custom charges, and updated shift cash report generation to split `MINIMART` vs `FOOD` from order-item snapshots with targeted Vitest and ESLint verification.
- 2026-04-11: Added restaurant staff pricing. Menu items now support optional `staff_price`, the menu modal exposes that field, restaurant orders can be flagged to use staff pricing, and the order route now applies configured staff prices while blocking staff-priced orders that include items without a `staff_price`. Focused ESLint and restaurant-order Vitest checks passed.
- 2026-04-11: Audited admin destructive/cancel actions and replaced the remaining direct or browser-confirm flows with the shared `ConfirmActionDialog` modal. Updated discounts delete, reviews delete, bookings cancel, restaurant cancel-order, and recipe ingredient removal; confirmed there are no remaining `confirm()` calls under `src/`, and the touched admin files pass ESLint.

## Open Follow-Ups

- Add new durable conventions here when workflow or architecture changes.
- Run the new migration before expecting persisted shift cash snapshots or turnover sections to appear in the live environment.
