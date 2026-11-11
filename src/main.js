import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { startFallback } from './fallback.js';
import './style.css';

const mount = document.querySelector('#scene-mount');
const frame = document.querySelector('#scene-frame');
const loadingState = document.querySelector('#loading-state');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const GATES = {
  walk: { speed: 5.6, bpm: 42, frequency: 0.74, clip: 'Walk', stride: 0.23, lift: 0.16, duty: 0.68, offsets: [0.75, 0.25, 0, 0.5] },
  trot: { speed: 13.2, bpm: 96, frequency: 1.35, clip: 'Walk', stride: 0.34, lift: 0.23, duty: 0.58, offsets: [0, 0.5, 0.5, 0] },
  canter: { speed: 19.8, bpm: 132, frequency: 1.55, clip: 'Gallop', stride: 0.43, lift: 0.29, duty: 0.55, offsets: [0.34, 0.67, 0.67, 0] },
  gallop: { speed: 38, bpm: 178, frequency: 1.9, clip: 'Gallop', stride: 0.55, lift: 0.35, duty: 0.42, offsets: [0.42, 0.55, 0.86, 0] },
};

const HOOF_BEATS = {
  walk: [0.02, 0.27, 0.52, 0.77],
  trot: [0.02, 0.52],
  canter: [0.02, 0.35, 0.68],
  gallop: [0.02, 0.16, 0.43, 0.7],
};

async function startThree() {
let renderer;
let usingSvgPreview = false;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (webglError) {
  console.warn('WebGL is unavailable; rendering the Three.js scene as SVG.', webglError);
  try {
    renderer = new SVGRenderer();
    renderer.setQuality('high');
    renderer.setPrecision(1);
    usingSvgPreview = true;
    const previewNote = document.createElement('span');
    previewNote.className = 'fallback-note';
    previewNote.textContent = 'THREE.JS SVG PREVIEW · WEBGL UNAVAILABLE';
    frame.append(previewNote);
  } catch (svgError) {
    console.error('Neither WebGL nor the Three.js SVG renderer could start.', svgError);
    startFallback();
    return;
  }
}
if (!usingSvgPreview) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} else {
  document.querySelector('.orbit-hint').textContent = 'DRAG TO ORBIT';
}
mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9c9c0);
scene.fog = new THREE.Fog(0xbcc9c8, 72, 220);

const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 420);
let cameraOffset = new THREE.Vector3(4.4, 2.55, 5.35);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 4;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minPolarAngle = 0.16;
controls.enablePan = false;
controls.target.set(0, 1.45, 0);

scene.add(new THREE.HemisphereLight(0xe4f0e2, 0x7d745b, 1.05));
const coolFill = new THREE.DirectionalLight(0xc4d8e6, 0.68);
coolFill.position.set(13, 9, -15);
scene.add(coolFill);

const sun = new THREE.DirectionalLight(0xffebce, 2.35);
sun.position.set(-18, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 28;
sun.shadow.camera.bottom = -28;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -0.00015;
sun.shadow.radius = 4;
scene.add(sun);
sun.target.position.set(0, 0, 0);
scene.add(sun.target);

let seed = 80421;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function material(color, roughness = 0.8, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extra });
}

function makeFurTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#965532';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 18000; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const length = 2 + random() * 11;
    context.strokeStyle = random() > 0.5
      ? `rgba(218, 164, 119, ${0.025 + random() * 0.055})`
      : `rgba(45, 24, 15, ${0.025 + random() * 0.05})`;
    context.lineWidth = 0.35 + random() * 0.55;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (random() - 0.5) * 1.4, y + length);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.anisotropy = 4;
  return texture;
}

function addMesh(parent, geometry, mat, position, options = {}) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.scale) mesh.scale.set(...options.scale);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh);
  return mesh;
}

const sphereGeometry = new THREE.SphereGeometry(1, usingSvgPreview ? 18 : 28, usingSvgPreview ? 12 : 20);
function ellipsoid(parent, mat, position, scale, rotation = [0, 0, 0], casts = true) {
  return addMesh(parent, sphereGeometry, mat, position, {
    scale,
    rotation,
    castShadow: casts,
  });
}

function taperedTube(parent, points, startRadius, endRadius, mat, segments = 30, radialSegments = 10, depthScale = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const center = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, t);
    for (let j = 0; j <= radialSegments; j += 1) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const normal = frames.normals[i].clone().multiplyScalar(Math.cos(angle));
      const binormal = frames.binormals[i].clone().multiplyScalar(Math.sin(angle));
      const vertex = center.clone().addScaledVector(normal, radius).addScaledVector(binormal, radius * depthScale);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(j / radialSegments, t);
      if (i < segments && j < radialSegments) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return addMesh(parent, geometry, mat, [0, 0, 0]);
}

