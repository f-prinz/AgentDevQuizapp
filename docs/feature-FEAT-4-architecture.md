# FEAT-4 Architecture Assessment

## Decision

- Stack recommendation: **KEEP**.
- Web classification: **CURRENT_STACK_ONLY** (React 19, Vite 8, TypeScript, react-router; native WebSocket client and shared Zod contracts).
- Contract impact: **No CONTRACT_CHANGE required** for the scoped FEAT-4 role views and phase controls. Contracts already define the required per-role round variants, commands, input state, and timer authority. If implementation discovers a missing protocol field, stop and create a separate TECH CONTRACT_CHANGE task; do not change `contracts/` in FEAT-4.
- User explicitly waived manual browser/UI acceptance and the `ui_step` inventory anchor for FEAT-4. Automated tests, lint/typecheck, build, and independent review remain required. The waiver is limited to this feature.

## Existing protocol-to-view mapping

| Phase / role | Existing snapshot data | UI responsibility |
| --- | --- | --- |
| Start / player | `PlayerSnapshot.round: { phase: 'start', roundId, game, questionIndex, questionCount }` | Show game title and start transition; no seed solution or answer options are needed yet. |
| Start / host | `HostSnapshot.round` with the same start fields | Show title/rules and the host start action. Send `game.start` with the current `roundId`. |
| Start / projector | `ProjectorSnapshot.round` with the same start fields | Show title and rules in desktop presentation. |
| Playing / player | `PlayerRound.task` (`quiz` includes options, `sorting` includes that player's randomized `terms`, `estimation` includes question); `PlayerSnapshot.input` (`answer`, `final`, `participating`); `round.timer` | Render answer controls; restore current draft/final status; disable submissions when not participating, final, or input closed. |
| Playing / host | `HostRound.task` (quiz includes options) and `timer` | Show current question/options, progress and timer. Enable reveal only when `timer.canReveal` and phase is `playing`; server remains authoritative. |
| Playing / projector | `ProjectorRound.task` uses `PublicTaskSchema`, intentionally omitting quiz options; `timer` | Show only the public prompt and synchronized, prominent timer. |
| Evaluation / player | `solution`, `hasNextQuestion`, `ownEvaluation` | Mark own answer and correct answer; show points, distance, or sorting correctness. |
| Evaluation / host and projector | `solution`, `hasNextQuestion`, `results` | Show revealed solution and aggregate player results; host may advance (`game.next`) or finish (`game.finish`) according to quiz progression. |

`TimerSchema` carries `serverTime`, `deadline`, `acceptUntil`, `inputClosed`, and `canReveal`; the UI should derive countdown display from these server timestamps, not run an independent authoritative timer. `acceptUntil` is constrained to `deadline + 2000` by contract.

## Safety and state invariants

- Correct options, sorting values, estimation targets, and the full `solution` appear only in evaluation snapshots. Playing snapshots expose only role-appropriate task data; projector quiz snapshots exclude options. Do not derive answers from catalog/seed content on the client.
- `game.reveal` is a host-only transition; the server checks role, current phase, current `roundId`, and closed input. The host button must additionally be gated on `phase === 'playing'` and `timer.canReveal === true`.
- Player inputs are enabled only for `participating === true`, `final === false`, and while input remains open. Waiting/late players cannot submit; the server returns `NOT_PARTICIPATING`. UI checks are convenience only; server validation is authoritative.
- Use only role-discriminated snapshots (`HostSnapshot`, `PlayerSnapshot`, `ProjectorSnapshot`) and avoid sharing host/player-only data into the projector rendering path.
- Keep answer editing and final submission aligned with `answer.set`/`answer.submit`; display the persisted snapshot state after reconnect rather than inventing local round state.

## Validation plan

- Write focused failing web tests first for each role across start, playing, and evaluation phases; cover quiz/sorting/estimation discriminants, timer states, draft/final/participation, host reveal/advance controls, and absence of solution/options in unauthorized views.
- Run the configured web test suite, lint/typecheck, and production build through `scripts/record-check.mjs`; preserve real exit-code evidence. Do not claim manual browser acceptance because the user expressly waived it.
- Require an independent `code_reviewer` who did not implement FEAT-4. Review role isolation, transition gating, protocol usage, CSS/theme constraints, stack adherence, and test coverage. Add security review if new input paths or trust boundaries are introduced.
- Add/update the feature inventory without a `ui_step` anchor; test and source anchors remain appropriate. Run `check-state`, `check-inventory`, `verify`, and task-scope checks before DONE.

## Scope boundary

FEAT-4 is presentation and interaction wiring against the existing protocol. Any requirement for a new event, field, server behavior, persistence, or dependency is outside this assessment and requires a separately tracked, reviewed task before implementation.
