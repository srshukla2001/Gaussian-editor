// export.js
export function exportScene(splatPath, models, groups) {
  // Enhanced model data collection with proper GLB support
  const sceneData = {
    splatPath,
    models: models.map(m => {
      const o = m.object;
      
      // Extract material properties properly
      let materialProps = {};
      if (o.material) {
        materialProps = {
          color: o.material.color ? o.material.color.getHexString() : null,
          wireframe: o.material.wireframe || false,
          transparent: o.material.transparent || false,
          opacity: o.material.opacity || 1.0,
          emissive: o.material.emissive ? o.material.emissive.getHexString() : null,
          metalness: o.material.metalness || 0,
          roughness: o.material.roughness || 1,
          envMapIntensity: o.material.envMapIntensity || 1
        };
        
        // Preserve original GLB material properties if available
        if (m.originalMaterial) {
          materialProps.originalColor = m.originalMaterial.color;
          materialProps.originalWireframe = m.originalMaterial.wireframe;
        }
      }
      
      return {
        name: m.name,
        description: m.description || `Description for ${m.name || 'model'}`,
        buttonText: m.buttonText || "Select",
        geometryType: o.geometry?.type || 'BoxGeometry',
        position: o.position.toArray(),
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
        scale: o.scale.toArray(),
        showTooltip: m.showTooltip !== false,
        tooltipTrigger: m.tooltipTrigger || 'onclick', // Default to onclick as in main app
        groupId: m.groupId || null,
        sourceFile: m.sourceFile || null,
        isGLBPart: m.isGLBPart || false,
        originalMatrix: m.originalMatrix || null,
        material: materialProps,
        uuid: o.uuid
      };
    }),
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
      objectIds: g.objects.map(obj => models.findIndex(m => m.object === obj)).filter(i => i !== -1),
      sourceFile: g.sourceFile || null
    }))
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
    :root {
      --bg: #1e1e1e;
      --muted: #969696;
      --accent: #0078d4;
      --border: #3e3e42;
    }
    
    body {
      margin: 0;
      overflow: hidden;
      background: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    
    .hp-tooltip {
      position: absolute;
      pointer-events: auto;
      background: rgba(30, 30, 30, 0.95);
      color: #fff;
      padding: 10px 12px;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      transform: translate(-50%, -100%);
      z-index: 60;
      min-width: 180px;
      border: 1px solid var(--border);
      backdrop-filter: blur(10px);
    }
    
    .hp-tooltip h4 { 
      margin: 0 0 6px 0; 
      font-size: 13px; 
      color: #ffffff;
    }

    .hp-tooltip p { 
      margin: 0 0 8px 0; 
      font-size: 12px; 
      color: var(--muted); 
    }

    .hp-tooltip button { 
      border-radius: 4px; 
      padding: 6px 8px; 
      border: none; 
      cursor: pointer; 
      background: var(--accent); 
      color: #ffffff; 
      font-weight: 500; 
      font-size: 12px;
      transition: background 0.2s ease;
    }

    .hp-tooltip button:hover {
      background: #1b8bf9;
    }

    canvas {
      display: block;
      outline: none;
    }
  </style>
</head>
<body>
  <script type="module" src="main.js"></script>
</body>
</html>`;

  const js = `
import * as GaussianSplats3D from './lib/gaussian-splats-3d.module.js';
import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { DRACOLoader } from './lib/DRACOLoader.js';

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(dracoLoader);
const mixers = [];
const clock = new THREE.Clock();
const tooltips = new Map();
const tmpProj = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let lastHovered = null;
let viewer = null;
let sceneData = null;
let camera = null;
let scene = null;
let models = [];
let groups = [];

function createTooltipForModel(model, modelData) {
  const tooltip = document.createElement('div');
  tooltip.className = 'hp-tooltip';
  
  const name = modelData?.name || model.name || model.type;
  const description = modelData?.description || \`Description for \${name}\`;
  const buttonText = modelData?.buttonText || "Select";
  
  tooltip.innerHTML = \`<h4>\${name}</h4><p>\${description}</p><button>\${buttonText}</button>\`;
  
  // Set initial visibility based on trigger type
  const trigger = modelData.tooltipTrigger || 'onclick';
  if (trigger === 'always') {
    tooltip.style.display = 'block';
  } else {
    tooltip.style.display = 'none';
  }
  
  document.body.appendChild(tooltip);
  
  tooltip.querySelector('button').addEventListener('click', () => {
    console.log('Selected model:', name);
    if (camera && viewer && viewer.controls) {
      const boundingBox = new THREE.Box3().setFromObject(model);
      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraDistance = maxDim / (2 * Math.tan(fov / 2));
      
      camera.position.copy(center).add(new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(cameraDistance * 1.5));
      viewer.controls.target.copy(center);
    }
  });
  
  return { 
    tooltip, 
    visible: trigger === 'always',
    trigger: trigger
  };
}

function updateTooltipPosition(tooltip, worldPos) {
  try {
    if (!camera) return;
    
    tmpProj.copy(worldPos);
    tmpProj.project(camera);
    const x = (tmpProj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpProj.y * 0.5 + 0.5) * window.innerHeight;
    
    // Check if the point is behind the camera
    if (tmpProj.z > 1) {
      tooltip.style.display = 'none';
      return;
    }
    
    // Check if the point is within view frustum
    if (tmpProj.x >= -1 && tmpProj.x <= 1 && tmpProj.y >= -1 && tmpProj.y <= 1) {
      tooltip.style.display = 'block';
      tooltip.style.transform = \`translate(-50%, -100%) translate(\${x}px,\${y}px)\`;
    } else {
      tooltip.style.display = 'none';
    }
  } catch (e) {
    console.error('Error updating tooltip position:', e);
  }
}

function hideAllOnclickTooltips() {
  tooltips.forEach((tooltipData, model) => {
    if (tooltipData.trigger === 'onclick' && tooltipData.visible) {
      tooltipData.visible = false;
      tooltipData.tooltip.style.display = 'none';
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  mixers.forEach(m => m.update(delta));

  if (camera) {
    tooltips.forEach((tooltipData, model) => {
      try {
        const { tooltip, trigger, visible } = tooltipData;
        if (visible) {
          const anchor = new THREE.Vector3();
          model.getWorldPosition(anchor);
          updateTooltipPosition(tooltip, anchor);
        } else if (trigger === 'always') {
          // Ensure always-visible tooltips stay visible
          tooltipData.visible = true;
          tooltip.style.display = 'block';
          const anchor = new THREE.Vector3();
          model.getWorldPosition(anchor);
          updateTooltipPosition(tooltip, anchor);
        }
      } catch (e) {
        console.error('Error in tooltip animation:', e);
      }
    });
  }
}

function loadGLBModel(modelData, onComplete) {
  if (!modelData.sourceFile) {
    console.error('No source file specified for GLB model:', modelData.name);
    onComplete(null);
    return;
  }

  loader.load('assets/' + modelData.sourceFile, gltf => {
    let obj = null;
    
    if (modelData.isGLBPart) {
      // For GLB parts, we need to extract the specific mesh
      const meshes = [];
      gltf.scene.traverse(child => {
        if (child.isMesh) {
          meshes.push(child);
        }
      });
      
      // Try to find by name or use first mesh
      let targetMesh = meshes.find(mesh => mesh.name === modelData.name);
      if (!targetMesh && meshes.length > 0) {
        targetMesh = meshes[0];
      }
      
      if (targetMesh) {
        obj = targetMesh.clone();
        obj.name = modelData.name;
        
        // Apply the edited transformations from the editor
        if (modelData.position) obj.position.fromArray(modelData.position);
        if (modelData.rotation) obj.rotation.set(...modelData.rotation);
        if (modelData.scale) obj.scale.fromArray(modelData.scale);
        
        // Apply material properties from editor
        if (modelData.material && obj.material) {
          if (modelData.material.color) {
            obj.material.color.set('#' + modelData.material.color);
          }
          if (modelData.material.wireframe !== undefined) {
            obj.material.wireframe = modelData.material.wireframe;
          }
          if (modelData.material.transparent !== undefined) {
            obj.material.transparent = modelData.material.transparent;
          }
          if (modelData.material.opacity !== undefined) {
            obj.material.opacity = modelData.material.opacity;
          }
          if (modelData.material.emissive) {
            obj.material.emissive.set('#' + modelData.material.emissive);
          }
          if (modelData.material.metalness !== undefined) {
            obj.material.metalness = modelData.material.metalness;
          }
          if (modelData.material.roughness !== undefined) {
            obj.material.roughness = modelData.material.roughness;
          }
          obj.material.needsUpdate = true;
        }
      }
    } else {
      // Regular GLB model
      obj = gltf.scene;
      obj.name = modelData.name;
      
      if (modelData.position) obj.position.fromArray(modelData.position);
      if (modelData.rotation) obj.rotation.set(...modelData.rotation);
      if (modelData.scale) obj.scale.fromArray(modelData.scale);
    }
    
    if (!obj) {
      console.error('Failed to create object for model:', modelData.name);
      onComplete(null);
      return;
    }
    
    // Ensure shadow properties
    obj.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    
    scene.add(obj);

    if (modelData.showTooltip) {
      const wrapper = createTooltipForModel(obj, modelData);
      tooltips.set(obj, { 
        tooltip: wrapper.tooltip, 
        modelData, 
        visible: wrapper.visible, 
        trigger: wrapper.trigger 
      });
    }

    if (gltf.animations && gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(obj);
      gltf.animations.forEach(clip => {
        mixer.clipAction(clip).play();
      });
      mixers.push(mixer);
    }

    onComplete(obj);
  }, undefined, (error) => {
    console.error('Error loading GLB:', error);
    onComplete(null);
  });
}

function loadPrimitiveModel(modelData) {
  let geometry;
  switch(modelData.geometryType) {
    case 'BoxGeometry': 
      geometry = new THREE.BoxGeometry(1, 1, 1); 
      break;
    case 'SphereGeometry': 
      geometry = new THREE.SphereGeometry(0.5, 16, 16); 
      break;
    case 'CylinderGeometry': 
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16); 
      break;
    case 'ConeGeometry': 
      geometry = new THREE.ConeGeometry(0.5, 1, 16); 
      break;
    default: 
      geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  const materialProps = modelData.material || {};
  const material = new THREE.MeshStandardMaterial({
    color: materialProps.color ? '#' + materialProps.color : '#ffff00',
    wireframe: materialProps.wireframe || false,
    transparent: materialProps.transparent || false,
    opacity: materialProps.opacity !== undefined ? materialProps.opacity : 1.0,
    emissive: materialProps.emissive ? '#' + materialProps.emissive : '#000000',
    metalness: materialProps.metalness || 0,
    roughness: materialProps.roughness || 1
  });

  const obj = new THREE.Mesh(geometry, material);
  if (modelData.position) obj.position.fromArray(modelData.position);
  if (modelData.rotation) obj.rotation.set(...modelData.rotation);
  if (modelData.scale) obj.scale.fromArray(modelData.scale);
  obj.name = modelData.name;
  obj.castShadow = true;
  obj.receiveShadow = true;
  scene.add(obj);

  if (modelData.showTooltip) {
    const wrapper = createTooltipForModel(obj, modelData);
    tooltips.set(obj, { 
      tooltip: wrapper.tooltip, 
      modelData, 
      visible: wrapper.visible, 
      trigger: wrapper.trigger 
    });
  }

  return obj;
}

function loadModels() {
  const loadPromises = [];
  
  sceneData.models.forEach(modelData => {
    const loadPromise = new Promise((resolve) => {
      if (modelData.sourceFile && modelData.sourceFile.toLowerCase().endsWith('.glb')) {
        loadGLBModel(modelData, (loadedObj) => {
          if (loadedObj) {
            models.push({ object: loadedObj, modelData });
          }
          resolve();
        });
      } else {
        const obj = loadPrimitiveModel(modelData);
        models.push({ object: obj, modelData });
        resolve();
      }
    });
    
    loadPromises.push(loadPromise);
  });

  // Wait for all models to load before creating groups
  Promise.all(loadPromises).then(() => {
    sceneData.groups.forEach(groupData => {
      const groupObjects = groupData.objectIds
        .map(id => models[id]?.object)
        .filter(obj => obj !== undefined);
      
      if (groupObjects.length > 0) {
        groups.push({
          id: groupData.id,
          name: groupData.name,
          objects: groupObjects,
          sourceFile: groupData.sourceFile
        });
        console.log('Group created:', groupData.name, 'with', groupObjects.length, 'objects');
      }
    });
  });
}

function setupLighting() {
  // Ambient light
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  
  // Directional light (sun)
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);
  
  // Fill light
  const fillLight = new THREE.DirectionalLight(0x7777ff, 0.3);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);
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
      sphericalHarmonicsDegree: 2,
      useFrustumCulling: true,
      halfPrecisionCovariancesOnGPU: true,
      sortEnable: true
    });

    viewer.addSplatScene(data.splatPath, { 
      progressiveLoad: true,
      useFrustumCulling: true 
    }).then(() => {
      viewer.start();
      
      // Get the camera and scene from the viewer
      camera = viewer.camera;
      scene = viewer.scene || viewer.threeScene;
      
      if (!scene) {
        console.error('Scene not found in viewer');
        return;
      }
      
      // Add lighting to the scene
      setupLighting();

      // Load custom models
      loadModels();

      // Setup pointer handlers for tooltip triggers
      const canvas = viewer.renderer && viewer.renderer.domElement;
      if (canvas) {
        canvas.style.touchAction = 'none';
        
        // Hover handler for onhover triggers
        canvas.addEventListener('pointermove', (ev) => {
          mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(ev.clientY / window.innerHeight) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          
          const intersects = raycaster.intersectObjects(scene.children, true)
            .filter(i => !i.object.isGaussianSplatMesh);
          
          let hoveredObject = null;
          let hoveredTooltipData = null;
          
          // Find the first object that has a tooltip with onhover trigger
          for (const intersect of intersects) {
            const obj = intersect.object;
            const tooltipData = tooltips.get(obj);
            if (tooltipData && tooltipData.trigger === 'onhover') {
              hoveredObject = obj;
              hoveredTooltipData = tooltipData;
              break;
            }
          }
          
          // Handle onhover tooltips
          if (hoveredObject && hoveredTooltipData) {
            // Hide previous hovered tooltip if different
            if (lastHovered && lastHovered !== hoveredObject) {
              const prevTooltipData = tooltips.get(lastHovered);
              if (prevTooltipData && prevTooltipData.trigger === 'onhover') {
                prevTooltipData.visible = false;
                prevTooltipData.tooltip.style.display = 'none';
              }
            }
            
            // Show current hovered tooltip
            hoveredTooltipData.visible = true;
            hoveredTooltipData.tooltip.style.display = 'block';
            const anchor = new THREE.Vector3();
            hoveredObject.getWorldPosition(anchor);
            updateTooltipPosition(hoveredTooltipData.tooltip, anchor);
            
            lastHovered = hoveredObject;
          } else {
            // No valid hover object found, hide any visible onhover tooltips
            if (lastHovered) {
              const prevTooltipData = tooltips.get(lastHovered);
              if (prevTooltipData && prevTooltipData.trigger === 'onhover') {
                prevTooltipData.visible = false;
                prevTooltipData.tooltip.style.display = 'none';
              }
              lastHovered = null;
            }
          }
        });

        // Click handler for onclick-type tooltips (toggle)
        canvas.addEventListener('click', (ev) => {
          mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(ev.clientY / window.innerHeight) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          
          const intersects = raycaster.intersectObjects(scene.children, true)
            .filter(i => !i.object.isGaussianSplatMesh);
          
          if (intersects.length > 0) {
            const obj = intersects[0].object;
            const tooltipData = tooltips.get(obj);
            
            if (tooltipData && tooltipData.trigger === 'onclick') {
              // Toggle visibility
              tooltipData.visible = !tooltipData.visible;
              tooltipData.tooltip.style.display = tooltipData.visible ? 'block' : 'none';
              
              if (tooltipData.visible) {
                const anchor = new THREE.Vector3();
                obj.getWorldPosition(anchor);
                updateTooltipPosition(tooltipData.tooltip, anchor);
              }
            }
          } else {
            // Clicked on empty space, hide all onclick tooltips
            hideAllOnclickTooltips();
          }
        });

        // Hide onclick tooltips when clicking outside the canvas
        document.addEventListener('mousedown', (e) => {
          if (!canvas.contains(e.target)) {
            hideAllOnclickTooltips();
          }
        });
      }

      // Start animation loop
      animate();

      // Add resize handler
      window.addEventListener('resize', () => {
        tooltips.forEach((tooltipData, model) => {
          try {
            if (tooltipData.visible) {
              const anchor = new THREE.Vector3();
              model.getWorldPosition(anchor);
              updateTooltipPosition(tooltipData.tooltip, anchor);
            }
          } catch (e) {}
        });
      });

      // Add keyboard controls for better navigation
      window.addEventListener('keydown', (e) => {
        if (viewer && viewer.controls) {
          // Reset camera position with R key
          if (e.key === 'r' || e.key === 'R') {
            viewer.controls.reset();
          }
        }
      });

    }).catch(err => {
      console.error('Failed to load splat scene:', err);
    });
  })
  .catch(err => console.error('Failed to load scene.json:', err));

// Handle window errors gracefully
window.addEventListener('error', (e) => {
  console.error('Runtime error:', e.error);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});
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

    // Create assets folder instructions
    const readme = `# Exported Scene

Place your GLB model files in the 'assets' folder alongside these files.

Required folder structure:
- index.html
- main.js
- scene.json
- lib/ (containing three.module.js, gaussian-splats-3d.module.js, GLTFLoader.js, DRACOLoader.js)
- assets/ (containing your GLB model files)

Serve these files through a web server for proper loading.`;
    
    downloadFile('README.txt', readme, 'text/plain');

  } catch (error) {
    console.error('Error in export process:', error);
  }
}
