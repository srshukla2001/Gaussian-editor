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
  // Frustum culling settings
  useFrustumCulling: true,
  frustumCullingDebug: false,
  frustumCullingMargin: 0.5,
  // Additional performance optimizations
  halfPrecisionCovariancesOnGPU: true,
  sortEnable: true,
  showLoadingUI: false
});

const splatPath = 'https://virtual-homes.s3.ap-south-1.amazonaws.com/SignatureGlobal/TwinTowerDXP/gs.spz';
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);
const models = [];
const groups = []; // New array to track groups of objects
const mixers = [];
let selectedModel = null;
let selectedGroup = null; // Track selected group
let gui = null;

// Transform gizmo variables
let transformGizmo = null;
let isDragging = false;
let dragStartPoint = new THREE.Vector3();
let selectedAxis = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let lastHoveredModel = null; // NEW: track last hovered model for hover-triggered tooltips

document.head.appendChild(styleTag);
document.body.appendChild(sidebar);

const tooltip = document.createElement('div');
tooltip.className = 'hp-tooltip';
tooltip.innerHTML = `<h4 id="tipTitle">Title</h4><p id="tipDesc">desc</p><button id="tipBtn">Action</button>`;
document.body.appendChild(tooltip);

const tooltips = new Map();

// Add group section to sidebar
const groupsSection = document.createElement('div');
groupsSection.className = 'sidebar-section';
groupsSection.innerHTML = `
  <div class="section-header">
    <h3>Groups</h3>
  </div>
  <div id="groupsList" class="section-content"></div>
`;
sidebar.insertBefore(groupsSection, sidebar.querySelector('.sidebar-section:nth-child(2)'));

// Group management functions
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

  // Create a dummy object to represent the group for GUI purposes
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
        // Rotate around group center
        const relativePos = new THREE.Vector3().subVectors(obj.position, center);
        relativePos.applyAxisAngle(value.axis, value.angle);
        obj.position.copy(center).add(relativePos);
        obj.rotation[value.axis] += value.angle;
        break;
      case 'scale':
        // Scale from group center
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
  // Check if we're clicking on a transform gizmo handle first
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, viewer.camera);

  // Check for gizmo handle clicks first
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
        return; // Exit early if we hit a gizmo handle
      }
    }
  }

  // If we didn't click on a gizmo handle, check for object/group selection
  const sceneIntersects = raycaster.intersectObjects(viewer.threeScene.children, true);

  // Filter out gizmo objects and splat objects
  const validIntersects = sceneIntersects.filter(intersect =>
    !intersect.object.userData?.isHandle &&
    !intersect.object.isGaussianSplatMesh
  );

  if (validIntersects.length > 0) {
    const clickedObject = validIntersects[0].object;

    // Check if this object belongs to a group
    // walk up to find group info if a child mesh was clicked
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

    // If not part of a group, select the individual object (walk up to find model entry)
    const modelData = findModelEntryForObject(clickedObject);
    if (modelData) {
      // If this model uses 'onclick' trigger, toggle tooltip visibility using wrapper lookup that climbs parents
      if (modelData.showTooltip !== false && modelData.tooltipTrigger === 'onclick') {
        const wrapper = findTooltipWrapperForObject(clickedObject);
        if (wrapper) {
          wrapper.visible = !wrapper.visible;
          wrapper.el.style.display = wrapper.visible ? 'block' : 'none';
          if (wrapper.visible) {
            const anchor = new THREE.Vector3();
            // ensure we position at the model's world position (use stored model object)
            modelData.object.getWorldPosition(anchor);
            updateTooltipPosition(wrapper.el, anchor);
          }
        }
      }

      selectModel(modelData.object);
    }
  } else {
    // Clicked on empty space, deselect everything
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

    // hide any onclick tooltips when user clicks anywhere else
    hideAllOnclickTooltips();
  }
}

