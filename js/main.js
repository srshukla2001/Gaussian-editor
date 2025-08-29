import * as GaussianSplats3D from '../lib/gaussian-splats-3d.module.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import GUI from 'lil-gui';
import { exportScene } from './export.js';
import { createGUI } from './gui.js';
import { createTransformGizmo } from './gizmo.js';
import { styleTag } from './styles.js'
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
  sphericalHarmonicsDegree: 2,
  useFrustumCulling: true,
  frustumCullingDebug: false,
  frustumCullingMargin: 0.5,
  halfPrecisionCovariancesOnGPU: true,
  sortEnable: true,
  showLoadingUI: false
});
if (window.CameraAPI) {
  window.CameraAPI.init(viewer);
} else {
  console.warn('CameraAPI not loaded yet');
}
const splatPath = 'https://virtual-homes.s3.ap-south-1.amazonaws.com/SignatureGlobal/TwinTowerDXP/converted_file_spz.ksplat';
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);
const models = [];
const groups = [];
const mixers = [];
const meshes = [];
const tooltips = new Map();
let selectedModel = null;
let selectedGroup = null;
let gui = null;

window.models = models;
window.tooltips = tooltips;
window.viewer = viewer;
let transformGizmo = null;
let isDragging = false;
let dragStartPoint = new THREE.Vector3();
let selectedAxis = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let lastHoveredModel = null;

document.head.appendChild(styleTag);
document.body.appendChild(sidebar);

const tooltip = document.createElement('div');
tooltip.className = 'hp-tooltip';
tooltip.innerHTML = `<h4 id="tipTitle">Title</h4><p id="tipDesc">desc</p><button id="tipBtn">Action</button>`;
document.body.appendChild(tooltip);




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

  tooltip.innerHTML = `<h4>${name}</h4><p>${description}</p><button>${buttonText}</button>`;


  tooltip.querySelector('button').addEventListener('click', () => {
    selectModel(model);
  });
}

function createModelItem(m, index) {
  const item = document.createElement('div');
  item.className = 'model-item';
  item.dataset.index = index;

  const left = document.createElement('div');
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
  left.appendChild(buttonInput);

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

    // FIX: Actually hide/show the tooltip immediately
    if (e.target.checked) {
      // Show tooltip if it should be visible based on trigger
      if (m.tooltipTrigger === 'always') {
        const wrapper = tooltips.get(m.object);
        if (wrapper) {
          wrapper.visible = true;
          wrapper.el.style.display = 'block';
          const anchor = new THREE.Vector3();
          m.object.getWorldPosition(anchor);
          updateTooltipPosition(wrapper.el, anchor);
        }
      }
    } else {
      // Hide tooltip immediately
      const wrapper = tooltips.get(m.object);
      if (wrapper) {
        wrapper.visible = false;
        wrapper.el.style.display = 'none';
      }
    }

    // Update tooltip visibility in the animation loop
    updateTooltipVisibility(m.object, m.showTooltip !== false);

    // Create or remove tooltip based on checkbox state
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
    } else if (!m.showTooltip && tooltips.has(m.object)) {
      // Remove tooltip if checkbox is unchecked
      removeTooltip(m.object);
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
    selectGroup(group);

    if (transformGizmo) {
      transformGizmo.visible = true;
      transformGizmo.position.copy(calculateGroupCenter(group));
    }
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

          // Remove group if empty
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

  tooltip.innerHTML = `<h4>${name}</h4><p>${description}</p><button>${buttonText}</button>`;

  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  tooltip.querySelector('button').addEventListener('click', () => {
    selectModel(model);
  });

  return {
    el: tooltip,
    trigger: modelData?.tooltipTrigger || 'onclick',
    visible: modelData?.tooltipTrigger === 'always' ? true : false,
    manualControl: false,
    manualHidden: false,
    apiOverride: false,    // Add this line
    apiHidden: false       // Add this line
  };
}


