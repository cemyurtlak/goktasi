// One-Euro filtresi: yavaş harekette titremeyi siler, hızlı harekette gecikme eklemez.
// Bir dizi sayıyı (ör. 99 koordinat) aynı anda süzer.

export class OneEuroFiltre {
  constructor({ minKesim = 1.0, beta = 0.4, dKesim = 1.0 } = {}) {
    this.minKesim = minKesim;
    this.beta = beta;
    this.dKesim = dKesim;
    this.sifirla();
  }

  sifirla() {
    this.x = null;
    this.dx = null;
    this.t = 0;
  }

  static alfa(kesim, dt) {
    const tau = 1 / (2 * Math.PI * kesim);
    return 1 / (1 + tau / dt);
  }

  /** @param {Float32Array} deger  @param {number} t saniye */
  suz(deger, t) {
    if (!this.x || this.x.length !== deger.length) {
      this.x = Float32Array.from(deger);
      this.dx = new Float32Array(deger.length);
      this.t = t;
      return Float32Array.from(this.x);
    }
    const dt = Math.max(t - this.t, 1e-3);
    this.t = t;
    const aD = OneEuroFiltre.alfa(this.dKesim, dt);
    for (let i = 0; i < deger.length; i++) {
      const dxHam = (deger[i] - this.x[i]) / dt;
      this.dx[i] = aD * dxHam + (1 - aD) * this.dx[i];
      const kesim = this.minKesim + this.beta * Math.abs(this.dx[i]);
      const a = OneEuroFiltre.alfa(kesim, dt);
      this.x[i] = a * deger[i] + (1 - a) * this.x[i];
    }
    return Float32Array.from(this.x);
  }
}
