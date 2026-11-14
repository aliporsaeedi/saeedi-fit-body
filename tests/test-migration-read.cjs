const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
let reads=0;const seen=new Set(),key='fixture-key-not-a-credential';
const ctx={sfMigrationKey_:()=>key,ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},toHex_:b=>Buffer.from(b).toString('hex'),Utilities:{computeHmacSha256Signature:(s,k)=>[...crypto.createHmac('sha256',k).update(s).digest()]},CacheService:{getScriptCache:()=>({get:k=>seen.has(k)?'1':null,put:k=>seen.add(k)})},getSS_:()=>{reads++;return{getId:()=> 'own-workbook',getSpreadsheetTimeZone:()=> 'Asia/Tehran',getSheets:()=>[]}},PropertiesService:{getScriptProperties:()=>({getProperties:()=>({fixture:true})})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('MigrationRead.js','utf8'),ctx);
function signed(payload){const timestamp=Date.now(),nonce=crypto.randomBytes(16).toString('hex');return{timestamp,nonce,payload,signature:crypto.createHmac('sha256',key).update(timestamp+'\n'+nonce+'\n'+JSON.stringify(payload)).digest('hex')};}
assert.equal(ctx.sfMigrationRead_({}).ok,false);assert.equal(reads,0);
let body=signed({op:'metadata'});body.signature='0'.repeat(64);assert.equal(ctx.sfMigrationRead_(body).ok,false);assert.equal(reads,0);
body=signed({op:'metadata'});body.timestamp-=120000;assert.equal(ctx.sfMigrationRead_(body).ok,false);assert.equal(reads,0);
body=signed({op:'metadata'});assert.equal(ctx.sfMigrationRead_(body).data.spreadsheetId,'own-workbook');assert.equal(ctx.sfMigrationRead_(body).error,'replayed');
body=signed({op:'rows',sheetId:1,start:0,count:50000});assert.equal(ctx.sfMigrationRead_(body).ok,false);
assert(!/"sfMigrationRead_"|"sfMigrationKey_"/.test(fs.readFileSync('cloudflare/methods.mjs','utf8')));
console.log('PASS owner migration channel: missing/invalid/stale signatures cannot read data; replay denied, ranges bounded and private functions absent from public RPC. Fixtures only.');
