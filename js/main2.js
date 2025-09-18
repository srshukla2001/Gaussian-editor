import * as GaussianSplats3D from '../lib/gaussian-splats-3d.module.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import GUI from 'lil-gui';
import { exportScene } from './export.js';
import { createGUI } from './gui.js';
import { createTransformGizmo } from './gizmo.js';
import { styleTag } from './styles.js'
import { sidebar, BottomBar } from './sidebar.js';
window.THREE = THREE;

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.fromArray([0, 1, 1]);
camera.up.fromArray([0, 1, 0]);
camera.lookAt(new THREE.Vector3(0, 0, 0));

const renderDim = new THREE.Vector2();
const tmpVec3 = new THREE.Vector3();
const tmpProj = new THREE.Vector3();
let canvasEl = null;
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

const BASE_CHUNK_URL = 'https://virtual-homes.s3.ap-south-1.amazonaws.com/VirtualHomes/gs_3d_vista/chunk_wasl/';
let splatChunks = [];
let loadedChunkScenes = [];
// function generateChunkUrls(gridSize = 5) {
//   splatChunks = [];
//   for (let i = 0; i < gridSize; i++) {
//     for (let j = 0; j < gridSize; j++) {
//       for (let k = 0; k < gridSize; k++) {
//         try {
//           splatChunks.push(`${BASE_CHUNK_URL}chunk_${i}_${j}_${k}.ply`);
//         } catch (e) {
//           console.warn(`Chunk ${i}_${j}_${k} not available, skipping...`);
//           continue;
//         }
//       }
//     }
//   }
//   console.log(`Generated ${splatChunks.length} chunk URLs`);
// }

async function generateChunkUrlsFromManifest(manifestUrl) {
  try {
    const response = await fetch(manifestUrl);
    const files = await response.json();
    splatChunks = files.map(f => `${BASE_CHUNK_URL}${f}`);
    console.log(`Loaded ${splatChunks.length} chunk URLs from manifest`);
    document.getElementById('loadChunksStatus').textContent =
      `Loaded ${splatChunks.length} valid chunk URLs from manifest`;
  } catch (err) {
    console.error("Failed to load manifest:", err);
    document.getElementById('loadChunksStatus').textContent = "Failed to load manifest.";
  }
}


const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);
const models = [];
const groups = [];
const mixers = [];
let skybox = null;
let skyboxTextureUrl = null;
let selectedModel = null;
let selectedGroup = null;
let gui = null;

let transformGizmo = null;
let isDragging = false;
let dragStartPoint = new THREE.Vector3();
let selectedAxis = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let lastHoveredModel = null;

document.head.appendChild(styleTag);
document.body.appendChild(sidebar);
document.body.appendChild(BottomBar);

const tooltip = document.createElement('div');
tooltip.className = 'hp-tooltip';
tooltip.innerHTML = `<h4 id="tipTitle">Title</h4><p id="tipDesc">desc</p><button style="display: none" id="tipBtn">Action</button>`;
document.body.appendChild(tooltip);

const tooltips = new Map();

