import * as GaussianSplats3D from '../lib/gaussian-splats-3d.module.js';
import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '/lib/GLTFLoader.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';
import { exportScene } from './export.js';
import { createGUI } from './gui.js';

const viewer = new GaussianSplats3D.Viewer({
  cameraUp: [0, -1, 0],
  initialCameraPosition: [1.54163, 2.68515, -6.37228],
  initialCameraLookAt: [0.45622, 1.95338, 1.51278],
  sphericalHarmonicsDegree: 2
});

const splatPath = 'https://virtual-homes.s3.ap-south-1.amazonaws.com/SignatureGlobal/TwinTowerDXP/gs_gssplat.ply';
const loader = new GLTFLoader();
const models = [];
const mixers = [];
let selectedModel = null;
let gui = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const styleTag = document.createElement('style');
styleTag.innerHTML = `
  :root {
    --sidebar-w: 260px;
    --bg: #111214;
    --panel: #15161a;
    --muted: #9aa0a6;
    --accent: #7bd389;
    --glass: rgba(255,255,255,0.03);
  }
  body { margin: 0; font-family: Inter, Roboto, system-ui, -apple-system; background: #000; }
  .hp-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--sidebar-w);
    height: 100%;
    background: linear-gradient(180deg, var(--panel), #0f1113);
    color: #e6eef4;
    box-shadow: 2px 0 18px rgba(0,0,0,0.7);
    padding: 14px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 30;
  }
  .hp-header { display:flex; align-items:center; gap:10px; }
  .hp-title { font-weight:600; font-size:16px; }
  .hp-sub { color: var(--muted); font-size:12px; }
  .hp-controls { display:flex; gap:8px; }
  .hp-btn {
    background: var(--glass);
    border: 1px solid rgba(255,255,255,0.04);
    color: inherit;
    padding:8px 10px;
    border-radius:8px;
    cursor:pointer;
    font-size:13px;
  }
  .hp-btn.primary { background: linear-gradient(90deg,var(--accent), #6dd3b2); color: #05120b; font-weight:600; }
  .hp-section { background: rgba(255,255,255,0.02); border-radius:10px; padding:10px; }
  .hp-list { max-height: 320px; overflow:auto; display:flex; flex-direction:column; gap:8px; margin-top:8px; }
  .model-item {
    display:flex; align-items:center; justify-content:space-between;
    gap:8px; padding:8px; border-radius:8px; cursor:pointer;
    background: transparent;
  }
  .model-item:hover { background: rgba(255,255,255,0.02); }
  .model-item .name { font-size:13px; color:#e6eef4; }
  .model-item .actions { display:flex; gap:6px; }
  .small-btn { padding:6px 8px; border-radius:7px; font-size:12px; border: none; cursor:pointer; background: rgba(255,255,255,0.02); color: var(--muted); }
  .small-btn.danger { color: #ff8b8b; }
  .hp-footer { margin-top:auto; display:flex; gap:8px; }
  .file-input { display:none; }
  .hp-tooltip {
    position: absolute;
    pointer-events: auto;
    background: rgba(10,11,12,0.9);
    color: #fff;
    padding: 10px 12px;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
    transform: translate(-50%, -100%);
    z-index: 60;
    display: none;
    min-width: 180px;
  }
  .hp-tooltip h4 { margin:0 0 6px 0; font-size:13px; }
  .hp-tooltip p { margin:0 0 8px 0; font-size:12px; color:var(--muted); }
  .hp-tooltip button { border-radius:6px; padding:6px 8px; border: none; cursor:pointer; background: var(--accent); color:#052018; font-weight:600; }
`;
document.head.appendChild(styleTag);

