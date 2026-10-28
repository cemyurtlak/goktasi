// Oyun nesneleri: göktaşları (düşen ve yatay) ve yıldız
import * as THREE from 'three';
import { parlamaSprite } from './efektler.js';

// ---------------------------------------------------------------- ortak geometriler
const tasGeometrileri = [];
function tasGeometrisi() {
  if (tasGeometrileri.length < 4) {
    // Pürüzlü taş: ikosahedronun köşelerini rastgele it
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const tohum = Math.random() * 10;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + 0.22 * Math.sin(v.x * 3.1 + tohum) * Math.cos(v.y * 2.7 + tohum) + 0.12 * Math.sin(v.z * 5 + tohum);
      v.multiplyScalar(n);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    tasGeometrileri.push(g);
    return g;
  }
  return tasGeometrileri[Math.floor(Math.random() * tasGeometrileri.length)];
}

const tasMalzemesi = new THREE.MeshStandardMaterial({
  color: 0x5a3a2a, roughness: 0.95, emissive: 0xff4a00, emissiveIntensity: 0.35, flatShading: true,
});

// ---------------------------------------------------------------- Göktaşı
export class Goktasi {
  /**
   * @param {'dusen'|'yuksek'|'orta'|'alcak'} tur  düşen = yukarıdan düşer (kaç), yüksek = baş hizasında
   *   gelir (eğil), orta = gövde hizasında gelir (yana kaç), alçak = ayak hizasında gelir (zıpla)
   * @param {THREE.Vector3} bas  başlangıç noktası
   * @param {THREE.Vector3} son  bitiş noktası (düşen için çarpma noktası)
   * @param {number} sure  uçuş süresi (sn)
   * @param {number} yaricap
   */
  constructor(tur, bas, son, sure, yaricap) {
    this.tur = tur;
    this.bas = bas.clone();
    this.son = son.clone();
    this.sure = sure;
    this.r = yaricap;
    this.t = 0;
    this.bitti = false;
    this.carpti = false;
    this.oncekiKonum = bas.clone();

    this.grup = new THREE.Group();
    const tas = new THREE.Mesh(tasGeometrisi(), tasMalzemesi);
    tas.scale.setScalar(yaricap);
    tas.castShadow = true;
    this.tas = tas;
    this.donmeEkseni = new THREE.Vector3().randomDirection();
    this.grup.add(tas);

    // Ateş kuyruğu: hareket yönünün tersine dizilmiş parlamalar
    this.kuyruk = [];
    const renkler = [0xffd07a, 0xff8a1f, 0xff4a00, 0xb02000, 0x601000];
    renkler.forEach((renk, i) => {
      const s = parlamaSprite(renk, yaricap * (3.2 - i * 0.45));
      s.material.opacity = 0.9 - i * 0.15;
      this.kuyruk.push(s);
      this.grup.add(s);
    });
    this.yon = new THREE.Vector3().subVectors(son, bas).normalize();
    this.kuyruk.forEach((s, i) => s.position.copy(this.yon).multiplyScalar(-yaricap * (0.6 + i * 1.1)));

    // Uyarı: düşen için zeminde halka, yataylar için zeminde iz çizgisi
    if (tur === 'dusen') {
      this.uyari = new THREE.Mesh(
        new THREE.RingGeometry(yaricap * 1.6, yaricap * 2.1, 32),
        new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      );
      this.uyari.rotation.x = -Math.PI / 2;
      this.uyari.position.set(son.x, 0.01, son.z);
    } else {
      const uzunluk = bas.distanceTo(son);
      this.uyari = new THREE.Mesh(
        new THREE.PlaneGeometry(yaricap * 2.2, uzunluk),
        new THREE.MeshBasicMaterial({ color: { yuksek: 0xffd23d, orta: 0xff8a1f, alcak: 0x3fd0ff }[tur], transparent: true, opacity: 0.12, depthWrite: false }),
      );
      this.uyari.rotation.x = -Math.PI / 2;
      this.uyari.position.set((bas.x + son.x) / 2, 0.01, (bas.z + son.z) / 2);
    }
    this.grup.position.copy(bas);
  }

  get konum() { return this.grup.position; }

  sahneyeEkle(sahne) { sahne.add(this.grup, this.uyari); }

  sahnedenCikar(sahne) {
    sahne.remove(this.grup, this.uyari);
    this.uyari.geometry.dispose();
    this.uyari.material.dispose();
    this.kuyruk.forEach((s) => s.material.dispose());
  }

  guncelle(dt) {
    this.oncekiKonum.copy(this.grup.position);
    this.t = Math.min(1, this.t + dt / this.sure);
    this.grup.position.lerpVectors(this.bas, this.son, this.t);
    this.tas.rotateOnAxis(this.donmeEkseni, dt * 4);
    // Uyarı yaklaştıkça belirginleşir
    const yakinlik = this.tur === 'dusen' ? this.t : Math.min(1, this.t * 1.6);
    this.uyari.material.opacity = 0.15 + 0.6 * yakinlik * (0.75 + 0.25 * Math.sin(this.t * 40));
    if (this.tur === 'dusen') this.uyari.scale.setScalar(1.4 - 0.4 * this.t);
    if (this.t >= 1) this.bitti = true;
  }
}

// ---------------------------------------------------------------- Yıldız
function yildizSekli(dis = 1, ic = 0.45, kose = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < kose * 2; i++) {
    const r = i % 2 === 0 ? dis : ic;
    const a = (i / (kose * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
const yildizGeo = new THREE.ExtrudeGeometry(yildizSekli(), { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 });
yildizGeo.center();

export class Yildiz {
  constructor(konum, omur = 8) {
    this.grup = new THREE.Group();
    this.grup.position.copy(konum);
    this.merkez = konum.clone();
    this.r = 0.16;
    this.omur = omur;
    this.yas = 0;
    this.bitti = false;
    const m = new THREE.Mesh(yildizGeo, new THREE.MeshStandardMaterial({
      color: 0xffd23d, emissive: 0xffa000, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.3,
    }));
    m.scale.setScalar(this.r);
    m.castShadow = true;
    this.mesh = m;
    this.parlama = parlamaSprite(0xffe27a, 0.9);
    this.grup.add(this.parlama, m);
  }

  sahneyeEkle(sahne) { sahne.add(this.grup); }
  sahnedenCikar(sahne) {
    sahne.remove(this.grup);
    this.mesh.material.dispose();
    this.parlama.material.dispose();
  }

  guncelle(dt) {
    this.yas += dt;
    this.mesh.rotation.y += dt * 2.5;
    this.grup.position.y = this.merkez.y + Math.sin(this.yas * 3) * 0.05;
    const s = 0.9 + 0.2 * Math.sin(this.yas * 6);
    this.parlama.scale.setScalar(s);
    // Son 2 saniyede yanıp söner
    const kalan = this.omur - this.yas;
    this.grup.visible = kalan > 2 || Math.sin(this.yas * 25) > 0;
    if (this.yas >= this.omur) this.bitti = true;
  }
}
