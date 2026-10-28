// Göktaşı Tesla - Hareket Yakalama: ana program
import * as THREE from 'three';
import { sahneOlustur } from './sahne.js';
import { PozAlgilayici } from './poz-algilayici.js';
import { OneEuroFiltre } from './filtre.js';
import { avatarUzayinaCevir, YonKarar } from './koordinat.js';
import { InsansiKarakter } from './karakter-insansi.js';
import { IskeletKarakter, iskeletZeminOfseti } from './karakter-iskelet.js';
import { KonumTakip } from './konum-takip.js';
import { demoPozu } from './demo-poz.js';
import { iskeletCiz } from './onizleme.js';
import { KasliGorunum } from './guc-modu.js';
import { ErkekRobot } from './robot-gorunum.js';
import { Oyun } from './oyun/oyun.js';
import { Hud } from './oyun/hud.js';
import { Efektler } from './oyun/efektler.js';
import { Ses } from './oyun/ses.js';
import { DOKUNMATIK, tamEkranAc, EkranAcikTut, cevrimdisiHazirla } from './tablet.js';

const $ = (id) => document.getElementById(id);
const ui = {
  sahne: $('sahne'), durum: $('durum'), mesaj: $('mesaj'),
  kameraBtn: $('kameraBtn'), demoBtn: $('demoBtn'), kameraSec: $('kameraSec'),
  ayna: $('ayna'), karakterSec: $('karakterSec'), goruntuGoster: $('goruntuGoster'),
  yerDegistir: $('yerDegistir'), ekranaBakar: $('ekranaBakar'), yumusatma: $('yumusatma'),
  onizleme: $('onizleme'), video: $('video'), tuval: $('tuval'),
  fpsEkran: $('fpsEkran'), fpsAlgi: $('fpsAlgi'), islemci: $('islemci'),
  oyunBtn: $('oyunBtn'), tekrarBtn: $('tekrarBtn'), sesAcik: $('sesAcik'), panel: $('panel'), panelBtn: $('panelBtn'),
  modelSec: $('modelSec'), menuBtn: $('menuBtn'), menuAcBtn: $('menuAcBtn'),
  giris: $('giris'), girisBasla: $('girisBasla'), girisDemo: $('girisDemo'), girisAyar: $('girisAyar'), girisRekor: $('girisRekor'),
};

// ---------------------------------------------------------------- durum
const ayarlar = {
  ayna: true,
  karakter: 'robot',     // robot | iskelet | ikisi
  goruntu: true,
  yerDegistir: true,
  ekranaBakar: true,
  ses: true,
  model: 'full',         // full = dengeli, lite = hızlı (yavaş cihazlar)
};
let mod = 'bos';          // bos | kamera | demo
let sonPoz = null;        // filtrelenmiş ham poz (MediaPipe düzeninde)
let sonAvatarPoz = null;
let sonKisiZamani = 0;
let demoBaslangic = 0;

function durumYaz(metin, tur = 'bilgi') {
  ui.durum.textContent = metin;
  ui.durum.dataset.tur = tur;
}
function mesajGoster(metin) {
  ui.mesaj.innerHTML = metin;
  ui.mesaj.hidden = !metin;
}

// ---------------------------------------------------------------- sahne + karakterler
const { renderer, sahne, kamera, kontrol } = sahneOlustur(ui.sahne);
const ekranAcik = new EkranAcikTut();
if (DOKUNMATIK) {
  document.body.classList.add('dokunmatik');
  kontrol.enabled = false;                                        // dokununca sahne kaymasın
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); // tablette akıcılık için
}
cevrimdisiHazirla();

const robot = new InsansiKarakter();
sahne.add(robot.kok);
const iskelet = new IskeletKarakter();
sahne.add(iskelet.grup);
let robotHazir = false;
let kasli = null;

