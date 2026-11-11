import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { startFallback } from './fallback.js';
import './style.css';

const mount = document.querySelector('#scene-mount');
const frame = document.querySelector('#scene-frame');
const loadingState = document.querySelector('#loading-state');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const GATES = {
  walk: { speed: 5.6, bpm: 42, frequency: 0.74, stride: 0.23, lift: 0.16, duty: 0.68, offsets: [0.75, 0.25, 0, 0.5] },
  trot: { speed: 13.2, bpm: 96, frequency: 1.35, stride: 0.34, lift: 0.23, duty: 0.58, offsets: [0, 0.5, 0.5, 0] },
  canter: { speed: 19.8, bpm: 132, frequency: 1.55, stride: 0.43, lift: 0.29, duty: 0.55, offsets: [0.34, 0.67, 0.67, 0] },
  gallop: { speed: 38, bpm: 178, frequency: 1.9, stride: 0.55, lift: 0.35, duty: 0.42, offsets: [0.42, 0.55, 0.86, 0] },
};

function startThree() {
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
scene.fog = new THREE.Fog(0xc3d0c4, 42, 116);

const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 220);
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

scene.add(new THREE.HemisphereLight(0xe4f0e2, 0x7d745b, 1.72));
const coolFill = new THREE.DirectionalLight(0xc4d8e6, 0.68);
coolFill.position.set(13, 9, -15);
scene.add(coolFill);

const sun = new THREE.DirectionalLight(0xffebce, 3.05);
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

function cylinderBetween(parent, start, end, radius, mat, radialSegments = 8) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), radialSegments),
    mat,
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createGround() {
  const terrainSegments = usingSvgPreview ? 40 : 100;
  const geometry = new THREE.PlaneGeometry(180, 180, terrainSegments, terrainSegments);
  const positions = geometry.attributes.position;
  const colors = [];
  const low = new THREE.Color(0x667858);
  const mid = new THREE.Color(0x82916a);
  const high = new THREE.Color(0xa0a078);

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = -positions.getY(i);
    const wave = Math.sin(x * 0.11) * Math.cos(z * 0.095) * 0.13
      + Math.sin((x + z) * 0.047) * 0.16
      + (random() - 0.5) * 0.055;
    positions.setZ(i, wave);
    const tint = wave > 0.11 ? high.clone().lerp(mid, 0.36) : mid.clone().lerp(low, Math.max(0, -wave) * 2.4);
    const variation = 0.94 + random() * 0.11;
    tint.multiplyScalar(variation);
    colors.push(tint.r, tint.g, tint.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const groundTexture = usingSvgPreview ? null : makeMeadowTexture();
  if (groundTexture) groundTexture.repeat.set(34, 34);
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

function createTrack() {
  const track = addMesh(
    scene,
    new THREE.RingGeometry(0.78, 1, 160),
    material(0x907354, 1),
    [0, 0.012, 0],
    { castShadow: false },
  );
  track.rotation.x = -Math.PI / 2;
  track.scale.set(8.8, 5.35, 1);
  track.material.side = THREE.DoubleSide;

  const edge = addMesh(
    scene,
    new THREE.RingGeometry(0.775, 0.785, 160),
    material(0xb49a76, 1),
    [0, 0.017, 0],
    { castShadow: false },
  );
  edge.rotation.x = -Math.PI / 2;
  edge.scale.set(8.8, 5.35, 1);
  edge.material.side = THREE.DoubleSide;

  const postMat = material(0x604d37, 0.93);
  const railMat = material(0x765d3e, 0.9);
  const postGeometry = new THREE.CylinderGeometry(0.055, 0.076, 1.14, 8);
  const count = 44;
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const x = 10.35 * Math.cos(angle);
    const z = 6.72 * Math.sin(angle);
    points.push([x, z]);
    addMesh(scene, postGeometry, postMat, [x, 0.57, z], { receiveShadow: false });
  }
  for (let i = 0; i < count; i += 1) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[(i + 1) % count];
    for (const y of [0.47, 0.91]) {
      cylinderBetween(scene, [x1, y, z1], [x2, y, z2], 0.044, railMat, 7);
    }
  }
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
    const trackDistance = Math.sqrt((x * x) / (8.8 * 8.8) + (z * z) / (5.35 * 5.35));
    if (trackDistance > 0.775 && trackDistance < 1.04) continue;

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
  let planted = 0;
  let attempts = 0;
  while (planted < (usingSvgPreview ? 28 : 58) && attempts < 300) {
    attempts += 1;
    const x = (random() - 0.5) * 88;
    const z = (random() - 0.5) * 88;
    const paddockDistance = (x * x) / (16 * 16) + (z * z) / (12 * 12);
    if (paddockDistance < 1 || Math.hypot(x + 19, z + 17) < 9) continue;
    createTree(x, z, 0.72 + random() * 0.68, Math.floor(random() * 3));
    planted += 1;
  }

  const hillMaterial = material(0x859486, 1);
  for (const [x, z, sx, sy, sz] of [
    [-39, -38, 21, 7, 10],
    [-10, -44, 25, 8, 12],
    [24, -40, 23, 7, 13],
    [48, -22, 17, 7, 19],
    [-51, 2, 16, 8, 18],
    [42, 20, 18, 6, 14],
  ]) {
    ellipsoid(scene, hillMaterial, [x, 1.1, z], [sx, sy, sz], [0, 0, 0], false);
  }
}

