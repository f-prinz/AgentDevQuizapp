# Code Review FEAT-5

Reviewer: code_reviewer, independent of implementation and test authors.
Reviewed the complete FEAT-5 diff against main, including current working-tree changes in apps/server/src/game.ts, apps/server/src/lobby.ts, and apps/server/test/game-state.test.ts. Also reviewed the task acceptance criteria, agent context, approved stack, architecture scoring/ranking sections, and ranking/snapshot contracts.

## Result: APPROVED

No blockers or other findings in the FEAT-5 scope.

- Quiz points accumulate for frozen participants at reveal from the current question's stored answer. Reveal can transition a closed playing round to evaluation only once; next question gets a new round ID while retaining the accumulated points. A completed-game result is created only when the final evaluation is finished. A repeated finish with the old round ID is rejected because the active round has been cleared.
- Ranking totals sum completedGames only. An unfinished game adds no points and is not marked played. On finish, all current players get a per-game entry; missing answers score zero. Players who join after a game are also projected with zero for that prior game.
- Competition ranks count players with strictly higher totals, yielding 1, 1, 3 for a tie at first. Ranking iteration follows the lobby's append-only player list, preserving join order within ties. The transition stores previous/current ranking and one resultId at finish; host and projector receive the same values.
- Player snapshots receive an empty aggregate ranking and null transition; host and projector receive the ranking. Snapshots are parsed through their role-specific contract schemas.
- The quiz test verifies no new rank or played flag during question evaluations, then verifies accumulated multi-question points, tied ranks, completed-game entry, played status, and matching host/projector transitions. The sorting test verifies completion and ranking-entry structure. The shared finish/ranking path handles all game kinds.

Sorting and estimation currently retain zero points because their scoring algorithms are pending FEAT-9 and FEAT-11, both TODO in tasks/state.json and described as future work in the feature plan. These values are placeholders; this review does not claim they are correct sorting or estimation scores. Those algorithms remain separate follow-up work.

The diff is limited to server game state, lobby projection, and tests. No dependencies, manifests, contracts, persistence changes, or cross-component edits were introduced. It remains within the approved Node.js/TypeScript, Fastify, ws, in-memory state, Vitest, and ESLint/typecheck stack. git diff --check reported no whitespace errors.

## Evidence reviewed

- tasks/evidence/FEAT-5-2026-10-26T17-19-43-950Z.json: quiz ranking regression failed while ranking was still empty.
- tasks/evidence/FEAT-5-2026-10-26T17-26-59-246Z.json: sorting completion regression failed while completed ranking was still empty.
- tasks/evidence/FEAT-5-2026-10-26T17-28-37-101Z.json: focused game-state suite passed, 11/11.
- tasks/evidence/FEAT-5-2026-10-26T17-28-40-979Z.json: full server suite passed, 49/49.
- tasks/evidence/FEAT-5-2026-10-26T17-29-14-793Z.json: lint and typecheck passed.
- tasks/evidence/FEAT-5-2026-10-26T17-29-37-518Z.json: server build passed.

Evidence was reviewed from the recorded files and not rerun. FEAT-5 remains IN_PROGRESS with inventory_refs empty in tasks/state.json; the orchestrator must complete the required main-branch bookkeeping and checks before marking it DONE.
