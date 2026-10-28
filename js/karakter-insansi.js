// Kemikli (Mixamo uyumlu) insan karakteri algılanan eklemlere göre hareket ettirir.
//
// Yöntem:
//  1) Model yüklenince dinlenme pozunda (T-poz) her kemiğin yönü ve dönüşü kaydedilir.
//  2) Gövde (kalça, omurga, göğüs) ve baş için omuz/kalça/kulak çizgilerinden tam bir yön
//     çerçevesi (sol-yukarı-ileri) kurulur.
//  3) Kollar ve bacaklar zincir hâlinde döndürülür: önce ebeveynin dönüşü uygulanır, sonra
//     kemiğin dinlenme yönü en kısa dönüşle algılanan yöne çevrilir (FromTo).
//  4) Ayaklar zemine oturtulur.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EKLEM as E, GORUNURLUK_ESIGI } from './sabitler.js';
import { orta } from './koordinat.js';

// Kemik adı (Mixamo öneki temizlenmiş, küçük harf) -> bizim anahtarımız
const KEMIK_ADLARI = {
  hips: 'kalca', spine: 'omurga', spine1: 'omurga1', spine2: 'gogus', neck: 'boyun', head: 'bas',
  leftarm: 'solKol', leftforearm: 'solOnKol', lefthand: 'solEl', lefthandmiddle1: 'solOrtaParmak',
  rightarm: 'sagKol', rightforearm: 'sagOnKol', righthand: 'sagEl', righthandmiddle1: 'sagOrtaParmak',
  leftupleg: 'solUyluk', leftleg: 'solBaldir', leftfoot: 'solAyak', lefttoebase: 'solAyakUcu',
  rightupleg: 'sagUyluk', rightleg: 'sagBaldir', rightfoot: 'sagAyak', righttoebase: 'sagAyakUcu',
};

// Uzuv zincirleri: kemik, dinlenme yönü için çocuk kemik, ebeveyn anahtarı, algılanan başlangıç/bitiş
const UZUVLAR = [
  { k: 'solKol', cocuk: 'solOnKol', ebeveyn: 'gogus', bas: [E.SOL_OMUZ], son: [E.SOL_DIRSEK] },
  { k: 'solOnKol', cocuk: 'solEl', ebeveyn: 'solKol', bas: [E.SOL_DIRSEK], son: [E.SOL_BILEK] },
  { k: 'solEl', cocuk: 'solOrtaParmak', ebeveyn: 'solOnKol', bas: [E.SOL_BILEK], son: [E.SOL_SERCE, E.SOL_ISARET] },
  { k: 'sagKol', cocuk: 'sagOnKol', ebeveyn: 'gogus', bas: [E.SAG_OMUZ], son: [E.SAG_DIRSEK] },
  { k: 'sagOnKol', cocuk: 'sagEl', ebeveyn: 'sagKol', bas: [E.SAG_DIRSEK], son: [E.SAG_BILEK] },
  { k: 'sagEl', cocuk: 'sagOrtaParmak', ebeveyn: 'sagOnKol', bas: [E.SAG_BILEK], son: [E.SAG_SERCE, E.SAG_ISARET] },
  { k: 'solUyluk', cocuk: 'solBaldir', ebeveyn: 'kalca', bas: [E.SOL_KALCA], son: [E.SOL_DIZ] },
  { k: 'solBaldir', cocuk: 'solAyak', ebeveyn: 'solUyluk', bas: [E.SOL_DIZ], son: [E.SOL_AYAK_BILEGI] },
  { k: 'solAyak', cocuk: 'solAyakUcu', ebeveyn: 'solBaldir', bas: [E.SOL_AYAK_BILEGI], son: [E.SOL_AYAK_UCU] },
  { k: 'sagUyluk', cocuk: 'sagBaldir', ebeveyn: 'kalca', bas: [E.SAG_KALCA], son: [E.SAG_DIZ] },
  { k: 'sagBaldir', cocuk: 'sagAyak', ebeveyn: 'sagUyluk', bas: [E.SAG_DIZ], son: [E.SAG_AYAK_BILEGI] },
  { k: 'sagAyak', cocuk: 'sagAyakUcu', ebeveyn: 'sagBaldir', bas: [E.SAG_AYAK_BILEGI], son: [E.SAG_AYAK_UCU] },
];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();

