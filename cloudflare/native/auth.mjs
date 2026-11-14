const encoder=new TextEncoder();
export const SESSION_COOKIE='__Host-sfb_session';
const TTL=6*60*60,ITERATIONS=100000;
export class AppError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const usernameKey=value=>String(value??'').trim().toLowerCase();
const hex=buffer=>Array.from(new Uint8Array(buffer),n=>n.toString(16).padStart(2,'0')).join('');
export const sha256=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
function same(a,b){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
async function pbkdf2(password,salt,iterations){
  const k=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},k,256));
}
export async function makePassword(password){const salt=hex(crypto.getRandomValues(new Uint8Array(16)));return 'pbkdf2-sha256$'+ITERATIONS+'$'+salt+'$'+await pbkdf2(password,salt,ITERATIONS);}
export async function passwordMatches(candidate,stored){
  const value=String(candidate??'');if(value.length>1024||typeof stored!=='string')return false;
  if(stored.startsWith('pbkdf2-sha256$')){
    const [algorithm,count,salt,digest,...extra]=stored.split('$'),n=Number(count);
    if(extra.length||!Number.isInteger(n)||n<100000||n>100000||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(digest))return false;
    return same(await pbkdf2(value,salt,n),digest);
  }
  const parts=stored.split('$');
  if(parts.length>1){const salt=parts.at(-2),digest=parts.at(-1);if(!/^[a-f0-9]{64}$/i.test(digest))return false;return same(await sha256(salt+'::'+value),digest.toLowerCase())||same(await sha256(salt+'::'+value.trim()),digest.toLowerCase());}
  return same(value.trim(),stored);
}
function cookieToken(request){const match=request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-sfb_session=([a-f0-9]{64})(?:;|$)/);return match?.[1]||'';}
export function sessionCookie(token){return SESSION_COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+TTL;}
export function clearCookie(){return SESSION_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';}
async function reserve(db,bucket,max,now){
  const row=await db.prepare(`INSERT INTO auth_attempts(bucket,attempts,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END
    WHERE expires_at<=? OR attempts<? RETURNING attempts`).bind(bucket,now+900,now,now,now,max).first();
  if(!row)throw new AppError('تلاش‌های ورود بیش از حد مجاز است؛ 15 دقیقه دیگر دوباره امتحان کنید.',429);
}
export async function login(db,request,username,password){
  const key=usernameKey(username),value=String(password??''),now=Math.floor(Date.now()/1000);
  if(!key||key.length>120||!value||value.length>1024)throw new AppError('نام کاربری یا رمز عبور اشتباه است.',401);
  const ip=request.headers.get('CF-Connecting-IP')||'local-test';
  await reserve(db,'ip:'+await sha256(ip),60,now);
  await reserve(db,'account:'+await sha256(key),8,now);
  const user=await db.prepare('SELECT * FROM accounts WHERE username_key=? AND active=1').bind(key).first();
  // Keep the expensive path for unknown usernames too.
  const valid=await passwordMatches(value,user?.password_hash||('pbkdf2-sha256$100000$'+'0'.repeat(32)+'$'+'0'.repeat(64)));
  if(user&&!valid&&!user.password_hash.startsWith('pbkdf2-sha256$'))await pbkdf2('invalid-login','0'.repeat(32),ITERATIONS);
  if(!user||!valid)throw new AppError('نام کاربری یا رمز عبور اشتباه است.',401);
  const token=hex(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await sha256(token);
  let passwordHash=user.password_hash;
  if(!passwordHash.startsWith('pbkdf2-sha256$')){const canonical=await passwordMatches(value.trim(),passwordHash)?value.trim():value;passwordHash=await makePassword(canonical);}
  // Password compatibility upgrade and session creation commit atomically.
  await db.batch([
    db.prepare('UPDATE accounts SET password_hash=?,updated_at=? WHERE username_key=? AND password_hash=? AND active=1 AND auth_version=?').bind(passwordHash,new Date().toISOString(),key,user.password_hash,user.auth_version),
    db.prepare(`INSERT INTO auth_sessions(token_hash,username_key,auth_version,created_at,expires_at)
      SELECT ?,username_key,auth_version,?,? FROM accounts WHERE username_key=? AND active=1 AND auth_version=? AND password_hash=?`).bind(tokenHash,now,now+TTL,key,user.auth_version,passwordHash),
    db.prepare('DELETE FROM auth_attempts WHERE bucket=?').bind('account:'+await sha256(key)),
  ]);
  const session=await db.prepare('SELECT token_hash FROM auth_sessions WHERE token_hash=?').bind(tokenHash).first();
  if(!session)throw new AppError('حساب تغییر کرده است؛ دوباره وارد شوید.',401);
  return{cookie:sessionCookie(token),data:{ok:true,token:'cookie',user:{username:user.username,role:user.role}}};
}
export async function requireSession(db,request){
  const token=cookieToken(request);if(!token)throw new AppError('جلسه ورود معتبر نیست. دوباره وارد شوید.',401);
  const user=await db.prepare(`SELECT a.username_key,a.username,a.role,a.email,a.coach_key,a.telegram_chat_id FROM auth_sessions s
    JOIN accounts a ON a.username_key=s.username_key AND a.auth_version=s.auth_version
    WHERE s.token_hash=? AND s.expires_at>? AND a.active=1`).bind(await sha256(token),Math.floor(Date.now()/1000)).first();
  if(!user)throw new AppError('جلسه ورود منقضی شده است. دوباره وارد شوید.',401);
  return user;
}
export async function logout(db,request){const token=cookieToken(request);if(token)await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await sha256(token)).run();return{cookie:clearCookie(),data:{ok:true}};}
export function requireStaff(user){if(!['coach','admin'].includes(user.role))throw new AppError('فقط مربی و ادمین به این بخش دسترسی دارند.',403);return user;}
export function requireAdmin(user){if(user.role!=='admin')throw new AppError('فقط ادمین به این بخش دسترسی دارد.',403);return user;}
export async function authorizeAthlete(db,user,target){
  const key=usernameKey(target);if(key===user.username_key)return key;
  requireStaff(user);const athlete=await db.prepare('SELECT coach_key FROM accounts WHERE username_key=? AND active=1').bind(key).first();
  if(!athlete||user.role!=='admin'&&athlete.coach_key!==user.username_key)throw new AppError('دسترسی به این شاگرد مجاز نیست.',403);
  return key;
}
