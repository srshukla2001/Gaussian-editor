// export.js
export function exportScene(splatPath, models) {
  // Prepare scene.json
  const sceneData = {
    splatPath,
    models: models.map(m => {
      const o = m.object;
      return {
        name: m.name,
        color: o.material?.color ? o.material.color.getHexString() : null,
        wireframe: o.material?.wireframe || false,   // <-- store wireframe
        geometryType: o.geometry?.type || 'BoxGeometry', // <-- store geometry type
        position: o.position.toArray(),
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
        scale: o.scale.x
      };
    })
  };

  // --- index.html ---
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
        "GLTFLoader": "./lib/GLTFLoader.js"
      }
    }
  </script>
  <style>body{margin:0;overflow:hidden;background:#000}</style>
</head>
<body>
  <script type="module" src="main.js"></script>
</body>
</html>`;

  // --- main.js ---
  const js = `
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';
import { GLTFLoader } from 'GLTFLoader';

const loader = new GLTFLoader();

fetch('scene.json')
  .then(res => res.json())
  .then(data => {
    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0.01933, -0.7583, -0.65161],
      initialCameraPosition: [1.5, 2.6, -6.3],
      initialCameraLookAt: [0.45, 1.95, 1.5]
    });

    viewer.addSplatScene(data.splatPath, { progressiveLoad: false }).then(() => {
      viewer.start();
      const scene = viewer.threeScene;

      // Lighting
      scene.add(new THREE.AmbientLight(0x404040, 1.5));
      const dir = new THREE.DirectionalLight(0xffffff, 1);
      dir.position.set(5,10,7);
      scene.add(dir);

      data.models.forEach(model => {
        if(model.name.toLowerCase().endsWith('.glb')) {
          loader.load('assets/' + model.name, gltf => {
            const obj = gltf.scene;
            obj.name = model.name;
            if(model.position) obj.position.fromArray(model.position);
            if(model.rotation) obj.rotation.set(...model.rotation);
            if(model.scale) obj.scale.setScalar(model.scale);
            scene.add(obj);
          });
        } else {
          let geometry;
          switch(model.geometryType) {
            case 'BoxGeometry': geometry = new THREE.BoxGeometry(1,1,1); break;
            case 'TrapeziumGeometry': geometry = new THREE.CylinderGeometry(0.5,1,1,4); break;
            case 'CylinderGeometry': geometry = new THREE.CylinderGeometry(0.5,0.5,1,16); break;
            default: geometry = new THREE.BoxGeometry(1,1,1);
          }

          const material = new THREE.MeshStandardMaterial({
            color: model.color ? '#' + model.color : '#ffff00',
            wireframe: model.wireframe || false
          });

          const obj = new THREE.Mesh(geometry, material);
          if(model.position) obj.position.fromArray(model.position);
          if(model.rotation) obj.rotation.set(...model.rotation);
          if(model.scale) obj.scale.setScalar(model.scale);
          obj.name = model.name;
          scene.add(obj);
        }
      });
    });
  })
  .catch(err => console.error('Failed to load scene.json', err));
`;

  const json = JSON.stringify(sceneData, null, 2);

  function downloadFile(filename, content, type='text/plain') {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Save files
  downloadFile('index.html', html, 'text/html');
  downloadFile('main.js', js, 'text/javascript');
  downloadFile('scene.json', json, 'application/json');

  // Download GLB assets
  models.forEach(m => {
    if(m.name.toLowerCase().endsWith('.glb') && m.fileUrl) {
      fetch(m.fileUrl)
        .then(res => res.blob())
        .then(blob => downloadFile('assets/' + m.name, blob, 'model/gltf-binary'));
    }
  });
}
