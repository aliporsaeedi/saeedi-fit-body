PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS native_initial_import(id INTEGER PRIMARY KEY CHECK(id=1),batch_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS native_imports (
  batch_id TEXT PRIMARY KEY, imported_at TEXT NOT NULL, source_sha256 TEXT NOT NULL,
  counts TEXT NOT NULL CHECK(json_valid(counts))
);
CREATE TABLE IF NOT EXISTS accounts (
  username_key TEXT PRIMARY KEY, username TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','coach','admin')),
  email TEXT NOT NULL DEFAULT '', coach_key TEXT NOT NULL DEFAULT '',
  telegram_chat_id TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  auth_version INTEGER NOT NULL DEFAULT 1, source_batch TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_coach ON accounts(coach_key,username_key);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY, username_key TEXT NOT NULL REFERENCES accounts(username_key),
  auth_version INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(username_key);
CREATE TABLE IF NOT EXISTS auth_attempts (
  bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  username_key TEXT PRIMARY KEY REFERENCES accounts(username_key), body TEXT NOT NULL CHECK(json_valid(body)), updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS programs (
  program_id TEXT PRIMARY KEY, owner_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('workout','diet','supplement')),
  name TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)),
  body TEXT NOT NULL CHECK(json_valid(body)), editor_body TEXT CHECK(editor_body IS NULL OR json_valid(editor_body)),
  source_batch TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS programs_owner ON programs(owner_key,kind,active);
CREATE TABLE IF NOT EXISTS records (
  record_id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner_key TEXT NOT NULL DEFAULT '',
  date_key TEXT NOT NULL DEFAULT '', lookup_key TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL CHECK(json_valid(body)), source_batch TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS records_owner_day ON records(kind,owner_key,date_key);
CREATE INDEX IF NOT EXISTS records_lookup ON records(kind,lookup_key);
CREATE TABLE IF NOT EXISTS exercises (
  exercise_id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL,
  body TEXT NOT NULL CHECK(json_valid(body)), active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS exercises_name ON exercises(name_key);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscriptions (
  sub_id TEXT PRIMARY KEY, owner_key TEXT NOT NULL REFERENCES accounts(username_key),
  package_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  status TEXT NOT NULL, body TEXT NOT NULL CHECK(json_valid(body))
);
CREATE INDEX IF NOT EXISTS subscriptions_owner ON subscriptions(owner_key,end_date);
CREATE TABLE IF NOT EXISTS packages (
  package_id TEXT PRIMARY KEY, body TEXT NOT NULL CHECK(json_valid(body)), active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS request_results (
  owner_key TEXT NOT NULL, request_id TEXT NOT NULL, action TEXT NOT NULL,
  result TEXT NOT NULL CHECK(json_valid(result)), created_at INTEGER NOT NULL,
  PRIMARY KEY(owner_key,request_id)
);
CREATE TABLE IF NOT EXISTS mutation_guard (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1), passed INTEGER NOT NULL CHECK(passed=1)
);
CREATE TABLE IF NOT EXISTS media_objects (
  media_id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, kind TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL, source_file_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  ,storage TEXT NOT NULL DEFAULT 'r2' CHECK(storage IN ('r2','kv'))
);
CREATE INDEX IF NOT EXISTS media_owner ON media_objects(owner_key,kind);
CREATE TABLE IF NOT EXISTS media_write_buffer (
  media_id TEXT NOT NULL REFERENCES media_objects(media_id), chunk_no INTEGER NOT NULL,
  payload TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(media_id,chunk_no)
);
CREATE INDEX IF NOT EXISTS media_buffer_expiry ON media_write_buffer(expires_at);
