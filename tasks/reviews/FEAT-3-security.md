# Security Review FEAT-3

Reviewer: security_reviewer, independent of implementation (lobby_impl) and test author (lobby_test_prep).
Reviewed the full main-to-FEAT-3 diff and the follow-up working-tree changes in game.ts and game-state.test.ts.

## Result: APPROVED

The previous P1 finding is resolved. No security blocker remains in the reviewed scope.

For sorting rounds, a player’s first snapshot now gets a shuffled order cached by player ID for the round. Reauthentication reads that same cached order, and projection no longer returns raw seed order when the player has no prior order. The regression demonstrates both the non-seed initial order and its stability after the mocked random source changes. Projected sorting terms contain only ID and text; their answer values are not sent. Quiz correctOptionId and estimation target are likewise withheld until evaluation.

The fix does not change eligibility: participantIds are frozen when the round is prepared; later joiners remain waiting and non-participating. The answer path checks membership in the frozen set, and the regression verifies both draft and submit commands return NOT_PARTICIPATING for the late player. Existing final-answer and host-transition checks remain server-side.

The server stack and scope remain approved: TypeScript, Fastify, ws, in-memory lobby/game state, and existing validation/test tooling. No new dependencies, external services, persistence, contracts, secrets, or cross-component changes appear in the diff. No new data exposure was found in snapshot projection.

## Evidence reviewed

- Red regression: tasks/evidence/FEAT-3-2026-10-26T16-17-34-487Z.json, exit 1 at the expected pre-fix seed-order assertion.
- Focused green suite: tasks/evidence/FEAT-3-2026-10-26T16-19-11-748Z.json, 8/8.
- Full server suite: tasks/evidence/FEAT-3-2026-10-26T16-22-18-608Z.json, 46/46.
- Lint and typecheck: tasks/evidence/FEAT-3-2026-10-26T16-22-37-079Z.json, exit 0.
- Build: tasks/evidence/FEAT-3-2026-10-26T16-22-50-629Z.json, exit 0.

Evidence was reviewed from the recorded files and not rerun. Security review is approved with no findings.
