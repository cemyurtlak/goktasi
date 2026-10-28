// Oyuncunun kamera önündeki yer değiştirmesi: yana kayma ve zıplama.
// MediaPipe dünya koordinatları kalça merkezlidir (yer değiştirmeyi göstermez); bu yüzden
// görüntü koordinatları kullanılır ve kişinin boyuna göre metreye çevrilir.
import { EKLEM as E, GORUNURLUK_ESIGI } from './sabitler.js';

export class KonumTakip {
  constructor() {
    this.sifirla();
    this.yanaKaymaCarpani = 1.0;   // 1 = gerçek ölçek
    this.zipramaCarpani = 1.0;
  }

  sifirla() {
    this.metrePerY = null;     // görüntüde 1 birim yükseklik kaç metre
    this.ayakTaban = null;     // ayakta dururken ayakların görüntüdeki y değeri
    this.x = 0;
    this.y = 0;
  }

  /**
   * @param {{p, n, v}} avatarPoz  (n ayna uygulanmış görüntü koordinatı)
   * @param {number} enBoy video genişlik / yükseklik
   * @returns {{x:number, y:number}} metre
   */
  guncelle(avatarPoz, enBoy) {
    const { p, n, v } = avatarPoz;
    const ny = (i) => n[i * 2 + 1];
    const nx = (i) => n[i * 2];

    // Ölçek: burundan ayak bileklerine boy (metre / görüntü birimi)
    const ayaklarGorunur = v[E.SOL_AYAK_BILEGI] > GORUNURLUK_ESIGI && v[E.SAG_AYAK_BILEGI] > GORUNURLUK_ESIGI;
    if (ayaklarGorunur && v[E.BURUN] > GORUNURLUK_ESIGI) {
      const boyM = ((p[E.BURUN].y - p[E.SOL_AYAK_BILEGI].y) + (p[E.BURUN].y - p[E.SAG_AYAK_BILEGI].y)) / 2;
      const boyN = ((ny(E.SOL_AYAK_BILEGI) - ny(E.BURUN)) + (ny(E.SAG_AYAK_BILEGI) - ny(E.BURUN))) / 2;
      if (boyM > 0.5 && boyN > 0.1) {
        const yeni = boyM / boyN;
        this.metrePerY = this.metrePerY == null ? yeni : this.metrePerY + (yeni - this.metrePerY) * 0.05;
      }
    }
    const mY = this.metrePerY ?? 2.0;
    const mX = mY * enBoy;

    // Yana kayma: kalça ortasının görüntüdeki yatay konumu
    const kalcaX = (nx(E.SOL_KALCA) + nx(E.SAG_KALCA)) / 2;
    const hedefX = Math.max(-2.5, Math.min(2.5, (kalcaX - 0.5) * mX * this.yanaKaymaCarpani));

    // Zıplama: ayakların görüntüde yukarı çıkması
    let hedefY = 0;
    if (ayaklarGorunur) {
      const ayakY = Math.max(ny(E.SOL_AYAK_BILEGI), ny(E.SAG_AYAK_BILEGI));
      if (this.ayakTaban == null || ayakY > this.ayakTaban) this.ayakTaban = ayakY;
      else this.ayakTaban += (ayakY - this.ayakTaban) * 0.01;   // öne/arkaya yürümeye yavaşça uyum
      const fark = this.ayakTaban - ayakY;
      hedefY = fark > 0.015 ? Math.min(1.2, fark * mY * this.zipramaCarpani) : 0;
    } else {
      this.ayakTaban = null;
    }

    this.x += (hedefX - this.x) * 0.35;
    this.y += (hedefY - this.y) * 0.5;
    return { x: this.x, y: this.y };
  }
}