function generateModelId() {
  return 'model_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}
function addChunkPath(path) {
  if (!splatChunks.includes(path)) {
    splatChunks.push(path);
    refreshChunksList();
  }
}
function removeChunkPath(path) {
  const index = splatChunks.indexOf(path);
  if (index > -1) {
    splatChunks.splice(index, 1);
    refreshChunksList();
  }
}
function refreshChunksList() {
  const chunksList = document.getElementById('chunksList');
  if (!chunksList) return;

  chunksList.innerHTML = '';
  splatChunks.forEach((path, index) => {
    const item = document.createElement('div');
    item.className = 'chunk-item';
    item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      margin: 4px 0;
      background: var(--bg-secondary);
      border-radius: 4px;
      border: 1px solid var(--border);
    `;

    const pathDisplay = document.createElement('span');
    pathDisplay.textContent = path.split('/').pop() || path;
    pathDisplay.style.fontSize = '12px';
    pathDisplay.title = path;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'small-btn danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      removeChunkPath(path);
    });

    item.appendChild(pathDisplay);
    item.appendChild(removeBtn);
    chunksList.appendChild(item);
  });
}

async function loadAllChunks() {
  try {
    console.log('Starting to load chunks sequentially...');
    document.getElementById('loadChunksStatus').textContent = `Loading ${splatChunks.length} chunks sequentially...`;
    loadedChunkScenes = [];
    let loadedCount = 0;

    for (let i = 0; i < splatChunks.length; i++) {
      try {
        const chunkPath = splatChunks[i];
        console.log(`Loading chunk ${i + 1}/${splatChunks.length}: ${chunkPath}`);
        document.getElementById('loadChunksStatus').textContent =
          `Loading chunk ${i + 1}/${splatChunks.length}...`;
        await viewer.addSplatScene(chunkPath, {
          'splatAlphaRemovalThreshold': 20,
          'progressiveLoad': false
        });

        loadedChunkScenes.push({ path: chunkPath, splatAlphaRemovalThreshold: 20 });
        loadedCount++;
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (chunkError) {
        console.warn(`Failed to load chunk ${i + 1}: ${splatChunks[i]}`, chunkError);
      }
    }

    console.log(`Successfully loaded ${loadedCount} out of ${splatChunks.length} chunks`);
    document.getElementById('loadChunksStatus').textContent =
      `Loaded ${loadedCount}/${splatChunks.length} chunks successfully`;
    if (!viewer.isStarted) {
      viewer.start();
    }

    requestAnimationFrame(() => {
      canvasEl = (viewer.renderer && viewer.renderer.domElement) || document.querySelector('canvas');
      if (canvasEl) {
        canvasEl.style.touchAction = 'none';
      }
      setupTransformGizmo();
      initializeScene();
    });

  } catch (err) {
    console.error('Critical error during chunk loading:', err);
    document.getElementById('loadChunksStatus').textContent = 'Critical error during loading. Starting basic viewer...';
    try {
      if (!viewer.isStarted) {
        viewer.start();
      }
      requestAnimationFrame(() => {
        canvasEl = (viewer.renderer && viewer.renderer.domElement) || document.querySelector('canvas');
        if (canvasEl) {
          canvasEl.style.touchAction = 'none';
        }
        setupTransformGizmo();
        initializeScene();
      });
    } catch (fallbackErr) {
      console.error('Even fallback initialization failed:', fallbackErr);
      document.getElementById('loadChunksStatus').textContent = 'Complete initialization failure. Check console.';
    }
  }
}
async function loadChunksBatched(batchSize = 5) {
  try {
    console.log('Starting batched chunk loading...');
    document.getElementById('loadChunksStatus').textContent = `Loading ${splatChunks.length} chunks in batches of ${batchSize}...`;

    loadedChunkScenes = [];
    let totalLoaded = 0;
    for (let i = 0; i < splatChunks.length; i += batchSize) {
      const batch = splatChunks.slice(i, i + batchSize);
      const batchConfigs = batch.map(path => ({ path, splatAlphaRemovalThreshold: 20 }));

      try {
        console.log(`Loading batch ${Math.floor(i / batchSize) + 1}: ${batch.length} chunks`);
        document.getElementById('loadChunksStatus').textContent =
          `Loading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(splatChunks.length / batchSize)}...`;
        await viewer.addSplatScenes(batchConfigs, true);
        loadedChunkScenes.push(...batchConfigs);
        totalLoaded += batch.length;
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (batchError) {
        console.warn(`Batch failed, falling back to individual loading for this batch:`, batchError);
        for (const chunkPath of batch) {
          try {
            await viewer.addSplatScene(chunkPath, { splatAlphaRemovalThreshold: 20 });
            loadedChunkScenes.push({ path: chunkPath, splatAlphaRemovalThreshold: 20 });
            totalLoaded++;
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (individualError) {
            console.warn(`Individual chunk failed: ${chunkPath}`, individualError);
          }
        }
      }
    }

    console.log(`Loaded ${totalLoaded} chunks using batched approach`);
    document.getElementById('loadChunksStatus').textContent =
      `Loaded ${totalLoaded}/${splatChunks.length} chunks (batched)`;

    if (!viewer.isStarted) {
      viewer.start();
    }

    requestAnimationFrame(() => {
      canvasEl = (viewer.renderer && viewer.renderer.domElement) || document.querySelector('canvas');
      if (canvasEl) {
        canvasEl.style.touchAction = 'none';
      }
      setupTransformGizmo();
      initializeScene();
    });

  } catch (err) {
    console.error('Batched loading failed, falling back to sequential:', err);
    return loadAllChunks();
  }
}
async function loadChunksWithRetry(maxRetries = 3) {
  let totalLoaded = 0;
  const failedChunks = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Loading attempt ${attempt}/${maxRetries}`);
      for (let i = 0; i < splatChunks.length; i++) {
        const chunkPath = splatChunks[i];
        if (loadedChunkScenes.some(scene => scene.path === chunkPath)) {
          continue;
        }

        try {
          console.log(`Loading chunk ${i + 1}/${splatChunks.length}: ${chunkPath}`);
          document.getElementById('loadChunksStatus').textContent =
            `Loading chunk ${i + 1}/${splatChunks.length}... (Attempt ${attempt})`;

          await viewer.addSplatScene(chunkPath, {
            'splatAlphaRemovalThreshold': 20,
            'progressiveLoad': false
          });

          loadedChunkScenes.push({ path: chunkPath, splatAlphaRemovalThreshold: 20 });
          totalLoaded++;
          const failedIndex = failedChunks.indexOf(chunkPath);
          if (failedIndex > -1) {
            failedChunks.splice(failedIndex, 1);
          }

          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (chunkError) {
          console.warn(`Failed to load chunk: ${chunkPath}`, chunkError);
          if (!failedChunks.includes(chunkPath)) {
            failedChunks.push(chunkPath);
          }
          continue;
        }
      }

      console.log(`Loaded ${totalLoaded} chunks, ${failedChunks.length} failed`);
      document.getElementById('loadChunksStatus').textContent =
        `Loaded ${totalLoaded}/${splatChunks.length} chunks. ${failedChunks.length} failed.`;
      if (!viewer.isStarted) {
        viewer.start();
      }

      requestAnimationFrame(() => {
        canvasEl = (viewer.renderer && viewer.renderer.domElement) || document.querySelector('canvas');
        if (canvasEl) {
          canvasEl.style.touchAction = 'none';
        }
        setupTransformGizmo();
        initializeScene();
      });

      return;

    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        console.log(`Retrying in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      } else {
        console.error('All loading attempts failed');
        document.getElementById('loadChunksStatus').textContent =
          `Failed to load all chunks. ${totalLoaded} succeeded, ${failedChunks.length} failed.`;
        try {
          if (!viewer.isStarted) {
            viewer.start();
          }
          requestAnimationFrame(() => {
            canvasEl = (viewer.renderer && viewer.renderer.domElement) || document.querySelector('canvas');
            if (canvasEl) {
              canvasEl.style.touchAction = 'none';
            }
            setupTransformGizmo();
            initializeScene();
          });
        } catch (fallbackErr) {
          console.error('Ultimate fallback failed:', fallbackErr);
        }
      }
    }
  }
}
function logMissingChunks() {
  const expectedChunks = splatChunks;
  const loadedPaths = loadedChunkScenes.map(scene => scene.path);
  const missingChunks = expectedChunks.filter(path => !loadedPaths.includes(path));

  console.log('Missing chunks:', missingChunks);
  if (missingChunks.length > 0) {
    document.getElementById('loadChunksStatus').textContent +=
      ` | Missing: ${missingChunks.length} chunks`;
  }
}
logMissingChunks();
const scene = viewer.threeScene;

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

const box = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xffff00 })
);
box.name = 'Box';
scene.add(box);
models.push({ id: generateModelId(), name: 'Box', object: box, showTooltip: true, showTooltipButton: true });

gui = createGUI(box);
selectedModel = box;
updateSelectedInfo();
refreshSidebarList();
refreshGroupList();

window.addEventListener('resize', () => {
  models.forEach(m => {
    try {
      const wrapper = tooltips.get(m.object);
      if (wrapper && m.showTooltip !== false) {
        const anchor = new THREE.Vector3();
        m.object.getWorldPosition(anchor);
        updateTooltipPosition(wrapper.el, anchor);
      }
    } catch (e) { }
  });
});


const CAMERA_LIMITS = {
  MIN_ZOOM: 2,
  MAX_ZOOM: 6,
  MIN_POLAR: 10,
  MAX_POLAR: 170,
  MIN_HEIGHT: 0,
  TARGET: new THREE.Vector3(0, 1, 0)
};
function clampCamera(camera) {
  if (camera.position.y < CAMERA_LIMITS.MIN_HEIGHT) {
    camera.position.y = CAMERA_LIMITS.MIN_HEIGHT;
  }
  const distance = camera.position.distanceTo(CAMERA_LIMITS.TARGET);
  const clampedDistance = THREE.MathUtils.clamp(
    distance,
    CAMERA_LIMITS.MIN_ZOOM,
    CAMERA_LIMITS.MAX_ZOOM
  );
  if (distance !== clampedDistance) {
    const direction = new THREE.Vector3()
      .subVectors(camera.position, CAMERA_LIMITS.TARGET)
      .normalize();
    camera.position.copy(CAMERA_LIMITS.TARGET).add(direction.multiplyScalar(clampedDistance));
  }
  const direction = new THREE.Vector3()
    .subVectors(camera.position, CAMERA_LIMITS.TARGET)
    .normalize();
  const polarAngle = Math.acos(direction.y) * THREE.MathUtils.RAD2DEG;
  const clampedPolar = THREE.MathUtils.clamp(
    polarAngle,
    CAMERA_LIMITS.MIN_POLAR,
    CAMERA_LIMITS.MAX_POLAR
  );
  if (polarAngle !== clampedPolar) {
    const spherical = new THREE.Spherical()
      .setFromVector3(
        new THREE.Vector3()
          .subVectors(camera.position, CAMERA_LIMITS.TARGET)
      );

    spherical.phi = clampedPolar * THREE.MathUtils.DEG2RAD;

    const newPosition = new THREE.Vector3()
      .copy(CAMERA_LIMITS.TARGET)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    if (newPosition.y >= CAMERA_LIMITS.MIN_HEIGHT) {
      camera.position.copy(newPosition);
    }

    camera.lookAt(CAMERA_LIMITS.TARGET);
  }
  if (camera.position.y < CAMERA_LIMITS.MIN_HEIGHT) {
    camera.position.y = CAMERA_LIMITS.MIN_HEIGHT;
    camera.lookAt(CAMERA_LIMITS.TARGET);
  }
}

function createSkybox(textureUrl) {
  if (skybox) {
    viewer.threeScene.remove(skybox);
    skybox = null;
  }

  if (!textureUrl) return;

  const loader = new THREE.TextureLoader();
  loader.load(textureUrl, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;

    const skyboxGeometry = new THREE.SphereGeometry(30, 32, 32);
    const skyboxMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false
    });

    skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    skybox.renderOrder = -1000;
    viewer.threeScene.add(skybox);
    skyboxTextureUrl = textureUrl;
    if (skyboxGUI) {
      skyboxGUI.refresh();
    }
  }, undefined, (err) => {
    console.error('Failed to load skybox texture:', err);
  });
}
function removeSkybox() {
  if (skybox) {
    viewer.threeScene.remove(skybox);
    skybox = null;
    skyboxTextureUrl = null;
  }
}
let skyboxGUI = null;

function createSkyboxGUI() {
  if (skyboxGUI) {
    skyboxGUI.destroy();
  }

  skyboxGUI = new GUI({ title: 'Skybox Settings', width: 300 });

  const skyboxFolder = skyboxGUI.addFolder('Skybox');
  skyboxFolder.add({ enabled: !!skybox }, 'enabled')
    .name('Enable Skybox')
    .onChange((value) => {
      if (value) {
        if (skyboxTextureUrl) {
          createSkybox(skyboxTextureUrl);
        } else {
          createSkybox('https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr');
        }
      } else {
        removeSkybox();
      }
    });

  skyboxFolder.add({ url: skyboxTextureUrl || '' }, 'url')
    .name('Texture URL')
    .onChange((url) => {
      if (url && url.trim() !== '') {
        createSkybox(url);
      }
    });

  skyboxFolder.add({ remove: () => removeSkybox() }, 'remove')
    .name('Remove Skybox');

  skyboxFolder.open();
}
const skyboxSection = `
<div class="sidebar-section">
  <h3>PLY Chunks (Auto-loaded)</h3>
  <div class="form-group">
    <div id="loadChunksStatus" style="font-size: 12px; color: var(--muted); padding: 8px; background: var(--bg-secondary); border-radius: 4px;">Ready to load chunks...</div>
  </div>
  <div class="form-group">
    <label>Grid Size:</label>
    <div class="button-group">
      <button class="small-btn" id="load3x3Grid">Load 3x3x3 (27 chunks)</button>
      <button class="small-btn" id="load4x4Grid">Load 4x4x4 (64 chunks)</button>
      <button class="small-btn" id="load5x5Grid">Load 5x5x5 (125 chunks)</button>
    </div>
  </div>
  <div class="form-group">
    <button id="loadChunksBtn" class="btn primary" style="width: 100%; margin-bottom: 8px;">Load Selected Chunks</button>
  </div>
</div>
<div class="sidebar-section">
  <h3>Skybox</h3>
  <div class="form-group">
    <label for="skyboxUrl">Skybox Texture URL:</label>
    <input type="text" id="skyboxUrl" placeholder="Enter HDR/Equirectangular image URL">
    <button id="loadSkyboxBtn" class="btn">Load Skybox</button>
    <button id="removeSkyboxBtn" class="btn danger">Remove Skybox</button>
  </div>
  <div class="form-group">
    <label>Presets:</label>
    <div class="button-group">
      <button class="small-btn" data-skybox="https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr">Venice Sunset</button>
      <button class="small-btn" data-skybox="https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr">Royal Esplanade</button>
      <button class="small-btn" data-skybox="https://threejs.org/examples/textures/equirectangular/paul_lobe_haus_1k.hdr">Paul Lobe Haus</button>
    </div>
  </div>
</div>
`;
sidebar.innerHTML += skyboxSection;
// document.getElementById('load3x3Grid').addEventListener('click', () => {
//   generateChunkUrls(3);
//   document.getElementById('loadChunksStatus').textContent = `Generated 27 chunk URLs (3x3x3 grid)`;
// });

// document.getElementById('load4x4Grid').addEventListener('click', () => {
//   generateChunkUrls(4);
//   document.getElementById('loadChunksStatus').textContent = `Generated 64 chunk URLs (4x4x4 grid)`;
// });

document.getElementById('load5x5Grid').addEventListener('click', () => {
  generateChunkUrlsFromManifest(`${BASE_CHUNK_URL}manifest.json`);
  document.getElementById('loadChunksStatus').textContent = `Generated 125 chunk URLs (5x5x5 grid)`;
});

document.getElementById('loadChunksBtn').addEventListener('click', () => {
  if (splatChunks.length === 0) {
    alert('Please select a grid size first (3x3x3, 4x4x4, or 5x5x5)');
    return;
  }
  loadChunksWithRetry();
});
document.getElementById('loadSkyboxBtn').addEventListener('click', () => {
  const url = document.getElementById('skyboxUrl').value;
  if (url && url.trim() !== '') {
    createSkybox(url);
    createSkyboxGUI();
  }
});

document.getElementById('removeSkyboxBtn').addEventListener('click', () => {
  removeSkybox();
  if (skyboxGUI) {
    skyboxGUI.destroy();
    skyboxGUI = null;
  }
});
document.querySelectorAll('[data-skybox]').forEach(button => {
  button.addEventListener('click', (e) => {
    const url = e.target.getAttribute('data-skybox');
    document.getElementById('skyboxUrl').value = url;
    createSkybox(url);
    createSkyboxGUI();
  });
});

function createGroupFromFile(filename, meshes) {
  const groupId = `group_${filename}_${Date.now()}`;
  const group = {
    id: groupId,
    name: filename.replace('.glb', ''),
    objects: meshes.map(m => m.object),
    visible: true
  };

  groups.push(group);
  return group;
}

function selectGroup(group) {
  selectedGroup = group;
  selectedModel = null;

  if (transformGizmo) {
    transformGizmo.visible = true;
    const center = calculateGroupCenter(group);
    transformGizmo.position.copy(center);
  }

  updateSelectedInfo();

  if (gui) {
    try {
      gui.destroy();
    } catch (e) { }
    gui = null;
  }

  const groupDummy = new THREE.Object3D();
  groupDummy.name = group.name;
  groupDummy.position.copy(calculateGroupCenter(group));
  groupDummy.visible = true;
  group.dummy = groupDummy;

  gui = createGUI(groupDummy, true, group.objects);
}

function calculateGroupCenter(group) {
  const center = new THREE.Vector3();
  group.objects.forEach(obj => {
    center.add(obj.position);
  });
  center.divideScalar(group.objects.length);
  return center;
}

function transformGroup(group, operation, value) {
  const center = calculateGroupCenter(group);

  group.objects.forEach(obj => {
    switch (operation) {
      case 'translate':
        obj.position.add(value);
        break;
      case 'rotate':
        const relativePos = new THREE.Vector3().subVectors(obj.position, center);
        relativePos.applyAxisAngle(value.axis, value.angle);
        obj.position.copy(center).add(relativePos);
        obj.rotation[value.axis] += value.angle;
        break;
      case 'scale':
        const scaleRelativePos = new THREE.Vector3().subVectors(obj.position, center);
        scaleRelativePos.multiply(value);
        obj.position.copy(center).add(scaleRelativePos);
        obj.scale.multiply(value);
        break;
    }

    obj.updateMatrix();
  });
}

function refreshGroupList() {
  const list = document.getElementById('groupsList');
  if (!list) return;

  list.innerHTML = '';

  groups.forEach((group, index) => {
    const item = document.createElement('div');
    item.className = 'group-item';
    item.dataset.index = index;

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = '2px';

    const nameDisplay = document.createElement('div');
    nameDisplay.className = 'name';
    nameDisplay.textContent = group.name;

    const countDisplay = document.createElement('div');
    countDisplay.style.fontSize = '11px';
    countDisplay.style.color = 'var(--muted)';
    countDisplay.textContent = `${group.objects.length} objects`;

    left.appendChild(nameDisplay);
    left.appendChild(countDisplay);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const selectBtn = document.createElement('button');
    selectBtn.className = 'small-btn';
    selectBtn.textContent = 'Select Group';
    selectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectGroup(group);
    });

    const visibilityBtn = document.createElement('button');
    visibilityBtn.className = 'small-btn';
    visibilityBtn.textContent = group.visible ? 'Hide' : 'Show';
    visibilityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      group.visible = !group.visible;
      group.objects.forEach(obj => {
        obj.visible = group.visible;
      });
      visibilityBtn.textContent = group.visible ? 'Hide' : 'Show';
    });

    actions.appendChild(selectBtn);
    actions.appendChild(visibilityBtn);

    item.appendChild(left);
    item.appendChild(actions);

    item.addEventListener('click', () => selectGroup(group));

    list.appendChild(item);
  });
}
function setupTransformGizmo() {
  transformGizmo = createTransformGizmo();
  viewer.threeScene.add(transformGizmo);
  transformGizmo.visible = false;

  if (viewer.renderer && viewer.renderer.domElement) {
    viewer.renderer.domElement.addEventListener('mousedown', onMouseDown);
    viewer.renderer.domElement.addEventListener('mousemove', onMouseMove);
    viewer.renderer.domElement.addEventListener('mouseup', onMouseUp);
  }
}

function onMouseDown(event) {
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, viewer.camera);

  if ((selectedModel || selectedGroup) && transformGizmo && transformGizmo.visible) {
    const gizmoIntersects = raycaster.intersectObjects(transformGizmo.children, true);

    for (const intersect of gizmoIntersects) {
      if (intersect.object.userData.isHandle) {
        selectedAxis = intersect.object.userData.axis;
        isDragging = true;
        dragStartPoint.copy(intersect.point);
        if (viewer.controls) {
          viewer.controls.enabled = false;
        }
        return;
      }
    }
  }

  const sceneIntersects = raycaster.intersectObjects(viewer.threeScene.children, true);

  const validIntersects = sceneIntersects.filter(intersect =>
    !intersect.object.userData?.isHandle &&
    !intersect.object.isGaussianSplatMesh
  );

  if (validIntersects.length > 0) {
    const clickedObject = validIntersects[0].object;

    let groupOwner = clickedObject;
    while (groupOwner && !groupOwner.userData.groupId) {
      groupOwner = groupOwner.parent;
    }
    if (groupOwner && groupOwner.userData && groupOwner.userData.groupId) {
      const groupId = groupOwner.userData.groupId;
      const group = groups.find(g => g.id === groupId);

      if (group) {
        selectGroup(group);
        return;
      }
    }

    const modelData = findModelEntryForObject(clickedObject);
    if (modelData) {
      if (modelData.script && modelData.script.trim() !== "") {
        try {
          new Function(modelData.script).call(modelData.object);
        } catch (err) {
          console.error("Script error for model:", modelData.id, err);
        }
      }
      if (modelData.showTooltip !== false && modelData.tooltipTrigger === 'onclick') {
        const wrapper = findTooltipWrapperForObject(clickedObject);
        if (wrapper) {
          wrapper.visible = !wrapper.visible;
          wrapper.el.style.display = wrapper.visible ? 'block' : 'none';
          if (wrapper.visible) {
            const anchor = new THREE.Vector3();

            modelData.object.getWorldPosition(anchor);
            updateTooltipPosition(wrapper.el, anchor);
          }
        }
      }
      if (modelData.script && modelData.script.trim() !== "") {
        try {
          new Function(modelData.script).call(modelData.object);
        } catch (err) {
          console.error("Script error for model:", modelData.id, err);
        }
      }
      selectModel(modelData.object);
    }
  } else {
    selectedModel = null;
    selectedGroup = null;
    if (transformGizmo) {
      transformGizmo.visible = false;
    }
    updateSelectedInfo();

    if (gui) {
      try {
        gui.destroy();
      } catch (e) { }
      gui = null;
    }

    hideAllOnclickTooltips();
  }
}

function onMouseMove(event) {
  const mouseN = new THREE.Vector2();
  mouseN.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseN.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (!isDragging) {
    raycaster.setFromCamera(mouseN, viewer.camera);
    const sceneIntersects = raycaster.intersectObjects(viewer.threeScene.children, true);
    const validIntersects = sceneIntersects.filter(intersect =>
      !intersect.object.userData?.isHandle &&
      !intersect.object.isGaussianSplatMesh
    );

    if (validIntersects.length > 0) {
      const hoveredObject = validIntersects[0].object;
      const modelData = findModelEntryForObject(hoveredObject);

      if (modelData && modelData.showTooltip !== false && modelData.tooltipTrigger === 'onhover') {
        if (lastHoveredModel && lastHoveredModel !== modelData.object) {
          const lastWrap = tooltips.get(lastHoveredModel);
          if (lastWrap) { lastWrap.el.style.display = 'none'; lastWrap.visible = false; }
        }
        const wrapper = findTooltipWrapperForObject(hoveredObject);
        if (wrapper) {
          wrapper.visible = true;
          wrapper.el.style.display = 'block';
          const anchor = new THREE.Vector3();
          modelData.object.getWorldPosition(anchor);
          updateTooltipPosition(wrapper.el, anchor);
          lastHoveredModel = modelData.object;
        }
      } else {
        if (lastHoveredModel) {
          const lastWrap = tooltips.get(lastHoveredModel);
          if (lastWrap) { lastWrap.el.style.display = 'none'; lastWrap.visible = false; }
          lastHoveredModel = null;
        }
      }
    } else {
      if (lastHoveredModel) {
        const lastWrap = tooltips.get(lastHoveredModel);
        if (lastWrap) { lastWrap.el.style.display = 'none'; lastWrap.visible = false; }
        lastHoveredModel = null;
      }
    }
  }

  if (!isDragging || !selectedAxis) return;

  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouseN, viewer.camera);

  const plane = new THREE.Plane();
  const axisVector = new THREE.Vector3();

  switch (selectedAxis) {
    case 'x': axisVector.set(1, 0, 0); break;
    case 'y': axisVector.set(0, 1, 0); break;
    case 'z': axisVector.set(0, 0, 1); break;
  }

  const cameraDirection = new THREE.Vector3();
  viewer.camera.getWorldDirection(cameraDirection);
  const cross = new THREE.Vector3().crossVectors(axisVector, cameraDirection);
  plane.setFromNormalAndCoplanarPoint(cross, dragStartPoint);

  const intersection = new THREE.Vector3();
  ray.ray.intersectPlane(plane, intersection);

  const delta = new THREE.Vector3().subVectors(intersection, dragStartPoint);

  if (selectedModel) {
    switch (selectedAxis) {
      case 'x': selectedModel.position.x += delta.x; break;
      case 'y': selectedModel.position.y += delta.y; break;
      case 'z': selectedModel.position.z += delta.z; break;
    }
    transformGizmo.position.copy(selectedModel.position);
  } else if (selectedGroup) {
    transformGroup(selectedGroup, 'translate', delta);
    transformGizmo.position.copy(calculateGroupCenter(selectedGroup));
  }

  dragStartPoint.copy(intersection);
  updateSelectedInfo();
}

const tooltipInputStyle = document.createElement('style');
tooltipInputStyle.textContent = `
  .tooltip-input {
    width: 100%;
    padding: 4px;
    margin-top: 4px;
    font-size: 11px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg-secondary);
    color: var(--text);
  }
  
  .tooltip-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  
  .group-item {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .group-item:hover {
    background-color: var(--bg-secondary);
  }

  .group-item .name {
    font-weight: 500;
    margin-bottom: 2px;
  }
`;
document.head.appendChild(tooltipInputStyle);

function updateTooltipContent(model) {
  const wrapper = tooltips.get(model);
  const modelData = models.find(m => m.object === model);
  if (!wrapper) return;

  const tooltip = wrapper.el;

  const name = modelData?.name || model.name || model.type;
  const description = modelData?.description || `Description for ${name}`;
  const buttonText = modelData?.buttonText || "Select";
  const showButton = modelData?.showTooltipButton !== false;

  tooltip.innerHTML = `<h4>${name}</h4><p>${description}</p>${showButton ? `<button>${buttonText}</button>` : ''}`;
  tooltip.style.pointerEvents = showButton ? 'auto' : 'none';
  if (showButton) {
    const button = tooltip.querySelector('button');
    if (button) {
      button.replaceWith(button.cloneNode(true));
      const newButton = tooltip.querySelector('button');

      newButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (modelData && modelData.script && modelData.script.trim() !== "") {
          try {
            new Function(modelData.script).call(modelData.object);
          } catch (err) {
            console.error("Script error for model:", modelData.id, err);
          }
        }
        selectModel(model);
      });
    }
  }
}

function createModelItem(m, index) {
  const item = document.createElement('div');
  item.className = 'model-item';
  item.dataset.index = index;
  const showButtonToggle = document.createElement('div');
  showButtonToggle.className = 'tooltip-toggle';
  showButtonToggle.style.marginTop = '6px';
  const showButtonCheckbox = document.createElement('input');
  showButtonCheckbox.type = 'checkbox';
  showButtonCheckbox.checked = m.showTooltipButton !== false;
  showButtonCheckbox.addEventListener('change', (e) => {
    m.showTooltipButton = e.target.checked;
    updateTooltipContent(m.object);
  });
  const showButtonLabel = document.createElement('span');
  showButtonLabel.textContent = 'Show Button';
  showButtonToggle.appendChild(showButtonCheckbox);
  showButtonToggle.appendChild(showButtonLabel);

  const left = document.createElement('div');
  left.appendChild(showButtonToggle);
  left.style.display = 'flex';
  left.style.flexDirection = 'column';
  left.style.gap = '2px';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = m.name || `Model ${index + 1}`;
  nameInput.placeholder = "Model name";
  nameInput.className = 'tooltip-input';
  nameInput.addEventListener('change', (e) => {
    m.name = e.target.value;
    m.object.name = e.target.value;
    nameDisplay.textContent = m.name || `Model ${index + 1}`;
    updateTooltipContent(m.object);
  });

  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.value = m.description || `Description for ${m.name || 'model'}`;
  descInput.placeholder = "Model description";
  descInput.className = 'tooltip-input';
  descInput.addEventListener('change', (e) => {
    m.description = e.target.value;
    updateTooltipContent(m.object);
  });

  const buttonInput = document.createElement('input');
  buttonInput.type = 'text';
  buttonInput.value = m.buttonText || "Select";
  buttonInput.placeholder = "Button text";
  buttonInput.className = 'tooltip-input';
  buttonInput.addEventListener('change', (e) => {
    m.buttonText = e.target.value;
    updateTooltipContent(m.object);
  });
  const idLabel = document.createElement('label');
  idLabel.style.marginTop = '6px';
  idLabel.style.fontSize = '12px';
  idLabel.style.color = 'var(--muted)';
  idLabel.textContent = 'Model ID:';

  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.value = m.id || generateModelId();
  idInput.className = 'tooltip-input';
  idInput.addEventListener('change', (e) => {
    m.id = e.target.value;
    m.object.userData.id = m.id;
  });

  left.appendChild(idLabel);
  left.appendChild(idInput);

  const scriptLabel = document.createElement('label');
  scriptLabel.style.marginTop = '6px';
  scriptLabel.style.fontSize = '12px';
  scriptLabel.style.color = 'var(--muted)';
  scriptLabel.textContent = 'Click Script:';

  const scriptInput = document.createElement('textarea');
  scriptInput.placeholder = 'Enter JavaScript code...';
  scriptInput.value = m.script || '';
  scriptInput.className = 'tooltip-input';
  scriptInput.style.height = '60px';
  scriptInput.style.resize = 'vertical';
  scriptInput.addEventListener('change', (e) => {
    m.script = e.target.value;
    m.object.userData.script = m.script;
  });

  left.appendChild(scriptLabel);
  left.appendChild(scriptInput);

  const nameDisplay = document.createElement('div');
  nameDisplay.className = 'name';
  nameDisplay.textContent = m.name || `Model ${index + 1}`;

  const meta = document.createElement('div');
  meta.style.fontSize = '11px';
  meta.style.color = 'var(--muted)';
  meta.textContent = m.object.type;

  if (m.sourceFile) {
    const sourceInfo = document.createElement('div');
    sourceInfo.style.fontSize = '10px';
    sourceInfo.style.color = 'var(--accent)';
    sourceInfo.textContent = `From: ${m.sourceFile}`;
    meta.appendChild(sourceInfo);
  }

  left.appendChild(nameDisplay);
  left.appendChild(meta);
  left.appendChild(nameInput);
  left.appendChild(descInput);

  const triggerLabel = document.createElement('label');
  triggerLabel.style.marginTop = '6px';
  triggerLabel.style.fontSize = '12px';
  triggerLabel.style.color = 'var(--muted)';
  triggerLabel.textContent = 'Tooltip Trigger:';

  const triggerSelect = document.createElement('select');
  triggerSelect.className = 'tooltip-input';
  const optHover = document.createElement('option');
  optHover.value = 'onhover';
  optHover.textContent = 'onhover';
  const optClick = document.createElement('option');
  optClick.value = 'onclick';
  optClick.textContent = 'onclick';
  const optAlways = document.createElement('option');
  optAlways.value = 'always';
  optAlways.textContent = 'always';
  triggerSelect.appendChild(optHover);
  triggerSelect.appendChild(optClick);
  triggerSelect.appendChild(optAlways);

  triggerSelect.value = m.tooltipTrigger || 'onclick';
  triggerSelect.addEventListener('change', (e) => {
    m.tooltipTrigger = e.target.value;

    const wrapper = tooltips.get(m.object);
    if (wrapper) {
      wrapper.trigger = m.tooltipTrigger;

      if (wrapper.trigger === 'always') {
        wrapper.visible = true;
        wrapper.el.style.display = 'block';
        const anchor = new THREE.Vector3();
        m.object.getWorldPosition(anchor);
        updateTooltipPosition(wrapper.el, anchor);
      } else {
        wrapper.el.style.display = 'none';
        wrapper.visible = false;
      }
    }
  });

  triggerLabel.style.display = (m.showTooltip !== false) ? 'block' : 'none';
  triggerSelect.style.display = (m.showTooltip !== false) ? 'block' : 'none';
  left.appendChild(triggerLabel);
  left.appendChild(triggerSelect);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const tooltipToggle = document.createElement('div');
  tooltipToggle.className = 'tooltip-toggle';
  const toggleCheckbox = document.createElement('input');
  toggleCheckbox.type = 'checkbox';
  toggleCheckbox.checked = m.showTooltip !== false;
  toggleCheckbox.addEventListener('change', (e) => {
    m.showTooltip = e.target.checked;

    triggerLabel.style.display = e.target.checked ? 'block' : 'none';
    triggerSelect.style.display = e.target.checked ? 'block' : 'none';
    updateTooltipVisibility(m.object, m.showTooltip !== false);
    if (m.showTooltip && !tooltips.has(m.object)) {
      const wrapper = createTooltipForModel(m.object);
      wrapper.trigger = m.tooltipTrigger || 'onclick';
      tooltips.set(m.object, wrapper);
      if (wrapper.trigger === 'always') {
        wrapper.visible = true;
        wrapper.el.style.display = 'block';
        const anchor = new THREE.Vector3();
        m.object.getWorldPosition(anchor);
        updateTooltipPosition(wrapper.el, anchor);
      }
    }
  });
  const toggleLabel = document.createElement('span');
  toggleLabel.textContent = 'Tooltip';
  tooltipToggle.appendChild(toggleCheckbox);
  tooltipToggle.appendChild(toggleLabel);

  const selectBtn = document.createElement('button');
  selectBtn.className = 'small-btn';
  selectBtn.textContent = 'Select';
  selectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectModel(m.object);
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'small-btn danger';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      viewer.threeScene.remove(m.object);
      removeTooltip(m.object);
      if (selectedModel === m.object && transformGizmo) {
        transformGizmo.visible = false;
        selectedModel = null;
      }

      if (m.groupId) {
        const group = groups.find(g => g.id === m.groupId);
        if (group) {
          const objIndex = group.objects.indexOf(m.object);
          if (objIndex >= 0) {
            group.objects.splice(objIndex, 1);
          }
          if (group.objects.length === 0) {
            const groupIndex = groups.indexOf(group);
            if (groupIndex >= 0) {
              groups.splice(groupIndex, 1);
              if (selectedGroup === group) {
                selectedGroup = null;
              }
            }
          }
        }
      }
    } catch (err) { }
    const idx = models.indexOf(m);
    if (idx >= 0) models.splice(idx, 1);
    refreshSidebarList();
    refreshGroupList();
    if (selectedModel === m.object) {
      selectedModel = null;
      updateSelectedInfo();
      if (gui) { gui.destroy(); gui = null; }
    }
  });

  actions.appendChild(tooltipToggle);
  actions.appendChild(selectBtn);
  actions.appendChild(removeBtn);

  item.appendChild(left);
  item.appendChild(actions);

  item.addEventListener('click', () => selectModel(m.object));

  return item;
}

function refreshSidebarList() {
  const list = document.getElementById('modelsList');
  list.innerHTML = '';
  models.forEach((m, i) => {
    list.appendChild(createModelItem(m, i));
  });
}

function selectModel(obj) {
  selectedModel = obj;
  selectedGroup = null;

  updateSelectedInfo();

  if (transformGizmo) {
    transformGizmo.visible = true;
    transformGizmo.position.copy(obj.position);
  }

  if (gui) {
    try {
      gui.destroy();
    } catch (e) { }
    gui = null;
  }

  gui = createGUI(obj);
}

function updateSelectedInfo() {
  const sel = document.getElementById('selectedInfo');
  if (selectedModel) {
    sel.innerHTML = `
      <div style="font-weight:600">${selectedModel.name || selectedModel.type}</div>
      <div style="font-size:12px; color:var(--muted); margin-top:6px;">
        Pos: ${selectedModel.position.x.toFixed(2)}, ${selectedModel.position.y.toFixed(2)}, ${selectedModel.position.z.toFixed(2)}
      </div>
      <div style="font-size:10px; color:var(--accent); margin-top:4px;">
        Individual Object
      </div>
    `;
  } else if (selectedGroup) {
    const center = calculateGroupCenter(selectedGroup);
    sel.innerHTML = `
      <div style="font-weight:600">${selectedGroup.name}</div>
      <div style="font-size:12px; color:var(--muted); margin-top:6px;">
        Center: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}
      </div>
      <div style="font-size:10px; color:var(--accent); margin-top:4px;">
        Group (${selectedGroup.objects.length} objects)
      </div>
    `;
  } else {
    sel.textContent = 'None';
  }
}

function createTooltipForModel(model) {
  const modelData = models.find(m => m.object === model);
  const tooltip = document.createElement('div');
  tooltip.className = 'hp-tooltip';

  const name = modelData?.name || model.name || model.type;
  const description = modelData?.description || `Description for ${name}`;
  const buttonText = modelData?.buttonText || "Select";
  const showButton = modelData?.showTooltipButton !== false;

  tooltip.innerHTML = `<h4>${name}</h4><p>${description}</p>${showButton ? `<button>${buttonText}</button>` : ''}`;

  tooltip.style.pointerEvents = showButton ? 'auto' : 'none';

  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  if (showButton) {
    const button = tooltip.querySelector('button');
    if (button) {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (modelData && modelData.script && modelData.script.trim() !== "") {
          try {
            new Function(modelData.script).call(modelData.object);
          } catch (err) {
            console.error("Script error for model:", modelData.id, err);
          }
        }
        selectModel(model);
      });
    }
  }

  return {
    el: tooltip,
    trigger: modelData?.tooltipTrigger || 'onclick',
    visible: modelData?.tooltipTrigger === 'always' ? true : false
  };
}

function removeTooltip(model) {
  if (tooltips.has(model)) {
    const wrapper = tooltips.get(model);
    try {
      document.body.removeChild(wrapper.el);
    } catch (e) { }
    tooltips.delete(model);
  }
}

function updateTooltipVisibility(model, enabled) {
  const wrapper = tooltips.get(model);
  if (!wrapper) return;
  if (!enabled) {
    wrapper.el.style.display = 'none';
    wrapper.visible = false;
  } else {
    wrapper.el.style.display = 'none';
    wrapper.visible = false;
  }
}

function updateTooltipPosition(tooltip, worldPos) {
  try {
    const cam = viewer.camera;
    tmpProj.copy(worldPos).project(cam);
    const x = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
    tooltip.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
  } catch (e) { }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  mixers.forEach(m => m.update(delta));
  clampCamera(viewer.camera);
  if (skybox && viewer.camera) {
    skybox.position.copy(viewer.camera.position);
  }
  if (((selectedModel || selectedGroup) && transformGizmo && transformGizmo.visible && !isDragging)) {
    if (selectedModel) {
      transformGizmo.position.copy(selectedModel.position);
    } else if (selectedGroup) {
      transformGizmo.position.copy(calculateGroupCenter(selectedGroup));
    }
  }

  models.forEach(m => {
    try {
      const anchor = new THREE.Vector3();
      m.object.getWorldPosition(anchor);

      if (m.showTooltip !== false && !tooltips.has(m.object)) {
        const wrapper = createTooltipForModel(m.object);
        wrapper.trigger = m.tooltipTrigger || 'onclick';
        tooltips.set(m.object, wrapper);
        if (wrapper.trigger === 'always') {
          wrapper.visible = true;
          wrapper.el.style.display = 'block';
          updateTooltipPosition(wrapper.el, anchor);
        }
      }

      if (m.showTooltip === false && tooltips.has(m.object)) {
        const wrapper = tooltips.get(m.object);
        wrapper.el.style.display = 'none';
        wrapper.visible = false;
      }

      if (tooltips.has(m.object)) {
        const wrapper = tooltips.get(m.object);
        wrapper.trigger = m.tooltipTrigger || wrapper.trigger;
        if (wrapper.trigger === 'always') {
          wrapper.visible = true;
          wrapper.el.style.display = 'block';
          updateTooltipPosition(wrapper.el, anchor);
        } else if (wrapper.visible) {
          updateTooltipPosition(wrapper.el, anchor);
        }
      }
    } catch (e) { }
  });
}

document.getElementById('addSelectableBtn').addEventListener('click', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.name = 'SelectableCube_' + (models.length + 1);
  cube.position.set(0, 0.5, 0);

  viewer.threeScene.add(cube);
  models.push({ id: generateModelId(), name: cube.name, object: cube, showTooltip: true, tooltipTrigger: 'onclick', showTooltipButton: true });
  refreshSidebarList();
  selectModel(cube);
});

document.getElementById('glbFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loader.load(url, (gltf) => {
    const scene = gltf.scene;

    const extractAllMeshes = (object, matrix = new THREE.Matrix4()) => {
      const meshes = [];
      const currentMatrix = matrix.clone().multiply(object.matrix);

      if (object.isMesh) {
        const clone = object.clone();
        const originalMatrix = currentMatrix.clone();
        clone.applyMatrix4(currentMatrix);
        clone.position.set(0, 0, 0);
        clone.rotation.set(0, 0, 0);
        clone.scale.set(1, 1, 1);
        clone.updateMatrix();
        clone.updateMatrixWorld();

        meshes.push({
          object: clone,
          originalName: object.name,
          originalMatrix: originalMatrix.toArray(),
          originalMaterial: object.material ? {
            color: object.material.color ? object.material.color.getHexString() : null,
            wireframe: object.material.wireframe || false,
            transparent: object.material.transparent || false,
            opacity: object.material.opacity || 1.0
          } : null
        });
      }

      if (object.children && object.children.length > 0) {
        object.children.forEach(child => {
          meshes.push(...extractAllMeshes(child, currentMatrix));
        });
      }

      return meshes;
    };
    const allMeshes = extractAllMeshes(scene);

    if (allMeshes.length === 0) {
      console.warn('No meshes found in the GLB file');
      return;
    }
    const group = createGroupFromFile(file.name, allMeshes);
    allMeshes.forEach((meshData, index) => {
      const mesh = meshData.object;
      mesh.name = meshData.originalName || `${file.name.replace('.glb', '')}_part_${index + 1}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.groupId = group.id;
      mesh.userData.isPartOfGroup = true;

      viewer.threeScene.add(mesh);
      models.push({
        id: generateModelId(),
        name: mesh.name,
        object: mesh,
        showTooltip: true,
        tooltipTrigger: 'onclick',
        sourceFile: file.name,
        groupId: group.id,
        isGLBPart: true,
        originalMatrix: meshData.originalMatrix,
        originalMaterial: meshData.originalMaterial,
        showTooltipButton: true
      });
    });

    refreshSidebarList();
    refreshGroupList();

    selectGroup(group);

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, undefined, (err) => {
    console.error('GLB load error', err);
    alert('Failed to load GLB');
  });

  e.target.value = '';
});

