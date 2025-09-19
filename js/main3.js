import * as GaussianSplats3D from '../lib/gaussian-splats-3d.module.js';
import * as THREE from 'three';

window.THREE = THREE;

// -------------------- Config (tweak these) --------------------
const BASE_CHUNK_URL = 'https://virtual-homes.s3.ap-south-1.amazonaws.com/VirtualHomes/gs_3d_vista/chunks_output/';

// WORLD / CHUNK sizing: should match what you used in Python manifest (chunk_world_size)
const CHUNK_WORLD_SIZE = 1.0; // world size of a chunk edge (set same as Python chunk_world_size)
const CHUNK_SPHERE_RADIUS = Math.sqrt(3) * CHUNK_WORLD_SIZE * 0.5; // bounding sphere radius for frustum tests

// LOD distance thresholds (in same world units)
const CAMERA_LOAD_DISTANCE = 20;   // low considered in-range
const CAMERA_MEDIUM_DISTANCE = 10; // med threshold
const CAMERA_HIGH_DISTANCE = 5;    // high threshold

// Concurrency + movement tuning
const MAX_CONCURRENT_LOADS = 4;
const MOVEMENT_POS_THRESHOLD = 0.01;
const MOVEMENT_ROT_DOT_THRESHOLD = 0.9997;
const MOVEMENT_THROTTLE_MS = 150;

// Loading options passed to viewer.addSplatScene
const LOAD_OPTIONS = { splatAlphaRemovalThreshold: 1, progressiveLoad: false };

// LOD ordering
const LOD_ORDER = ['low', 'med', 'high'];

// -------------------- Viewer + Camera --------------------
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.fromArray([0, 1, 1]);
camera.up.fromArray([0, 1, 0]);
camera.lookAt(new THREE.Vector3(0, 0, 0));

const viewer = new GaussianSplats3D.Viewer({
  camera: camera,
  cameraUp: [0, 1, 0],
  initialCameraLookAt: [0, 0, 0],
  sphericalHarmonicsDegree: 2,
  useFrustumCulling: true,
  frustumCullingDebug: false,
  frustumCullingMargin: 0.5,
  halfPrecisionCovariancesOnGPU: true,
  sortEnable: true,
  showLoadingUI: false
});

// -------------------- State --------------------
let chunkMeta = []; // each: { i,j,k, center: THREE.Vector3, lods: {low:{path,loaded,promise}, med:..., high:...}, currentLOD }
let skybox = null;
let allowUpgrades = false;   // only becomes true after low loads complete AND camera movement
let lowLoadsComplete = false;
let pendingLoads = [];
let activeLoads = 0;

// camera movement detection
const lastCameraPos = new THREE.Vector3();
const lastCameraQuat = new THREE.Quaternion();
let cameraInit = false;
let lastMovementTime = 0;

