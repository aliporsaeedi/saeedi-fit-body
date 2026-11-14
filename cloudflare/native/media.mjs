import {AppError,authorizeAthlete,requireSession,sha256} from './auth.mjs';
import {mutate,guard} from './mutations.mjs';
import {text,isoToday,records,profile,gate} from './data.mjs';
import {getMediaStore,writeBufferStatements} from './storage.mjs';
export function decodeImage(value,mime,maxBytes){
  if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new AppError('فرمت عکس باید JPEG، PNG یا WebP باشد.');
  const encoded=String(value??'').replace(/^data:image\/(?:jpeg|png|webp);base64,/, '');
  if(!encoded||encoded.length>Math.ceil(maxBytes/3)*4+4||!/^[-A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new AppError('دادهٔ تصویر یا حجم آن معتبر نیست.');
  let raw;try{raw=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));}catch{throw new AppError('دادهٔ تصویر معتبر نیست.');}
  if(raw.length>maxBytes)throw new AppError('حجم تصویر بیشتر از حد مجاز است.',413);
  const jpeg=raw[0]===255&&raw[1]===216&&raw[2]===255,png=[137,80,78,71,13,10,26,10].every((v,i)=>raw[i]===v),webp=String.fromCharCode(...raw.slice(0,4))==='RIFF'&&String.fromCharCode(...raw.slice(8,12))==='WEBP';
  if(!(mime==='image/jpeg'&&jpeg||mime==='image/png'&&png||mime==='image/webp'&&webp))throw new AppError('محتوای فایل با فرمت عکس مطابقت ندارد.');
  return raw;
}
async function byteHash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
async function upload(c,kind,base64,mime,label=''){
  const store=getMediaStore(c.env);
  const bytes=decodeImage(base64,mime,kind==='avatar'?3*1024*1024:12*1024*1024),digest=await byteHash(bytes);
  let staged=null;
  async function removeOrphan(){if(!staged)return;try{const registered=await c.db.prepare('SELECT media_id FROM media_objects WHERE media_id=?').bind(staged.id).first();if(!registered)await store.delete(staged.key);}catch{/* Keep private orphan rather than risk deleting a committed image. */}}
  try{
    const result=await mutate(c,'upload:'+kind,[digest,mime,text(label)],async()=>{
      const id=crypto.randomUUID(),suffix=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp',key='private/'+await sha256(c.user.username_key)+'/'+kind+'/'+id+'.'+suffix,url='/api/media/'+id,at=new Date().toISOString();
      await store.put(key,bytes,{httpMetadata:{contentType:mime},customMetadata:{sha256:digest}});staged={id,key};
      const statements=[c.db.prepare('INSERT INTO media_objects(media_id,owner_key,kind,object_key,mime,bytes,sha256,created_at,storage) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,c.user.username_key,kind,key,mime,bytes.length,digest,at,store.kind),...writeBufferStatements(c.db,store.kind,id,bytes)];
      if(kind==='avatar')statements.push(c.db.prepare("UPDATE profiles SET body=json_set(body,'$.avatarUrl',?),updated_at=? WHERE username_key=?").bind(url,at,c.user.username_key),guard(c.db));
      else statements.push(c.db.prepare("INSERT INTO records(record_id,kind,owner_key,date_key,body,updated_at) VALUES(?,'ProgressPhotos',?,?,?,?)").bind('native:photo:'+id,c.user.username_key,isoToday(),JSON.stringify({Username:c.user.username,DateISO:isoToday(),Label:text(label).slice(0,120),FileId:id,Url:url,CreatedAt:at}),at));
      return{base:{ok:true,fileId:id,url},statements};
    },async base=>{if(kind==='avatar'){const p=await profile(c.db,c.user);return{...base,url:p.avatarUrl,profile:p};}return{...base,photos:(await records(c.db,'ProgressPhotos',c.user.username_key)).map(r=>({date:r.date_key,label:text(r.value.Label),url:text(r.value.Url)})).sort((a,b)=>a.date.localeCompare(b.date))};});
    if(staged&&result.fileId!==staged.id)await removeOrphan();return result;
  }catch(error){await removeOrphan();throw error;}
}
export async function serveMedia(request,env,id){
  if(!/^[a-f0-9-]{36}$/.test(id))throw new AppError('فایل پیدا نشد.',404);
  const user=await requireSession(env.DB,request),file=await env.DB.prepare('SELECT * FROM media_objects WHERE media_id=?').bind(id).first();
  if(!file)throw new AppError('فایل پیدا نشد.',404);
  if(file.kind==='exercise'){if(!(await gate(env.DB,user)).features.gif)throw new AppError('رسانهٔ این حرکت برای اشتراک شما فعال نیست.',403);}
  else {if(file.kind==='receipt'&&file.owner_key!==user.username_key&&user.role!=='admin')throw new AppError('دسترسی به این فایل مجاز نیست.',403);await authorizeAthlete(env.DB,user,file.owner_key);}
  const object=await getMediaStore(env,file.storage).get(file.object_key,id);if(!object)throw new AppError('فایل در فضای ذخیره‌سازی پیدا نشد.',404);
  return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':file.mime,'Content-Length':String(file.bytes),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'",'X-Robots-Tag':'noindex, nofollow'}});
}
export const MEDIA_METHODS={uploadProfileAvatar:(c,_token,bytes,mime)=>upload(c,'avatar',bytes,mime),uploadProgressPhoto:(c,_token,bytes,mime,label)=>upload(c,'progress',bytes,mime,label)};