const takip = new KonumTakip();
takip.zipramaCarpani = 1.5;          // oyunda zıplama biraz abartılı görünsün
const yonKarar = new YonKarar();
const filtreDunya = new OneEuroFiltre({ minKesim: 1.0, beta: 0.4 });
const filtreGoruntu = new OneEuroFiltre({ minKesim: 1.0, beta: 0.4 });
const algilayici = new PozAlgilayici();

function karakterleriYerlestir() {
  const ikisi = ayarlar.karakter === 'ikisi';
  robot.kok.visible = robotHazir && ayarlar.karakter !== 'iskelet';
  iskelet.grup.visible = ayarlar.karakter !== 'robot' || !robotHazir;
  robot.taban = ikisi ? -0.6 : 0;
  iskelet.taban = ikisi ? 0.6 : 0;
}

robot.yukle(new URL('../modeller/Xbot.glb', import.meta.url).href)
  .then(() => {
    // Robot dinlenme pozundayken: önce erkek robot zırhı, sonra güç modu kasları kemiklere bağlanır
    const gorunum = new ErkekRobot(robot);
    kasli = new KasliGorunum(robot, {
      kasMalzemesi: gorunum.zirh, renklenecekler: gorunum.renklenecekler, kasCarpani: 1.3,
    });
    robotHazir = true;
    karakterleriYerlestir();
  })
  .catch((e) => {
    console.error(e);
    mesajGoster('Robot karakter yüklenemedi, iskelet karakter gösteriliyor.<br><small>' + e.message + '</small>');
    karakterleriYerlestir();
  });

// ---------------------------------------------------------------- kamera / demo
let yuklenenModel = null;

async function kameraBaslat() {
  if (location.protocol === 'file:') {
    mesajGoster('Kamera, sayfa dosyadan açılınca çalışmaz.<br><b>baslat.bat</b> ile aç (http://localhost adresinden).');
    return;
  }
  ui.kameraBtn.disabled = true;
  try {
    if (yuklenenModel !== ayarlar.model) {
      algilayici.landmarker?.close?.();
      await algilayici.yukle(ayarlar.model, (m) => durumYaz(m, 'bekle'));
      yuklenenModel = ayarlar.model;
      ui.islemci.textContent = algilayici.islemci + (ayarlar.model === 'lite' ? ' · hızlı model' : '');
    }
    durumYaz('Kamera açılıyor...', 'bekle');
    await algilayici.kameraAc(ui.video, ui.kameraSec.value || null);
    await kameraListesiniDoldur();
    mod = 'kamera';
    filtreDunya.sifirla(); filtreGoruntu.sifirla(); takip.sifirla(); yonKarar.sifirla();
    mesajGoster('');
    durumYaz('Kamera açık – baştan ayağa görünecek şekilde 2-3 m geri çekil', 'bekle');
    ui.kameraBtn.textContent = '⏹ Kamerayı Durdur';
    ui.demoBtn.classList.remove('aktif');
    ayarlariUygula();
    ekranAcik.ac();
  } catch (e) {
    console.error(e);
    let m = e?.message || String(e);
    if (e?.name === 'NotAllowedError') m = 'Kamera izni verilmedi. Adres çubuğundaki kilit/kamera simgesinden ya da tarayıcı ayarlarından bu siteye kamera izni ver.';
    if (e?.name === 'NotFoundError') m = 'Kamera bulunamadı.';
    if (e?.name === 'NotReadableError') m = 'Kamera başka bir program tarafından kullanılıyor olabilir.';
    mesajGoster('Kamera başlatılamadı: ' + m);
    durumYaz('Hata', 'hata');
  } finally {
    ui.kameraBtn.disabled = false;
  }
}

function kameraDurdur() {
  algilayici.kameraKapat();
  mod = 'bos';
  ui.kameraBtn.textContent = '📷 Kamerayı Başlat';
  durumYaz('Durduruldu');
  iskeletCiz(ui.tuval, null);
  ayarlariUygula();
  ekranAcik.kapat();
}