function roundedLimbGeometry(length, topRadius, bottomRadius, depthScale = 0.84) {
  const ringPositions = [0, 0.08, 0.2, 0.43, 0.66, 0.82, 0.94, 1];
  const fullness = [0.68, 0.9, 1.02, 1, 0.97, 0.9, 0.8, 0.66];
  const radialSegments = 16;
  const positions = [];
  const indices = [];

  ringPositions.forEach((t, i) => {
    const radius = THREE.MathUtils.lerp(topRadius, bottomRadius, t) * fullness[i];
    for (let j = 0; j <= radialSegments; j += 1) {
      const angle = (j / radialSegments) * Math.PI * 2;
      positions.push(
        radius * Math.cos(angle),
        length * (0.5 - t),
        radius * depthScale * Math.sin(angle),
      );
      if (i < ringPositions.length - 1 && j < radialSegments) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function loftedBody(parent, sections, mat) {
  const sectionCurve = new THREE.CatmullRomCurve3(
    sections.map(([z, centerY, radiusX]) => new THREE.Vector3(radiusX, centerY, z)),
  );
  const depthCurve = new THREE.CatmullRomCurve3(
    sections.map(([z, , , radiusY]) => new THREE.Vector3(radiusY, 0, z)),
  );
  const longitudinalSegments = 48;
  const radialSegments = 32;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= longitudinalSegments; i += 1) {
    const t = i / longitudinalSegments;
    const section = sectionCurve.getPoint(t);
    const radiusY = Math.max(0.025, depthCurve.getPoint(t).x);
    const radiusX = Math.max(0.025, section.x);
    for (let j = 0; j <= radialSegments; j += 1) {
      const angle = (j / radialSegments) * Math.PI * 2;
      positions.push(
        radiusX * Math.cos(angle),
        section.y + radiusY * Math.sin(angle),
        section.z,
      );
      uvs.push(j / radialSegments, t);
      if (i < longitudinalSegments && j < radialSegments) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return addMesh(parent, geometry, mat, [0, 0, 0]);
}

function createGround() {
  const terrainSegments = usingSvgPreview ? 40 : 100;
  const geometry = new THREE.PlaneGeometry(420, 420, terrainSegments, terrainSegments);
  const positions = geometry.attributes.position;
  const colors = [];
  const low = new THREE.Color(0x667858);
  const mid = new THREE.Color(0x82916a);
  const high = new THREE.Color(0xa0a078);

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = -positions.getY(i);
    const wave = Math.sin(x * 0.052) * Math.cos(z * 0.039) * 0.2
      + Math.sin((x + z) * 0.021) * 0.22
      + Math.sin((x - z) * 0.013) * 0.12;
    positions.setZ(i, wave);
    const tint = wave > 0.11 ? high.clone().lerp(mid, 0.36) : mid.clone().lerp(low, Math.max(0, -wave) * 1.7);
    const variation = 0.97 + 0.03 * Math.sin(x * 0.18 + z * 0.11);
    tint.multiplyScalar(variation);
    colors.push(tint.r, tint.g, tint.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const groundTexture = usingSvgPreview ? null : makeMeadowTexture();
  if (groundTexture) groundTexture.repeat.set(78, 78);
  const ground = addMesh(
    scene,
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTexture, roughness: 1 }),
    [0, -0.06, 0],
    { castShadow: false },
  );
  ground.receiveShadow = true;
}

function makeMeadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#d9dec9';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 4600; i += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const height = 2 + random() * 7;
    context.strokeStyle = random() > 0.48
      ? 'rgba(58, 83, 48, 0.12)'
      : 'rgba(174, 158, 103, 0.12)';
    context.lineWidth = 0.45 + random() * 0.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (random() - 0.5) * 2, y - height);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function createSky() {
  const geometry = new THREE.SphereGeometry(150, 32, 24);
  const positions = geometry.attributes.position;
  const colors = [];
  const horizon = new THREE.Color(0xd6d2c1);
  const zenith = new THREE.Color(0x88a9bd);
  const nadir = new THREE.Color(0x93a28c);

  for (let i = 0; i < positions.count; i += 1) {
    const vertical = positions.getY(i) / 150;
    const color = vertical >= 0
      ? horizon.clone().lerp(zenith, Math.pow(vertical, 0.7))
      : horizon.clone().lerp(nadir, Math.min(1, -vertical * 1.3));
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);
}

function loadOutdoorEnvironment() {
  if (usingSvgPreview) return;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const loader = new HDRLoader();
  loader.load(
    `${import.meta.env.BASE_URL}environments/kloppenheim_06_puresky_1k.hdr`,
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      const environment = pmremGenerator.fromEquirectangular(texture);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.72;
      pmremGenerator.dispose();
    },
    undefined,
    (error) => {
      pmremGenerator.dispose();
      console.error('The outdoor HDR environment could not be loaded.', error);
      createSky();
    },
  );
}

function createGrass() {
  if (usingSvgPreview) return;

  const bladeGeometry = new THREE.ConeGeometry(0.024, 0.22, 4, 1);
  bladeGeometry.translate(0, 0.11, 0);
  const grass = new THREE.InstancedMesh(
    bladeGeometry,
    material(0x84936a, 1),
    3300,
  );
  grass.castShadow = false;
  grass.receiveShadow = false;
  const dummy = new THREE.Object3D();
  const grassColors = [0x9ca775, 0x80916a, 0x71855e, 0xb0a777, 0x8c9767].map((color) => new THREE.Color(color));
  let placed = 0;

  while (placed < 3300) {
    const x = (random() - 0.5) * 84;
    const z = (random() - 0.5) * 84;
    dummy.position.set(x, -0.045, z);
    dummy.rotation.set(0, random() * Math.PI, (random() - 0.5) * 0.17);
    const scale = 0.55 + random() * 1.05;
    dummy.scale.set(scale, scale * (0.65 + random() * 0.65), scale);
    dummy.updateMatrix();
    grass.setMatrixAt(placed, dummy.matrix);
    grass.setColorAt(placed, grassColors[Math.floor(random() * grassColors.length)]);
    placed += 1;
  }
  scene.add(grass);
}

function createTree(x, z, scale = 1, variant = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  const trunk = material(variant === 2 ? 0x554634 : 0x68513a, 0.95);
  const canopy = material(
    variant === 1 ? 0x657858 : variant === 2 ? 0x76825d : 0x596f50,
    0.95,
  );
  const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.22, 2.25, 8), trunk, [0, 1.08, 0], { receiveShadow: false });
  const crownY = variant === 1 ? 2.65 : 2.48;
  ellipsoid(group, canopy, [0, crownY, 0], [1.32, 1.14, 1.25], [0, 0, 0], false).geometry = leafGeometry;
  ellipsoid(group, canopy, [-0.73, crownY - 0.25, 0.25], [0.9, 0.83, 0.92], [0, 0.2, 0], false).geometry = leafGeometry;
  ellipsoid(group, canopy, [0.7, crownY - 0.14, -0.2], [0.96, 0.88, 0.91], [0.1, 0, 0], false).geometry = leafGeometry;
  scene.add(group);
}

