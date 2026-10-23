const V='nila-v3';
const SHELL=['./','index.html','runtime.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','vendor/xlsx.full.min.js','vendor/pptxgen.bundle.js','vendor/marked.min.js','vendor/purify.min.js','theme.css','studio.js','deck.js','guide.js','sync.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const keep=(req,res)=>{if(res&&res.ok){const c=res.clone();caches.open(V).then(x=>x.put(req,c))}return res};
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);
  if(u.origin===location.origin){
    if(req.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('runtime.js')){e.respondWith(fetch(req).then(r=>keep(req,r)).catch(()=>caches.match(req).then(m=>m||caches.match('index.html'))));return}
    e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>keep(req,r))));return}
  if(/fonts\.(googleapis|gstatic)\.com$/.test(u.host))e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>keep(req,r))));
});