document.getElementById('exportBtnSidebar').addEventListener('click', () => {
  exportScene(skyboxTextureUrl, loadedChunkScenes, models, groups);
});

document.getElementById('centerCameraBtn').addEventListener('click', () => {
  if (!viewer.threeCamera) return;
  viewer.threeCamera.position.set(2, 2, 6);
  viewer.threeCamera.lookAt(new THREE.Vector3(0, 0, 0));
});

document.getElementById('resetSceneBtn').addEventListener('click', () => {
  models.forEach(m => {
    try {
      viewer.threeScene.remove(m.object);
      removeTooltip(m.object);
    } catch (e) { }
  });
  models.length = 0;
  groups.length = 0;
  selectedModel = null;
  selectedGroup = null;

  if (transformGizmo) {
    transformGizmo.visible = false;
  }

  updateSelectedInfo();
  refreshSidebarList();
  refreshGroupList();
  if (gui) { try { gui.destroy(); } catch (e) { } gui = null; }

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
  box.name = 'Box';
  viewer.threeScene.add(box);
  models.push({ id: generateModelId(), name: 'Box', object: box, showTooltip: true, showTooltipButton: true });
  refreshSidebarList();
});

document.addEventListener('DOMContentLoaded', () => {
  // generateChunkUrls(5);
    generateChunkUrlsFromManifest(`${BASE_CHUNK_URL}manifest.json`);
  document.getElementById('loadChunksStatus').textContent = `Auto-generated 125 chunk URLs (5x5x5 grid). Loading...`;
  setTimeout(() => {
    loadChunksWithRetry();
  }, 1000);
});

