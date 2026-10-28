// Ses dosyası gerektirmeyen, Web Audio ile üretilen basit oyun sesleri.
export class Ses {
  constructor() {
    this.ctx = null;
    this.acik = true;
  }

  /** Tarayıcılar sesi ancak bir tıklamadan sonra açar; Başlat düğmesinde çağrılır. */
  hazirla() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  get _hazir() { return this.acik && this.ctx && this.ctx.state === 'running'; }

  _ton(frekans, sure, { tur = 'sine', ses = 0.2, bitisFrekans = null, gecikme = 0 } = {}) {
    if (!this._hazir) return;
    const c = this.ctx, t = c.currentTime + gecikme;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tur;
    o.frequency.setValueAtTime(frekans, t);
    if (bitisFrekans) o.frequency.exponentialRampToValueAtTime(bitisFrekans, t + sure);
    g.gain.setValueAtTime(ses, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + sure);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + sure + 0.05);
  }

  _gurultu(sure, { ses = 0.35, kesim = 900, bitisKesim = 120 } = {}) {
    if (!this._hazir) return;
    const c = this.ctx, t = c.currentTime;
    const n = Math.floor(c.sampleRate * sure);
    const tampon = c.createBuffer(1, n, c.sampleRate);
    const veri = tampon.getChannelData(0);
    for (let i = 0; i < n; i++) veri[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const kaynak = c.createBufferSource();
    kaynak.buffer = tampon;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(kesim, t);
    f.frequency.exponentialRampToValueAtTime(bitisKesim, t + sure);
    const g = c.createGain();
    g.gain.setValueAtTime(ses, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + sure);
    kaynak.connect(f).connect(g).connect(c.destination);
    kaynak.start(t);
  }

  patlama() { this._gurultu(0.7, { ses: 0.45, kesim: 1200, bitisKesim: 80 }); this._ton(90, 0.4, { tur: 'sine', ses: 0.3, bitisFrekans: 40 }); }
  kirma() { this._gurultu(0.35, { ses: 0.4, kesim: 3000, bitisKesim: 300 }); this._ton(220, 0.2, { tur: 'square', ses: 0.08, bitisFrekans: 880 }); }
  puan() { this._ton(880, 0.12, { ses: 0.12 }); this._ton(1320, 0.12, { ses: 0.1, gecikme: 0.07 }); }
  hasar() { this._ton(140, 0.35, { tur: 'square', ses: 0.18, bitisFrekans: 60 }); this._gurultu(0.3, { ses: 0.25 }); }
  yildiz() { [523, 659, 784, 1047].forEach((f, i) => this._ton(f, 0.18, { tur: 'triangle', ses: 0.15, gecikme: i * 0.07 })); }
  guc() { this._ton(110, 0.9, { tur: 'sawtooth', ses: 0.12, bitisFrekans: 660 }); }
  gucBitti() { this._ton(660, 0.6, { tur: 'sawtooth', ses: 0.08, bitisFrekans: 110 }); }
  geriSayim(son = false) { this._ton(son ? 1046 : 523, son ? 0.4 : 0.15, { tur: 'triangle', ses: 0.18 }); }
  uyari() { this._ton(740, 0.1, { tur: 'square', ses: 0.07 }); this._ton(740, 0.1, { tur: 'square', ses: 0.07, gecikme: 0.15 }); }
  seviye() { [392, 523, 659].forEach((f, i) => this._ton(f, 0.2, { tur: 'triangle', ses: 0.14, gecikme: i * 0.1 })); }
  bitti() { [523, 392, 330, 262].forEach((f, i) => this._ton(f, 0.3, { tur: 'triangle', ses: 0.15, gecikme: i * 0.18 })); }
}
