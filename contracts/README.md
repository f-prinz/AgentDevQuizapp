# @raccoons/contracts – protocol 1

Shared TypeScript/zod contracts for server and web. Run `npm install`,
`npm test`, and `npm run typecheck` here. `npm run build` emits ESM and
declarations into `dist/`; consumers use `file:../../contracts` and import
from `@raccoons/contracts`. Build this package before building consumers.
Do not import component implementation files across component boundaries.

## Versioning

Every WS message and REST response carries `version: 1`. This package starts
at 1.0.0. A new optional field or event can be additive only when both
consumers handle it safely: strict object validation otherwise makes an
unknown field incompatible. Renaming/removing fields, changing meaning,
adding required fields, or incompatible validation requires a new protocol
major version and its own CONTRACT_CHANGE task. All changes under contracts/
require a dedicated TECH task and producer/consumer review.

## REST and links

| Method/path | Request | Response |
| --- | --- | --- |
| GET /health | none | HealthResponseSchema |
| POST /lobbies | CreateLobbyRequestSchema (`{}`) | CreateLobbyResponseSchema |
| POST /lobbies/:lobbyId/players | JoinPlayerRequestSchema | JoinPlayerResponseSchema |

The creation response contains host/projector sessions and host/player/projector
links. Each Session has lobbyId, sessionId, role, token. Host and projector
links use `/lobbies/:id/host#sessionId=...&token=...` and
`/lobbies/:id/projector#sessionId=...&token=...`; player link is
`/lobbies/:id/join`. Link targets are same-origin relative paths. Tokens have
at least 256 bits generated entropy (schema requires base64url length >=43).
The frontend takes fragment credentials into localStorage scoped by lobby
and role, then removes the fragment using replaceState. Tokens never appear
in HTTP query strings, WebSocket URLs, snapshots, logging, or error messages.
The public player link alone cannot recover another participant. Resume
requires the previously stored Session in the same browser.
REST errors use ErrorEventSchema with requestId null; status 400 for schema
errors, 404 unknown lobby, 403 forbidden action, 500 sanitized internal error.

## WebSocket /ws

The first message is AuthCommandSchema (`auth`, lobbyId, sessionId, token).
The server binds the socket to the stored role; clients never choose a role
inside commands. Authentication replies with ack and a role-specific snapshot.
All commands include version and requestId. Request IDs correlate ack/errors;
they are not credentials. Answer/round transition commands include roundId
to reject stale actions. Transport implementations must enforce authorization,
payload size, origin, rate limits, and domain-state checks in addition to schemas.

| Commands | Allowed role and effect |
| --- | --- |
| lobby.start | host; lobby -> overview after >=2 players |
| game.select {gameId|null} | host; select/deselect unplayed game in overview |
| game.prepare | host; selected game -> start, freeze participants |
| game.start | host; start -> playing, assign deadline |
| game.reveal {roundId} | host; closed playing -> evaluation |
| game.next {roundId} | host; quiz evaluation with next question -> playing |
| game.finish {roundId} | host; final evaluation -> overview, score once |
| player.name {name} | player; trim name, max20, empty uses Spieler N |
| answer.set {roundId,answer} | active player; save mutable draft |
| answer.submit {roundId,answer} | active player; atomically save + finalize |
| time.sync {clientTime} | authenticated roles; response echoes clientTime + serverTime |

Server replies are ServerMessageSchema: ack, error, time.sync or snapshot.
Snapshots have monotonically increasing revision; clients ignore older ones.
They contain participants, metadata-only catalog (played flag), selectedGameId,
ranking, optional rankingTransition (resultId/gameId/previous/current), phase,
serverTime and role-specific round. Host also receives canStartLobby; player
receives playerId/input (own answer/final/participating). Projector has no
mutation actions or private input. Connections sharing a session share identity.

## Round data and privacy

`round` is null in lobby/overview. In start it contains game metadata,
roundId and zero-based questionIndex plus questionCount. In playing it also
contains task and timer. Quiz options go to host/player; projector sees only
question. Sorting terms (without values) go only to players; host/projector
see question. Estimation target is absent until evaluation. Strict wire
schemas reject solution fields and foreign private inputs in playing.

Timer contains roundId/serverTime/deadline/acceptUntil/inputClosed/canReveal.
acceptUntil is exactly deadline+2000ms. Server arrival time <=acceptUntil is
accepted unless finalized. All-final closes early; otherwise closure is after
the inclusive boundary. Clients show zero at deadline, then wait. canReveal
equals inputClosed, but only host may reveal. Server state is authoritative.

In evaluation all roles receive solution and hasNextQuestion. Host/projector
receive results (playerId,name,points,rank,distance,errors); irrelevant numeric
columns are null. Players receive ownEvaluation (own answer/points/distance/
positionsCorrect), with irrelevant fields null. Correct sorting terms are
in ascending value order. Null input is unsubmitted; sorting initial order
is already a valid draft. New players during a game are waiting until next
selection; reconnect restores the frozen participant's draft/final state.

GameSeedSchema is a catalog-only storage/seed model containing solutions.
It must never be serialized into snapshots or public catalog responses.
Schemas validate shapes and local invariants. The server must additionally
check selected game/round IDs, answer kind, sorting's exact permutation,
questionIndex bounds, role permissions, finality, timing, and scoring.
Ranking totals contain completed games only; tied scores share competition
rank (1,1,3), stable display order uses join number. The initial projector
view renders only names, despite ranking numeric fields being present.

No application producer/consumer exists at TECH-3 creation; conformance is
proven at subsequent server/web integration tasks, not claimed here.
