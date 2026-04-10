# Memory

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

## Known Constraints

- Preserve unrelated user changes.
- Keep service-role Supabase usage server-side only.
- Validate important claims with code or command output before stating them as fact.

## Recent Completed Tasks

- 2026-04-10: Created `rules.md`, `GUARDRAIL.md`, and `MEMORY.md` in the repo root. Added a standing rule to always follow guardrails and to read and update memory at task start and task completion.
- 2026-04-10: Updated `rules.md` to require checking available skills at the start of every task and using relevant skills before substantial work.
- 2026-04-10: Updated the global Codex Supabase MCP server to project ref `yqsjczhiemzngudppkhg`, confirmed `remote_mcp_client_enabled = true`, and completed Supabase MCP OAuth login. The Supabase skill was already installed, so no extra skill install was needed.
- 2026-04-10: Verified that manual shift ledger mode does not auto-close the active shift after schedule end, added overtime elapsed-time warnings to the shift UI/API, and fixed the close-ledger modal to scroll on short screens. Targeted Vitest and ESLint checks passed for the touched files.

## Open Follow-Ups

- Add new durable conventions here when workflow or architecture changes.
