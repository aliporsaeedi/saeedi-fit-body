CREATE TABLE IF NOT EXISTS catalog_packs (
 pack_id TEXT PRIMARY KEY, source_sha TEXT NOT NULL UNIQUE, source_bytes INTEGER NOT NULL,
 entries_count INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('importing','verified')), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_entries (
 entry_id TEXT PRIMARY KEY, pack_id TEXT NOT NULL REFERENCES catalog_packs(pack_id), kind TEXT NOT NULL,
 source_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, goal TEXT NOT NULL,
 audience TEXT NOT NULL, level TEXT NOT NULL, template_id TEXT NOT NULL, review_status TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, body_json TEXT NOT NULL, source_ref TEXT NOT NULL, updated_at TEXT NOT NULL, source_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS catalog_kind_category ON catalog_entries(kind,category,name);
CREATE TABLE IF NOT EXISTS catalog_templates (
 template_id TEXT PRIMARY KEY, pack_id TEXT NOT NULL REFERENCES catalog_packs(pack_id), kind TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL, columns_json TEXT NOT NULL, is_default INTEGER NOT NULL, layout_json TEXT NOT NULL, source_ref TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_issues (
 issue_id TEXT PRIMARY KEY, pack_id TEXT NOT NULL REFERENCES catalog_packs(pack_id), entry_id TEXT NOT NULL,
 severity TEXT NOT NULL, code TEXT NOT NULL, message TEXT NOT NULL, detail_json TEXT NOT NULL, resolved INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS catalog_issue_entry ON catalog_issues(entry_id,resolved);
CREATE TABLE IF NOT EXISTS catalog_sources (
 pack_id TEXT NOT NULL REFERENCES catalog_packs(pack_id), part_no INTEGER NOT NULL,
 parts INTEGER NOT NULL, source_name TEXT NOT NULL, source_sha TEXT NOT NULL, body_base64 TEXT NOT NULL,
 PRIMARY KEY(pack_id,part_no)
);
CREATE TABLE IF NOT EXISTS catalog_revisions (
 entry_id TEXT NOT NULL, revision INTEGER NOT NULL, body_json TEXT NOT NULL,
 metadata_json TEXT NOT NULL, saved_at TEXT NOT NULL, saved_by TEXT NOT NULL,
 PRIMARY KEY(entry_id,revision)
);