ui.kameraBtn.addEventListener('click', () => (mod === 'kamera' ? kameraDurdur() : kameraBaslat()));
ui.demoBtn.addEventListener('click', () => {
  if (mod === 'demo') { mod = 'bos'; ui.demoBtn.classList.remove('aktif'); durumYaz('Durduruldu'); return; }
  if (mod === 'kamera') kameraDurdur();
  mod = 'demo';
  demoBaslangic = performance.now();
  filtreDunya.sifirla(); filtreGoruntu.sifirla(); takip.sifirla(); yonKarar.sifirla();
  ui.demoBtn.classList.add('aktif');
  durumYaz('Demo: yapay hareket', 'iyi');
});

async function kameraListesiniDoldur() {
  const liste = await PozAlgilayici.kameralariListele();
  const secili = ui.kameraSec.value;
  ui.kameraSec.innerHTML = '<option value="">Varsayılan kamera</option>' +
    liste.map((c, i) => `<option value="${c.deviceId}">${c.label || 'Kamera ' + (i + 1)}</option>`).join('');
  ui.kameraSec.value = secili;
}
ui.kameraSec.addEventListener('change', () => { if (mod === 'kamera') kameraBaslat(); });
ui.modelSec.addEventListener('change', () => { ayarlar.model = ui.modelSec.value; if (mod === 'kamera') kameraBaslat(); });

// ---------------------------------------------------------------- oyun
const ses = new Ses();
const efektler = new Efektler(sahne);
const hud = new Hud(kamera);
let sarsintiGucu = 0;

const ISKELET_BOLGE = (i) => (i <= 10 ? 'bas' : i <= 12 || i === 23 || i === 24 ? 'govde'
  : i <= 14 ? 'kol' : i <= 22 ? 'el' : i <= 26 ? 'bacak' : 'ayak');

const oyun = new Oyun({
  sahne, efektler, ses, hud,
  oyuncuNoktalari() {
    if (robot.kok.visible) return robot.carpismaNoktalari();
    // İskelet karakter: görünen eklem küreleri
    return iskelet.eklemler
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => m.visible && (i === 0 || i > 10))
      .map(({ m, i }) => ({
        p: m.getWorldPosition(new THREE.Vector3()),
        r: i === 0 ? 0.13 : i <= 12 || i === 23 || i === 24 ? 0.14 : 0.08,
        bolge: ISKELET_BOLGE(i),
      }));
  },
  oyuncuX: () => (robot.kok.visible ? robot.kok.position.x : iskelet.grup.position.x),
  gucDegisti(acik) { if (kasli) (acik ? kasli.ac() : kasli.kapat()); },
  sarsinti(g) { sarsintiGucu = Math.max(sarsintiGucu, g); },
  bitti() {
    ui.oyunBtn.textContent = '▶ Oyunu Başlat';
    document.body.classList.remove('oyunda');
    if (!DOKUNMATIK) ui.panel.classList.remove('kapali');
  },
});

async function oyunuBaslat() {
  ses.hazirla();
  if (mod === 'bos') await kameraBaslat();
  if (mod === 'bos') return;               // kamera açılamadı
  if (!ui.yerDegistir.checked) { ui.yerDegistir.checked = true; ayarlariUygula(); }
  ui.panel.classList.add('kapali');
  girisGizle();
  document.body.classList.add('oyunda');
  oyun.baslat();
  ui.oyunBtn.textContent = '⏹ Oyunu Bitir';
}
function oyunuBitir() {
  oyun.durdur();
  ui.oyunBtn.textContent = '▶ Oyunu Başlat';
  document.body.classList.remove('oyunda');
  if (!DOKUNMATIK) ui.panel.classList.remove('kapali');
}

