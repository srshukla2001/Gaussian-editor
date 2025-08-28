import * as GaussianSplats3D from '../lib/gaussian-splats-3d.module.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import GUI from 'lil-gui';
import { exportScene } from './export.js';
import { createGUI } from './gui.js';
import {createTransformGizmo} from './gizmo.js';
import {styleTag} from './styles.js'
import { sidebar } from './sidebar.js';
window.THREE = THREE;

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.fromArray([1.54163, 2.68515, -6.37228]);
camera.up.fromArray([0, -1, 0]);
camera.lookAt(new THREE.Vector3(0.45622, 1.95338, 1.51278));

const renderDim = new THREE.Vector2();
const tmpVec3 = new THREE.Vector3();
const tmpProj = new THREE.Vector3();
let canvasEl = null;
const viewer = new GaussianSplats3D.Viewer({
  camera: camera,
  cameraUp: [0, -1, 0],
  initialCameraPosition: [1.54163, 2.68515, -6.37228],
  initialCameraLookAt: [0.45622, 1.95338, 1.51278],
  sphericalHarmonicsDegree: 2
});

const splatPath = '../assets/data/bonsai/bonsai.ksplat';
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);
const models = [];
const mixers = [];
let selectedModel = null;
let gui = null;

// Transform gizmo variables
let transformGizmo = null;
let isDragging = false;
let dragStartPoint = new THREE.Vector3();
let selectedAxis = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

document.head.appendChild(styleTag);
document.body.appendChild(sidebar);

const tooltip = document.createElement('div');
tooltip.className = 'hp-tooltip';
tooltip.innerHTML = `<h4 id="tipTitle">Title</h4><p id="tipDesc">desc</p><button id="tipBtn">Action</button>`;
document.body.appendChild(tooltip);

const tooltips = new Map();

// Transform Gizmo Functions


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
  if (!selectedModel || !transformGizmo.visible) return;
  
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, viewer.camera);
  
  const intersects = raycaster.intersectObjects(transformGizmo.children, true);
  
  for (const intersect of intersects) {
    if (intersect.object.userData.isHandle) {
      selectedAxis = intersect.object.userData.axis;
      isDragging = true;
      dragStartPoint.copy(intersect.point);
      if (viewer.controls) {
        viewer.controls.enabled = false;
      }
      break;
    }
  }
}

function onMouseMove(event) {
  if (!isDragging || !selectedModel || !selectedAxis) return;
  
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, viewer.camera);
  
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
  raycaster.ray.intersectPlane(plane, intersection);
  
  const delta = new THREE.Vector3().subVectors(intersection, dragStartPoint);
  
  switch (selectedAxis) {
    case 'x': selectedModel.position.x += delta.x; break;
    case 'y': selectedModel.position.y += delta.y; break;
    case 'z': selectedModel.position.z += delta.z; break;
  }
  
  dragStartPoint.copy(intersection);
  transformGizmo.position.copy(selectedModel.position);
  updateSelectedInfo();
}

function onMouseUp() {
  isDragging = false;
  selectedAxis = null;
  if (viewer.controls) {
    viewer.controls.enabled = true;
  }
}

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
  
  const tooltipToggle = document.createElement('div');
  tooltipToggle.className = 'tooltip-toggle';
  const toggleCheckbox = document.createElement('input');
  toggleCheckbox.type = 'checkbox';
  toggleCheckbox.checked = m.showTooltip !== false;
  toggleCheckbox.addEventListener('change', (e) => {
    m.showTooltip = e.target.checked;
    updateTooltipVisibility(m.object, m.showTooltip);
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
  updateSelectedInfo();

  if (transformGizmo) {
    transformGizmo.visible = true;
    transformGizmo.position.copy(obj.position);
  }

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

function createTooltipForModel(model) {
  const tooltip = document.createElement('div');
  tooltip.className = 'hp-tooltip';
  tooltip.innerHTML = `<h4>${model.name || model.type}</h4><p>Selectable object</p><button>Select</button>`;
  tooltip.style.display = 'block';
  document.body.appendChild(tooltip);
  
  tooltip.querySelector('button').addEventListener('click', () => {
    selectModel(model);
  });
  
  return tooltip;
}

function removeTooltip(model) {
  if (tooltips.has(model)) {
    const tooltip = tooltips.get(model);
    try {
      document.body.removeChild(tooltip);
    } catch (e) {}
    tooltips.delete(model);
  }
}

function updateTooltipVisibility(model, visible) {
  if (tooltips.has(model)) {
    const tooltip = tooltips.get(model);
    tooltip.style.display = visible ? 'block' : 'none';
  }
}

function updateTooltipPosition(tooltip, worldPos) {
  try {
    const cam = viewer.camera;
    tmpProj.copy(worldPos).project(cam);
    const x = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
    tooltip.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
  } catch (e) {}
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  mixers.forEach(m => m.update(delta));

  if (selectedModel && transformGizmo && transformGizmo.visible && !isDragging) {
    transformGizmo.position.copy(selectedModel.position);
  }

  models.forEach(m => {
    try {
      const anchor = new THREE.Vector3();
      m.object.getWorldPosition(anchor);
      
      if (!tooltips.has(m.object)) {
        const tooltip = createTooltipForModel(m.object);
        tooltips.set(m.object, tooltip);
        updateTooltipVisibility(m.object, m.showTooltip !== false);
      }
      
      if (m.showTooltip !== false) {
        const tooltip = tooltips.get(m.object);
        updateTooltipPosition(tooltip, anchor);
      }
    } catch (e) {}
  });
}
animate();

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
  models.push({ name: cube.name, object: cube, showTooltip: true });
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
    models.push({ name: file.name, object: obj, showTooltip: true });
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
    try { 
      viewer.threeScene.remove(m.object);
      removeTooltip(m.object);
    } catch (e) { }
  });
  models.length = 0;
  selectedModel = null;
  
  if (transformGizmo) {
    transformGizmo.visible = false;
  }
  
  updateSelectedInfo();
  refreshSidebarList();
  if (gui) { try { gui.destroy(); } catch (e) { } gui = null; }

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
  box.name = 'Box';
  viewer.threeScene.add(box);
  models.push({ name: 'Box', object: box, showTooltip: true });
  refreshSidebarList();
});

viewer.addSplatScene(splatPath, { progressiveLoad: true }).then(() => {
  viewer.start();

  requestAnimationFrame(() => {
    canvasEl = (viewer.renderer && viewer.renderer.domElement) || document.querySelector('canvas');
    if (canvasEl) {
      canvasEl.style.touchAction = 'none';
    }
    setupTransformGizmo();
    animate();
  });
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
  models.push({ name: 'Box', object: box, showTooltip: true });

  gui = createGUI(box);
  selectedModel = box;
  updateSelectedInfo();
  refreshSidebarList();

  window.addEventListener('resize', () => {
    models.forEach(m => {
      try {
        if (tooltips.has(m.object) && m.showTooltip !== false) {
          const anchor = new THREE.Vector3();
          m.object.getWorldPosition(anchor);
          updateTooltipPosition(tooltips.get(m.object), anchor);
        }
      } catch (e) {}
    });
  });

}).catch(err => {
  console.error('Failed to load splat scene', err);
  alert('Failed to load splat scene. Check console for details.');
});
