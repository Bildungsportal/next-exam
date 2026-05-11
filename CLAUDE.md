# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- always describe newly introduced functions with a short comment
- If you notice unrelated dead code, mention it - don't delete it.
- Never run git restore/reset/clean/rebase/stash/pop/checkout/switch unless the user explicitly requests it.

**Match the repo, not the tutorial (mandatory for new or touched UI/logic):**

- **Before** you pick patterns (Vue API, TS vs plain JS, module layout, IPC usage, router shape, comment language), open **at least one existing file of the same kind** in the same app or sibling directory (e.g. another `*.vue` in `teacher/src/pages/` or `components/`) and **mirror what you see**: Options API vs `<script setup>`, semicolons, naming, how similar features import `pdfjs` or call `ipcRenderer`, etc.
- **Do not** default to “modern” or framework-canonical style when this codebase already standardized on something else (e.g. Options API everywhere → do not introduce `<script setup>` unless the user explicitly asks for that migration).
- If two styles coexist in legacy areas, follow the **dominant** pattern in the tree you are editing; if it is genuinely ambiguous, **ask** once instead of guessing.

**Indentation (new vs existing files):**

- In **new** files you add, use **4 spaces** per indent level (spaces only; do not use tab characters for leading indentation).
- In **existing** files, keep that file’s current indent width and tab/space choice; do not reformat unrelated lines or whole-file whitespace unless the user asks.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Project memory (`memory.md`)

**Mandatory for all AI agents (Claude Code, Cursor Agent, etc.) in this repo.** `memory.md` at the repository root is a shared, **token-minimal machine index** of durable **project-level** facts: architecture, conventions, contracts, and cross-app relationships (especially `student/` ↔ `teacher/`). Humans are not the audience; optimize for **fewest characters per retrievable fact**.

### Read

- **Before** non-trivial work (multi-file, IPC/Electron, print pipeline, unfamiliar subsystem, or anything that could duplicate past investigation): **read `memory.md` end-to-end** (it should stay short). Combine with `graphify-out/` when the task is structural (see §6).

### Write / update

- **After** you discover something **non-obvious and stable** that helps future work at a project level: architecture locations (`PATH`), conventions (`RULE`), IPC/API contracts (`IPC`), or important cross-module relationships (`TECH`).
- **Do NOT** put narrow implementation details or one-off bugfix notes in `memory.md`. If a bug is truly structural (recurs across modules / defines an invariant / impacts architecture), capture it as a high-level rule or contract instead of a step-by-step fix.
- **One atomic fact per line** where possible; **no prose**, no markdown essays, no filler.
- **Dedupe**: if a fact already exists, tighten the stronger line and remove the weaker duplicate.
- **Prune**: delete or replace lines that are wrong after refactors; keep file **small** (if it grows past ~400–500 lines, aggressively compress or archive old atoms to a separate file only if the user asks).
- **Paths**: repo-relative (`teacher/...`, `student/...`).

### Encoding format (keep stable; extend only with necessity)

Use plain UTF-8 lines. Preferred atom shape (fields separated by `^`, empty fields allowed but omit trailing `^`):

```
KIND^TOPIC^KEY^VALUE^CTX
```

- `KIND`: `TECH` (stack/pattern), `BUG` (symptom/cause/fix pointer), `RULE` (must/must-not), `IPC` (channel/handler contract), `PATH` (where logic lives).
- `TOPIC`: short slug, e.g. `print`, `vue`, `electron`.
- `KEY` / `VALUE` / `CTX`: ultra-abbreviated; use symbols, camelCase, no articles.

**Examples:**

```
RULE^agent^memRW^read memory.md before nontrivial task; write durable deltas after
TECH^vue^api^Options API default teacher/src; no script setup unless user migrates
RULE^i18n^alphabetical^keep keys in teacher/src/locales/de.json+en.json alphabetically sorted within each object
PATH^pdfparser^root^pdf parser code lives in teacher/src/utils/pdfparser/ and student/src/utils/pdfparser/
```

If a single line cannot fit, split into two atoms with the same `TOPIC^KEY` prefix rather than wrapping prose.

**Meta line** (optional, first line): keep `@memV1` or similar so parsers/agents detect schema version in one token.

---

## 6. Graphify (repository knowledge graph)

**Mandatory for agents in this repo.** Graphify is the canonical map of structure and cross-file links; do not substitute guesswork when a graph can ground the answer.

- **Before** substantive or cross-cutting work (architecture, IPC, shared protocols, unfamiliar subsystems, large refactors): read existing outputs under `graphify-out/` (`GRAPH_REPORT.md`, `graph.json`, and `graph.html` when helpful). If outputs are missing or no longer reflect the areas you will touch, run a full build from the repository root: `graphify .` (or the `/graphify` skill / project graphify workflow when available).
- **After coarse architecture changes** (new packages or apps, IPC/API surface changes, large directory moves, refactors that shift many callsites, or anything that redraws boundaries between `student/`, `teacher/`, and shared code): refresh the graph without being prompted—run `graphify . --update` from repo root when Graphify is installed; if outputs never existed or the delta is too large to trust incrementally, run `graphify .` instead.
- **Definition of done** for those changes includes an updated `graphify-out/` consistent with the new layout (same session unless the user explicitly defers a long rebuild).

**Order of operations:** for tasks that touch both unknown behavior and structure, skim `memory.md` first, then `graphify-out/` as needed.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, **no stylistic drift** (new code reads like the surrounding authors wrote it), clarifying questions come before implementation rather than after mistakes, and **`memory.md` stays current** without turning into unreadable prose.
