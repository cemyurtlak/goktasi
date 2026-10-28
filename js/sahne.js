// Three.js sahnesi: ışıklar, zemin, kamera, yörünge kontrolü
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function sahneOlustur(kap) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // dahili ekran kartı için sınırlı
  renderer.setSize(kap.clientWidth, kap.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  kap.appendChild(renderer.domElement);

  const sahne = new THREE.Scene();
  sahne.background = new THREE.Color(0x0b1026);
  sahne.fog = new THREE.Fog(0x0b1026, 8, 22);

  const kamera = new THREE.PerspectiveCamera(45, kap.clientWidth / kap.clientHeight, 0.05, 100);
  kamera.position.set(0, 1.35, 4.2);

  const kontrol = new OrbitControls(kamera, renderer.domElement);
  kontrol.target.set(0, 1.0, 0);
  kontrol.enableDamping = true;
  kontrol.minDistance = 1.5;
  kontrol.maxDistance = 12;
  kontrol.maxPolarAngle = Math.PI * 0.495;
  kontrol.update();

  sahne.add(new THREE.HemisphereLight(0xbcd4ff, 0x2a2340, 1.2));
  const gunes = new THREE.DirectionalLight(0xffffff, 2.2);
  gunes.position.set(2.5, 5, 4);
  gunes.castShadow = true;
  gunes.shadow.mapSize.set(1024, 1024);
  gunes.shadow.camera.left = -4; gunes.shadow.camera.right = 4;
  gunes.shadow.camera.top = 4; gunes.shadow.camera.bottom = -2;
  gunes.shadow.bias = -0.0005;
  sahne.add(gunes);

  // Zemin
  const zemin = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.MeshStandardMaterial({ color: 0x1b2246, roughness: 0.95 }),
  );
  zemin.rotation.x = -Math.PI / 2;
  zemin.receiveShadow = true;
  sahne.add(zemin);
  const izgara = new THREE.GridHelper(24, 48, 0x3c4a8a, 0x26305e);
  izgara.position.y = 0.002;
  sahne.add(izgara);

  // Arka planda yıldızlar (göktaşı teması için)
  const yildizGeo = new THREE.BufferGeometry();
  const konumlar = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) {
    const r = 30 + Math.random() * 20;
    const teta = Math.random() * Math.PI * 2;
    const fi = Math.random() * Math.PI * 0.45;
    konumlar.set([r * Math.cos(teta) * Math.sin(fi + 0.3), r * Math.cos(fi + 0.3) * 0.8 + 2, r * Math.sin(teta) * Math.sin(fi + 0.3)], i * 3);
  }
  yildizGeo.setAttribute('position', new THREE.BufferAttribute(konumlar, 3));
  const yildizlar = new THREE.Points(yildizGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, fog: false }));
  sahne.add(yildizlar);

  function boyutla() {
    const w = kap.clientWidth, h = kap.clientHeight;
    renderer.setSize(w, h);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', boyutla);

  return { renderer, sahne, kamera, kontrol };
}
