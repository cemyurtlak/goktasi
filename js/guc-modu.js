// Güç modu görünümü: robot kaslanır, büyür, altın rengine döner, etrafında enerji halesi oluşur.
//
// Kaslar, ilgili kemiklere bağlanmış elipsoidlerdir (deri ağırlıklarına dokunmadan); böylece
// robot hangi pozdaysa kaslar da onunla birlikte hareket eder.
import * as THREE from 'three';
import { parlamaDokusu, parlamaSprite } from './oyun/efektler.js';

// Xbot T-pozunda (kök uzayı, metre): [kemik, merkez [x,y,z], boyut [x,y,z]]  — sol taraf; sağ için x aynalanır
const KASLAR_SOL = [
  ['solKol', [0.17, 1.45, -0.04], [0.085, 0.075, 0.085]],     // omuz (deltoid)
  ['solKol', [0.28, 1.44, -0.045], [0.15, 0.066, 0.076]],     // pazu + arka kol
  ['solOnKol', [0.53, 1.44, -0.05], [0.13, 0.055, 0.058]],    // ön kol
  ['solUyluk', [0.085, 0.76, 0.035], [0.085, 0.2, 0.09]],     // ön bacak (quadriceps)
  ['solUyluk', [0.08, 0.93, -0.07], [0.09, 0.08, 0.07]],      // kalça kası
  ['solBaldir', [0.082, 0.36, -0.035], [0.06, 0.13, 0.07]],   // baldır
  ['gogus', [0.085, 1.39, 0.115], [0.105, 0.065, 0.032]],    // göğüs (yassı, geniş)
];
const KASLAR_ORTA = [
  ['gogus', [0, 1.47, -0.06], [0.14, 0.05, 0.07]],             // trapez
  ['gogus', [0, 1.33, -0.08], [0.17, 0.12, 0.06]],             // sırt
  ['omurga1', [0, 1.20, 0.095], [0.10, 0.12, 0.045]],          // karın
];

const ALTIN = new THREE.Color(0xffb02e);

