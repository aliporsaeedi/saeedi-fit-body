import {AppError} from './auth.mjs';
function base64(bytes){let value='';for(let i=0;i<bytes.length;i+=16384)value+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(value);}
export function getMediaStore(env,preferred){
  const kind=preferred||(env.MEDIA?'r2':env.PRIVATE_MEDIA?'kv':'');
  if(kind==='r2'&&env.MEDIA)return{kind,put:(...args)=>env.MEDIA.put(...args),get:(key)=>env.MEDIA.get(key),delete:key=>env.MEDIA.delete(key)};
  if(kind==='kv'&&env.PRIVATE_MEDIA)return{
    kind,
    async put(key,bytes,options){
      try{await env.PRIVATE_MEDIA.put(key,bytes,{metadata:{contentType:options.httpMetadata.contentType,sha256:options.customMetadata.sha256}});}
      catch(error){if(/limit|quota|exceed/i.test(String(error)))throw new AppError('سهمیهٔ فضای فایل‌ها پر شده است؛ تصویر قبلی حفظ شده است. برای افزایش ظرفیت با مدیر هماهنگ کنید.',507);throw new AppError('ذخیرهٔ فایل فعلاً در دسترس نیست؛ تصویر قبلی حفظ شده است.',503);}
    },
    async get(key,id){
      let value;try{value=await env.PRIVATE_MEDIA.get(key,{type:'arrayBuffer'});}catch{}
      if(value)return{body:value};
      // Immutable keys avoid cache invalidation. D1 bridges KV's propagation
      // delay so a just-saved private photo is available from another region.
      const rows=await env.DB.prepare('SELECT payload FROM media_write_buffer WHERE media_id=? ORDER BY chunk_no').bind(id).all();
      if(!rows.results.length)return null;
      const chunks=rows.results.map(r=>Uint8Array.from(atob(r.payload),c=>c.charCodeAt(0))),bytes=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return{body:bytes};
    },
    delete:key=>env.PRIVATE_MEDIA.delete(key),
  };
  throw new AppError('فضای فایل‌های خصوصی این نسخه هنوز فعال نشده است؛ تصویر قبلی شما حفظ شده است.',503);
}
export function writeBufferStatements(db,kind,id,bytes){
  if(kind!=='kv')return[];
  const out=[],chunkSize=512*1024,expires=Math.floor(Date.now()/1000)+86400;
  for(let i=0;i<bytes.length;i+=chunkSize)out.push(db.prepare('INSERT INTO media_write_buffer VALUES(?,?,?,?)').bind(id,i/chunkSize,base64(bytes.subarray(i,i+chunkSize)),expires));
  return out;
}
export async function cleanupMediaBuffers(env){
  if(!env.PRIVATE_MEDIA)return;
  const rows=await env.DB.prepare(`SELECT DISTINCT m.media_id,m.object_key FROM media_write_buffer b JOIN media_objects m ON m.media_id=b.media_id WHERE b.expires_at<? AND m.storage='kv' LIMIT 20`).bind(Math.floor(Date.now()/1000)).all();
  for(const row of rows.results){let present;try{present=await env.PRIVATE_MEDIA.get(row.object_key,{type:'stream'});}catch{continue;}if(!present)continue;await present.cancel();await env.DB.prepare('DELETE FROM media_write_buffer WHERE media_id=?').bind(row.media_id).run();}
}