function createTreeLine() {
  const groupCount = usingSvgPreview ? 9 : 18;
  for (let i = 0; i < groupCount; i += 1) {
    const angle = (i / groupCount) * Math.PI * 2 + (random() - 0.5) * 0.18;
    const distance = 55 + random() * 65;
    const centerX = Math.cos(angle) * distance;
    const centerZ = Math.sin(angle) * distance;
    const count = 2 + Math.floor(random() * 4);
    for (let j = 0; j < count; j += 1) {
      const x = centerX + (random() - 0.5) * 18;
      const z = centerZ + (random() - 0.5) * 18;
      createTree(x, z, 0.8 + random() * 0.9, Math.floor(random() * 3));
    }
  }

  const hillMaterial = material(0x859486, 1);
  for (const [x, z, sx, sy, sz] of [
    [-180, -150, 88, 18, 40],
    [-54, -205, 94, 24, 36],
    [120, -180, 108, 25, 52],
    [202, -52, 86, 20, 72],
    [-190, 62, 92, 23, 60],
    [96, 188, 104, 22, 46],
  ]) {
    ellipsoid(scene, hillMaterial, [x, -2.8, z], [sx, sy, sz], [0, 0, 0], false);
  }
}

function createMeadowProps() {
  if (usingSvgPreview) createSky();
  createGround();
  createGrass();
  createTreeLine();
}

