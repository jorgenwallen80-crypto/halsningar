const CACHE_NAME = 'handelser-v7.3.5';
const APP_SHELL = [
  './','./index.html','./vanner/','./admin/','./vanner.html','./admin.html',
  './styles.css','./icons.js','./config.js','./data.js','./app.js','./upload.js','./admin.js','./pwa.js',
  './manifest.json','./icon-192.png','./icon-512.png','./facts.js','./sudoku.js','./floral-bouquet.svg','./floral-corner.svg','./flower-mark.svg'
];
self.addEventListener('install',(event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate',(event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key!==CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch',(event) => {
  if (event.request.method!=='GET') return;
  const url = new URL(event.request.url);
  if (url.origin!==location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request,copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
});
self.addEventListener('message',(event) => { if (event.data && event.data.type==='SKIP_WAITING') self.skipWaiting(); });
