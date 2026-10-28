// Göktaşı oyunu: kurallar, göktaşı/yıldız üretimi, çarpışma, puan, can, seviye, güç modu
//
//  - Düşen göktaşı: yerdeki kırmızı halka düşeceği yeri gösterir -> yana kaçarak kurtul (+10)
//  - Yüksek göktaşı (sarı iz, "EĞİL!"): baş hizasında gelir -> eğil/çömel (+15)
//  - Orta göktaşı (turuncu iz, "KAÇ!"): gövde hizasında gelir -> yana kaç (+15)
//  - Alçak göktaşı (mavi iz, "ZIPLA!"): ayak hizasında gelir -> zıpla (+15)
//  - Yıldız: eline (ya da başına) değdir -> +50 ve 10 sn GÜÇ MODU: kaslanırsın, göktaşlarını
//    vücudunla kırarsın (+20), hasar almazsın
//  - 3 can; göktaşı çarpınca 1 can gider, 1.5 sn dokunulmaz olursun
import * as THREE from 'three';
import { Goktasi, Yildiz } from './nesneler.js';

export const AYAR = {
  CAN: 3,
  SEVIYE_SURESI: 30,         // her 30 sn'de seviye artar
  ILK_ARALIK: 1.5,           // ilk seviyede göktaşları arası süre (sn)
  EN_KISA_ARALIK: 0.5,
  ILK_UCUS: 2.6,             // düşen göktaşının uçuş süresi (sn)
  EN_KISA_UCUS: 1.3,
  YATAY_BASLAMA_SEVIYESI: 1, // vücut hizasında gelen (eğil/kaç/zıpla) göktaşları bu seviyeden itibaren
  YATAY_ORANI: 0.45,         // göktaşlarının ne kadarı vücut hizasında gelsin
  YATAY_TURLERI: { yuksek: 0.5, orta: 0.3, alcak: 0.2 },   // yatayların dağılımı
  // Yükseklik (y) ve yarıçap (r), metre. Ayakta duran robotun başı ~1.52-1.78, göğsü ~1.2-1.55
  YUKSEK: { y: 1.6, r: 0.22 },   // eğilince/çömelince başın üstünden geçer
  ORTA: { y: 1.15, r: 0.24 },    // gövdeye gelir, yana kaçmak gerekir
  ALCAK: { y: 0.16, r: 0.17 },   // yalnızca ayaklara çarpar
  YILDIZ_ARALIK: [9, 15],    // sn
  YILDIZ_OMRU: 8,
  GUC_SURESI: 10,
  DOKUNULMAZ_SURE: 1.6,
  OYUN_ALANI_X: 2.2,         // göktaşlarının düştüğü yatay alan (± metre)
  PUAN: { kacis: 10, egilZipla: 15, yildiz: 50, kirma: 20 },
};

const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
/** p noktasının [a,b] doğru parçasına uzaklığı */
function parcayaUzaklik(p, a, b) {
  _ab.subVectors(b, a);
  _ap.subVectors(p, a);
  const t = THREE.MathUtils.clamp(_ap.dot(_ab) / Math.max(_ab.lengthSq(), 1e-9), 0, 1);
  return _ap.sub(_ab.multiplyScalar(t)).length();
}

const rastgele = (a, b) => a + Math.random() * (b - a);

export class Oyun {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.sahne
   * @param {import('./efektler.js').Efektler} o.efektler
   * @param {import('./ses.js').Ses} o.ses
   * @param {import('./hud.js').Hud} o.hud
   * @param {() => {p:THREE.Vector3, r:number, bolge:string}[]} o.oyuncuNoktalari
   * @param {() => number} o.oyuncuX  oyuncunun sahnedeki yatay konumu
   * @param {(acik:boolean) => void} o.gucDegisti
   * @param {(guc:number) => void} o.sarsinti
   * @param {() => void} [o.bitti]  oyun bitti ekranı açılınca
   */
  constructor(o) {
    Object.assign(this, o);
    this.durum = 'bekliyor';     // bekliyor | gerisayim | oyun | bitti
    this.goktaslari = [];
    this.yildiz = null;
    try { this.rekor = Number(localStorage.getItem('goktasi-rekor')) || 0; } catch { this.rekor = 0; }
  }

