// Erkek robot görünümü: Xbot iskeletinin üstüne giydirilen zırh parçaları.
//
// Xbot'un kendi (kadın hatlı) derisi gizlenir. Onun yerine geniş omuzlu, V gövdeli, kasklı,
// lacivert-çelik renkli bir robot, parça parça ilgili kemiklere bağlanır. Parçalar kemiklerle
// birlikte döndüğü için hareket yakalama ve oyun hiçbir değişiklik olmadan çalışır.
//
// Konumlar Xbot'un T-pozuna göre (kök uzayı, metre, robot +z'ye bakar, solu +x).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const RENKLER = {
  zirh: 0x1f4fa8,     // lacivert / kraliyet mavisi zırh
  celik: 0x9aa7b8,    // çelik gri
  koyu: 0x262c38,     // eklemler, koyu gri
  isik: 0x3fd0ff,     // vizör ve göğüs çekirdeği (parlar)
  uc: 0xff3b30,       // anten ucu
};

/**
 * Bir mesh'i, robot dinlenme (T-poz) hâlindeyken verilen kök-uzayı konumunda ve yönünde
 * duracak şekilde kemiğe bağlar. Kemik döndükçe mesh de onunla döner.
 */
export function kemigeBagla(robot, anahtar, mesh, merkez, donus = new THREE.Quaternion()) {
  const kemik = robot.kemik[anahtar];
  if (!kemik) return null;
  robot.kok.updateMatrixWorld(true);
  const dunyaKonum = robot.kok.localToWorld(new THREE.Vector3(...merkez));
  mesh.position.copy(kemik.worldToLocal(dunyaKonum));
  const kemikQ = kemik.getWorldQuaternion(new THREE.Quaternion());
  const kokQ = robot.kok.getWorldQuaternion(new THREE.Quaternion());
  mesh.quaternion.copy(kemikQ.invert().multiply(kokQ).multiply(donus));
  const olcek = kemik.getWorldScale(new THREE.Vector3());
  mesh.scale.divide(olcek);            // geometri metre cinsinden; kemiğin ölçeğini dengele
  kemik.add(mesh);
  return mesh;
}

const X_EKSENI = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); // y ekseni -> -x (yatay)
const Z_EKSENI = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // y -> z

export class ErkekRobot {
  constructor(robot) {
    this.robot = robot;
    const std = (renk, ek = {}) => new THREE.MeshStandardMaterial({ color: renk, roughness: 0.45, metalness: 0.55, ...ek });
    this.zirh = std(RENKLER.zirh, { roughness: 0.35, metalness: 0.6 });
    this.celik = std(RENKLER.celik, { roughness: 0.3, metalness: 0.8 });
    this.koyu = std(RENKLER.koyu, { roughness: 0.6, metalness: 0.4 });
    this.isik = new THREE.MeshStandardMaterial({ color: RENKLER.isik, emissive: RENKLER.isik, emissiveIntensity: 1.6, roughness: 0.2 });
    this.uc = new THREE.MeshStandardMaterial({ color: RENKLER.uc, emissive: RENKLER.uc, emissiveIntensity: 1.2 });
    /** Güç modunda altına dönecek malzemeler (ışıklar hariç) */
    this.renklenecekler = [this.zirh, this.celik, this.koyu];

    // Xbot'un kendi derisini gizle (iskelet çalışmaya devam eder)
    robot.model.traverse((o) => { if (o.isSkinnedMesh || o.isMesh) o.visible = false; });

    this.parcalar = [];
    this._olustur();
  }

  _ekle(anahtar, geometri, malzeme, merkez, donus) {
    const m = new THREE.Mesh(geometri, malzeme);
    m.castShadow = true;
    if (kemigeBagla(this.robot, anahtar, m, merkez, donus)) this.parcalar.push(m);
    return m;
  }

