/** Owner migration channel. Read only, signed, short lived requests.
 * MigrationSecret.js is private deployment configuration, never committed.
 * This function is intentionally absent from SF_API_ALLOWED_.
 */
function sfMigrationRead_(body) {
  function reply(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
  var key = typeof sfMigrationKey_ === 'function' ? sfMigrationKey_() : '';
  var stamp = Number(body.timestamp), nonce = String(body.nonce || ''), signature = String(body.signature || '');
  if (!key || !Number.isFinite(stamp) || Math.abs(Date.now() - stamp) > 60000 || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return reply({ok:false,error:'unauthorized'});
  var payload = body.payload;
  if (!payload || typeof payload !== 'object' || JSON.stringify(payload).length > 1500) return reply({ok:false,error:'unauthorized'});
  var expected = toHex_(Utilities.computeHmacSha256Signature(String(stamp) + '\n' + nonce + '\n' + JSON.stringify(payload), key));
  var mismatch = 0; for (var i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (mismatch) return reply({ok:false,error:'unauthorized'});
  var cache = CacheService.getScriptCache(), nonceKey = 'migration_nonce_' + nonce;
  if (cache.get(nonceKey)) return reply({ok:false,error:'replayed'});
  cache.put(nonceKey, '1', 120);
  try {
    var ss = getSS_();
    if (payload.op === 'metadata') return reply({ok:true,data:{spreadsheetId:ss.getId(),timeZone:ss.getSpreadsheetTimeZone(),sheets:ss.getSheets().map(function(sh){return{id:sh.getSheetId(),name:sh.getName(),rows:sh.getLastRow(),columns:sh.getLastColumn()};})}});
    if (payload.op === 'configuration') return reply({ok:true,data:PropertiesService.getScriptProperties().getProperties()});
    if (payload.op !== 'rows') return reply({ok:false,error:'unknown operation'});
    var sh = ss.getSheets().find(function(s){return s.getSheetId() === Number(payload.sheetId);});
    var start = Number(payload.start), count = Number(payload.count);
    if (!sh || !Number.isInteger(start) || start < 1 || !Number.isInteger(count) || count < 1 || count > 300 || count * sh.getLastColumn() > 15000) return reply({ok:false,error:'invalid range'});
    count = Math.min(count, sh.getLastRow() - start + 1);
    if(count < 1)return reply({ok:true,data:{sheetId:sh.getSheetId(),start:start,rows:[],display:[]}});
    var range = sh.getRange(start, 1, count, sh.getLastColumn());
    var values = range.getValues().map(function(row){return row.map(function(v){return v instanceof Date ? {type:'date',value:v.toISOString()} : v;});});
    return reply({ok:true,data:{sheetId:sh.getSheetId(),start:start,rows:values,display:range.getDisplayValues()}});
  } catch(error) { return reply({ok:false,error:'migration read failed'}); }
}