function makeProceduralHorse() {
  const horseRoot = new THREE.Group();
  const horse = new THREE.Group();
  horse.name = 'horse-rig';
  horseRoot.add(horse);

  const furTexture = makeFurTexture();
  const coat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: furTexture,
    bumpMap: furTexture,
    bumpScale: 0.009,
    roughness: 0.68,
    clearcoat: 0.06,
    clearcoatRoughness: 0.76,
  });
  const coatShade = new THREE.MeshStandardMaterial({
    color: 0x9b7b68,
    map: furTexture,
    roughness: 0.82,
  });
  const maneMat = material(0x30231c, 0.86);
  const maneLight = material(0x483126, 0.85);
  const hoofMat = material(0x332a23, 0.65);
  const eyeMat = material(0x171411, 0.32);
  const eyeShineMat = new THREE.MeshBasicMaterial({ color: 0xf3e7d0 });
  const nostrilMat = material(0x342017, 0.9);
  const hoofShape = new THREE.Shape();
  hoofShape.moveTo(-0.075, -0.12);
  hoofShape.quadraticCurveTo(-0.14, -0.12, -0.14, -0.045);
  hoofShape.lineTo(-0.13, 0.075);
  hoofShape.quadraticCurveTo(-0.12, 0.17, -0.07, 0.17);
  hoofShape.lineTo(0.07, 0.17);
  hoofShape.quadraticCurveTo(0.12, 0.17, 0.13, 0.075);
  hoofShape.lineTo(0.14, -0.045);
  hoofShape.quadraticCurveTo(0.14, -0.12, 0.075, -0.12);
  hoofShape.closePath();
  const hoofGeometry = new THREE.ExtrudeGeometry(hoofShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  hoofGeometry.rotateX(Math.PI / 2);

  loftedBody(horse, [
    [-1.4, 1.68, 0.025, 0.035],
    [-1.22, 1.7, 0.34, 0.4],
    [-0.96, 1.74, 0.47, 0.52],
    [-0.62, 1.76, 0.45, 0.53],
    [-0.22, 1.76, 0.41, 0.46],
    [0.2, 1.73, 0.42, 0.48],
    [0.52, 1.68, 0.47, 0.62],
    [0.78, 1.57, 0.42, 0.67],
    [1, 1.53, 0.29, 0.55],
    [1.12, 1.56, 0.025, 0.06],
  ], coat);
  const headPartStart = horse.children.length;

  loftedBody(horse, [
    [0.4, 1.87, 0.4, 0.47],
    [0.64, 2.08, 0.35, 0.41],
    [0.88, 2.36, 0.29, 0.35],
    [1.1, 2.63, 0.23, 0.29],
    [1.28, 2.83, 0.17, 0.22],
    [1.39, 2.9, 0.13, 0.17],
  ], coat);
  loftedBody(horse, [
    [1.18, 2.88, 0.14, 0.18],
    [1.32, 2.92, 0.21, 0.24],
    [1.47, 2.84, 0.18, 0.22],
    [1.62, 2.71, 0.135, 0.17],
    [1.77, 2.64, 0.105, 0.125],
    [1.87, 2.63, 0.065, 0.075],
  ], coat);

  for (const side of [-1, 1]) {
    const ear = addMesh(
      horse,
      new THREE.ConeGeometry(0.083, 0.34, 9),
      coat,
      [side * 0.15, 3.18, 1.21],
      { rotation: [0.12, 0, -side * 0.2] },
    );
    ear.scale.set(0.77, 1, 0.68);
    addMesh(
      horse,
      new THREE.ConeGeometry(0.038, 0.22, 8),
      maneLight,
      [side * 0.15, 3.18, 1.25],
      { rotation: [0.12, 0, -side * 0.2] },
    );

    ellipsoid(horse, coatShade, [side * 0.17, 2.84, 1.46], [0.029, 0.05, 0.07], [0.12, 0, side * 0.1]);
    ellipsoid(horse, eyeMat, [side * 0.19, 2.85, 1.47], [0.022, 0.035, 0.045], [0.12, 0, side * 0.1]);
    ellipsoid(horse, eyeShineMat, [side * 0.207, 2.87, 1.49], [0.009, 0.012, 0.014], [0, 0, 0], false);
    ellipsoid(horse, nostrilMat, [side * 0.09, 2.64, 1.8], [0.018, 0.029, 0.014], [0.18, 0, side * 0.2], false);
  }

  const manePoints = [[0, 2.02, 0.62], [0, 2.24, 0.84], [0, 2.49, 1.02], [0, 2.75, 1.15], [0, 3.03, 1.2]];
  taperedTube(horse, manePoints, 0.105, 0.075, maneMat, 28, 9);
  for (let i = 0; i < 13; i += 1) {
    const t = 0.12 + (i / 13) * 0.79;
    const center = new THREE.CatmullRomCurve3(manePoints.map((point) => new THREE.Vector3(...point))).getPointAt(t);
    const x = (random() - 0.5) * 0.18;
    const drop = 0.12 + random() * 0.2;
    taperedTube(
      horse,
      [
        [center.x + x * 0.45, center.y + 0.035, center.z],
        [center.x + x, center.y - drop * 0.5, center.z + 0.015],
        [center.x + x * 1.25, center.y - drop, center.z - 0.01],
      ],
      0.022,
      0.003,
      i % 3 === 0 ? maneLight : maneMat,
      8,
      5,
    );
  }
  for (let i = 0; i < 7; i += 1) {
    const x = (i - 3) * 0.035;
    taperedTube(
      horse,
      [[x, 3.05, 1.23], [x * 1.2, 3.0 - random() * 0.1, 1.36], [x * 1.35, 2.87 - random() * 0.08, 1.5]],
      0.026,
      0.002,
      i % 2 ? maneMat : maneLight,
      8,
      5,
    );
  }

  const headPartEnd = horse.children.length;
  const headRig = new THREE.Group();
  headRig.name = 'head-rig';
  headRig.position.set(0, 1.9, 0.55);
  horse.add(headRig);
  horse.updateMatrixWorld(true);
  for (let i = headPartStart; i < headPartEnd; i += 1) {
    headRig.attach(horse.children[headPartStart]);
  }

  const tail = new THREE.Group();
  tail.name = 'tail-rig';
  tail.position.set(0, 1.99, -1.14);
  horse.add(tail);
  ellipsoid(tail, coatShade, [0, -0.08, -0.08], [0.17, 0.17, 0.21], [0.15, 0, 0]);
  taperedTube(
    tail,
    [[0, -0.08, -0.09], [0, -0.33, -0.22], [0, -0.58, -0.47], [0, -0.83, -0.62], [0, -1.03, -0.7]],
    0.12,
    0.012,
    maneMat,
    26,
    10,
  );
  for (let i = 0; i < 11; i += 1) {
    const x = (i - 5) * 0.018;
    taperedTube(
      tail,
      [[x, -0.2, -0.2], [x * 1.3, -0.49, -0.43], [x * 1.45, -0.76 - random() * 0.15, -0.61]],
      0.027,
      0.002,
      i % 3 === 0 ? maneLight : maneMat,
      10,
      5,
    );
  }

  const legs = [];
  function makeLeg(side, z, isHind) {
    const legName = `${isHind ? 'hind' : 'fore'}-${side < 0 ? 'left' : 'right'}`;
    const hip = new THREE.Group();
    hip.name = `${legName}-hip`;
    hip.position.set(side * (isHind ? 0.36 : 0.32), isHind ? 1.56 : 1.55, z);
    horse.add(hip);

    const lengths = isHind ? [0.39, 0.55, 0.49] : [0.7, 0.67];
    const radii = isHind
      ? [[0.18, 0.12], [0.125, 0.074], [0.072, 0.047]]
      : [[0.145, 0.09], [0.09, 0.053]];
    const depthScale = isHind ? [0.96, 0.82, 0.78] : [0.9, 0.76];
    const joints = [];
    let parent = hip;

    lengths.forEach((length, index) => {
      const [topRadius, bottomRadius] = radii[index];
      const bone = addMesh(
        parent,
        roundedLimbGeometry(length, topRadius, bottomRadius, depthScale[index]),
        index === lengths.length - 1 ? coatShade : coat,
        [0, -length / 2, 0],
      );
      bone.castShadow = true;
      const joint = new THREE.Group();
      joint.name = `${legName}-joint-${index}`;
      joint.position.y = -length;
      parent.add(joint);
      const jointRadius = bottomRadius * (index === 0 && isHind ? 1.35 : 1.05);
      ellipsoid(joint, index === lengths.length - 1 ? coatShade : coat, [0, 0, 0], [jointRadius, jointRadius, jointRadius * 0.86], [0, 0, 0]);
      joints.push(joint);
      parent = joint;
    });

    const totalLength = lengths.reduce((sum, length) => sum + length, 0);
    addMesh(parent, hoofGeometry, hoofMat, [0, 0, 0.035], {
      scale: [isHind ? 0.92 : 1, 1, 1],
    });
    ellipsoid(parent, coatShade, [0, 0.015, 0.035], [0.085, 0.055, 0.09], [0, 0, 0]);

    if (!isHind && side === -1) {
      ellipsoid(parent, material(0xd4c8ad, 0.95), [0, 0.075, 0.035], [0.058, 0.06, 0.066], [0, 0, 0], false);
    }

    legs.push({ hip, joints, isHind, side, totalLength });
  }

  makeLeg(-1, 0.63, false);
  makeLeg(1, 0.63, false);
  makeLeg(-1, -0.75, true);
  makeLeg(1, -0.75, true);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x35402f, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.9, 1.38, 1);
  shadow.position.y = 0.025;
  horseRoot.add(shadow);

  scene.add(horseRoot);
  return { horseRoot, horse, legs, tail, headRig };
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function createHorseAnimations(horse, legs, headRig, tail) {
  const mixer = new THREE.AnimationMixer(horse);
  const sampleCount = 48;

  function makeTrack(path, duration, sample) {
    const times = [];
    const values = [];
    for (let i = 0; i <= sampleCount; i += 1) {
      const progress = i / sampleCount;
      times.push(progress * duration);
      values.push(sample(progress));
    }
    return new THREE.NumberKeyframeTrack(path, times, values);
  }

  function makeGaitClip(name, gait) {
    const duration = 1;
    const tracks = [];

    legs.forEach((leg, index) => {
      const offset = gait.offsets[index];
      const sampleLeg = (progress) => {
        const phase = (progress + offset) % 1;
        const stride = gait.stride * (leg.isHind ? 0.84 : 1);
        const flexion = gait.lift + (leg.isHind ? 0.32 : 0.22);
        let hipAngle;
        let kneeFlex;

        if (phase < gait.duty) {
          const stance = smoothstep(phase / gait.duty);
          hipAngle = THREE.MathUtils.lerp(-stride * 0.62, stride * 0.58, stance);
          kneeFlex = 0.025 + Math.sin(Math.PI * phase / gait.duty) * 0.035;
        } else {
          const swing = (phase - gait.duty) / (1 - gait.duty);
          const easedSwing = smoothstep(swing);
          hipAngle = THREE.MathUtils.lerp(stride * 0.58, -stride * 0.62, easedSwing);
          kneeFlex = Math.sin(Math.PI * swing) * flexion;
        }

        return { hipAngle, kneeFlex };
      };

      tracks.push(makeTrack(`${leg.hip.name}.rotation[x]`, duration, (progress) => (
        sampleLeg(progress).hipAngle
      )));

      if (leg.isHind) {
        tracks.push(makeTrack(`${leg.joints[0].name}.rotation[x]`, duration, (progress) => (
          -0.07 + sampleLeg(progress).kneeFlex * 0.38
        )));
        tracks.push(makeTrack(`${leg.joints[1].name}.rotation[x]`, duration, (progress) => (
          0.14 + sampleLeg(progress).kneeFlex * 0.48
        )));
        tracks.push(makeTrack(`${leg.joints[2].name}.rotation[x]`, duration, (progress) => (
          -0.08 - sampleLeg(progress).kneeFlex * 0.2
        )));
      } else {
        tracks.push(makeTrack(`${leg.joints[0].name}.rotation[x]`, duration, (progress) => (
          sampleLeg(progress).kneeFlex * 0.82
        )));
        tracks.push(makeTrack(`${leg.joints[1].name}.rotation[x]`, duration, (progress) => (
          0.025 - sampleLeg(progress).kneeFlex * 0.22
        )));
      }
    });

    tracks.push(makeTrack('horse-rig.position[y]', duration, (progress) => {
      const suspension = Math.max(0, Math.sin((progress - gait.duty * 0.72) * Math.PI * 2));
      return suspension * suspension * gait.lift * 0.09;
    }));
    tracks.push(makeTrack('horse-rig.rotation[z]', duration, (progress) => (
      Math.sin(progress * Math.PI * 4) * gait.stride * 0.018
    )));
    tracks.push(makeTrack('head-rig.rotation[x]', duration, (progress) => (
      -0.015 - Math.sin(progress * Math.PI * 2 + 0.4) * gait.stride * 0.11
    )));
    tracks.push(makeTrack('head-rig.rotation[z]', duration, (progress) => (
      Math.sin(progress * Math.PI * 2) * 0.012
    )));
    tracks.push(makeTrack('tail-rig.rotation[x]', duration, (progress) => (
      Math.sin(progress * Math.PI * 4 + 0.7) * (0.075 + gait.stride * 0.11)
    )));
    tracks.push(makeTrack('tail-rig.rotation[z]', duration, (progress) => (
      Math.sin(progress * Math.PI * 2 + 1.2) * 0.045
    )));

    return new THREE.AnimationClip(name, duration, tracks);
  }

  const idleTracks = [
    makeTrack('horse-rig.position[y]', 2.4, (progress) => (
      0.008 + Math.sin(progress * Math.PI * 2) * 0.006
    )),
    makeTrack('head-rig.rotation[x]', 2.4, (progress) => (
      -0.012 + Math.sin(progress * Math.PI * 2 + 0.6) * 0.014
    )),
    makeTrack('head-rig.rotation[z]', 2.4, (progress) => (
      Math.sin(progress * Math.PI * 2) * 0.006
    )),
    makeTrack('tail-rig.rotation[x]', 2.4, (progress) => (
      Math.sin(progress * Math.PI * 2) * 0.035
    )),
  ];
  const idleAction = mixer.clipAction(new THREE.AnimationClip('idle', 2.4, idleTracks));
  idleAction.setLoop(THREE.LoopRepeat, Infinity);

  const gaitActions = {};
  for (const [name, gait] of Object.entries(GATES)) {
    const action = mixer.clipAction(makeGaitClip(name, gait));
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.setEffectiveTimeScale(gait.frequency * action.getClip().duration);
    gaitActions[name] = action;
  }

  return { mixer, idleAction, gaitActions };
}

