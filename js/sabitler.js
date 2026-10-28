// MediaPipe Pose 33 eklem numaraları ve ortak sabitler

export const EKLEM = {
  BURUN: 0,
  SOL_GOZ_IC: 1, SOL_GOZ: 2, SOL_GOZ_DIS: 3,
  SAG_GOZ_IC: 4, SAG_GOZ: 5, SAG_GOZ_DIS: 6,
  SOL_KULAK: 7, SAG_KULAK: 8,
  AGIZ_SOL: 9, AGIZ_SAG: 10,
  SOL_OMUZ: 11, SAG_OMUZ: 12,
  SOL_DIRSEK: 13, SAG_DIRSEK: 14,
  SOL_BILEK: 15, SAG_BILEK: 16,
  SOL_SERCE: 17, SAG_SERCE: 18,
  SOL_ISARET: 19, SAG_ISARET: 20,
  SOL_BASPARMAK: 21, SAG_BASPARMAK: 22,
  SOL_KALCA: 23, SAG_KALCA: 24,
  SOL_DIZ: 25, SAG_DIZ: 26,
  SOL_AYAK_BILEGI: 27, SAG_AYAK_BILEGI: 28,
  SOL_TOPUK: 29, SAG_TOPUK: 30,
  SOL_AYAK_UCU: 31, SAG_AYAK_UCU: 32,
};

export const EKLEM_SAYISI = 33;

// Ayna modunda yer değiştirecek sol/sağ eklem çiftleri
export const SOL_SAG_CIFTLERI = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16],
  [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];

// İskelet çizimi için bağlantılar
export const BAGLANTILAR = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21], [17, 19],
  [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

export const GORUNURLUK_ESIGI = 0.5;
