// Görsel efektler: parlama dokusu, patlama parçacıkları, yanık izi
import * as THREE from 'three';

let _parlamaDokusu = null;
/** Ortası parlak, kenarı saydam yuvarlak doku (canvas ile üretilir) */
export function parlamaDokusu() {
  if (_parlamaDokusu) return _parlamaDokusu;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _parlamaDokusu = new THREE.CanvasTexture(c);
  return _parlamaDokusu;
}

export function parlamaSprite(renk, boyut) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: parlamaDokusu(), color: renk, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(boyut);
  return s;
}

export class Efektler {
  constructor(sahne) {
    this.sahne = sahne;
    this.liste = [];
  }

  /** Patlama: dışa saçılan parçacıklar + parlama */
  patlama(konum, { renk = 0xff7a1a, adet = 60, guc = 4, boyut = 0.12, sure = 0.9 } = {}) {
    const geo = new THREE.BufferGeometry();
    const poz = new Float32Array(adet * 3);
    const hiz = new Float32Array(adet * 3);
    for (let i = 0; i < adet; i++) {
      poz.set([konum.x, konum.y, konum.z], i * 3);
      const yon = new THREE.Vector3().randomDirection();
      yon.y = Math.abs(yon.y) * 0.8 + 0.2;
      yon.multiplyScalar(guc * (0.4 + Math.random() * 0.6));
      hiz.set([yon.x, yon.y, yon.z], i * 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
    const mat = new THREE.PointsMaterial({
      color: renk, size: boyut, map: parlamaDokusu(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const noktalar = new THREE.Points(geo, mat);
    noktalar.frustumCulled = false;
    const parlama = parlamaSprite(renk, 1.6);
    parlama.position.copy(konum);
    this.sahne.add(noktalar, parlama);
    this.liste.push({ tur: 'patlama', noktalar, parlama, hiz, yas: 0, sure });
  }

  /** Zeminde yavaşça kaybolan yanık izi */
  yanikIzi(konum, boyut = 0.6) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(boyut, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(konum.x, 0.006, konum.z);
    this.sahne.add(m);
    this.liste.push({ tur: 'iz', m, yas: 0, sure: 4 });
  }

  guncelle(dt) {
    for (let i = this.liste.length - 1; i >= 0; i--) {
      const e = this.liste[i];
      e.yas += dt;
      const k = e.yas / e.sure;
      if (e.tur === 'patlama') {
        const p = e.noktalar.geometry.attributes.position;
        for (let j = 0; j < p.count; j++) {
          e.hiz[j * 3 + 1] -= 6 * dt;     // yerçekimi
          p.array[j * 3] += e.hiz[j * 3] * dt;
          p.array[j * 3 + 1] = Math.max(0.02, p.array[j * 3 + 1] + e.hiz[j * 3 + 1] * dt);
          p.array[j * 3 + 2] += e.hiz[j * 3 + 2] * dt;
        }
        p.needsUpdate = true;
        e.noktalar.material.opacity = Math.max(0, 1 - k);
        e.parlama.material.opacity = Math.max(0, 1 - k * 3);
        e.parlama.scale.setScalar(1.6 + k * 2);
      } else if (e.tur === 'iz') {
        e.m.material.opacity = 0.55 * Math.max(0, 1 - k);
      }
      if (k >= 1) {
        this._sil(e);
        this.liste.splice(i, 1);
      }
    }
  }

  _sil(e) {
    for (const nesne of [e.noktalar, e.parlama, e.m]) {
      if (!nesne) continue;
      this.sahne.remove(nesne);
      if (!nesne.isSprite) nesne.geometry?.dispose();   // sprite geometrisi ortaktır, silinmez
      nesne.material?.dispose();
    }
  }

  temizle() {
    this.liste.forEach((e) => this._sil(e));
    this.liste = [];
  }
}