async function createHorseAsset() {
  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(
      `${import.meta.env.BASE_URL}models/quaternius-horse.glb`,
    );
  } catch (error) {
    console.error('The animated horse model could not be loaded; using the procedural fallback.', error);
    const procedural = makeProceduralHorse();
    return {
      horseRoot: procedural.horseRoot,
      horseAnimation: createHorseAnimations(
        procedural.horse,
        procedural.legs,
        procedural.headRig,
        procedural.tail,
      ),
    };
  }

  const horse = gltf.scene;
  horse.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(horse);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.y <= 0 || size.z <= 0) {
    throw new Error('The animated horse model has invalid dimensions.');
  }

  const modelScale = 2.4 / size.y;
  horse.scale.setScalar(modelScale);
  horse.position.set(
    -(bounds.min.x + bounds.max.x) * 0.5 * modelScale,
    -bounds.min.y * modelScale,
    -(bounds.min.z + bounds.max.z) * 0.5 * modelScale,
  );
  horse.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((horseMaterial) => {
      const name = (horseMaterial.name ?? '').toLowerCase();
      horseMaterial.metalness = 0;
      horseMaterial.roughness = name.includes('eye')
        ? 0.3
        : name.includes('hoof')
          ? 0.66
          : name.includes('hair')
            ? 0.9
            : 0.82;
    });
  });

  const horseRoot = new THREE.Group();
  horseRoot.name = 'horse-root';
  horseRoot.add(horse);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x35402f, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.7, 1.35, 1);
  shadow.position.y = 0.025;
  horseRoot.add(shadow);
  scene.add(horseRoot);

  const mixer = new THREE.AnimationMixer(horse);
  const clipFor = (name) => {
    const clip = gltf.animations.find((animation) => animation.name === name);
    if (!clip) throw new Error(`The animated horse model is missing its ${name} clip.`);
    return clip;
  };
  const idleAction = mixer.clipAction(clipFor('Idle'));
  idleAction.setLoop(THREE.LoopRepeat, Infinity);
  const gaitActions = {};
  for (const [name, gait] of Object.entries(GATES)) {
    const clip = clipFor(gait.clip).clone();
    clip.name = `${clip.name}-${name}`;
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.setEffectiveTimeScale(gait.frequency * action.getClip().duration);
    gaitActions[name] = action;
  }

  return { horseRoot, horseAnimation: { mixer, idleAction, gaitActions } };
}

