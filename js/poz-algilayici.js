// Kamera + MediaPipe Pose Landmarker (tarayıcıda, WebAssembly ile)
import { FilesetResolver, PoseLandmarker } from '../lib/mediapipe/vision_bundle.mjs';
import { EKLEM_SAYISI } from './sabitler.js';

const UZAK_MODELLER = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task',
};

// lib/mediapipe ile birebir aynı sürüm olmalı
export const UZAK_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

async function dosyaVarMi(yol) {
  try {
    const c = await fetch(yol, { method: 'HEAD', cache: 'no-store' });
    return c.ok;
  } catch {
    return false;
  }
}

export class PozAlgilayici {
  constructor() {
    this.landmarker = null;
    this.video = null;
    this.akis = null;
    this.sonVideoZamani = -1;
    this.sonMs = 0;
    this.islemci = '';
  }

  /** Modeli yükler. Önce yerel modeller/ klasörüne, yoksa internete bakar. GPU olmazsa CPU. */
  async yukle(modelAdi = 'full', durumYaz = () => {}) {
    // Çekirdek (wasm) dosyaları klasörde yoksa (ör. GitHub Pages'e yüklenmediyse; 10 MB'tan büyükler)
    // aynı sürüm jsDelivr'den yüklenir. Service worker bunu da önbelleğe alır.
    const yerelWasm = new URL('../lib/mediapipe/wasm', import.meta.url).href;
    const wasmYolu = (await dosyaVarMi(yerelWasm + '/vision_wasm_internal.js')) ? yerelWasm : UZAK_WASM;
    durumYaz('Yapay zekâ çekirdeği yükleniyor...');
    const fileset = await FilesetResolver.forVisionTasks(wasmYolu);

    const yerel = new URL(`../modeller/pose_landmarker_${modelAdi}.task`, import.meta.url).href;
    const modelYolu = (await dosyaVarMi(yerel)) ? yerel : UZAK_MODELLER[modelAdi];
    durumYaz(`Model yükleniyor (${modelAdi})...`);

    let sonHata = null;
    for (const delegate of ['GPU', 'CPU']) {
      try {
        this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelYolu, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        this.islemci = delegate === 'GPU' ? 'Ekran kartı' : 'İşlemci';
        return;
      } catch (e) {
        sonHata = e;
        console.warn(`[PozAlgilayici] ${delegate} ile açılamadı:`, e);
      }
    }
    throw sonHata;
  }

  async kameraAc(video, cihazId = null) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Tarayıcı kameraya erişemiyor. Sayfayı baslat.bat ile (http://localhost) aç.');
    }
    this.kameraKapat();
    const kosul = {
      audio: false,
      video: cihazId
        ? { deviceId: { exact: cihazId }, width: { ideal: 640 }, height: { ideal: 480 } }
        : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    };
    this.akis = await navigator.mediaDevices.getUserMedia(kosul);
    video.srcObject = this.akis;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    this.video = video;
    this.sonVideoZamani = -1;
  }

  kameraKapat() {
    if (this.akis) this.akis.getTracks().forEach((t) => t.stop());
    this.akis = null;
    this.video = null;
  }

  get hazir() {
    return !!(this.landmarker && this.video && this.video.readyState >= 2);
  }

  /**
   * Yeni bir kamera karesi varsa algılar.
   * @returns {null | 'ayni-kare' | {dunya, goruntu, gorunurluk}} null = kişi yok
   */
  algila() {
    if (!this.hazir) return 'ayni-kare';
    const v = this.video;
    if (v.currentTime === this.sonVideoZamani) return 'ayni-kare';
    this.sonVideoZamani = v.currentTime;
    let ms = performance.now();
    if (ms <= this.sonMs) ms = this.sonMs + 1;
    this.sonMs = ms;
    const sonuc = this.landmarker.detectForVideo(v, ms);
    if (!sonuc.landmarks?.length || !sonuc.worldLandmarks?.length) return null;
    const n = sonuc.landmarks[0];
    const w = sonuc.worldLandmarks[0];
    const dunya = new Float32Array(EKLEM_SAYISI * 3);
    const goruntu = new Float32Array(EKLEM_SAYISI * 2);
    const gorunurluk = new Float32Array(EKLEM_SAYISI);
    for (let i = 0; i < EKLEM_SAYISI; i++) {
      dunya[i * 3] = w[i].x; dunya[i * 3 + 1] = w[i].y; dunya[i * 3 + 2] = w[i].z;
      goruntu[i * 2] = n[i].x; goruntu[i * 2 + 1] = n[i].y;
      gorunurluk[i] = n[i].visibility ?? 1;
    }
    return { dunya, goruntu, gorunurluk };
  }

  static async kameralariListele() {
    try {
      const cihazlar = await navigator.mediaDevices.enumerateDevices();
      return cihazlar.filter((c) => c.kind === 'videoinput');
    } catch {
      return [];
    }
  }
}