function onMouseMove(event) {
  // compute normalized mouse for both dragging logic and hover detection
  const mouseN = new THREE.Vector2();
  mouseN.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseN.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Hover detection (only when not dragging)
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
        // show hovered tooltip - find wrapper by climbing parent chain
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
        // Not a hoverable model -> hide previously hovered tooltip
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

  // If dragging, fallback to original translation logic
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
    // Transform individual object
    switch (selectedAxis) {
      case 'x': selectedModel.position.x += delta.x; break;
      case 'y': selectedModel.position.y += delta.y; break;
      case 'z': selectedModel.position.z += delta.z; break;
    }
    transformGizmo.position.copy(selectedModel.position);
  } else if (selectedGroup) {
    // Transform entire group
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

  // Reattach event listener
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

  // Name input
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

  // Description input
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.value = m.description || `Description for ${m.name || 'model'}`;
  descInput.placeholder = "Model description";
  descInput.className = 'tooltip-input';
  descInput.addEventListener('change', (e) => {
    m.description = e.target.value;
    updateTooltipContent(m.object);
  });

  // Button text input
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

  // Show source file if available
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

  // Tooltip trigger dropdown (hidden unless tooltip enabled)
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
  // default to 'onclick' if not specified
  triggerSelect.value = m.tooltipTrigger || 'onclick';
  triggerSelect.addEventListener('change', (e) => {
    m.tooltipTrigger = e.target.value;
    // If tooltip exists, update stored trigger
    const wrapper = tooltips.get(m.object);
    if (wrapper) {
      wrapper.trigger = m.tooltipTrigger;
      // if changed to always, show immediately; else hide and let handlers control
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
  // Initially show/hide trigger selector based on checkbox state
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
    // Show or hide the dropdown based on checkbox
    triggerLabel.style.display = e.target.checked ? 'block' : 'none';
    triggerSelect.style.display = e.target.checked ? 'block' : 'none';
    updateTooltipVisibility(m.object, m.showTooltip !== false);
    // If enabling, create wrapper right away in case trigger is 'always'
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
    selectGroup(group);

    // Also update the transform gizmo position
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

      // Remove from group if it belongs to one
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

// ...existing code inside createTooltipForModel ...
function createTooltipForModel(model) {
  const modelData = models.find(m => m.object === model);
  const tooltip = document.createElement('div');
  tooltip.className = 'hp-tooltip';

  const name = modelData?.name || model.name || model.type;
  const description = modelData?.description || `Description for ${name}`;
  const buttonText = modelData?.buttonText || "Select";

  tooltip.innerHTML = `<h4>${name}</h4><p>${description}</p><button>${buttonText}</button>`;
  // Do not show by default; visibility will be controlled by trigger behavior
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  tooltip.querySelector('button').addEventListener('click', () => {
    selectModel(model);
  });

  return {
    el: tooltip,
    trigger: modelData?.tooltipTrigger || 'onclick', // default to 'onclick'
    visible: modelData?.tooltipTrigger === 'always' ? true : false
  };
}
// ...existing code...

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
  // enabled: whether the tooltip feature should be active for this model
  const wrapper = tooltips.get(model);
  if (!wrapper) return;
  if (!enabled) {
    // disable tooltip feature and hide any visible tooltip
    wrapper.el.style.display = 'none';
    wrapper.visible = false;
  } else {
    // enabling tooltip feature - leave hidden until trigger fires
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

      // Create tooltip wrapper if tooltip feature is enabled for this model
      if (m.showTooltip !== false && !tooltips.has(m.object)) {
        const wrapper = createTooltipForModel(m.object);
        // ensure wrapper.trigger matches model setting
        wrapper.trigger = m.tooltipTrigger || 'onclick';
        tooltips.set(m.object, wrapper);
        // If 'always' show immediately
        if (wrapper.trigger === 'always') {
          wrapper.visible = true;
          wrapper.el.style.display = 'block';
          updateTooltipPosition(wrapper.el, anchor);
        }
      }

      // If tooltip was disabled, remove/hide it
      if (m.showTooltip === false && tooltips.has(m.object)) {
        const wrapper = tooltips.get(m.object);
        wrapper.el.style.display = 'none';
        wrapper.visible = false;
      }

      // Keep 'always' tooltips visible and updated
      if (tooltips.has(m.object)) {
        const wrapper = tooltips.get(m.object);
        // sync trigger if changed in sidebar
        wrapper.trigger = m.tooltipTrigger || wrapper.trigger;
        if (wrapper.trigger === 'always') {
          wrapper.visible = true;
          wrapper.el.style.display = 'block';
          updateTooltipPosition(wrapper.el, anchor);
        } else if (wrapper.visible) {
          // update position only when visible (hover or onclick toggled)
          updateTooltipPosition(wrapper.el, anchor);
        }
      }
    } catch (e) { }
  });
}
animate();

// ...existing code for addSelectableBtn ...
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
  // default trigger is 'onclick' per request
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

    // Function to flatten the hierarchy and extract all meshes
    // In the GLTFLoader callback in main.js, update the mesh extraction:
    const extractAllMeshes = (object, matrix = new THREE.Matrix4()) => {
      const meshes = [];
      const currentMatrix = matrix.clone().multiply(object.matrix);

      if (object.isMesh) {
        const clone = object.clone();

        // Store the original transformation matrix for proper export
        const originalMatrix = currentMatrix.clone();

        // Apply the accumulated transformation
        clone.applyMatrix4(currentMatrix);

        // Reset position, rotation, scale for independent control
        clone.position.set(0, 0, 0);
        clone.rotation.set(0, 0, 0);
        clone.scale.set(1, 1, 1);

        // Update matrix
        clone.updateMatrix();
        clone.updateMatrixWorld();

        meshes.push({
          object: clone,
          originalName: object.name,
          originalMatrix: originalMatrix.toArray(), // Store original transformation
          originalMaterial: object.material ? {
            color: object.material.color ? object.material.color.getHexString() : null,
            wireframe: object.material.wireframe || false,
            transparent: object.material.transparent || false,
            opacity: object.material.opacity || 1.0
          } : null
        });
      }

      // Process all children recursively
      if (object.children && object.children.length > 0) {
        object.children.forEach(child => {
          meshes.push(...extractAllMeshes(child, currentMatrix));
        });
      }

      return meshes;
    };

    // Extract all meshes from the GLB scene
    const allMeshes = extractAllMeshes(scene);

    if (allMeshes.length === 0) {
      console.warn('No meshes found in the GLB file');
      return;
    }

    // Create a group for this file
    const group = createGroupFromFile(file.name, allMeshes);

    // Add each mesh as a separate object
    // In the GLTFLoader callback, when adding to models array:
    allMeshes.forEach((meshData, index) => {
      const mesh = meshData.object;

      // Ensure proper naming
      mesh.name = meshData.originalName || `${file.name.replace('.glb', '')}_part_${index + 1}`;

      // Set up mesh properties
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.groupId = group.id;
      mesh.userData.isPartOfGroup = true;

      // Add to scene
      viewer.threeScene.add(mesh);

      // Add to models list with all necessary data for proper export
      // ...existing code inside glb loader where models.push is called ...
      models.push({
        name: mesh.name,
        object: mesh,
        showTooltip: true,
        tooltipTrigger: 'onclick', // NEW default
        sourceFile: file.name,
        groupId: group.id,
        isGLBPart: true,
        originalMatrix: meshData.originalMatrix, // Store original transformation
        originalMaterial: meshData.originalMaterial // Store original material properties
      });
    });

    refreshSidebarList();
    refreshGroupList();

    // Select the group by default
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

// Helper: find model entry or tooltip wrapper by walking up the object parent chain.
// This fixes cases where intersectObjects returns a child mesh rather than the stored model object.
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

// --- ADDED helper to hide onclick tooltips globally ---
function hideAllOnclickTooltips() {
  tooltips.forEach((wrapper, model) => {
    if (wrapper.trigger === 'onclick' && wrapper.visible) {
      wrapper.visible = false;
      wrapper.el.style.display = 'none';
    }
  });
}

// --- ADDED onMouseUp referenced by setupTransformGizmo ---
function onMouseUp(event) {
  if (isDragging) {
    isDragging = false;
    selectedAxis = null;
    if (viewer.controls) viewer.controls.enabled = true;
  }
}

// ensure clicks outside canvas or on arbitrary UI hide onclick tooltips
document.addEventListener('mousedown', (e) => {
  // if click is inside a tooltip or inside the sidebar controls, don't automatically hide (so user can interact)
  if (e.target.closest('.hp-tooltip') || e.target.closest('.sidebar-section') || e.target.closest('.model-item')) return;
  // if click is inside canvas we let canvas handler manage showing/toggling, but still hide onclicks if the click didn't hit a model
  if (e.target.closest('canvas')) {
    // canvas click handling already calls onMouseDown -> but we hide onclick tooltips here only if the event path didn't hit a model
    // small delay to let onMouseDown run first; then check if any onclick tooltip remains visible and no new model toggled it
    setTimeout(() => {
      // if no clicked model toggled an onclick tooltip, hide all onclick tooltips
      hideAllOnclickTooltips();
    }, 10);
    return;
  }
  // click outside canvas/tooltip -> hide onclick tooltips
  hideAllOnclickTooltips();
});
