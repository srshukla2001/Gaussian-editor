// export.js
export function exportScene(splatPath, models) {
  const sceneData = {
    splatPath,
    models: models.map(m => {
      const o = m.object;
      return {
        name: m.name,
        color: o.material?.color ? o.material.color.getHexString() : null,
        wireframe: o.material?.wireframe || false,
        geometryType: o.geometry?.type || 'BoxGeometry',
        position: o.position.toArray(),
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
        scale: o.scale.x,
        showTooltip: m.showTooltip !== false
      };
    })
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Exported Scene</title>
  <script type="importmap">
    {
      "imports": {
        "three": "./lib/three.module.js",
        "@mkkellogg/gaussian-splats-3d": "./lib/gaussian-splats-3d.module.js",
        "GLTFLoader": "./lib/GLTFLoader.js",
        "DRACOLoader": "./lib/DRACOLoader.js"
      }
    }
  </script>
  <style>
    body{margin:0;overflow:hidden;background:#000}
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
      min-width: 180px;
    }
    .hp-tooltip h4 { margin:0 0 6px 0; font-size:13px; }
    .hp-tooltip p { margin:0 0 8px 0; font-size:12px; color:#9aa0a6; }
    .hp-tooltip button { 
      border-radius:6px; 
      padding:6px 8px; 
      border: none; 
      cursor:pointer; 
      background: #7bd389; 
      color:#052018; 
      font-weight:600; 
    }
  </style>
</head>
<body>
  <script type="module" src="main.js"></script>
</body>
</html>`;

  const js = `
import * as GaussianSplats3D from '/lib/gaussian-splats-3d.module.js';
import * as THREE from '/lib/three.module.js';
import { GLTFLoader } from '/lib/GLTFLoader.js';
import { DRACOLoader } from '/lib/DRACOLoader.js';

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);
const mixers = [];
const clock = new THREE.Clock();
const tooltips = new Map();
const tmpProj = new THREE.Vector3();
let viewer = null;
let sceneData = null;
let camera = null;
let scene = null;

function createTooltipForModel(model) {
  const tooltip = document.createElement('div');
  tooltip.className = 'hp-tooltip';
  tooltip.innerHTML = \`<h4>\${model.name || model.type}</h4><p>Selectable object</p><button>Select</button>\`;
  tooltip.style.display = 'block';
  document.body.appendChild(tooltip);
  
  tooltip.querySelector('button').addEventListener('click', () => {
    console.log('Selected model:', model.name);
  });
  
  return tooltip;
}

function updateTooltipPosition(tooltip, worldPos) {
  try {
    if (!camera) return;
    
    tmpProj.copy(worldPos);
    tmpProj.project(camera);
    const x = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
    tooltip.style.transform = \`translate(-50%, -100%) translate(\${x}px,\${y}px)\`;
  } catch (e) {
    console.error('Error updating tooltip position:', e);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  mixers.forEach(m => m.update(delta));

  if (camera) {
    tooltips.forEach((tooltip, model) => {
      try {
        const anchor = new THREE.Vector3();
        model.getWorldPosition(anchor);
        updateTooltipPosition(tooltip, anchor);
      } catch (e) {
        console.error('Error in tooltip animation:', e);
      }
    });
  }
}

function loadModels() {
  sceneData.models.forEach(modelData => {
    if(modelData.name.toLowerCase().endsWith('.glb')) {
      loader.load('assets/' + modelData.name, gltf => {
        const obj = gltf.scene;
        obj.name = modelData.name;
        if(modelData.position) obj.position.fromArray(modelData.position);
        if(modelData.rotation) obj.rotation.set(...modelData.rotation);
        if(modelData.scale) obj.scale.setScalar(modelData.scale);
        
        obj.traverse(c => {
          if (c.isMesh) {
            c.castShadow = c.receiveShadow = true;
          }
        });
        
        scene.add(obj);

        if (modelData.showTooltip) {
          const tooltip = createTooltipForModel(obj);
          tooltips.set(obj, tooltip);
        }

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(obj);
          gltf.animations.forEach(clip => {
            mixer.clipAction(clip).play();
          });
          mixers.push(mixer);
        }
      }, undefined, (error) => {
        console.error('Error loading GLB:', error);
      });
    } else {
      let geometry;
      switch(modelData.geometryType) {
        case 'BoxGeometry': geometry = new THREE.BoxGeometry(1,1,1); break;
        case 'TrapeziumGeometry': geometry = new THREE.CylinderGeometry(0.5,1,1,4); break;
        case 'CylinderGeometry': geometry = new THREE.CylinderGeometry(0.5,0.5,1,16); break;
        default: geometry = new THREE.BoxGeometry(1,1,1);
      }

      const material = new THREE.MeshStandardMaterial({
        color: modelData.color ? '#' + modelData.color : '#ffff00',
        wireframe: modelData.wireframe || false
      });

      const obj = new THREE.Mesh(geometry, material);
      if(modelData.position) obj.position.fromArray(modelData.position);
      if(modelData.rotation) obj.rotation.set(...modelData.rotation);
      if(modelData.scale) obj.scale.setScalar(modelData.scale);
      obj.name = modelData.name;
      scene.add(obj);

      if (modelData.showTooltip) {
        const tooltip = createTooltipForModel(obj);
        tooltips.set(obj, tooltip);
      }
    }
  });
}

// Start the application
fetch('scene.json')
  .then(res => res.json())
  .then(data => {
    sceneData = data;
    
    viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0, -1, 0],
      initialCameraPosition: [1.54163, 2.68515, -6.37228],
      initialCameraLookAt: [0.45622, 1.95338, 1.51278],
      sphericalHarmonicsDegree: 2
    });

    viewer.addSplatScene(data.splatPath, { progressiveLoad: true }).then(() => {
      viewer.start();
      
      // Get the camera and scene from the viewer
      camera = viewer.camera;
      scene = viewer.scene || viewer.threeScene;
      
      if (!scene) {
        console.error('Scene not found in viewer');
        return;
      }
      
      // Add lighting to the scene
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(5, 10, 7);
      dirLight.castShadow = true;
      scene.add(dirLight);

      // Load custom models
      loadModels();

      // Start animation loop
      animate();

      // Add resize handler
      window.addEventListener('resize', () => {
        tooltips.forEach((tooltip, model) => {
          try {
            const anchor = new THREE.Vector3();
            model.getWorldPosition(anchor);
            updateTooltipPosition(tooltip, anchor);
          } catch (e) {}
        });
      });

    }).catch(err => {
      console.error('Failed to load splat scene:', err);
    });
  })
  .catch(err => console.error('Failed to load scene.json:', err));
`;

  const json = JSON.stringify(sceneData, null, 2);

  function downloadFile(filename, content, type = 'text/plain') {
    try {
      const blob = new Blob([content], { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 100);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  }

  try {
    downloadFile('index.html', html, 'text/html');
    downloadFile('main.js', js, 'text/javascript');
    downloadFile('scene.json', json, 'application/json');

    models.forEach(m => {
      if (m.name.toLowerCase().endsWith('.glb') && m.fileUrl) {
        fetch(m.fileUrl)
          .then(res => res.blob())
          .then(blob => downloadFile('assets/' + m.name, blob, 'model/gltf-binary'))
          .catch(err => console.error('Error downloading GLB:', err));
      }
    });
  } catch (error) {
    console.error('Error in export process:', error);
  }
}