const sidebar = document.createElement('aside');
sidebar.className = 'hp-sidebar';
sidebar.innerHTML = `
  <div class="hp-header">
    <div>
      <div class="hp-title">Gaussian 3D Editor</div>
      <div class="hp-sub">Scene editor • Bonsai</div>
    </div>
  </div>

  <div class="hp-section">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-weight:600">Scene</div>
      <div class="hp-controls">
        <button id="addSelectableBtn" class="hp-btn">Add Cube</button>
        <button id="exportBtnSidebar" class="hp-btn primary">Export</button>
      </div>
    </div>
    <div style="margin-top:8px; font-size:12px; color:var(--muted);">
      Click objects to select. Dragging is available via gizmo (if added).
    </div>
  </div>

  <div class="hp-section" id="modelsSection">
    <div style="font-weight:600">Models</div>
    <div class="hp-list" id="modelsList"></div>
  </div>

  <div class="hp-section">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-weight:600">Import</div>
      <label class="hp-btn" style="margin-left:8px;">
        <input id="glbFileInput" class="file-input" type="file" accept=".glb" />
        Load GLB
      </label>
    </div>
    <div style="margin-top:8px; font-size:12px; color:var(--muted);">Supported: .glb</div>
  </div>

  <div class="hp-section">
    <div style="font-weight:600">Selected</div>
    <div id="selectedInfo" style="margin-top:8px; font-size:13px; color:var(--muted)">None</div>
  </div>

  <div class="hp-footer">
    <button id="centerCameraBtn" class="hp-btn">Center Camera</button>
    <button id="resetSceneBtn" class="hp-btn">Reset</button>
  </div>
`;
document.body.appendChild(sidebar);

const tooltip = document.createElement('div');
tooltip.className = 'hp-tooltip';
tooltip.innerHTML = `<h4 id="tipTitle">Title</h4><p id="tipDesc">desc</p><button id="tipBtn">Action</button>`;
document.body.appendChild(tooltip);

function createModelItem(m, index) {
  const item = document.createElement('div');
  item.className = 'model-item';
  item.dataset.index = index;

  const left = document.createElement('div');
  left.style.display = 'flex';
  left.style.flexDirection = 'column';
  left.style.gap = '2px';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = m.name || `Model ${index + 1}`;
  const meta = document.createElement('div');
  meta.style.fontSize = '11px';
  meta.style.color = 'var(--muted)';
  meta.textContent = m.object.type;
  left.appendChild(name);
  left.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'actions';
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
    } catch (err) { }
    const idx = models.indexOf(m);
    if (idx >= 0) models.splice(idx, 1);
    refreshSidebarList();
    if (selectedModel === m.object) {
      selectedModel = null;
      updateSelectedInfo();
      if (gui) { gui.destroy(); gui = null; }
    }
  });

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
  updateSelectedInfo();

  models.forEach(m => {
    if (m.object === obj) {
      if (gui) { try { gui.destroy(); } catch (e) { } }
      gui = createGUI(obj);
    }
  });
}

function updateSelectedInfo() {
  const sel = document.getElementById('selectedInfo');
  if (!selectedModel) {
    sel.textContent = 'None';
    return;
  }
  sel.innerHTML = `
    <div style="font-weight:600">${selectedModel.name || selectedModel.type}</div>
    <div style="font-size:12px; color:var(--muted); margin-top:6px;">
      Pos: ${selectedModel.position.x.toFixed(2)}, ${selectedModel.position.y.toFixed(2)}, ${selectedModel.position.z.toFixed(2)}
    </div>
  `;
}