function createBarn() {
  const barn = new THREE.Group();
  barn.position.set(-20, 0, -16);
  const wall = material(0x9e5942, 0.9);
  const trim = material(0xe0d4b8, 0.85);
  const roof = material(0x514b3b, 0.94);
  const door = material(0x704635, 0.92);
  addMesh(barn, new THREE.BoxGeometry(5.2, 2.75, 4.2), wall, [0, 1.38, 0]);
  const gable = new THREE.Shape();
  gable.moveTo(-2.6, 0);
  gable.lineTo(0, 1.5);
  gable.lineTo(2.6, 0);
  gable.closePath();
  const gableMesh = addMesh(barn, new THREE.ShapeGeometry(gable), wall, [0, 2.75, 2.11]);
  gableMesh.castShadow = true;
  addMesh(
    barn,
    new THREE.BoxGeometry(3.12, 0.16, 4.65),
    roof,
    [-1.22, 3.39, 0],
    { rotation: [0, 0, -0.42] },
  );
  addMesh(
    barn,
    new THREE.BoxGeometry(3.12, 0.16, 4.65),
    roof,
    [1.22, 3.39, 0],
    { rotation: [0, 0, 0.42] },
  );
  addMesh(barn, new THREE.BoxGeometry(2.15, 2.05, 0.12), door, [0, 1.05, 2.17]);
  addMesh(barn, new THREE.BoxGeometry(0.09, 2.2, 0.13), trim, [-1.15, 1.08, 2.18]);
  addMesh(barn, new THREE.BoxGeometry(0.09, 2.2, 0.13), trim, [1.15, 1.08, 2.18]);
  addMesh(barn, new THREE.BoxGeometry(2.4, 0.1, 0.14), trim, [0, 2.18, 2.18]);
  addMesh(barn, new THREE.BoxGeometry(0.08, 2.05, 0.08), trim, [0, 1.05, 2.25]);
  addMesh(barn, new THREE.BoxGeometry(2.12, 0.08, 0.08), trim, [0, 1.05, 2.25]);
  for (const x of [-1.65, 1.65]) {
    addMesh(barn, new THREE.BoxGeometry(0.66, 0.72, 0.1), material(0x536255, 0.52), [x, 1.85, 2.16]);
    addMesh(barn, new THREE.BoxGeometry(0.76, 0.08, 0.12), trim, [x, 2.25, 2.17]);
    addMesh(barn, new THREE.BoxGeometry(0.08, 0.86, 0.12), trim, [x, 1.84, 2.17]);
  }
  scene.add(barn);
}

function createMeadowProps() {
  createSky();
  createGround();
  createTrack();
  createGrass();
  createTreeLine();
  createBarn();

  const troughMat = material(0x746348, 0.92);
  const trough = new THREE.Group();
  trough.position.set(-5.3, 0, -8.7);
  addMesh(trough, new THREE.BoxGeometry(1.7, 0.36, 0.66), troughMat, [0, 0.35, 0]);
  addMesh(trough, new THREE.BoxGeometry(1.48, 0.06, 0.45), material(0x81939a, 0.25, { metalness: 0.1 }), [0, 0.55, 0]);
  for (const x of [-0.65, 0.65]) {
    addMesh(trough, new THREE.BoxGeometry(0.09, 0.43, 0.09), troughMat, [x, 0.22, -0.22]);
    addMesh(trough, new THREE.BoxGeometry(0.09, 0.43, 0.09), troughMat, [x, 0.22, 0.22]);
  }
  scene.add(trough);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe6bd, fog: false }),
  );
  sunGlow.position.set(-42, 31, -82);
  scene.add(sunGlow);
}