  get oynaniyor() { return this.durum === 'oyun' || this.durum === 'gerisayim'; }

  baslat() {
    this.temizle();
    this.puan = 0;
    this.can = AYAR.CAN;
    this.seviye = 1;
    this.sure = 0;
    this.sonrakiGoktasi = 1.0;
    this.sonrakiYildiz = rastgele(...AYAR.YILDIZ_ARALIK) * 0.6;
    this.gucKalan = 0;
    this.dokunulmaz = 0;
    this.geriSayim = 3.0;
    this.sonSayi = 4;
    this.durum = 'gerisayim';
    this.hud.bittiGizle();
    this.hud.goster(true);
    this.hud.puan(0);
    this.hud.seviye(1);
    this.hud.can(this.can, AYAR.CAN);
    this.hud.guc(0);
    this.gucDegisti(false);
  }

  durdur() {
    this.temizle();
    this.durum = 'bekliyor';
    this.hud.goster(false);
    this.hud.bittiGizle();
    this.gucDegisti(false);
  }

  temizle() {
    this.goktaslari.forEach((g) => g.sahnedenCikar(this.sahne));
    this.goktaslari = [];
    if (this.yildiz) this.yildiz.sahnedenCikar(this.sahne);
    this.yildiz = null;
  }

  // ------------------------------------------------------------ ana güncelleme
  guncelle(dt) {
    if (this.durum === 'gerisayim') {
      this.geriSayim -= dt;
      const sayi = Math.ceil(this.geriSayim);
      if (sayi !== this.sonSayi && sayi > 0) {
        this.sonSayi = sayi;
        this.hud.mesaj(String(sayi), { sinif: 'sayi', sure: 0.9 });
        this.ses.geriSayim(false);
      }
      if (this.geriSayim <= 0) {
        this.durum = 'oyun';
        this.hud.mesaj('BAŞLA!', { sinif: 'basla', sure: 1.0 });
        this.ses.geriSayim(true);
      }
      return;
    }
    if (this.durum !== 'oyun') return;

    this.sure += dt;
    this.dokunulmaz = Math.max(0, this.dokunulmaz - dt);

    // Seviye
    const yeniSeviye = 1 + Math.floor(this.sure / AYAR.SEVIYE_SURESI);
    if (yeniSeviye !== this.seviye) {
      this.seviye = yeniSeviye;
      this.hud.seviye(this.seviye);
      this.hud.mesaj(`SEVİYE ${this.seviye}!`, { sinif: 'seviye', sure: 1.4 });
      this.ses.seviye();
    }

    // Güç modu süresi
    if (this.gucKalan > 0) {
      this.gucKalan -= dt;
      this.hud.guc(this.gucKalan / AYAR.GUC_SURESI);
      if (this.gucKalan <= 0) {
        this.gucKalan = 0;
        this.gucDegisti(false);
        this.ses.gucBitti();
      }
    }

    // Yeni göktaşı
    this.sonrakiGoktasi -= dt;
    if (this.sonrakiGoktasi <= 0) {
      this.goktasiUret();
      const aralik = Math.max(AYAR.EN_KISA_ARALIK, AYAR.ILK_ARALIK * Math.pow(0.86, this.seviye - 1));
      this.sonrakiGoktasi = aralik * rastgele(0.7, 1.3);
    }

    // Yeni yıldız
    if (!this.yildiz && this.gucKalan <= 0) {
      this.sonrakiYildiz -= dt;
      if (this.sonrakiYildiz <= 0) this.yildizUret();
    }

    const noktalar = this.oyuncuNoktalari();
    this._goktaslariniGuncelle(dt, noktalar);
    this._yildiziGuncelle(dt, noktalar);
  }