function handlePointerClick(event) {
  if (!viewer || !viewer.threeCamera) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, viewer.threeCamera);

  const objects = [];
  models.forEach(m => {
    if (m.object) {
      if (m.object.isGroup || m.object.type === 'Group') {
        m.object.traverse(c => { if (c.isMesh) objects.push(c); });
      } else {
        objects.push(m.object);
      }
    }
  });

  const intersects = raycaster.intersectObjects(objects, true);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    let top = null;
    for (const m of models) {
      if (m.object === hit || m.object.uuid === hit.uuid) { top = m.object; break; }
      if (m.object.traverse) {
        let found = false;
        m.object.traverse(c => { if (c.uuid === hit.uuid) found = true; });
        if (found) { top = m.object; break; }
      }
    }
    if (!top) top = hit;

    if (hit.material?.wireframe) {
      try {
        const oldColor = hit.material.color ? hit.material.color.getHex() : 0x00ff00;
        hit.material = new THREE.MeshStandardMaterial({
          color: oldColor,
          transparent: true,
          opacity: 0.3,
          wireframe: false
        });
      } catch (e) { }
    }

    tooltip.style.display = 'block';
    tooltip.querySelector('#tipTitle').innerText = top.name || top.type;
    tooltip.querySelector('#tipDesc').innerText = 'Selectable object';
    tooltip.querySelector('#tipBtn').onclick = () => {
      alert('Button clicked on ' + (top.name || top.type));
    };

    selectedModel = top;
    updateSelectedInfo();
    if (gui) { try { gui.destroy(); } catch (e) { } }
    gui = createGUI(selectedModel);
  } else {
    tooltip.style.display = 'none';
  }
}

window.removeEventListener('click', handlePointerClick);
window.addEventListener('click', handlePointerClick);

if (viewer && viewer.threeScene) {
  const clock = new THREE.Clock();

  viewer.threeScene.onBeforeRender = () => {
    const delta = clock.getDelta();
    mixers.forEach(m => m.update(delta));

    if (selectedModel && viewer.threeCamera) {
      const pos = (selectedModel.position?.clone ? selectedModel.position.clone() : new THREE.Vector3());
      pos.project(viewer.threeCamera);
      const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
      tooltip.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
    }
  };
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
  models.push({ name: cube.name, object: cube });
  refreshSidebarList();
  selectModel(cube);
});

document.getElementById('glbFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loader.load(url, (gltf) => {
    const obj = gltf.scene;
    obj.name = file.name;

    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    
    obj.traverse(c => {
      if (c.isMesh) {
        c.castShadow = c.receiveShadow = true;
      }
    });

    viewer.threeScene.add(obj);
    models.push({ name: file.name, object: obj });
    refreshSidebarList();
    selectModel(obj);

    if (gltf.animations && gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(obj);
      gltf.animations.forEach(clip => {
        mixer.clipAction(clip).play();
      });
      mixers.push(mixer);
    }

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, undefined, (err) => {
    console.error('GLB load error', err);
    alert('Failed to load GLB');
  });

  e.target.value = '';
});

document.getElementById('exportBtnSidebar').addEventListener('click', () => {
  exportScene(splatPath, models);
});

document.getElementById('centerCameraBtn').addEventListener('click', () => {
  if (!viewer.threeCamera) return;
  viewer.threeCamera.position.set(2, 2, 6);
  viewer.threeCamera.lookAt(new THREE.Vector3(0, 0, 0));
});

document.getElementById('resetSceneBtn').addEventListener('click', () => {
  models.forEach(m => {
    try { viewer.threeScene.remove(m.object); } catch (e) { }
  });
  models.length = 0;
  selectedModel = null;
  updateSelectedInfo();
  refreshSidebarList();
  if (gui) { try { gui.destroy(); } catch (e) { } gui = null; }
  
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
  box.name = 'Box';
  viewer.threeScene.add(box);
  models.push({ name: 'Box', object: box });
  refreshSidebarList();
});

viewer.addSplatScene(splatPath, { progressiveLoad: true }).then(() => {
  viewer.start();
  const scene = viewer.threeScene;
  const camera = viewer.threeCamera;

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
  models.push({ name: 'Box', object: box });

  gui = createGUI(box);
  selectedModel = box;
  updateSelectedInfo();
  refreshSidebarList();

  window.addEventListener('resize', () => {
    if (selectedModel && viewer.threeCamera) {
      const pos = (selectedModel.position?.clone ? selectedModel.position.clone() : new THREE.Vector3());
      pos.project(viewer.threeCamera);
      const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
      tooltip.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
    }
  });

}).catch(err => {
  console.error('Failed to load splat scene', err);
  alert('Failed to load splat scene. Check console for details.');
});