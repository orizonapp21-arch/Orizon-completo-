const CACHE_NOME = "orizon-cache-v23";
const ARQUIVOS_PARA_CACHE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./logo-emblema.png", "./logo-orizon.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE)));
  self.skipWaiting();
});
self.addEventListener("activate", (evento) => {
  evento.waitUntil(caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NOME).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      const buscaRede = fetch(evento.request).then((respostaRede) => {
        caches.open(CACHE_NOME).then((cache) => cache.put(evento.request, respostaRede.clone()));
        return respostaRede;
      }).catch(() => respostaCache);
      return respostaCache || buscaRede;
    })
  );
});