// -------------------- Simple concurrency scheduler --------------------
function scheduleLoad(loadFn) {
  return new Promise((resolve, reject) => {
    pendingLoads.push({ loadFn, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  while (activeLoads < MAX_CONCURRENT_LOADS && pendingLoads.length > 0) {
    const item = pendingLoads.shift();
    activeLoads++;
    item.loadFn()
      .then(res => {
        activeLoads--;
        item.resolve(res);
        processQueue();
      })
      .catch(err => {
        activeLoads--;
        item.reject(err);
        processQueue();
      });
  }
}

// -------------------- Manifest loader (manifest entries contain center, i,j,k, lod, filename) --------------------
async function loadManifest() {
  try {
    const resp = await fetch(`${BASE_CHUNK_URL}manifest.json`);
    const data = await resp.json();

    // group per chunk index (i_j_k)
    const map = {};
    for (const entry of data) {
      const key = `${entry.i}_${entry.j}_${entry.k}`;
      if (!map[key]) {
        map[key] = {
          i: entry.i,
          j: entry.j,
          k: entry.k,
          center: new THREE.Vector3(...entry.center),
          lods: {},
          currentLOD: null
        };
      }
      map[key].lods[entry.lod] = {
        path: `${BASE_CHUNK_URL}${entry.filename}`,
        loaded: false,
        promise: null
      };
    }

    chunkMeta = Object.values(map);
    console.log(`Manifest loaded: ${chunkMeta.length} chunks`);
  } catch (err) {
    console.error('Failed to load manifest:', err);
    throw err;
  }
}

// -------------------- Phase 1: Load ALL low LODs and WAIT until complete --------------------
async function loadAllLowLODs() {
  console.log('Phase 1: Enqueueing low LOD loads for all chunks (concurrency-limited)...');

  const lowPromises = [];
  for (const chunk of chunkMeta) {
    const low = chunk.lods.low;
    if (!low) continue;
    // if not scheduled yet, schedule
    if (!low.promise) {
      low.promise = scheduleLoad(() => viewer.addSplatScene(low.path, LOAD_OPTIONS))
        .then(() => {
          low.loaded = true;
          chunk.currentLOD = 'low';
          return low.path;
        })
        .catch(err => {
          low.loaded = false;
          console.warn('Low LOD load failed:', low.path, err);
          // don't throw here; but propagate the rejection so we know not all succeeded
          throw err;
        });
    }
    lowPromises.push(low.promise);
  }

  // Wait for all low promises to either resolve or reject. We treat resolution as "lowLoadsComplete"
  // For strictness we wait for all settle (use Promise.allSettled) and then set lowLoadsComplete true.
  const results = await Promise.allSettled(lowPromises);
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`${failed.length} low LOD loads failed. Continuing anyway.`);
  }
  lowLoadsComplete = true;
  console.log('Phase 1 complete: all low loads settled.');
}

// -------------------- Frustum helper --------------------
const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
function chunkIsVisible(chunk) {
  // Construct frustum
  _projScreenMatrix.multiplyMatrices(viewer.camera.projectionMatrix, viewer.camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_projScreenMatrix);

  const sphere = new THREE.Sphere(chunk.center, CHUNK_SPHERE_RADIUS);
  return _frustum.intersectsSphere(sphere);
}

// -------------------- Movement detection --------------------
function detectCameraMovement() {
  const pos = viewer.camera.position;
  const quat = viewer.camera.quaternion;

  if (!cameraInit) {
    lastCameraPos.copy(pos);
    lastCameraQuat.copy(quat);
    cameraInit = true;
    return false;
  }

  const posMoved = pos.distanceTo(lastCameraPos) > MOVEMENT_POS_THRESHOLD;
  const quatDot = Math.abs(quat.dot(lastCameraQuat));
  const rotated = quatDot < MOVEMENT_ROT_DOT_THRESHOLD;

  if (posMoved || rotated) {
    const now = performance.now();
    if (now - lastMovementTime > MOVEMENT_THROTTLE_MS) {
      lastMovementTime = now;
      lastCameraPos.copy(pos);
      lastCameraQuat.copy(quat);
      return true;
    }
  }

  return false;
}

// -------------------- Phase 2: Upgrades only for VISIBLE chunks (on movement) --------------------
async function handleVisibleUpgrades() {
  if (!lowLoadsComplete) return; // strictly do not upgrade until low phase is done
  if (!allowUpgrades) {
    allowUpgrades = true;
    console.log('Upgrades enabled (camera moved after low phase). Now using frustum + distance for med/high.');
  }

  // Update projection matrix once per pass
  _projScreenMatrix.multiplyMatrices(viewer.camera.projectionMatrix, viewer.camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_projScreenMatrix);

  const cameraPos = viewer.camera.position;

  // Iterate chunks and process visible ones
  for (const chunk of chunkMeta) {
    const visible = _frustum.intersectsSphere(new THREE.Sphere(chunk.center, CHUNK_SPHERE_RADIUS));
    if (!visible) {
      // Not visible -> ensure med/high are removed (keep low)
      await removeMedHigh(chunk);
      continue;
    }

    const dist = cameraPos.distanceTo(chunk.center);
    let desiredLOD = null;
    if (dist < CAMERA_HIGH_DISTANCE) desiredLOD = 'high';
    else if (dist < CAMERA_MEDIUM_DISTANCE) desiredLOD = 'med';
    else if (dist < CAMERA_LOAD_DISTANCE) desiredLOD = 'low';

    if (!desiredLOD) {
      // visible but beyond load distance; keep low
      continue;
    }

    // If desired higher than current, sequentially upgrade
    const currentIndex = chunk.currentLOD ? LOD_ORDER.indexOf(chunk.currentLOD) : -1;
    const targetIndex = LOD_ORDER.indexOf(desiredLOD);

    if (targetIndex > currentIndex) {
      // Kick off sequential upgrade but do not block whole loop
      upgradeChunkSequential(chunk, currentIndex, targetIndex).catch(err => {
        console.warn('Upgrade failed for chunk', chunk.i, chunk.j, chunk.k, err);
      });
    }
    // If desired is lower than current, we could consider downgrading, but we keep current until it's out of frustum to simplify
  }
}

// sequential upgrade implementation with waiting on previous LOD
async function upgradeChunkSequential(chunk, currentIndex, targetIndex) {
  // For idx = currentIndex+1 .. targetIndex
  for (let idx = currentIndex + 1; idx <= targetIndex; idx++) {
    const lod = LOD_ORDER[idx];
    const lodEntry = chunk.lods[lod];
    if (!lodEntry) continue;

    // Ensure previous is loaded
    if (idx > 0) {
      const prev = LOD_ORDER[idx - 1];
      const prevEntry = chunk.lods[prev];
      if (prevEntry && !prevEntry.loaded) {
        if (!prevEntry.promise) {
          prevEntry.promise = scheduleLoad(() => viewer.addSplatScene(prevEntry.path, LOAD_OPTIONS))
            .then(() => {
              prevEntry.loaded = true;
              chunk.currentLOD = prev;
              return prevEntry.path;
            })
            .catch(err => {
              prevEntry.loaded = false;
              throw err;
            });
        }
        await prevEntry.promise;
      }
    }

    // Now load this LOD if not loaded
    if (!lodEntry.loaded) {
      if (!lodEntry.promise) {
        lodEntry.promise = scheduleLoad(() => viewer.addSplatScene(lodEntry.path, LOAD_OPTIONS))
          .then(() => {
            lodEntry.loaded = true;
            chunk.currentLOD = lod;
            return lodEntry.path;
          })
          .catch(err => {
            lodEntry.loaded = false;
            throw err;
          });
      }
      await lodEntry.promise;
    }

    // after loading this LOD, remove lower immediate LOD to free memory
    if (idx > 0) {
      const lower = LOD_ORDER[idx - 1];
      const lowerEntry = chunk.lods[lower];
      if (lowerEntry && lowerEntry.loaded) {
        try { viewer.removeSplatScene(lowerEntry.path); } catch (e) {}
        lowerEntry.loaded = false;
      }
    }
  }
}

// -------------------- Remove med/high for chunks not visible (keep low) --------------------
async function removeMedHigh(chunk) {
  for (const lod of ['high', 'med']) {
    const entry = chunk.lods[lod];
    if (entry && entry.loaded) {
      try {
        viewer.removeSplatScene(entry.path);
      } catch (e) {}
      entry.loaded = false;
      // Keep entry.promise as-is (allows later reuse), but we mark not loaded.
    }
  }
}

// -------------------- Optional: aggressively unload very far chunks (keeps only low) --------------------
function unloadVeryFarChunks() {
  const cameraPos = viewer.camera.position;
  const UNLOAD_DISTANCE = CAMERA_LOAD_DISTANCE * 2.5;
  for (const chunk of chunkMeta) {
    const d = cameraPos.distanceTo(chunk.center);
    if (d > UNLOAD_DISTANCE) {
      // remove med/high
      for (const lod of ['high', 'med']) {
        const e = chunk.lods[lod];
        if (e && e.loaded) {
          try { viewer.removeSplatScene(e.path); } catch(e) {}
          e.loaded = false;
        }
      }
      // optionally remove low too if you want ultra aggressive unload, but you specified keep low
    }
  }
}

// -------------------- Scene init / skybox --------------------
function createSkybox(url) {
  if (skybox) {
    try { viewer.threeScene.remove(skybox); } catch(e) {}
    skybox = null;
  }
  if (!url) return;
  const loader = new THREE.TextureLoader();
  loader.load(url, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const g = new THREE.SphereGeometry(30, 32, 32);
    const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
    skybox = new THREE.Mesh(g, m);
    skybox.renderOrder = -1000;
    viewer.threeScene.add(skybox);
  }, undefined, (err) => console.error('Skybox load err', err));
}

function initializeScene() {
  const scene = viewer.threeScene;
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5, 10, 7);
  dir.castShadow = true;
  scene.add(dir);
  createSkybox('https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr');
}

