const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({});const source=fs.readFileSync('TrainingModule.js','utf8');vm.runInContext(source.slice(source.indexOf('function sfEnsureSheet_('),source.indexOf('var __SF_ENSURE_USED_')),ctx);
let wroteAt=0;const sheet={getLastColumn:()=>3,getRange:(row,col,h,w)=>({getValues:()=>[['ID','','Name']],setValues:values=>{wroteAt=col;assert.equal(values[0][0],'Status');}}),setFrozenRows:()=>{}};
Object.assign(ctx,{SF_HEADERS:{Bank:['ID','Name','Status']},SF_TEXT_COLS:{Bank:null},normalize_:x=>String(x||'').trim()});ctx.sfEnsureSheet_({getSheetByName:()=>sheet},'Bank');assert.equal(wroteAt,4);
const api=fs.readFileSync('AdminApi.js','utf8');vm.runInContext(api.slice(api.indexOf('function adm_ensure_('),api.indexOf('function adm_bank_(')),ctx);
let called=0;const props={ADM_READY_V2:'1'};Object.assign(ctx,{adm_register_:()=>{},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],deleteProperty:k=>delete props[k],setProperty:(k,v)=>props[k]=v})},SF:{READY_PROP:'SF_READY'},sfEnsure_:()=>called++,sfEnsureV16_:()=>{}});
ctx.adm_ensure_();assert.equal(called,1);assert.equal(props.ADM_READY_V3_REVIEW,'1');ctx.adm_ensure_();assert.equal(called,1);console.log('PASS: older databases migrate image review columns once; blank header gaps cannot overwrite existing columns.');
