// Göktaşından Kaç – çevrimdışı çalışma (service worker)
//
// İlk açılışta oyunun bütün dosyaları tabletin hafızasına kaydedilir; sonra internet olmadan da
// açılır. Dosyalar önbellekten hemen verilir ve arka planda yenilenir: GitHub'a yüklenen yeni
// sürüm, bir sonraki açılışta gelir.
// ÖNEMLİ: Dosya eklenir/silinirse DOSYALAR listesini ve SURUM'u güncelle.

const SURUM = 'goktasi-v5b';
const DOSYALAR = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/stil.css",
  "./js/demo-poz.js",
  "./js/filtre.js",
  "./js/guc-modu.js",
  "./js/karakter-insansi.js",
  "./js/karakter-iskelet.js",
  "./js/konum-takip.js",
  "./js/koordinat.js",
  "./js/main.js",
  "./js/onizleme.js",
  "./js/poz-algilayici.js",
  "./js/robot-gorunum.js",
  "./js/sabitler.js",
  "./js/sahne.js",
  "./js/tablet.js",
  "./js/oyun/efektler.js",
  "./js/oyun/hud.js",
  "./js/oyun/nesneler.js",
  "./js/oyun/oyun.js",
  "./js/oyun/ses.js",
  "./lib/mediapipe/vision_bundle.mjs",
  "./lib/mediapipe/wasm/vision_wasm_internal.js",
  "./lib/mediapipe/wasm/vision_wasm_internal.wasm",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_internal.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_internal.wasm",
  "./lib/three/LICENSE.txt",
  "./lib/three/three.module.min.js",
  "./lib/three/addons/controls/OrbitControls.js",
  "./lib/three/addons/geometries/RoundedBoxGeometry.js",
  "./lib/three/addons/loaders/GLTFLoader.js",
  "./lib/three/addons/utils/BufferGeometryUtils.js",
  "./modeller/Xbot.glb",
  "./modeller/pose_landmarker_full.task",
  "./simgeler/simge-192.png",
  "./simgeler/simge-512.png",
];
// Büyük ve değişmeyen dosyalar: önbellekte varsa hiç yenilenmez
const BUYUK = /\.(wasm|task|glb)$/;

self.addEventListener('install', (e) => {
  // Dosyalar tek tek eklenir: biri eksikse (ör. wasm GitHub'a yüklenmediyse) kurulum bozulmasın
  e.waitUntil(caches.open(SURUM)
    .then((c) => Promise.all(DOSYALAR.map((d) => c.add(d).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET') return;
  const url = new URL(istek.url);
  const ayniSite = url.origin === self.location.origin;
  // İnternetten gelen değişmez dosyalar: "hızlı" model (Google) ve sürümü sabit wasm çekirdeği (jsDelivr)
  const model = url.hostname === 'storage.googleapis.com' || url.hostname === 'cdn.jsdelivr.net';
  if (!ayniSite && !model) return;

  e.respondWith(caches.open(SURUM).then(async (onbellek) => {
    const kayitli = await onbellek.match(istek, { ignoreSearch: ayniSite });
    const agdan = fetch(istek).then((yanit) => {
      if (yanit && (yanit.ok || yanit.type === 'opaque')) onbellek.put(istek, yanit.clone());
      return yanit;
    }).catch(() => null);
    if (kayitli) {
      if (!BUYUK.test(url.pathname) && !model) e.waitUntil(agdan);   // arka planda yenile
      return kayitli;
    }
    const yanit = await agdan;
    return yanit || new Response('Çevrimdışı ve önbellekte yok', { status: 503 });
  }));
});
