const CACHE='__SFB_CACHE__',ASSETS=__SFB_ASSETS__;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sfb-public-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const r=event.request,u=new URL(r.url);
 // Private data is never stored here. Athlete-owned downloads live separately,
 // require an explicit download and are invalidated on every login/logout.
 if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/admin')||u.searchParams.has('page'))return;
 if(r.mode==='navigate'&&u.pathname==='/'){event.respondWith(fetch(r).catch(()=>caches.match('/').then(x=>x||Response.error())));return;}
 if(ASSETS.includes(u.pathname)&&u.pathname!=='/')event.respondWith(caches.match(r).then(hit=>hit||fetch(r)));
});