if (document.readyState === 'loading') {
} else {
  // generateChunkUrls(5);
    generateChunkUrlsFromManifest(`${BASE_CHUNK_URL}manifest.json`);
  if (document.getElementById('loadChunksStatus')) {
    document.getElementById('loadChunksStatus').textContent = `Auto-generated 125 chunk URLs (5x5x5 grid). Loading...`;
  }
  setTimeout(() => {
    loadChunksWithRetry();
  }, 1000);
}

function findModelEntryForObject(obj) {
  let o = obj;
  while (o) {
    const m = models.find(m => m.object === o);
    if (m) return m;
    o = o.parent;
  }
  return null;
}

function findTooltipWrapperForObject(obj) {
  let o = obj;
  while (o) {
    if (tooltips.has(o)) return tooltips.get(o);
    o = o.parent;
  }
  return null;
}
function hideAllOnclickTooltips() {
  tooltips.forEach((wrapper, model) => {
    if (wrapper.trigger === 'onclick' && wrapper.visible) {
      wrapper.visible = false;
      wrapper.el.style.display = 'none';
    }
  });
}

function onMouseUp(event) {
  if (isDragging) {
    isDragging = false;
    selectedAxis = null;
    if (viewer.controls) viewer.controls.enabled = true;
  }
}
function initializeScene() {



  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.hp-tooltip')) {
      return;
    }

    if (e.target.closest('.sidebar-section') || e.target.closest('.model-item')) {
      return;
    }

    if (e.target.closest('canvas')) {
      setTimeout(() => {
        hideAllOnclickTooltips();
      }, 10);
      return;
    }

    hideAllOnclickTooltips();
  });

  animate();
}