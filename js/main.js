// Use local libs served from Vite `public`/root. Import three and the gaussian splats module
// directly from the bundled files in `/lib` so the browser can load them as ES modules.
import * as GaussianSplats3D from '../lib/gaussian-splats-3d.module.js';
import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '/lib/GLTFLoader.js';
// use CDN esm build for lil-gui
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';
import { exportScene } from './export.js';
import { createGUI } from './gui.js';

const viewer = new GaussianSplats3D.Viewer({
  cameraUp: [0.01933, -0.75830, -0.65161],
  initialCameraPosition: [1.54163, 2.68515, -6.37228],
  initialCameraLookAt: [0.45622, 1.95338, 1.51278],
  sphericalHarmonicsDegree: 2
});

const splatPath = 'assets/data/bonsai/bonsai.ksplat';
const loader = new GLTFLoader();
const models = [];
let selectedModel = null;

viewer.addSplatScene(splatPath, { progressiveLoad: false }).then(() => {
  viewer.start();
  const scene = viewer.threeScene;
  const camera = viewer.threeCamera; // camera now exists

  // Lighting
  scene.add(new THREE.AmbientLight(0x404040, 1.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // Default box
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
  scene.add(box);
  models.push({ name: 'Box', object: box });

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.style.position = 'absolute';
  sidebar.style.left = '0';
  sidebar.style.top = '0';
  sidebar.style.width = '200px';
  sidebar.style.height = '100%';
  sidebar.style.background = '#222';
  sidebar.style.color = '#fff';
  sidebar.style.overflowY = 'auto';
  sidebar.style.padding = '10px';
  document.body.appendChild(sidebar);
  
  function refreshSidebar() {
    const inputs = Array.from(sidebar.querySelectorAll('input'));
    sidebar.innerHTML = '<b>Models</b><br>';
    inputs.forEach(i => sidebar.appendChild(i));

    // Add buttons for models
    models.forEach(m => {
      const btn = document.createElement('button');
      btn.textContent = m.name;
      btn.style.display = 'block';
      btn.style.margin = '5px 0';
      btn.onclick = () => selectModel(m.object);
      sidebar.appendChild(btn);
    });

    // Add Selectable button
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Selectable';
    addBtn.style.display = 'block';
    addBtn.style.margin = '10px 0';
    sidebar.appendChild(addBtn);

    addBtn.onclick = () => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true
      });
      const cube = new THREE.Mesh(geometry, material);
      cube.name = 'SelectableCube_' + (models.length + 1);
      cube.position.set(0, 0.5, 0);

      scene.add(cube);
      models.push({ name: cube.name, object: cube });
      refreshSidebar();
      selectModel(cube);
    };

    // File input for GLB
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.glb';
    fileInput.id = 'loadGLBBtn';
    fileInput.style.display = 'block';
    fileInput.style.margin = '10px 0';
    sidebar.appendChild(fileInput);
  }

  function selectModel(obj) {
    selectedModel = obj;
    if (gui) gui.destroy();
    gui = createGUI(selectedModel);
  }

  // GUI
  let gui;
  // receive GUI instance and store it
  gui = createGUI(selectedModel || box);
  refreshSidebar();

  // --- Click handling ---
  window.addEventListener('click', (event) => {
    if (!camera) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(models.map(m => m.object));

    if (intersects.length > 0) {
      const obj = intersects[0].object;

      // Add transparent fill if wireframe
      if (obj.material?.wireframe) {
        obj.material = new THREE.MeshStandardMaterial({
          color: obj.material.color,
          transparent: true,
          opacity: 0.3,
          wireframe: false
        });
      }

      tooltip.style.display = 'block';
      tooltip.querySelector('#tipTitle').innerText = obj.name;
      tooltip.querySelector('#tipDesc').innerText = 'This is a selectable cube';
      tooltip.querySelector('#tipBtn').onclick = () => alert('Button clicked on ' + obj.name);

      selectedModel = obj;
    } else {
      tooltip.style.display = 'none';
    }
  });

  // --- Update tooltip position each frame ---
  viewer.threeScene.onBeforeRender = () => {
    if (selectedModel && camera) {
      const pos = selectedModel.position.clone();
      pos.project(camera);

      const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;

      tooltip.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
    }
  };

  // Load GLB
  document.getElementById('loadGLBBtn')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    loader.load(url, gltf => {
      const obj = gltf.scene;
      obj.name = file.name;
      scene.add(obj);
      models.push({ name: file.name, object: obj });
      refreshSidebar();
      selectModel(obj);
    });
  });

  // Export
  document.getElementById('exportBtn').onclick = () => {
    exportScene(splatPath, models);
  };
});