loadOutdoorEnvironment();
createMeadowProps();
const { horseRoot, horseAnimation } = await createHorseAsset();

const PATH_X = 12.5;
const PATH_Z = 7.5;
let pathAngle = 0;
let selectedGait = 'gallop';
let pace = 1;
let isPlaying = !prefersReducedMotion.matches;
let activeGaitAction = horseAnimation.gaitActions[selectedGait];
const gaitTimeScale = (gait, action) => GATES[gait].frequency * action.getClip().duration;
if (isPlaying) {
  activeGaitAction.reset().setEffectiveTimeScale(gaitTimeScale(selectedGait, activeGaitAction) * pace).play();
} else {
  horseAnimation.idleAction.reset().play();
}
let isFollowing = true;
let lastHudUpdate = 0;
let userOrbiting = false;
let lastSvgFrame = 0;
let soundEnabled = false;
let audioListener;
let hoofAudio;
let meadowAudio;
let hoofBuffers;

function setHorsePath() {
  horseRoot.position.x = Math.sin(pathAngle) * PATH_X;
  horseRoot.position.z = Math.sin(pathAngle * 0.57) * PATH_Z;
  const tangentX = PATH_X * Math.cos(pathAngle);
  const tangentZ = PATH_Z * 0.57 * Math.cos(pathAngle * 0.57);
  horseRoot.rotation.y = Math.atan2(tangentX, tangentZ);
}