/** Sol ve yukarı vektörlerinden dönüş: dinlenmede sol=+x, yukarı=+y, ileri=+z */
function cerceve(solHam, yukariHam, hedef = new THREE.Quaternion()) {
  const yukari = yukariHam.clone().normalize();
  const ileri = new THREE.Vector3().crossVectors(solHam, yukari).normalize();
  const sol = new THREE.Vector3().crossVectors(yukari, ileri).normalize();
  _m.makeBasis(sol, yukari, ileri);
  return hedef.setFromRotationMatrix(_m);
}

function noktaOrtasi(p, idx) {
  if (idx.length === 1) return p[idx[0]].clone();
  const s = new THREE.Vector3();
  idx.forEach((i) => s.add(p[i]));
  return s.multiplyScalar(1 / idx.length);
}

export class InsansiKarakter {
  constructor() {
    this.kok = new THREE.Group();        // sahnede konumlandırılan kök (yana kayma, zıplama)
    this.kok.name = 'InsansiKarakter';
    this.model = null;
    this.kemik = {};
    this.dinlenme = {};                  // anahtar -> { q: kök uzayında dönüş, yerelQ, poz }
    this.hedefDunya = {};                // bu karedeki hedef dönüşler (kök uzayında)
    this.dinlenmeAyakY = 0;
    this.hiz = 18;                       // kemiklerin hedefe yaklaşma hızı (yumuşatma)
  }

