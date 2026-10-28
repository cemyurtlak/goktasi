// MediaPipe koordinatlarını karakterin (avatarın) kendi eksenine çevirir.
//
// MediaPipe dünya koordinatı: metre, kalça merkezi (0,0,0); x resimde sağa, y AŞAĞI,
// z kameraya yaklaştıkça KÜÇÜLÜR. Kişinin SOL tarafı resimde SAĞDA (x+) görünür.
//
// Avatar ekseni (Three.js): avatar ekrana (+z) bakıyor, y yukarı, avatarın SOLU +x.
//   Anatomik (ayna kapalı):  avatar = ( x, -y, -z)   -> kişinin sol eli = avatarın sol eli
//   Ayna açık:               x işareti çevrilir ve sol/sağ eklemler yer değiştirir
//                            -> oyuncu sağ elini kaldırınca ekrandaki avatar, aynadaki gibi
//                               ekranın aynı tarafındaki elini kaldırır.

import * as THREE from 'three';
import { EKLEM_SAYISI, SOL_SAG_CIFTLERI } from './sabitler.js';

const AYNA_ESI = new Int8Array(EKLEM_SAYISI).map((_, i) => i);
for (const [a, b] of SOL_SAG_CIFTLERI) { AYNA_ESI[a] = b; AYNA_ESI[b] = a; }

/**
 * Oyuncunun kameraya önünü mü arkasını mı döndüğüne karar verir.
 * MediaPipe sırtı dönük kişide sol ile sağı sık sık karıştırır (kişiyi önden bakıyor sanar).
 * Yüz noktalarının (burun, gözler) görünürlüğü daha güvenilirdir: yüz görünüyorsa önden,
 * görünmüyorsa arkadan bakılıyordur. Titremeyi önlemek için karar birkaç kare üst üste
 * aynı çıkınca değişir.
 */
export class YonKarar {
  constructor(gerekenKare = 5) {
    this.arkaDonuk = false;
    this.sayac = 0;
    this.gerekenKare = gerekenKare;
  }

  sifirla() { this.arkaDonuk = false; this.sayac = 0; }

  /** @returns {boolean} arkası dönük mü */
  guncelle(poz) {
    const g = poz.gorunurluk;
    const yuz = (g[0] + g[2] + g[5]) / 3;           // burun, sol göz, sağ göz
    let hedef = this.arkaDonuk;
    if (yuz > 0.6) hedef = false;
    else if (yuz < 0.35) hedef = true;
    if (hedef !== this.arkaDonuk) {
      if (++this.sayac >= this.gerekenKare) { this.arkaDonuk = hedef; this.sayac = 0; }
    } else {
      this.sayac = 0;
    }
    return this.arkaDonuk;
  }
}

/**
 * Ham pozu avatar uzayına çevirir.
 * @param {{dunya:Float32Array, goruntu:Float32Array, gorunurluk:Float32Array}} poz
 * @param {boolean} ayna
 * @param {boolean|null} arkaDonuk  null = yön düzeltme kapalı (MediaPipe'a olduğu gibi güven);
 *   false = oyuncu önden bakıyor, true = sırtı dönük. Sol/sağ etiketleri buna uyacak şekilde düzeltilir.
 * @returns {{p: THREE.Vector3[], n: Float32Array, v: Float32Array, arkaDonuk: boolean}}
 *   p: avatar uzayında 33 nokta (metre), n: görüntü koordinatı (ayna uygulanmış, 0..1),
 *   v: görünürlük (ayna eşleşmesine göre yeniden sıralı)
 */
export function avatarUzayinaCevir(poz, ayna, arkaDonuk = false) {
  const p = new Array(EKLEM_SAYISI);
  const n = new Float32Array(EKLEM_SAYISI * 2);
  const v = new Float32Array(EKLEM_SAYISI);
  // Önden bakan kişide sol omuz/kalça resimde SAĞDA (x+) olur, sırtı dönükte SOLDA.
  // Etiketler beklenen yönle uyuşmuyorsa sol/sağ yer değiştirilir.
  const x = (i) => poz.dunya[i * 3];
  const solSagdaMi = (x(11) - x(12)) + (x(23) - x(24)) > 0;
  let ters = false;
  if (arkaDonuk !== null) ters = arkaDonuk ? solSagdaMi : !solSagdaMi;
  for (let i = 0; i < EKLEM_SAYISI; i++) {
    const kaynak = (ayna !== ters) ? AYNA_ESI[i] : i;
    const px = poz.dunya[kaynak * 3], py = poz.dunya[kaynak * 3 + 1], pz = poz.dunya[kaynak * 3 + 2];
    p[i] = new THREE.Vector3(ayna ? -px : px, -py, -pz);
    const nx = poz.goruntu[kaynak * 2], ny = poz.goruntu[kaynak * 2 + 1];
    n[i * 2] = ayna ? 1 - nx : nx;
    n[i * 2 + 1] = ny;
    v[i] = poz.gorunurluk[kaynak];
  }
  // Sırtı dönükken yüz noktaları tahmindir: baş, gövdeyi takip etsin diye görünmez say.
  const arka = arkaDonuk === null ? !solSagdaMi : arkaDonuk;
  if (arka) for (let i = 0; i <= 10; i++) if (i !== 7 && i !== 8) v[i] = Math.min(v[i], 0.1);
  return { p, n, v, arkaDonuk: arka };
}

export function orta(a, b) {
  return new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
}
