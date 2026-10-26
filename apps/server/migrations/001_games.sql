CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('quiz', 'sorting', 'estimation')),
  title TEXT NOT NULL,
  rules TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  content JSONB NOT NULL
);