// ---------------------------------------------------------------- giriş (ana menü) ekranı
function girisGoster() {
  ui.girisRekor.textContent = oyun.rekor > 0 ? `🏆 En yüksek puan: ${oyun.rekor}` : '';
  ui.giris.hidden = false;
  document.body.classList.add('girista');
  ui.panel.classList.add('kapali');
}
function girisGizle() {
  ui.giris.hidden = true;
  document.body.classList.remove('girista');
}
ui.girisBasla.addEventListener('click', async () => {
  ses.hazirla();
  if (DOKUNMATIK) await tamEkranAc();
  oyunuBaslat();
});
ui.girisDemo.addEventListener('click', async () => {
  ses.hazirla();
  if (DOKUNMATIK) await tamEkranAc();
  if (mod !== 'demo') ui.demoBtn.click();
  oyunuBaslat();
});
ui.girisAyar.addEventListener('click', () => { girisGizle(); ui.panel.classList.remove('kapali'); });
ui.menuBtn.addEventListener('click', () => { oyunuBitir(); hud.bittiGizle(); girisGoster(); });
ui.menuAcBtn.addEventListener('click', () => { if (oyun.oynaniyor) oyunuBitir(); girisGoster(); });
ui.oyunBtn.addEventListener('click', () => (oyun.oynaniyor ? oyunuBitir() : oyunuBaslat()));
ui.tekrarBtn.addEventListener('click', () => {
  ses.hazirla(); ui.panel.classList.add('kapali'); document.body.classList.add('oyunda');
  oyun.baslat(); ui.oyunBtn.textContent = '⏹ Oyunu Bitir';
});
ui.panelBtn.addEventListener('click', () => ui.panel.classList.toggle('kapali'));

// ---------------------------------------------------------------- ayarlar
function ayarlariUygula() {
  ayarlar.ayna = ui.ayna.checked;
  ayarlar.karakter = ui.karakterSec.value;
  ayarlar.goruntu = ui.goruntuGoster.checked;
  ayarlar.yerDegistir = ui.yerDegistir.checked;
  ayarlar.ekranaBakar = ui.ekranaBakar.checked;
  ayarlar.ses = ui.sesAcik.checked;
  ayarlar.model = ui.modelSec.value;
  ses.acik = ayarlar.ses;
  const k = Number(ui.yumusatma.value);
  filtreDunya.minKesim = filtreGoruntu.minKesim = k;
  ui.onizleme.hidden = !ayarlar.goruntu || mod !== 'kamera';
  ui.onizleme.classList.toggle('ayna', ayarlar.ayna);
  karakterleriYerlestir();
  try { localStorage.setItem('goktasi-ayarlar', JSON.stringify({ ...ayarlar, yumusatma: k })); } catch { /* yok */ }
}
try {
  const kayitli = JSON.parse(localStorage.getItem('goktasi-ayarlar') || 'null');
  if (kayitli) {
    ui.ayna.checked = kayitli.ayna; ui.karakterSec.value = kayitli.karakter;
    ui.goruntuGoster.checked = kayitli.goruntu; ui.yerDegistir.checked = kayitli.yerDegistir;
    if (kayitli.ekranaBakar !== undefined) ui.ekranaBakar.checked = kayitli.ekranaBakar;
    if (kayitli.yumusatma) ui.yumusatma.value = kayitli.yumusatma;
    if (kayitli.ses !== undefined) ui.sesAcik.checked = kayitli.ses;
    if (kayitli.model) ui.modelSec.value = kayitli.model;
  }
} catch { /* yok */ }
for (const el of [ui.ayna, ui.karakterSec, ui.goruntuGoster, ui.yerDegistir, ui.ekranaBakar, ui.sesAcik, ui.modelSec, ui.yumusatma]) {
  el.addEventListener('change', ayarlariUygula);
  el.addEventListener('input', ayarlariUygula);
}
ayarlariUygula();

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.key === 'a' || e.key === 'A') { ui.ayna.checked = !ui.ayna.checked; ayarlariUygula(); }
  if (e.key === 'd' || e.key === 'D') ui.demoBtn.click();
  if (e.key === 'k' || e.key === 'K') ui.kameraBtn.click();
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); oyun.durum === 'bitti' ? ui.tekrarBtn.click() : ui.oyunBtn.click(); }
});

// ---------------------------------------------------------------- ana döngü
const saat = new THREE.Clock();
let fpsSay = 0, algiSay = 0, fpsZaman = performance.now();