  async yukle(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    this.model = gltf.scene;
    this.model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
      if (o.isBone) {
        const ad = o.name.replace(/^mixamorig/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        if (KEMIK_ADLARI[ad] && !this.kemik[KEMIK_ADLARI[ad]]) this.kemik[KEMIK_ADLARI[ad]] = o;
      }
    });
    const eksik = ['kalca', 'gogus', 'bas', 'solKol', 'solOnKol', 'sagKol', 'sagOnKol', 'solUyluk', 'solBaldir', 'sagUyluk', 'sagBaldir']
      .filter((k) => !this.kemik[k]);
    if (eksik.length) throw new Error('Modelde gerekli kemikler bulunamadı: ' + eksik.join(', '));
    this.kok.add(this.model);
    this.dinlenmeyiKaydet();
  }

  /** Kök uzayında dünya dönüşü */
  kokUzayindaDonus(nesne, hedef) {
    nesne.getWorldQuaternion(hedef);
    this.kok.getWorldQuaternion(_q2);
    return hedef.premultiply(_q2.invert());
  }

  kokUzayindaKonum(nesne, hedef) {
    nesne.getWorldPosition(hedef);
    return this.kok.worldToLocal(hedef);
  }

  dinlenmeyiKaydet() {
    this.kok.updateMatrixWorld(true);
    for (const [k, b] of Object.entries(this.kemik)) {
      this.dinlenme[k] = {
        q: this.kokUzayindaDonus(b, new THREE.Quaternion()),
        yerelQ: b.quaternion.clone(),
        poz: this.kokUzayindaKonum(b, new THREE.Vector3()),
      };
    }
    for (const u of UZUVLAR) {
      const b = this.dinlenme[u.k];
      if (!b) continue;
      const c = this.dinlenme[u.cocuk];
      // Çocuk kemik yoksa (ör. parmaksız model) ebeveynden gelen yönü kullan
      b.yon = c ? c.poz.clone().sub(b.poz).normalize()
        : b.poz.clone().sub(this.dinlenme[u.ebeveyn].poz).normalize();
    }
    this.dinlenmeAyakY = this.enAltAyakY();
  }

  enAltAyakY() {
    let enAlt = Infinity;
    for (const k of ['solAyak', 'sagAyak', 'solAyakUcu', 'sagAyakUcu']) {
      if (this.kemik[k]) enAlt = Math.min(enAlt, this.kokUzayindaKonum(this.kemik[k], _v).y);
    }
    return enAlt === Infinity ? 0 : enAlt;
  }

  /**
   * @param {{p:THREE.Vector3[], v:Float32Array}} avatarPoz
   * @param {number} dt saniye
   */
  guncelle(avatarPoz, dt) {
    if (!this.model) return;
    const { p, v } = avatarPoz;
    const gor = (...idx) => idx.every((i) => v[i] > GORUNURLUK_ESIGI);
    const D = this.dinlenme;
    const H = this.hedefDunya;
    const deltalar = {};     // anahtar -> dinlenmeden bu kareye dönüş farkı (kök uzayında)

    // ---- Gövde ----
    const kalcaOrta = orta(p[E.SOL_KALCA], p[E.SAG_KALCA]);
    const omuzOrta = orta(p[E.SOL_OMUZ], p[E.SAG_OMUZ]);
    const govdeYukari = omuzOrta.clone().sub(kalcaOrta);
    const kalcaQ = cerceve(p[E.SOL_KALCA].clone().sub(p[E.SAG_KALCA]), govdeYukari);
    const gogusQ = cerceve(p[E.SOL_OMUZ].clone().sub(p[E.SAG_OMUZ]), govdeYukari);
    const govdeGorunur = gor(E.SOL_OMUZ, E.SAG_OMUZ, E.SOL_KALCA, E.SAG_KALCA);

    // Baş: kulak çizgisi = sol, kulak ortasından buruna = ileri
    const kulakOrta = orta(p[E.SOL_KULAK], p[E.SAG_KULAK]);
    const basSol = p[E.SOL_KULAK].clone().sub(p[E.SAG_KULAK]);
    const basIleri = p[E.BURUN].clone().sub(kulakOrta);
    const basYukari = new THREE.Vector3().crossVectors(basIleri, basSol);
    const basQ = cerceve(basSol, basYukari);
    // Burun kulaklardan biraz aşağıda durduğu için başı hafif yukarı düzelt
    basQ.multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.25));
    let basGorunur = gor(E.BURUN, E.SOL_KULAK, E.SAG_KULAK) && govdeGorunur;
    if (basGorunur) {
      // Baş, göğse göre insanın yapabileceği açılarla sınırlı (kafa kopmuş gibi dönmesin).
      // Çok ters çıkan baş yönü hatalı algılamadır -> baş gövdeyi takip eder.
      const goreli = gogusQ.clone().invert().multiply(basQ);
      const aci = new THREE.Euler().setFromQuaternion(goreli, 'YXZ');
      if (Math.abs(aci.y) > 1.5 || Math.abs(aci.x) > 1.2 || Math.abs(aci.z) > 1.0) {
        basGorunur = false;
      } else {
        aci.y = THREE.MathUtils.clamp(aci.y, -1.25, 1.25);   // sağa-sola ~70°
        aci.x = THREE.MathUtils.clamp(aci.x, -0.6, 0.8);     // yukarı-aşağı
        aci.z = THREE.MathUtils.clamp(aci.z, -0.5, 0.5);     // yana yatma
        basQ.copy(gogusQ).multiply(new THREE.Quaternion().setFromEuler(aci));
      }
    }

    const govdeAta = (k, q) => {
      if (!this.kemik[k]) return;
      deltalar[k] = q.clone();
      H[k] = q.clone().multiply(D[k].q);
    };
    const kimlik = new THREE.Quaternion();
    const kalcaD = govdeGorunur ? kalcaQ : kimlik;
    const gogusD = govdeGorunur ? gogusQ : kimlik;
    govdeAta('kalca', kalcaD);
    govdeAta('omurga', kalcaD.clone().slerp(gogusD, 0.33));
    govdeAta('omurga1', kalcaD.clone().slerp(gogusD, 0.66));
    govdeAta('gogus', gogusD);
    const basD = basGorunur ? basQ : gogusD;
    govdeAta('boyun', gogusD.clone().slerp(basD, 0.5));
    govdeAta('bas', basD);

    // ---- Kollar ve bacaklar (zincir) ----
    for (const u of UZUVLAR) {
      if (!this.kemik[u.k] || !D[u.k]?.yon) continue;
      const ebeveynDelta = deltalar[u.ebeveyn] || deltalar.gogus || kimlik;
      const q0 = ebeveynDelta.clone().multiply(D[u.k].q);           // ebeveynle birlikte dönmüş hâli
      const yon0 = D[u.k].yon.clone().applyQuaternion(ebeveynDelta); // dinlenme yönünün yeni hâli
      if (gor(...u.bas, ...u.son)) {
        const hedefYon = noktaOrtasi(p, u.son).sub(noktaOrtasi(p, u.bas));
        if (hedefYon.lengthSq() > 1e-8) {
          hedefYon.normalize();
          _q.setFromUnitVectors(yon0, hedefYon);
          H[u.k] = _q.clone().multiply(q0);
        } else {
          H[u.k] = q0;
        }
      } else {
        H[u.k] = q0;  // görünmüyorsa ebeveyne göre dinlenme pozunda kalsın
      }
      deltalar[u.k] = H[u.k].clone().multiply(D[u.k].q.clone().invert());
    }

    // ---- Kemiklere uygula (ebeveynden çocuğa doğru) ----
    const a = 1 - Math.exp(-this.hiz * Math.max(dt, 0.001));
    this.kok.getWorldQuaternion(_q2);
    const kokQ = _q2.clone();
    const sira = ['kalca', 'omurga', 'omurga1', 'gogus', 'boyun', 'bas', ...UZUVLAR.map((u) => u.k)];
    for (const k of sira) {
      const b = this.kemik[k];
      if (!b || !H[k]) continue;
      const dunyaHedef = kokQ.clone().multiply(H[k]);
      b.parent.getWorldQuaternion(_q);
      const yerel = _q.invert().multiply(dunyaHedef);
      b.quaternion.slerp(yerel, a);
      b.updateMatrixWorld(true);
    }

    // ---- Ayakları zemine oturt ----
    this.model.position.y = 0;
    this.model.updateMatrixWorld(true);
    this.model.position.y = this.dinlenmeAyakY - this.enAltAyakY();
  }

  /**
   * Oyun için çarpışma noktaları (dünya uzayında küreler).
   * @returns {{p:THREE.Vector3, r:number, bolge:'bas'|'govde'|'el'|'kol'|'bacak'|'ayak'}[]}
   */
  carpismaNoktalari() {
    const L = [];
    if (!this.model) return L;
    const s = this.model.scale.x;
    const K = this.kemik;
    const konum = (k) => K[k].getWorldPosition(new THREE.Vector3());
    const ekle = (k, r, bolge) => { if (K[k]) L.push({ p: konum(k), r: r * s, bolge }); };
    const ara = (a, b, r, bolge) => {
      if (K[a] && K[b]) L.push({ p: konum(a).lerp(konum(b), 0.5), r: r * s, bolge });
    };
    if (K.bas && K.boyun) {
      const b = konum('bas');
      L.push({ p: b.clone().add(b.clone().sub(konum('boyun')).multiplyScalar(0.9)), r: 0.13 * s, bolge: 'bas' });
    }
    ekle('gogus', 0.17, 'govde');
    ekle('omurga', 0.15, 'govde');
    ekle('kalca', 0.15, 'govde');
    for (const y of ['sol', 'sag']) {
      ekle(y + 'Kol', 0.08, 'kol');
      ara(y + 'Kol', y + 'OnKol', 0.07, 'kol');
      ekle(y + 'OnKol', 0.07, 'kol');
      ara(y + 'OnKol', y + 'El', 0.06, 'kol');
      ekle(y + 'El', 0.07, 'el');
      ekle(y + 'OrtaParmak', 0.07, 'el');
      ekle(y + 'Uyluk', 0.1, 'bacak');
      ara(y + 'Uyluk', y + 'Baldir', 0.09, 'bacak');
      ekle(y + 'Baldir', 0.08, 'bacak');
      ara(y + 'Baldir', y + 'Ayak', 0.07, 'bacak');
      ekle(y + 'Ayak', 0.08, 'ayak');
      ekle(y + 'AyakUcu', 0.07, 'ayak');
    }
    return L;
  }

  /** T-poza geri dön */
  sifirla() {
    for (const [k, b] of Object.entries(this.kemik)) b.quaternion.copy(this.dinlenme[k].yerelQ);
    if (this.model) this.model.position.y = 0;
  }
}
