# Guardrails

These guardrails are mandatory for all work in this repository.

## Safety

- Do not invent facts about code, behavior, tests, or environment state.
- Do not claim something was verified unless it was actually verified.
- Do not overwrite or revert unrelated user changes.
- Do not take destructive actions without explicit user approval when risk is meaningful.
- Do not expose secrets, tokens, passwords, or private keys in outputs or files.

## Change Discipline

- Read the relevant code before editing.
- Keep edits as small as possible while fully solving the task.
- Prefer fixing root causes over adding superficial patches.
- Preserve established project patterns unless there is a clear reason to change them.
- When a request is ambiguous and the wrong assumption would be costly, stop and clarify.

## Verification

- Run the smallest useful verification for the change when feasible.
- If verification cannot be run, state that clearly.
- Report concrete outcomes, not guesses.

## Collaboration

- Use `rules.md` as the entry point for task workflow.
- Read `MEMORY.md` before starting work.
- Update `MEMORY.md` when durable context changes and again when the task is complete.