function dongu() {
  requestAnimationFrame(dongu);
  const dt = Math.min(saat.getDelta(), 0.1);
  const simdi = performance.now();
  let yeniPoz = null;

  if (mod === 'kamera') {
    const r = algilayici.algila();
    if (r !== 'ayni-kare') {
      algiSay++;
      if (r) {
        yeniPoz = {
          dunya: filtreDunya.suz(r.dunya, simdi / 1000),
          goruntu: filtreGoruntu.suz(r.goruntu, simdi / 1000),
          gorunurluk: r.gorunurluk,
        };
        sonKisiZamani = simdi;
        durumYaz('Kişi algılandı', 'iyi');
      } else {
        filtreDunya.sifirla(); filtreGoruntu.sifirla();
        if (simdi - sonKisiZamani > 400) durumYaz('Kişi görünmüyor – tüm vücudun kamerada olsun', 'bekle');
      }
      if (ayarlar.goruntu) {
        const vw = ui.video.videoWidth, vh = ui.video.videoHeight;
        if (vw && (ui.tuval.width !== vw || ui.tuval.height !== vh)) { ui.tuval.width = vw; ui.tuval.height = vh; }
        iskeletCiz(ui.tuval, r || null);
      }
    }
  } else if (mod === 'demo') {
    yeniPoz = demoPozu((simdi - demoBaslangic) / 1000);
    algiSay++;
  }

  if (yeniPoz) {
    sonPoz = yeniPoz;
    const arkaDonuk = ayarlar.ekranaBakar ? yonKarar.guncelle(sonPoz) : null;
    sonAvatarPoz = avatarUzayinaCevir(sonPoz, ayarlar.ayna, arkaDonuk);
    const enBoy = mod === 'kamera' && ui.video.videoHeight ? ui.video.videoWidth / ui.video.videoHeight : 4 / 3;
    const konum = ayarlar.yerDegistir ? takip.guncelle(sonAvatarPoz, enBoy) : { x: 0, y: 0 };
    robot.kok.position.set(robot.taban + konum.x, konum.y, 0);
    iskelet.grup.position.set(iskelet.taban + konum.x, konum.y, 0);
    if (iskelet.grup.visible) iskelet.guncelle(sonAvatarPoz, iskeletZeminOfseti(sonAvatarPoz));
  }
  if (sonAvatarPoz && robot.kok.visible) robot.guncelle(sonAvatarPoz, dt);

  // Oyun
  oyun.guncelle(dt);
  efektler.guncelle(dt);
  if (kasli) kasli.guncelle(dt);
  if (robot.model) robot.model.visible = !oyun.yanipSon;

  kontrol.update();
  // Sarsıntı: kamerayı kısa süre titret
  const sarsinti = new THREE.Vector3();
  if (sarsintiGucu > 0.001) {
    sarsinti.set(Math.random() - 0.5, Math.random() - 0.5, 0).multiplyScalar(sarsintiGucu * 2);
    sarsintiGucu *= Math.exp(-dt * 8);
  }
  kamera.position.add(sarsinti);
  renderer.render(sahne, kamera);
  kamera.position.sub(sarsinti);

  fpsSay++;
  if (simdi - fpsZaman >= 1000) {
    const s = (simdi - fpsZaman) / 1000;
    ui.fpsEkran.textContent = Math.round(fpsSay / s);
    ui.fpsAlgi.textContent = Math.round(algiSay / s);
    fpsSay = algiSay = 0;
    fpsZaman = simdi;
  }
}
dongu();

if (location.protocol === 'file:') {
  mesajGoster('Sayfa dosyadan açıldı. Kamera ve karakter için <b>baslat.bat</b> ile aç.');
}
durumYaz('Hazır – Oyunu Başlat, Kamera ya da Demo');
if (DOKUNMATIK) girisGoster();

// Test ve geliştirme için konsoldan erişim
window.goktasi = { robot, iskelet, ayarlar, oyun, get kasli() { return kasli; }, get mod() { return mod; }, get sonAvatarPoz() { return sonAvatarPoz; } };