  _olustur() {
    const kutu = (x, y, z, r = 0.025) => new RoundedBoxGeometry(x, y, z, 3, Math.min(r, x / 2, y / 2, z / 2));
    const kapsul = (r, boy) => new THREE.CapsuleGeometry(r, boy, 6, 14);
    const silindir = (r1, r2, boy, n = 18) => new THREE.CylinderGeometry(r1, r2, boy, n);
    const kure = (r) => new THREE.SphereGeometry(r, 18, 12);
    const { zirh, celik, koyu, isik, uc } = this;

    // ---------------- gövde ----------------
    this._ekle('kalca', kutu(0.34, 0.15, 0.22, 0.04), koyu, [0, 0.98, 0.0]);           // kalça bloğu
    this._ekle('kalca', kutu(0.36, 0.045, 0.235, 0.02), celik, [0, 1.06, 0.0]);        // kemer
    this._ekle('kalca', kutu(0.06, 0.035, 0.02, 0.01), isik, [0, 1.06, 0.12]);         // kemer tokası ışığı
    this._ekle('omurga', kutu(0.26, 0.13, 0.19, 0.04), koyu, [0, 1.15, 0.0]);          // bel
    for (let i = 0; i < 3; i++) {                                                       // karın plakaları
      this._ekle('omurga', kutu(0.15, 0.03, 0.03, 0.012), celik, [0, 1.11 + i * 0.04, 0.095]);
    }
    this._ekle('omurga1', kutu(0.33, 0.1, 0.22, 0.04), zirh, [0, 1.25, 0.0]);          // alt göğüs
    this._ekle('gogus', kutu(0.52, 0.22, 0.27, 0.06), zirh, [0, 1.385, -0.005]);       // geniş göğüs
    this._ekle('gogus', kutu(0.30, 0.12, 0.05, 0.03), celik, [0, 1.40, 0.12]);         // göğüs plakası
    this._ekle('gogus', silindir(0.042, 0.042, 0.02, 24), isik, [0, 1.40, 0.148], Z_EKSENI); // enerji çekirdeği
    this._ekle('gogus', kutu(0.36, 0.16, 0.06, 0.03), celik, [0, 1.38, -0.13]);        // sırt plakası
    this._ekle('gogus', silindir(0.025, 0.025, 0.14, 10), koyu, [0.05, 1.42, -0.17]);  // sırt egzozları
    this._ekle('gogus', silindir(0.025, 0.025, 0.14, 10), koyu, [-0.05, 1.42, -0.17]);

    // ---------------- boyun ve baş ----------------
    this._ekle('boyun', silindir(0.05, 0.06, 0.11), koyu, [0, 1.53, -0.02]);
    this._ekle('bas', kutu(0.21, 0.22, 0.23, 0.07), zirh, [0, 1.69, 0.0]);             // kask
    this._ekle('bas', kutu(0.175, 0.055, 0.04, 0.02), isik, [0, 1.705, 0.105]);        // vizör
    this._ekle('bas', kutu(0.15, 0.07, 0.05, 0.02), celik, [0, 1.625, 0.09]);          // çene plakası
    this._ekle('bas', kutu(0.05, 0.06, 0.2, 0.02), celik, [0, 1.80, -0.01]);           // kask sırtı (mohawk)
    for (const s of [1, -1]) {
      this._ekle('bas', silindir(0.04, 0.04, 0.035), celik, [s * 0.115, 1.68, -0.01], X_EKSENI); // kulaklık
    }
    this._ekle('bas', silindir(0.006, 0.006, 0.12, 6), celik, [0.075, 1.83, -0.04]);   // anten
    this._ekle('bas', kure(0.015), uc, [0.075, 1.895, -0.04]);

    // ---------------- kollar ----------------
    for (const s of [1, -1]) {
      const y = s > 0 ? 'sol' : 'sag';
      const k = (x) => s * x;
      this._ekle(y + 'Kol', kutu(0.19, 0.15, 0.2, 0.055), zirh, [k(0.2), 1.47, -0.04]);       // omuz zırhı
      this._ekle(y + 'Kol', kutu(0.13, 0.03, 0.16, 0.012), celik, [k(0.21), 1.55, -0.04]);      // omuz üst şerit
      this._ekle(y + 'Kol', kapsul(0.055, 0.17), celik, [k(0.3), 1.438, -0.05], X_EKSENI);      // üst kol
      this._ekle(y + 'OnKol', kure(0.058), koyu, [k(0.43), 1.438, -0.05]);                       // dirsek
      this._ekle(y + 'OnKol', silindir(0.052, 0.068, 0.22), zirh, [k(0.565), 1.438, -0.05],
        s > 0 ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2)
          : X_EKSENI);                                                                            // ön kol zırhı (bileğe doğru incelir)
      this._ekle(y + 'OnKol', kutu(0.05, 0.02, 0.04, 0.008), isik, [k(0.58), 1.438, 0.02]);    // bilek ışığı
      this._ekle(y + 'El', kutu(0.11, 0.06, 0.1, 0.025), koyu, [k(0.765), 1.438, -0.05]);       // el
      this._ekle(y + 'El', kutu(0.05, 0.03, 0.025, 0.01), koyu, [k(0.74), 1.438, 0.01]);       // başparmak
    }

    // ---------------- bacaklar ----------------
    for (const s of [1, -1]) {
      const y = s > 0 ? 'sol' : 'sag';
      const x = s * 0.085;
      this._ekle(y + 'Uyluk', kapsul(0.072, 0.28), celik, [x, 0.75, 0.0]);                     // uyluk
      this._ekle(y + 'Uyluk', kutu(0.12, 0.26, 0.05, 0.02), zirh, [x, 0.78, 0.065]);           // uyluk zırhı
      this._ekle(y + 'Baldir', kure(0.062), koyu, [s * 0.082, 0.53, 0.005]);                   // diz eklemi
      this._ekle(y + 'Baldir', kutu(0.105, 0.11, 0.055, 0.025), zirh, [s * 0.082, 0.53, 0.065]); // diz kapağı
      this._ekle(y + 'Baldir', silindir(0.075, 0.055, 0.38), zirh, [s * 0.082, 0.31, -0.005]); // kaval zırhı
      this._ekle(y + 'Baldir', kutu(0.03, 0.2, 0.02, 0.008), isik, [s * 0.082, 0.33, 0.07]);  // kaval ışığı
      this._ekle(y + 'Ayak', kutu(0.115, 0.09, 0.25, 0.03), koyu, [s * 0.082, 0.045, 0.04]);   // bot
      this._ekle(y + 'Ayak', kutu(0.12, 0.03, 0.12, 0.012), celik, [s * 0.082, 0.1, -0.02]);  // bot üstü
    }
  }
}
