// The reference components use the existing Apps Script account and Sheet APIs.
declare global { interface Window { google:any; SF_APP_URL:string; } }
const TOKEN_KEY = "fc_session";
let reportedFailures=0;

export class GasError extends Error {}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setToken(t: string) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export function classicUrl(path='/classic') { const query=path.split('?')[1];return window.SF_APP_URL+'?classic=1'+(query?'&'+query:''); }
export function gas<T = unknown>(fn: string, ...args: unknown[]): Promise<T> {
  // Standalone Cloudflare builds use a same-origin API. Apps Script keeps its
  // original transport during the staged migration; never retry mutations.
  if (!window.google?.script?.run) return httpRpc<T>(fn, args);
  return new Promise((resolve,reject)=>{
    if(!window.google?.script?.run){reject(new GasError('ارتباط با سرور برنامه در دسترس نیست.'));return;}
    window.google.script.run.withSuccessHandler((result:T)=>{
      if(fn==='getBootstrap'){try{const user=(result as any)?.user?.username;if(user)localStorage.setItem('sfb_plan_owner',user);}catch{}}
      resolve(result);
    }).withFailureHandler((e:any)=>{
      const error=new GasError(e?.message||'ارتباط با سرور برقرار نشد.');
      if(fn!=='sfErrorReport' && reportedFailures++<3){try{const token=getToken();const message=fn==='login'?'ورود ناموفق':(token?error.message.split(token).join('[redacted]'):error.message).slice(0,400);window.google.script.run.withSuccessHandler(()=>{}).withFailureHandler(()=>{}).sfErrorReport({app:'athlete-lovable-ui',action:'rpc',fn,message},token);}catch{}}
      reject(error);
    })[fn](...args);
  });
}

async function httpRpc<T>(fn: string, args: unknown[]): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('/api/rpc', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({fn, args}), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new GasError(result.error || 'ارتباط با سرور برقرار نشد.');
    if(fn==='getBootstrap') {
      try { const user=result.data?.user?.username; if(user)localStorage.setItem('sfb_plan_owner',user); } catch {}
    }
    return result.data as T;
  } catch(error) {
    if(error instanceof GasError) throw error;
    throw new GasError('پاسخ سرور دریافت نشد. پیش از تکرار ثبت، وضعیت اطلاعات را بررسی کنید.');
  } finally { clearTimeout(timer); }
}

/** True when the error means the saved login is no longer valid. */
export function isSessionError(e: unknown) {
  return e instanceof Error && /جلسه/.test(e.message);
}