export class KasliGorunum {
  /**
   * @param {import('./karakter-insansi.js').InsansiKarakter} robot  dinlenme pozundayken çağrılmalı
   * @param {object} [secenek]
   * @param {THREE.Material} [secenek.kasMalzemesi]  kasların malzemesi (verilmezse robotun derisi)
   * @param {THREE.Material[]} [secenek.renklenecekler]  güç modunda altına dönecek malzemeler
   * @param {number} [secenek.kasCarpani]  kas boyutu çarpanı (kalın zırhlı robot için > 1)
   */
  constructor(robot, { kasMalzemesi = null, renklenecekler = null, kasCarpani = 1 } = {}) {
    this.robot = robot;
    this.acik = false;
    this.oran = 0;          // 0 = normal, 1 = tam güç
    this.zaman = 0;

    // Robotun malzemeleri; kaslar gövde (deri) malzemesinin aynısını kullanır, böylece renk ve
    // ışık birebir aynı olur ve güç modunda birlikte altına döner.
    this.robotMalzemeleri = [];
    let deri = null, enBuyuk = null, enCokKose = 0;
    robot.model.traverse((o) => {
      if (!o.isMesh) return;
      if (!this.robotMalzemeleri.includes(o.material)) this.robotMalzemeleri.push(o.material);
      if (/surface/i.test(o.name)) deri = o.material;          // Xbot: "Beta_Surface"
      const kose = o.geometry.attributes.position.count;
      if (kose > enCokKose) { enCokKose = kose; enBuyuk = o.material; }
    });
    const govde = deri || enBuyuk;
    if (renklenecekler) this.robotMalzemeleri = renklenecekler;
    this.ilkRenkler = this.robotMalzemeleri.map((m) => ({ renk: m.color.clone(), isik: m.emissive.clone() }));
    this.kasMalzemesi = kasMalzemesi || govde || this.robotMalzemeleri[0];

    // Kasları kemiklere bağla
    const kure = new THREE.SphereGeometry(1, 20, 14);
    this.kaslar = [];
    const ekle = (anahtar, merkez, boyut) => {
      const kemik = robot.kemik[anahtar];
      if (!kemik) return;
      const m = new THREE.Mesh(kure, this.kasMalzemesi);
      m.castShadow = true;
      // Kök uzayındaki T-poz konumunu kemiğin yerel uzayına çevir
      const dunyaKonum = robot.kok.localToWorld(new THREE.Vector3(...merkez));
      kemik.updateWorldMatrix(true, false);
      m.position.copy(kemik.worldToLocal(dunyaKonum));
      const kemikQ = kemik.getWorldQuaternion(new THREE.Quaternion());
      const kokQ = robot.kok.getWorldQuaternion(new THREE.Quaternion());
      m.quaternion.copy(kemikQ.invert().multiply(kokQ));
      const olcek = kemik.getWorldScale(new THREE.Vector3());
      m.userData.hedefOlcek = new THREE.Vector3(boyut[0] / olcek.x, boyut[1] / olcek.y, boyut[2] / olcek.z)
        .multiplyScalar(kasCarpani);
      m.scale.setScalar(1e-4);
      m.visible = false;
      kemik.add(m);
      this.kaslar.push(m);
    };
    for (const [k, c, b] of KASLAR_SOL) {
      ekle(k, c, b);
      const sag = k.startsWith('sol') ? 'sag' + k.slice(3) : k;
      ekle(sag, [-c[0], c[1], c[2]], b);
    }
    for (const [k, c, b] of KASLAR_ORTA) ekle(k, c, b);

    // Ayakların altında dönen enerji halkası
    this.hale = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.62, 48),
      new THREE.MeshBasicMaterial({ color: 0xffc83d, map: null, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.hale.rotation.x = -Math.PI / 2;
    this.hale.position.y = 0.02;
    robot.kok.add(this.hale);

    // Vücudun etrafında yükselen kıvılcımlar
    const adet = 80;
    const geo = new THREE.BufferGeometry();
    this.kivilcimKonum = new Float32Array(adet * 3);
    this.kivilcimHiz = new Float32Array(adet);
    for (let i = 0; i < adet; i++) this._kivilcimYenile(i, Math.random() * 1.9);
    geo.setAttribute('position', new THREE.BufferAttribute(this.kivilcimKonum, 3));
    this.kivilcim = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffd870, size: 0.07, map: parlamaDokusu(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.kivilcim.frustumCulled = false;
    robot.kok.add(this.kivilcim);

    this.parlama = parlamaSprite(0xffb02e, 2.6);
    this.parlama.position.y = 1.0;
    this.parlama.material.opacity = 0;
    robot.kok.add(this.parlama);
  }

  _kivilcimYenile(i, y = 0) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.35 + Math.random() * 0.25;
    this.kivilcimKonum.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    this.kivilcimHiz[i] = 0.6 + Math.random() * 1.2;
  }

  ac() { this.acik = true; }
  kapat() { this.acik = false; }

  guncelle(dt) {
    this.zaman += dt;
    const hedef = this.acik ? 1 : 0;
    this.oran += (hedef - this.oran) * (1 - Math.exp(-dt * (this.acik ? 5 : 3)));
    if (Math.abs(this.oran - hedef) < 0.002) this.oran = hedef;
    const o = this.oran;

    // Kaslar: hafif "nabız" ile şişer
    const nabiz = 1 + 0.04 * Math.sin(this.zaman * 8) * o;
    for (const m of this.kaslar) {
      m.visible = o > 0.01;
      if (m.visible) m.scale.copy(m.userData.hedefOlcek).multiplyScalar(Math.max(1e-4, o * nabiz));
    }
    // Robot büyür
    if (this.robot.model) this.robot.model.scale.setScalar(1 + 0.15 * o);

    // Renk: altına doğru, hafif parlama
    this.robotMalzemeleri.forEach((m, i) => {
      m.color.copy(this.ilkRenkler[i].renk).lerp(ALTIN, 0.85 * o);
      m.emissive.copy(this.ilkRenkler[i].isik).lerp(new THREE.Color(0xff7a00), 0.35 * o * (0.8 + 0.2 * Math.sin(this.zaman * 6)));
    });

    this.hale.material.opacity = 0.75 * o;
    this.hale.rotation.z += dt * 2;
    this.hale.scale.setScalar(1 + 0.08 * Math.sin(this.zaman * 5));
    this.parlama.material.opacity = 0.25 * o;
    this.kivilcim.material.opacity = 0.9 * o;
    if (o > 0.01) {
      const p = this.kivilcim.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        p.array[i * 3 + 1] += this.kivilcimHiz[i] * dt;
        if (p.array[i * 3 + 1] > 1.9) this._kivilcimYenile(i, 0);
      }
      p.needsUpdate = true;
    }
  }
}