  // ------------------------------------------------------------ üretim
  goktasiUret() {
    const ox = this.oyuncuX();
    const A = AYAR.OYUN_ALANI_X;
    const yatay = this.seviye >= AYAR.YATAY_BASLAMA_SEVIYESI && Math.random() < AYAR.YATAY_ORANI;
    let g;
    if (yatay) {
      const d = AYAR.YATAY_TURLERI;
      const zar = Math.random() * (d.yuksek + d.orta + d.alcak);
      const tur = zar < d.yuksek ? 'yuksek' : zar < d.yuksek + d.orta ? 'orta' : 'alcak';
      const { y, r } = AYAR[tur.toUpperCase()];
      const x = THREE.MathUtils.clamp(ox + rastgele(-0.25, 0.25), -A, A);
      const hiz = 7 + this.seviye * 0.8;
      const bas = new THREE.Vector3(x, y, -16);
      const son = new THREE.Vector3(x, y, 4);
      g = new Goktasi(tur, bas, son, bas.distanceTo(son) / hiz, r);
      const yazi = { yuksek: ['EĞİL!', 'egil'], orta: ['KAÇ!', 'kac'], alcak: ['ZIPLA!', 'zipla'] }[tur];
      this.hud.mesaj(yazi[0], { sinif: yazi[1], sure: 1.2 });
      this.ses.uyari();
    } else {
      // Yarısı oyuncunun üstüne, yarısı rastgele
      const tx = THREE.MathUtils.clamp(Math.random() < 0.55 ? ox + rastgele(-0.35, 0.35) : rastgele(-A, A), -A, A);
      const son = new THREE.Vector3(tx, 0, rastgele(-0.2, 0.2));
      // Uzaktan ve alçaktan başlar: kamerada uçuşun tamamı görünür
      const bas = new THREE.Vector3(tx + rastgele(-1.5, 1.5), rastgele(5.5, 7), rastgele(-18, -13));
      const ucus = Math.max(AYAR.EN_KISA_UCUS, AYAR.ILK_UCUS * Math.pow(0.9, this.seviye - 1));
      g = new Goktasi('dusen', bas, son, ucus, rastgele(0.2, 0.32));
    }
    g.sahneyeEkle(this.sahne);
    this.goktaslari.push(g);
    return g;
  }

  yildizUret() {
    const ox = this.oyuncuX();
    const taraf = Math.random() < 0.5 ? -1 : 1;
    const x = THREE.MathUtils.clamp(ox + taraf * rastgele(0.5, 0.95), -AYAR.OYUN_ALANI_X, AYAR.OYUN_ALANI_X);
    this.yildiz = new Yildiz(new THREE.Vector3(x, rastgele(1.05, 1.75), 0.1), AYAR.YILDIZ_OMRU);
    this.yildiz.sahneyeEkle(this.sahne);
  }

  // ------------------------------------------------------------ çarpışma ve kurallar
  _goktaslariniGuncelle(dt, noktalar) {
    for (let i = this.goktaslari.length - 1; i >= 0; i--) {
      const g = this.goktaslari[i];
      g.guncelle(dt);

      // Alçak göktaşı yalnızca ayaklara çarpar (zıplayarak kaçılsın diye)
      const hedefler = g.tur === 'alcak' ? noktalar.filter((n) => n.bolge === 'ayak') : noktalar;
      let carpan = null;
      for (const n of hedefler) {
        if (parcayaUzaklik(n.p, g.oncekiKonum, g.konum) < g.r + n.r) { carpan = n; break; }
      }

      if (carpan) {
        this._carpisma(g, carpan);
        if (this.durum !== 'oyun') return;   // son can gitti; liste _bitir() içinde temizlendi
        g.sahnedenCikar(this.sahne);
        this.goktaslari.splice(i, 1);
        continue;
      }

      if (g.tur === 'dusen' && g.bitti) {
        // Yere düştü, oyuncuya değmedi -> kaçtın
        this.efektler.patlama(g.son, { adet: 45, guc: 3.5 });
        this.efektler.yanikIzi(g.son, g.r * 2.2);
        this.ses.patlama();
        this.sarsinti(0.04);
        this._puanEkle(AYAR.PUAN.kacis, g.son.clone().setY(0.4));
        g.sahnedenCikar(this.sahne);
        this.goktaslari.splice(i, 1);
      } else if (g.tur !== 'dusen' && (g.konum.z > 1.2 || g.bitti)) {
        if (!g.gecti) {
          g.gecti = true;
          this._puanEkle(AYAR.PUAN.egilZipla, new THREE.Vector3(g.konum.x, g.konum.y + 0.3, 0.3));
        }
        if (g.bitti) {
          g.sahnedenCikar(this.sahne);
          this.goktaslari.splice(i, 1);
        }
      }
    }
  }

