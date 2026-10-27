# FEAT-14 architecture assessment

## Decision

**KEEP** the approved stacks. Classify the web work as **CURRENT_STACK_ONLY** for `web` and the projection work as **CURRENT_STACK_ONLY** for `server`. React 19, Vite 8, react-router, TypeScript, Fastify and `ws` already provide everything needed. No new dependency, framework change or migration is justified.

## Scope and current state

The central theme file already defines the four approved CSS custom properties, and `app.css` imports it and consumes those properties. Its base player/host layout uses fluid widths and a narrow-screen baseline; the projector explicitly uses a desktop-width layout. Preserve that separation and extend it only where the player/host experience needs a clear mobile layout.

The remaining visible gaps are the player status bar and answer-state treatment. Although `PlayerSnapshot` has a `ranking` field, `apps/server/src/lobby.ts` currently sends an empty array to every player. The server must instead project only the requesting player's `RankingEntry` after a completed game; it must not expose other players' scores through player snapshots. The web status bar can then use `playerId` to select that entry and `participants` to derive the name. Before the first ranking entry exists, show name only (or the specified no-name fallback). Do not show a player score bar for the host: the host is a moderator, not a participant. Keep the player's name, points and rank visible at the top of player-facing views, including join/player lobby and game views after session identity is available.

Quiz answer options currently have a neutral border, while evaluation shows the answer as plain text. Apply neutral styling to unanswered/unresolved choices, turquoise to correct answers and red to incorrect answers. Use text/icon or accessible labels as well as color so meaning does not depend on color alone. For sorting, use the existing `positionsCorrect` values to mark each player's term right/wrong during evaluation. Do not infer answer correctness in the browser before authoritative evaluation.

## Responsive proposal

Retain the mobile-first `.page` flow for player and host, with touch-sized controls and content that fits narrow viewports without horizontal scrolling. The projector remains a desktop presentation with its intentional minimum width and large typography. Responsive behavior is a CSS concern in the existing web component; no route or protocol changes are needed. Verify narrow player/host widths and desktop projector dimensions in the automated UI tests where feasible; manual browser acceptance is waived for this task by user instruction.

## Contract impact

**No schema change.** The existing `PlayerSnapshot` schema already includes `playerId` and `ranking: RankingEntry[]`, so the server can safely populate that field with the requesting player's single entry and the web client can consume it. This changes behavior in both `apps/server` and `apps/web`, while remaining within their approved current stacks. Do not change `contracts/`; keep host/projector projections unchanged. `ownEvaluation` plus the solution already supplies the data for answer markings.

## Acceptance notes

- Keep all four specified colors centralized in `src/styles/theme.css`; no raw color literals elsewhere.
- Add the player status bar at the top of player-facing views; points and placement appear once available.
- In player snapshots, return at most the requesting player's ranking entry; verify another player's ranking data is not exposed. Populate after the first completed game; otherwise leave ranking empty.
- Apply neutral/correct/incorrect states to answer results with a non-color cue.
- Keep player and host layouts mobile-first and the projector desktop-oriented.
- Existing test, lint and build checks remain applicable. No additional dependencies are proposed.
