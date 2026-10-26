# Code Review FEAT-11

Reviewer: code_reviewer/security_reviewer, independent of implementation and test authors.
Reviewed the complete current diff against main, including working-tree changes in apps/server/src/game.ts and apps/server/test/game-state.test.ts. Also reviewed the FEAT-11 acceptance criteria, agent context, approved stack, estimation requirements and architecture, and contracts.

## Result: APPROVED

No blockers or other findings.

- Only finite estimation answers are eligible. The validated stored answer is used, so a later invalid submission does not replace the last valid value. The regression checks an invalid NaN submit, reconnects the same session, and verifies the previous valid estimate remains.
- estimateScores computes absolute distances and ranks by count of strictly closer valid estimates. It uses N valid estimates for ceil(N/3) and ceil(2N/3), lets a tie group use its best rank tier, adds two points to every estimate tied for closest, and caps the maximum at five. Missing answers receive zero and null rank/distance; with N=0, no rank groups or bonus are produced.
- Points are accumulated once at reveal for frozen participants and retained in totalPoints for finishGame to add to the completed game's ranking. Reveal changes the phase, preventing duplicate accumulation. The existing 30-second timer remains in effect.
- The target is omitted from playing snapshots and appears only in evaluation. Host/projector receive aggregate results; each player receives only their own answer, points, and distance. Output is schema-validated against the existing contracts.
- For distances whose subtraction overflows, the reported distance saturates at Number.MAX_VALUE, while ranking uses a separate half-scaled comparison value. This keeps the wire value finite and distinguishes overflow magnitudes instead of ranking solely on the saturated output. The extreme-value regression verifies finite host/projector snapshots and ranks an exact match ahead of the opposite extreme.
- The implementation changes only estimation logic in server game state and its tests. Quiz and sorting paths remain unchanged; no dependency, manifest, contract, persistence, or cross-component changes were introduced. The approved Node.js/TypeScript, Fastify, ws, in-memory state, Vitest, and ESLint/typecheck stack is preserved. git diff --check reported no whitespace errors.

## Evidence reviewed

- tasks/evidence/FEAT-11-2026-10-26T18-10-54-393Z.json: semantic red; the old estimation results did not yet match the expected ranking/point tiers.
- tasks/evidence/FEAT-11-2026-10-26T18-10-40-189Z.json: shell-filter attempt exited 255 on a PowerShell pipe parse error; not semantic red evidence.
- tasks/evidence/FEAT-11-2026-10-26T18-14-36-716Z.json: extreme-distance regression exposed Infinity in a snapshot before the overflow fix.
- tasks/evidence/FEAT-11-2026-10-26T18-17-32-103Z.json: focused estimation tests passed, 2/2.
- tasks/evidence/FEAT-11-2026-10-26T18-17-36-637Z.json: full server suite passed, 54/54.
- tasks/evidence/FEAT-11-2026-10-26T18-21-10-474Z.json: focused game-state suite passed, 16/16.
- tasks/evidence/FEAT-11-2026-10-26T18-17-57-448Z.json: lint and typecheck passed.
- tasks/evidence/FEAT-11-2026-10-26T18-18-12-063Z.json: server build passed.

Evidence was reviewed from the recorded files and not rerun. FEAT-11 remains IN_PROGRESS with inventory_refs empty in tasks/state.json; the orchestrator must complete the required main-branch bookkeeping and checks before marking it DONE.