// -------------------- Main animation loop --------------------
function animate() {
  requestAnimationFrame(animate);

  // keep skybox centered
  if (skybox && viewer.camera) skybox.position.copy(viewer.camera.position);

  // movement detection
  const moved = detectCameraMovement();

  // upgrades only after low phase done and on movement
  if (lowLoadsComplete && moved) {
    handleVisibleUpgrades();
  }

  // Periodic cleanup
  unloadVeryFarChunks();
}

// -------------------- Initialization flow --------------------
async function initialize() {
  try {
    await loadManifest();

    if (!viewer.isStarted) viewer.start();
    initializeScene();

    // Phase 1: enqueue and wait for ALL low loads to finish
    await loadAllLowLODs(); // WAIT here until low LODs settle
    // Now lowLoadsComplete = true

    // Start render loop and allow upgrades only after camera moves
    animate();
    console.log('Renderer started. Waiting for camera movement to begin med/high upgrades.');
  } catch (err) {
    console.error('Initialization failed:', err);
  }
}

// -------------------- Resize + start --------------------
window.addEventListener('resize', () => {
  if (viewer.camera) {
    viewer.camera.aspect = window.innerWidth / window.innerHeight;
    viewer.camera.updateProjectionMatrix();
  }
  if (viewer.renderer) viewer.renderer.setSize(window.innerWidth, window.innerHeight);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