function createHoofBuffer(context, gaitName) {
  const duration = 1 / GATES[gaitName].frequency;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  const impactLength = Math.floor(context.sampleRate * 0.12);

  for (const phase of HOOF_BEATS[gaitName]) {
    const start = Math.floor(phase * samples.length);
    for (let i = 0; i < impactLength && start + i < samples.length; i += 1) {
      const time = i / context.sampleRate;
      const attack = 1 - Math.exp(-time * 320);
      const decay = Math.exp(-time * 38);
      const noise = Math.random() * 2 - 1;
      const thud = Math.sin(time * Math.PI * 2 * 86) * 0.55;
      const click = Math.sin(time * Math.PI * 2 * 1450) * 0.24;
      samples[start + i] += (noise * 0.21 + thud + click) * attack * decay * 0.42;
    }
  }

  return buffer;
}

function createMeadowBuffer(context) {
  const length = context.sampleRate * 10;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  const fadeLength = Math.floor(context.sampleRate * 0.12);
  let brownNoise = 0;

  for (let i = 0; i < length; i += 1) {
    brownNoise = (brownNoise + (Math.random() * 2 - 1) * 0.02) * 0.999;
    const edgeFade = Math.min(1, i / fadeLength, (length - i - 1) / fadeLength);
    samples[i] = brownNoise * 0.7 * edgeFade;
  }

  return buffer;
}

function initializeAudio() {
  if (audioListener) return;

  audioListener = new THREE.AudioListener();
  camera.add(audioListener);
  hoofAudio = new THREE.PositionalAudio(audioListener);
  hoofAudio.setRefDistance(4);
  hoofAudio.setMaxDistance(42);
  hoofAudio.setRolloffFactor(1.1);
  hoofAudio.setDistanceModel('inverse');
  hoofAudio.setVolume(0.42);
  hoofAudio.setLoop(true);
  hoofBuffers = Object.fromEntries(
    Object.keys(GATES).map((gait) => [gait, createHoofBuffer(audioListener.context, gait)]),
  );
  hoofAudio.setBuffer(hoofBuffers[selectedGait]);
  horseRoot.add(hoofAudio);

  meadowAudio = new THREE.Audio(audioListener);
  meadowAudio.setBuffer(createMeadowBuffer(audioListener.context));
  meadowAudio.setLoop(true);
  meadowAudio.setVolume(0.12);
}

function syncAudioPlayback(resetHooves = false) {
  if (!audioListener) return;

  if (resetHooves) {
    if (hoofAudio.isPlaying) hoofAudio.stop();
    hoofAudio.setBuffer(hoofBuffers[selectedGait]);
  }

  if (!soundEnabled) {
    if (hoofAudio.isPlaying) hoofAudio.stop();
    if (meadowAudio.isPlaying) meadowAudio.stop();
    return;
  }

  if (!meadowAudio.isPlaying) meadowAudio.play();
  if (isPlaying) {
    if (!hoofAudio.isPlaying) hoofAudio.play();
    hoofAudio.setPlaybackRate(pace);
  } else if (hoofAudio.isPlaying) {
    hoofAudio.stop();
  }
}

async function toggleSound() {
  if (soundEnabled) {
    soundEnabled = false;
    syncAudioPlayback();
    updateHud();
    return;
  }

  try {
    initializeAudio();
    await audioListener.context.resume();
    if (audioListener.context.state !== 'running') {
      throw new Error('The browser did not allow the audio context to start.');
    }
    soundEnabled = true;
    syncAudioPlayback(true);
    updateHud();
  } catch (error) {
    console.error('Horse audio could not be enabled.', error);
  }
}

setHorsePath();
controls.target.copy(horseRoot.position).add(new THREE.Vector3(0, 1.4, 0));
camera.position.copy(controls.target).add(cameraOffset);
controls.update();
controls.addEventListener('start', () => {
  userOrbiting = true;
});
controls.addEventListener('end', () => {
  userOrbiting = false;
  cameraOffset.copy(camera.position).sub(controls.target);
});

