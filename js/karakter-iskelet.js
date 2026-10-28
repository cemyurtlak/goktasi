// Model gerektirmeyen iskelet karakter: eklemlerde küreler, aralarında silindir kemikler.
// Noktalar doğrudan algılanan konumlara konduğu için hareket birebir görünür.
import * as THREE from 'three';
import { BAGLANTILAR, EKLEM_SAYISI, GORUNURLUK_ESIGI } from './sabitler.js';
import { orta } from './koordinat.js';

const YUKARI = new THREE.Vector3(0, 1, 0);

export class IskeletKarakter {
  constructor() {
    this.grup = new THREE.Group();
    this.grup.name = 'IskeletKarakter';
    const eklemMat = new THREE.MeshStandardMaterial({ color: 0xffa21f, roughness: 0.4, emissive: 0x331a00 });
    const solMat = new THREE.MeshStandardMaterial({ color: 0x3fd0ff, roughness: 0.5 });
    const sagMat = new THREE.MeshStandardMaterial({ color: 0xff5d8f, roughness: 0.5 });
    const govdeMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ff, roughness: 0.5 });

    const kureGeo = new THREE.SphereGeometry(1, 16, 12);
    this.eklemler = [];
    for (let i = 0; i < EKLEM_SAYISI; i++) {
      const m = new THREE.Mesh(kureGeo, eklemMat);
      const r = i <= 10 ? 0.018 : 0.035;
      m.scale.setScalar(r);
      m.castShadow = true;
      this.grup.add(m);
      this.eklemler.push(m);
    }
    this.bas = new THREE.Mesh(kureGeo, govdeMat);
    this.bas.scale.setScalar(0.11);
    this.bas.castShadow = true;
    this.grup.add(this.bas);

    const silGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
    this.kemikler = BAGLANTILAR.map(([a, b]) => {
      const sol = a % 2 === 1 && b % 2 === 1;
      const sag = a % 2 === 0 && b % 2 === 0;
      const m = new THREE.Mesh(silGeo, sol ? solMat : sag ? sagMat : govdeMat);
      m.castShadow = true;
      this.grup.add(m);
      return { a, b, m, r: (a >= 23 && b >= 23 && b <= 28) ? 0.035 : 0.025 };
    });
  }

  /**
   * @param {{p:THREE.Vector3[], v:Float32Array}} avatarPoz avatar uzayında noktalar
   * @param {number} zeminOfseti noktalara eklenecek dikey kaydırma (ayakları zemine oturtur)
   */
  guncelle(avatarPoz, zeminOfseti) {
    const { p, v } = avatarPoz;
    const ofs = new THREE.Vector3(0, zeminOfseti, 0);
    const k = p.map((x) => x.clone().add(ofs));
    for (let i = 0; i < EKLEM_SAYISI; i++) {
      this.eklemler[i].position.copy(k[i]);
      this.eklemler[i].visible = v[i] > GORUNURLUK_ESIGI && (i === 0 || i > 10);
    }
    const kulakOrta = orta(k[7], k[8]);
    this.bas.position.copy(kulakOrta);
    if (v[0] > GORUNURLUK_ESIGI) this.bas.position.lerp(k[0], 0.35);
    this.bas.visible = v[0] > GORUNURLUK_ESIGI || (v[7] > GORUNURLUK_ESIGI && v[8] > GORUNURLUK_ESIGI);
    for (const kem of this.kemikler) {
      const A = k[kem.a], B = k[kem.b];
      const yon = new THREE.Vector3().subVectors(B, A);
      const boy = yon.length();
      const gorunur = v[kem.a] > GORUNURLUK_ESIGI && v[kem.b] > GORUNURLUK_ESIGI && boy > 1e-4;
      kem.m.visible = gorunur;
      if (!gorunur) continue;
      kem.m.position.copy(A).addScaledVector(yon, 0.5);
      kem.m.quaternion.setFromUnitVectors(YUKARI, yon.divideScalar(boy));
      kem.m.scale.set(kem.r, boy, kem.r);
    }
  }
}

/** Ayakları zemine oturtmak için gereken dikey kaydırma. Bacaklar görünmüyorsa kalça ~0.95 m. */
export function iskeletZeminOfseti(avatarPoz) {
  const { p, v } = avatarPoz;
  const ayaklar = [27, 28, 29, 30, 31, 32].filter((i) => v[i] > GORUNURLUK_ESIGI);
  if (ayaklar.length < 2) return 0.95;
  const enAlt = Math.min(...ayaklar.map((i) => p[i].y));
  return -enAlt + 0.03;
}
