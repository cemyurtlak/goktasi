// Kamera görüntüsünün üstüne algılanan iskeleti çizer (ham MediaPipe görüntü koordinatlarıyla)
import { BAGLANTILAR, EKLEM_SAYISI, GORUNURLUK_ESIGI } from './sabitler.js';

export function iskeletCiz(tuval, poz) {
  const ctx = tuval.getContext('2d');
  const w = tuval.width, h = tuval.height;
  ctx.clearRect(0, 0, w, h);
  if (!poz) return;
  const { goruntu: n, gorunurluk: v } = poz;
  ctx.lineWidth = Math.max(2, w / 200);
  ctx.strokeStyle = '#3dff9a';
  ctx.beginPath();
  for (const [a, b] of BAGLANTILAR) {
    if (v[a] < GORUNURLUK_ESIGI || v[b] < GORUNURLUK_ESIGI) continue;
    ctx.moveTo(n[a * 2] * w, n[a * 2 + 1] * h);
    ctx.lineTo(n[b * 2] * w, n[b * 2 + 1] * h);
  }
  ctx.stroke();
  ctx.fillStyle = '#ff9a1f';
  for (let i = 0; i < EKLEM_SAYISI; i++) {
    if (v[i] < GORUNURLUK_ESIGI) continue;
    ctx.beginPath();
    ctx.arc(n[i * 2] * w, n[i * 2 + 1] * h, Math.max(3, w / 160), 0, Math.PI * 2);
    ctx.fill();
  }
}
