// Kamera olmadan test için yapay hareket: sol kol sallanır, sağ kol öne-arkaya gider,
// kişi çömelip kalkar ve hafifçe yana kayar. MediaPipe düzeninde (y aşağı) üretilir.
import { EKLEM_SAYISI } from './sabitler.js';

export function demoPozu(t) {
  const p = Array.from({ length: EKLEM_SAYISI }, () => [0, 0, 0]);
  const comel = 0.12 * (0.5 + 0.5 * Math.sin(t * 1.3));
  p[23] = [0.10, 0, 0];
  p[24] = [-0.10, 0, 0];
  p[25] = [0.10, 0.42 - comel, -comel * 1.5];
  p[26] = [-0.10, 0.42 - comel, -comel * 1.5];
  p[27] = [0.10, 0.82 - comel * 2, 0];
  p[28] = [-0.10, 0.82 - comel * 2, 0];
  p[29] = [0.10, 0.86 - comel * 2, 0.05];
  p[30] = [-0.10, 0.86 - comel * 2, 0.05];
  p[31] = [0.11, 0.88 - comel * 2, -0.12];
  p[32] = [-0.11, 0.88 - comel * 2, -0.12];
  p[11] = [0.18, -0.50, 0];
  p[12] = [-0.18, -0.50, 0];
  // Sol kol yana açık, dirsekten sallanıyor
  const a = 0.6 * Math.sin(t * 3.0) + 0.6;
  p[13] = [0.45, -0.50, 0];
  p[15] = [0.45 + 0.27 * Math.cos(a), -0.50 - 0.27 * Math.sin(a), 0];
  // Sağ kol aşağıda, öne-arkaya sallanıyor
  const b = 0.5 * Math.sin(t * 2.0);
  p[14] = [-0.20, -0.22, -0.05];
  p[16] = [-0.20, -0.22 + 0.26 * Math.cos(b), -0.05 - 0.26 * Math.sin(b)];
  for (const [bilek, dirsek, parmaklar] of [[15, 13, [17, 19, 21]], [16, 14, [18, 20, 22]]]) {
    const d = p[bilek].map((v, k) => v - p[dirsek][k]);
    const u = Math.hypot(...d) || 1;
    parmaklar.forEach((j, k) => {
      p[j] = p[bilek].map((v, m) => v + (d[m] / u) * 0.08 + (m === 2 ? (k - 1) * 0.02 : 0));
    });
  }
  // Baş, hafifçe sağa sola döner
  const don = 0.4 * Math.sin(t * 0.8);
  const bas = [0, -0.68, -0.02];
  const ileri = [Math.sin(don) * -0.1, 0.02, -Math.cos(don) * 0.1];
  p[0] = bas.map((v, k) => v + ileri[k]);
  p[7] = [bas[0] + 0.08 * Math.cos(don), bas[1], bas[2] - 0.08 * Math.sin(don)];
  p[8] = [bas[0] - 0.08 * Math.cos(don), bas[1], bas[2] + 0.08 * Math.sin(don)];
  for (let i = 1; i <= 6; i++) {
    const kulak = i <= 3 ? p[7] : p[8];
    p[i] = p[0].map((v, k) => v * 0.6 + kulak[k] * 0.4 - (k === 1 ? 0.03 : 0));
  }
  p[9] = p[0].map((v, k) => v + (k === 1 ? 0.05 : 0) + (k === 0 ? 0.03 : 0));
  p[10] = p[0].map((v, k) => v + (k === 1 ? 0.05 : 0) - (k === 0 ? 0.03 : 0));

  const kayma = 0.15 * Math.sin(t * 0.5);
  const dunya = new Float32Array(EKLEM_SAYISI * 3);
  const goruntu = new Float32Array(EKLEM_SAYISI * 2);
  const gorunurluk = new Float32Array(EKLEM_SAYISI).fill(1);
  for (let i = 0; i < EKLEM_SAYISI; i++) {
    dunya.set(p[i], i * 3);
    goruntu[i * 2] = 0.5 + kayma + p[i][0] * 0.35;
    goruntu[i * 2 + 1] = 0.5 + p[i][1] * 0.45;
  }
  return { dunya, goruntu, gorunurluk };
}
