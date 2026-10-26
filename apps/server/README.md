# Server

The server requires local PostgreSQL. Copy `.env.example` to `.env`, set
`DATABASE_URL` to a local database URL, then run `npm run dev` from this
directory. The server starts listening only after it validates the seed files,
applies SQL migrations and seeds, and reads the catalog back from PostgreSQL.

`ALLOWED_ORIGINS` is a comma-separated list of HTTP(S) origins permitted to
open a browser WebSocket connection. The local Vite origins on port 5173 are
the default. For local phone testing, configure the exact LAN origin used by
the frontend and an explicit server `HOST`; paths, credentials, and wildcard
origins are not accepted.

The catalog is the only persistent application data. Lobby state and game
results remain in memory. Seed files are in `seeds/`; versioned SQL migrations
are in `migrations/`. Seed upserts use stable game IDs and preserve catalog
entries that are not managed by the seed files.

An existing role session can reconnect with its session ID and token while the
server process and lobby are still running. Authentication restores that
session's role and player identity without adding another participant; a server
restart clears the session. WebSocket connections receive a ping every 30
seconds. A peer that misses a pong is terminated at the next heartbeat, and a
player is marked disconnected only after the last socket for that session
closes, so another open tab keeps the participant connected.

Run the existing server checks with `npm test`, `npm run lint`, and
`npm run build`. PostgreSQL integration tests create an isolated temporary
cluster under `tmp/` and do not use the configured application database.