  _carpisma(g, nokta) {
    const yer = g.konum.clone();
    if (this.gucKalan > 0) {
      // Güç modunda göktaşını kır
      this.efektler.patlama(yer, { renk: 0x7fe7ff, adet: 70, guc: 5 });
      this.ses.kirma();
      this.sarsinti(0.06);
      this._puanEkle(AYAR.PUAN.kirma, yer, '#7fe7ff', 'KIRDIN! ');
      return;
    }
    this.efektler.patlama(yer, { adet: 60, guc: 4.5 });
    if (this.dokunulmaz > 0) return;
    this.can--;
    this.dokunulmaz = AYAR.DOKUNULMAZ_SURE;
    this.hud.can(this.can, AYAR.CAN);
    this.hud.hasarFlasi();
    this.ses.hasar();
    this.sarsinti(0.15);
    this.hud.ucanYazi(yer, nokta.bolge === 'bas' ? 'KAFAYA!' : 'AH!', '#ff5d6c');
    if (this.can <= 0) this._bitir();
  }

  _yildiziGuncelle(dt, noktalar) {
    const y = this.yildiz;
    if (!y) return;
    y.guncelle(dt);
    const alan = noktalar.filter((n) => n.bolge === 'el' || n.bolge === 'bas' || n.bolge === 'kol');
    const alindi = alan.some((n) => n.p.distanceTo(y.grup.position) < y.r + n.r + 0.12);
    if (alindi) {
      this.efektler.patlama(y.grup.position.clone(), { renk: 0xffd23d, adet: 50, guc: 3, boyut: 0.1 });
      this.ses.yildiz();
      this.ses.guc();
      this._puanEkle(AYAR.PUAN.yildiz, y.grup.position.clone(), '#ffd23d', 'GÜÇ! ');
      this.hud.mesaj('💪 GÜÇ MODU!', { sinif: 'guc', sure: 1.6 });
      this.gucKalan = AYAR.GUC_SURESI;
      this.hud.guc(1);
      this.gucDegisti(true);
    }
    if (alindi || y.bitti) {
      y.sahnedenCikar(this.sahne);
      this.yildiz = null;
      this.sonrakiYildiz = rastgele(...AYAR.YILDIZ_ARALIK);
    }
  }

  _puanEkle(miktar, konum, renk = '#ffd23d', onEk = '') {
    this.puan += miktar;
    this.hud.puan(this.puan);
    this.hud.ucanYazi(konum, `${onEk}+${miktar}`, renk);
    if (miktar >= AYAR.PUAN.egilZipla) this.ses.puan();
  }

  _bitir() {
    this.durum = 'bitti';
    // Havadaki göktaşları ve yıldız patlayarak kaybolsun
    this.goktaslari.forEach((g) => this.efektler.patlama(g.konum.clone(), { adet: 30, guc: 3 }));
    this.temizle();
    this.gucKalan = 0;
    this.gucDegisti(false);
    this.hud.guc(0);
    const yeniRekor = this.puan > this.rekor;
    if (yeniRekor) {
      this.rekor = this.puan;
      try { localStorage.setItem('goktasi-rekor', String(this.rekor)); } catch { /* yok */ }
    }
    this.ses.bitti();
    setTimeout(() => {
      this.hud.oyunBitti(this.puan, this.rekor, yeniRekor);
      this.bitti?.();
    }, 700);
  }

  /** Dokunulmazlık sırasında robot yanıp sönsün diye */
  get yanipSon() { return this.durum === 'oyun' && this.dokunulmaz > 0 && Math.sin(this.dokunulmaz * 30) > 0; }
}