function updateHud() {
  const gait = GATES[selectedGait];
  document.querySelector('#heart-rate').innerHTML = `${isPlaying ? gait.bpm : 42} <small>BPM</small>`;
  const currentSpeed = gait.speed * pace;
  document.querySelector('#speed-value').innerHTML = `${currentSpeed.toFixed(1)} <small>KM/H</small>`;
  document.querySelectorAll('.gait-button').forEach((button) => {
    const selected = button.dataset.gait === selectedGait;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const playButton = document.querySelector('#play-button');
  playButton.classList.toggle('is-paused', !isPlaying);
  playButton.setAttribute('aria-label', isPlaying ? 'Pause simulation' : 'Resume simulation');
  playButton.title = isPlaying ? 'Pause simulation' : 'Resume simulation';

  const cameraButton = document.querySelector('#camera-button');
  cameraButton.classList.toggle('is-active', isFollowing);
  cameraButton.setAttribute('aria-pressed', String(isFollowing));
  cameraButton.title = isFollowing ? 'Turn follow camera off' : 'Turn follow camera on';

  const audioButton = document.querySelector('#audio-button');
  audioButton.classList.toggle('is-active', soundEnabled);
  audioButton.setAttribute('aria-pressed', String(soundEnabled));
  audioButton.setAttribute('aria-label', soundEnabled ? 'Mute horse sounds' : 'Enable horse sounds');
  audioButton.title = soundEnabled ? 'Mute horse sounds' : 'Enable horse sounds';
}

function setGait(gait) {
  if (!Object.hasOwn(GATES, gait)) return;
  if (gait === selectedGait) return;
  const previousAction = activeGaitAction;
  selectedGait = gait;
  activeGaitAction = horseAnimation.gaitActions[gait];
  if (isPlaying) {
    activeGaitAction.reset().setEffectiveTimeScale(gaitTimeScale(gait, activeGaitAction) * pace).play();
    previousAction.crossFadeTo(activeGaitAction, 0.42, false);
  } else {
    previousAction.stop();
    activeGaitAction.stop();
  }
  syncAudioPlayback(true);
  updateHud();
}

function setPlaying(playing) {
  if (playing === isPlaying) return;
  isPlaying = playing;
  if (isPlaying) {
    activeGaitAction.reset().setEffectiveTimeScale(gaitTimeScale(selectedGait, activeGaitAction) * pace).play();
    horseAnimation.idleAction.crossFadeTo(activeGaitAction, 0.32, false);
  } else {
    horseAnimation.idleAction.reset().play();
    activeGaitAction.crossFadeTo(horseAnimation.idleAction, 0.32, false);
  }
  syncAudioPlayback();
  updateHud();
}

document.querySelectorAll('.gait-button').forEach((button) => {
  button.addEventListener('click', () => setGait(button.dataset.gait));
});

document.querySelector('#play-button').addEventListener('click', () => {
  setPlaying(!isPlaying);
});

document.querySelector('#audio-button').addEventListener('click', toggleSound);

document.querySelector('#speed-slider').addEventListener('input', (event) => {
  pace = Number(event.currentTarget.value) / 100;
  activeGaitAction.setEffectiveTimeScale(gaitTimeScale(selectedGait, activeGaitAction) * pace);
  syncAudioPlayback();
  updateHud();
});

document.querySelector('#camera-button').addEventListener('click', () => {
  isFollowing = !isFollowing;
  updateHud();
});

document.querySelector('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await frame.requestFullscreen();
    }
  } catch (error) {
    console.error('Fullscreen could not be changed.', error);
  }
});

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
  if (event.code === 'Space') {
    event.preventDefault();
    setPlaying(!isPlaying);
  }
  if (/^[1-4]$/.test(event.key)) {
    setGait(Object.keys(GATES)[Number(event.key) - 1]);
  }
});

prefersReducedMotion.addEventListener('change', (event) => {
  if (event.matches) {
    setPlaying(false);
  }
});

const clock = new THREE.Clock();

function resize() {
  const width = Math.max(1, frame.clientWidth);
  const height = Math.max(1, frame.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(frame);
window.addEventListener('resize', resize);
resize();

function animate() {
  const timestamp = performance.now();
  requestAnimationFrame(animate);
  if (usingSvgPreview && timestamp - lastSvgFrame < 1000 / 24) return;
  lastSvgFrame = timestamp;
  const delta = Math.min(clock.getDelta(), 0.05);
  const gait = GATES[selectedGait];
  horseAnimation.mixer.update(delta);

  if (isPlaying) {
    const metersPerSecond = (gait.speed / 3.6) * pace;
    const tangentSpeed = Math.hypot(
      PATH_X * Math.cos(pathAngle),
      PATH_Z * 0.57 * Math.cos(pathAngle * 0.57),
    );
    pathAngle += (metersPerSecond * delta) / Math.max(tangentSpeed, 0.001);
    setHorsePath();
  }

  if (isFollowing && !userOrbiting) {
    const nextTarget = horseRoot.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const nextPosition = nextTarget.clone().add(cameraOffset);
    controls.target.lerp(nextTarget, 1 - Math.exp(-delta * 8));
    camera.position.lerp(nextPosition, 1 - Math.exp(-delta * 8));
  } else if (!isFollowing) {
    cameraOffset.copy(camera.position).sub(controls.target);
  }

  controls.update();
  renderer.render(scene, camera);

  if (!loadingState.classList.contains('is-hidden')) {
    loadingState.classList.add('is-hidden');
  }

  lastHudUpdate += delta;
  if (lastHudUpdate > 1.5) {
    updateHud();
    lastHudUpdate = 0;
  }
}

updateHud();
animate();
}

startThree().catch((error) => {
  console.error('The horse simulation could not be initialized.', error);
  startFallback();
});
