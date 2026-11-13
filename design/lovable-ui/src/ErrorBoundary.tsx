import React from 'react';
import {gas,getToken} from './lib/fit/api';
let reports=0;
export function reportError(error:unknown,action='runtime'){
  if(reports++>=3)return;
  const token=getToken(),raw=error instanceof Error?error.message:String(error||'Unknown error');
  const message=(token?raw.split(token).join('[redacted]'):raw).slice(0,400);
  void gas('sfErrorReport',{app:'athlete-lovable-ui',action,message,url:location.origin+location.pathname},token).catch(()=>{});
}
export class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(error:Error){reportError(error,'render');}
  render(){if(this.state.failed)return <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col items-center justify-center gap-4 px-6 text-center"><h1 className="text-xl font-black">نمایش این بخش با مشکل روبه‌رو شد</h1><p className="text-sm text-muted-foreground">اطلاعاتت حفظ شده است. صفحه را دوباره باز کن.</p><button className="glass rounded-xl px-6 py-3 font-bold text-volt" onClick={()=>location.reload()}>تلاش دوباره</button></main>;return this.props.children;}
}
