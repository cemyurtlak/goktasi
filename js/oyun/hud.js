// Oyun ekranı (HUD): puan, seviye, can, güç çubuğu, büyük mesajlar, uçan puan yazıları
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(kamera) {
    this.kamera = kamera;
    this.kok = $('hud');
    this.puanEl = $('hudPuan');
    this.seviyeEl = $('hudSeviye');
    this.canEl = $('hudCan');
    this.gucEl = $('hudGuc');
    this.gucDoluEl = $('hudGucDolu');
    this.buyukEl = $('buyukMesaj');
    this.flasEl = $('hasarFlas');
    this.ucanKap = $('ucanYazilar');
    this.bittiEl = $('bittiEkrani');
    this._mesajZamani = null;
  }

  goster(acik) { this.kok.hidden = !acik; }

  puan(p) { this.puanEl.textContent = p; }
  seviye(s) { this.seviyeEl.textContent = s; }
  can(c, enFazla) {
    this.canEl.textContent = '❤️'.repeat(Math.max(0, c)) + '🖤'.repeat(Math.max(0, enFazla - c));
  }
  guc(kalanOran) {
    this.gucEl.hidden = kalanOran <= 0;
    this.gucDoluEl.style.width = `${Math.max(0, Math.min(1, kalanOran)) * 100}%`;
  }

  /** Ekran ortasında büyük yazı */
  mesaj(metin, { sinif = '', sure = 1.0 } = {}) {
    const el = this.buyukEl;
    el.textContent = metin;
    el.className = '';
    void el.offsetWidth;          // animasyonu yeniden başlat
    el.className = 'goster ' + sinif;
    clearTimeout(this._mesajZamani);
    if (sure > 0) this._mesajZamani = setTimeout(() => { el.className = ''; }, sure * 1000);
  }

  hasarFlasi() {
    this.flasEl.className = '';
    void this.flasEl.offsetWidth;
    this.flasEl.className = 'goster';
  }

  /** 3B konumda yükselip kaybolan yazı (ör. "+10") */
  ucanYazi(dunyaKonum, metin, renk = '#ffd23d') {
    const v = dunyaKonum.clone().project(this.kamera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'ucan-yazi';
    el.textContent = metin;
    el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    el.style.color = renk;
    this.ucanKap.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  oyunBitti(puan, rekor, yeniRekor) {
    $('bittiPuan').textContent = puan;
    $('bittiRekor').textContent = rekor;
    $('yeniRekor').hidden = !yeniRekor;
    this.bittiEl.hidden = false;
  }

  bittiGizle() { this.bittiEl.hidden = true; }
}