function makeHorse() {
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
  const saddleMat = material(0x302d28, 0.62);
  const saddlePadMat = material(0x56614c, 0.9);
  const bridleMat = material(0x31271f, 0.68);
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

  const saddlePad = ellipsoid(horse, saddlePadMat, [0, 2.17, -0.11], [0.45, 0.105, 0.6], [0, 0, 0]);
  saddlePad.rotation.z = 0.02;
  ellipsoid(horse, saddleMat, [0, 2.27, -0.13], [0.37, 0.14, 0.43], [0.02, 0, 0]);
  ellipsoid(horse, saddleMat, [0, 2.34, 0.04], [0.32, 0.11, 0.25], [-0.08, 0, 0]);
  ellipsoid(horse, saddleMat, [0, 2.36, -0.42], [0.33, 0.12, 0.16], [0.13, 0, 0]);

  const leatherLine = (points, radius = 0.024) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const strap = addMesh(horse, new THREE.TubeGeometry(curve, 22, radius, 7, false), bridleMat, [0, 0, 0]);
    strap.castShadow = false;
    return strap;
  };
  leatherLine([[-0.42, 2.18, -0.3], [-0.3, 1.68, -0.23], [0, 1.56, -0.14], [0.3, 1.68, -0.23], [0.42, 2.18, -0.3]], 0.031);
  leatherLine([[-0.4, 2.2, -0.3], [-0.46, 2.12, 0.1], [-0.42, 2.04, 0.45], [0, 2.0, 0.78], [0.42, 2.04, 0.45], [0.46, 2.12, 0.1], [0.4, 2.2, -0.3]], 0.023);

  for (const side of [-1, 1]) {
    leatherLine([
      [side * 0.14, 3.02, 1.27],
      [side * 0.23, 2.96, 1.36],
      [side * 0.23, 2.78, 1.52],
      [side * 0.17, 2.68, 1.65],
    ], 0.019);
    leatherLine([
      [side * 0.21, 2.94, 1.38],
      [side * 0.26, 2.84, 1.48],
      [side * 0.21, 2.73, 1.57],
      [side * 0.1, 2.69, 1.68],
    ], 0.015);
  }
  leatherLine([[-0.21, 2.91, 1.4], [0, 2.96, 1.38], [0.21, 2.91, 1.4]], 0.02);
  leatherLine([[-0.16, 2.67, 1.62], [0, 2.63, 1.69], [0.16, 2.67, 1.62]], 0.022);

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
    action.setEffectiveTimeScale(gait.frequency);
    gaitActions[name] = action;
  }

  return { mixer, idleAction, gaitActions };
}

createMeadowProps();
const { horseRoot, horse, legs, tail, headRig } = makeHorse();

const PATH_X = 8.05;
const PATH_Z = 4.85;
let pathAngle = 0;
let selectedGait = 'walk';
let pace = 0.85;
let isPlaying = !prefersReducedMotion.matches;
const horseAnimation = createHorseAnimations(horse, legs, headRig, tail);
let activeGaitAction = horseAnimation.gaitActions[selectedGait];
if (isPlaying) {
  activeGaitAction.reset().setEffectiveTimeScale(GATES[selectedGait].frequency * pace).play();
} else {
  horseAnimation.idleAction.reset().play();
}
let isFollowing = true;
let lastHudUpdate = 0;
let userOrbiting = false;
let lastSvgFrame = 0;

function setHorsePath() {
  horseRoot.position.x = Math.sin(pathAngle) * PATH_X;
  horseRoot.position.z = Math.cos(pathAngle) * PATH_Z;
  const tangentX = PATH_X * Math.cos(pathAngle);
  const tangentZ = -PATH_Z * Math.sin(pathAngle);
  horseRoot.rotation.y = Math.atan2(tangentX, tangentZ);
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
}

function setGait(gait) {
  if (!Object.hasOwn(GATES, gait)) return;
  if (gait === selectedGait) return;
  const previousAction = activeGaitAction;
  selectedGait = gait;
  activeGaitAction = horseAnimation.gaitActions[gait];
  if (isPlaying) {
    activeGaitAction.reset().setEffectiveTimeScale(GATES[gait].frequency * pace).play();
    previousAction.crossFadeTo(activeGaitAction, 0.42, false);
  } else {
    previousAction.stop();
    activeGaitAction.stop();
  }
  updateHud();
}

function setPlaying(playing) {
  if (playing === isPlaying) return;
  isPlaying = playing;
  if (isPlaying) {
    activeGaitAction.reset().setEffectiveTimeScale(GATES[selectedGait].frequency * pace).play();
    horseAnimation.idleAction.crossFadeTo(activeGaitAction, 0.32, false);
  } else {
    horseAnimation.idleAction.reset().play();
    activeGaitAction.crossFadeTo(horseAnimation.idleAction, 0.32, false);
  }
  updateHud();
}

document.querySelectorAll('.gait-button').forEach((button) => {
  button.addEventListener('click', () => setGait(button.dataset.gait));
});

document.querySelector('#play-button').addEventListener('click', () => {
  setPlaying(!isPlaying);
});

document.querySelector('#speed-slider').addEventListener('input', (event) => {
  pace = Number(event.currentTarget.value) / 100;
  activeGaitAction.setEffectiveTimeScale(GATES[selectedGait].frequency * pace);
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
    const meanRadius = (PATH_X + PATH_Z) * 0.5;
    pathAngle += (metersPerSecond * 0.13 * delta) / meanRadius;
    setHorsePath();
  }

  if (isFollowing && !userOrbiting) {
    const nextTarget = horseRoot.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const nextPosition = nextTarget.clone().add(cameraOffset);
    controls.target.lerp(nextTarget, 1 - Math.exp(-delta * 4.2));
    camera.position.lerp(nextPosition, 1 - Math.exp(-delta * 4.2));
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

startThree();
