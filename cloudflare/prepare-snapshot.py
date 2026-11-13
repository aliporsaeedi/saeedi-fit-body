"""Preserve every workbook tab/row/cell in private staging, not production.

Usage: python cloudflare/prepare-snapshot.py PRIVATE.xlsx PRIVATE_OUTPUT_DIR
No data, credentials or generated SQL belong in the public repository.
"""
import datetime
import hashlib
import json
import pathlib
import sys
import openpyxl

source = pathlib.Path(sys.argv[1]).resolve()
dest = pathlib.Path(sys.argv[2]).resolve()
repo = pathlib.Path(__file__).resolve().parents[1]
if dest == repo or repo in dest.parents:
    raise SystemExit('Snapshot output must be outside the public repository')
dest.mkdir(parents=True, exist_ok=True)
formulas = openpyxl.load_workbook(source, data_only=False)
values = openpyxl.load_workbook(source, data_only=True)
def dump(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
def quote(v):
    return "'" + str(v).replace("'", "''") + "'"
def cell_value(v):
    if isinstance(v, (datetime.date, datetime.datetime, datetime.time)):
        return {'type': type(v).__name__, 'value': v.isoformat()}
    return v
sql = [
    'CREATE TABLE IF NOT EXISTS migration_batches (id TEXT PRIMARY KEY, source_sha256 TEXT NOT NULL, exported_at TEXT NOT NULL, manifest TEXT NOT NULL);',
    'CREATE TABLE IF NOT EXISTS source_sheets (batch_id TEXT NOT NULL, sheet_index INTEGER NOT NULL, name TEXT NOT NULL, row_count INTEGER NOT NULL, column_count INTEGER NOT NULL, row_hash TEXT NOT NULL, PRIMARY KEY(batch_id,sheet_index));',
    'CREATE TABLE IF NOT EXISTS source_rows (batch_id TEXT NOT NULL, sheet_index INTEGER NOT NULL, row_index INTEGER NOT NULL, cells TEXT NOT NULL CHECK(json_valid(cells)), PRIMARY KEY(batch_id,sheet_index,row_index));',
]
digest = hashlib.sha256(source.read_bytes()).hexdigest()
batch = digest[:24]
manifest = {'batch': batch, 'sourceSha256': digest, 'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'production': False, 'sheets': []}
for i, ws in enumerate(formulas.worksheets):
    rows = []
    cached = values[ws.title]
    max_col = 0
    for row in ws.iter_rows():
        cells = {}
        for c in row:
            if c.value is None:
                continue
            v = cell_value(c.value)
            if c.data_type == 'f':
                v = {'type': 'formula', 'formula': c.value, 'cached': cell_value(cached.cell(c.row, c.column).value)}
            cells[str(c.column)] = v
            max_col = max(max_col, c.column)
        if cells:
            rows.append([row[0].row, cells])
    row_hash = hashlib.sha256(dump(rows).encode()).hexdigest()
    count = len(rows)
    manifest['sheets'].append({'index': i, 'name': ws.title, 'rows': count, 'lastRow': rows[-1][0] if rows else 0, 'columns': max_col, 'sha256': row_hash})
    # Idempotent resume only updates this exact content-addressed batch.
    sql.append('INSERT OR IGNORE INTO source_sheets VALUES (' + ','.join(map(quote, [batch, i, ws.title, count, max_col, row_hash])) + ');')
    for number, cells in rows:
        sql.append('INSERT OR IGNORE INTO source_rows VALUES (' + ','.join(map(quote, [batch, i, number, dump(cells)])) + ');')
sql.append('INSERT OR IGNORE INTO migration_batches VALUES (' + ','.join(map(quote, [batch, digest, manifest['createdAt'], dump(manifest)])) + ');')
(dest / 'snapshot.sql').write_text('\n'.join(sql), encoding='utf-8')
(dest / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(dump({'batch': batch, 'sheets': len(manifest['sheets']), 'nonemptyRows': sum(s['rows'] for s in manifest['sheets']), 'sqlBytes': (dest / 'snapshot.sql').stat().st_size}))
