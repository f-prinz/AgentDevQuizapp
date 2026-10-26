# Server

The server requires local PostgreSQL. Copy `.env.example` to `.env`, set
`DATABASE_URL` to a local database URL, then run `npm run dev` from this
directory. The server starts listening only after it validates the seed files,
applies SQL migrations and seeds, and reads the catalog back from PostgreSQL.

The catalog is the only persistent application data. Lobby state and game
results remain in memory. Seed files are in `seeds/`; versioned SQL migrations
are in `migrations/`. Seed upserts use stable game IDs and preserve catalog
entries that are not managed by the seed files.

Run the existing server checks with `npm test`, `npm run lint`, and
`npm run build`. PostgreSQL integration tests create an isolated temporary
cluster under `tmp/` and do not use the configured application database.
