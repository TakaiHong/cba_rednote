CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS posts_updated_at ON posts(updated_at DESC);

CREATE TABLE IF NOT EXISTS run_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS run_logs_created_at ON run_logs(created_at DESC);
