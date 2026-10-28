// Tablet (dokunmatik cihaz) desteği: tam ekran, yatay kilit, ekranın kararmasını önleme,
// çevrimdışı çalışma (service worker).
//
// Tablet modu kendiliğinden anlaşılır (dokunmatik ekran). Bilgisayarda denemek için adresin
// sonuna ?tablet=1 eklenebilir; zorla kapatmak için ?tablet=0.

const parametre = new URLSearchParams(location.search).get('tablet');
export const DOKUNMATIK = parametre === '1' ? true : parametre === '0' ? false
  : (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1);

/** Tam ekran + yatay kilit. Yalnızca bir dokunuş/tıklama içinden çağrılmalı. */
export async function tamEkranAc() {
  const kok = document.documentElement;
  try {
    if (!document.fullscreenElement && kok.requestFullscreen) await kok.requestFullscreen({ navigationUI: 'hide' });
  } catch { /* tarayıcı izin vermedi; oyun yine çalışır */ }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* kilit desteklenmiyor */ }
}

export function tamEkrandaMi() { return !!document.fullscreenElement; }

export async function tamEkranKapat() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* yok */ }
}

/** Oyun ve kamera açıkken ekranın kararmasını önler (Screen Wake Lock). */
export class EkranAcikTut {
  constructor() {
    this.kilit = null;
    this.istendi = false;
    document.addEventListener('visibilitychange', () => {
      // Sekme geri gelince kilit kendiliğinden düşmüş olur; yeniden iste
      if (document.visibilityState === 'visible' && this.istendi) this._iste();
    });
  }

  async ac() { this.istendi = true; await this._iste(); }

  async kapat() {
    this.istendi = false;
    try { await this.kilit?.release(); } catch { /* yok */ }
    this.kilit = null;
  }

  async _iste() {
    if (!('wakeLock' in navigator) || this.kilit) return;
    try {
      this.kilit = await navigator.wakeLock.request('screen');
      this.kilit.addEventListener('release', () => { this.kilit = null; });
    } catch { /* pil tasarrufu modu vb. — oyun yine çalışır */ }
  }
}

/** İnternetsiz çalışma için service worker (yalnızca https veya localhost'ta çalışır). */
export function cevrimdisiHazirla() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const kaydet = () => navigator.serviceWorker
    .register(new URL('../sw.js', import.meta.url).href, { scope: new URL('../', import.meta.url).href })
    .catch((e) => console.warn('[çevrimdışı] service worker kaydedilemedi:', e));
  if (document.readyState === 'complete') kaydet();
  else window.addEventListener('load', kaydet);
}