function removeTooltip(model) {
  if (tooltips.has(model)) {
    const wrapper = tooltips.get(model);
    try {
      if (wrapper.el && wrapper.el.parentNode) {
        wrapper.el.parentNode.removeChild(wrapper.el);
      }
    } catch (e) {
      console.error('Error removing tooltip element:', e);
    }
    tooltips.delete(model);
  }
}

function updateTooltipVisibility(model, enabled) {
  const wrapper = tooltips.get(model);
  if (!wrapper) return;

  if (!enabled) {
    // Hide immediately and prevent animation loop from showing it
    wrapper.visible = false;
    wrapper.el.style.display = 'none';
  } else {
    // Show based on trigger setting
    if (wrapper.trigger === 'always') {
      wrapper.visible = true;
      wrapper.el.style.display = 'block';
      const anchor = new THREE.Vector3();
      model.getWorldPosition(anchor);
      updateTooltipPosition(wrapper.el, anchor);
    } else {
      // For hover/click triggers, let the animation loop handle visibility
      wrapper.visible = false;
      wrapper.el.style.display = 'none';
    }
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

  if (((selectedModel || selectedGroup) && transformGizmo && transformGizmo.visible && !isDragging)) {
    if (selectedModel) {
      transformGizmo.position.copy(selectedModel.position);
    } else if (selectedGroup) {
      transformGizmo.position.copy(calculateGroupCenter(selectedGroup));
    }
  }

  models.forEach(m => {
    try {
      // Skip if tooltips are disabled for this model
      if (m.showTooltip === false) {
        const wrapper = tooltips.get(m.object);
        if (wrapper) {
          wrapper.visible = false;
          wrapper.el.style.display = 'none';
        }
        return; // Skip further processing for this model
      }

      const anchor = new THREE.Vector3();
      m.object.getWorldPosition(anchor);

      if (!tooltips.has(m.object)) {
        const wrapper = createTooltipForModel(m.object);
        wrapper.trigger = m.tooltipTrigger || 'onclick';
        tooltips.set(m.object, wrapper);
        if (wrapper.trigger === 'always') {
          wrapper.visible = true;
          wrapper.el.style.display = 'block';
          updateTooltipPosition(wrapper.el, anchor);
        }
      }

      if (tooltips.has(m.object)) {
        const wrapper = tooltips.get(m.object);
        wrapper.trigger = m.tooltipTrigger || wrapper.trigger;

        // Only handle tooltips that are enabled
        if (wrapper.trigger === 'always') {
          wrapper.visible = true;
          wrapper.el.style.display = 'block';
          updateTooltipPosition(wrapper.el, anchor);
        } else if (wrapper.visible) {
          updateTooltipPosition(wrapper.el, anchor);
        }
      }
    } catch (e) {
      console.error('Error in tooltip animation:', e);
    }
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
  models.push({ name: cube.name, object: cube, showTooltip: true, tooltipTrigger: 'onclick' });
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
        name: mesh.name,
        object: mesh,
        showTooltip: true,
        tooltipTrigger: 'onclick',
        sourceFile: file.name,
        groupId: group.id,
        isGLBPart: true,
        originalMatrix: meshData.originalMatrix,
        originalMaterial: meshData.originalMaterial
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
  exportScene(splatPath, models, groups);
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
  models.push({ name: 'Box', object: box, showTooltip: true });
  refreshSidebarList();
});
viewer.addSplatScene(splatPath, { progressiveLoad: false, useFrustumCulling: true }).then(() => {
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

}).catch(err => {
  console.error('Failed to load splat scene', err);
  alert('Failed to load splat scene. Check console for details.');
});
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


document.addEventListener('mousedown', (e) => {

  if (e.target.closest('.hp-tooltip') || e.target.closest('.sidebar-section') || e.target.closest('.model-item')) return;
  if (e.target.closest('canvas')) {
    setTimeout(() => {
      hideAllOnclickTooltips();
    }, 10);
    return;
  }
  hideAllOnclickTooltips();
});
