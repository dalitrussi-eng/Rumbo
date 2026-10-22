const C='rumbo-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/','/icon.svg'])));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||(u.origin!==location.origin&&!u.host.includes('fonts.g')))return;
 e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r.mode==='navigate'?'/':r,cp));return res}).catch(()=>caches.match(r.mode==='navigate'?'/':r)))});
