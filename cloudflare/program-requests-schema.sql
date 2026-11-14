CREATE TABLE IF NOT EXISTS program_requests (
 id TEXT PRIMARY KEY, nonce TEXT NOT NULL UNIQUE, body_hash TEXT NOT NULL,
 name TEXT NOT NULL, phone TEXT NOT NULL, goal TEXT NOT NULL, service TEXT NOT NULL,
 note TEXT NOT NULL, consent_version TEXT NOT NULL, ip_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new', admin_note TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 synced_revision INTEGER NOT NULL DEFAULT 0, notification_state TEXT NOT NULL DEFAULT 'pending',
 lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS request_ip_time ON program_requests(ip_hash,created_at);
CREATE INDEX IF NOT EXISTS request_phone_time ON program_requests(phone,created_at);
CREATE INDEX IF NOT EXISTS request_queue ON program_requests(status,created_at);
