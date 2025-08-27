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
        scale: o.scale.x
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

  const js = `
import * as GaussianSplats3D from '/lib/gaussian-splats-3d.module.js';
import * as THREE from '/lib/three.module.js';
import { GLTFLoader } from '/lib/GLTFLoader.js';

const loader = new GLTFLoader();
const mixers = [];
const clock = new THREE.Clock();

fetch('scene.json')
  .then(res => res.json())
  .then(data => {
    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0, -1, 0],
      initialCameraPosition: [1.54163, 2.68515, -6.37228],
      initialCameraLookAt: [0.45622, 1.95338, 1.51278],
      sphericalHarmonicsDegree: 2
    });

    viewer.addSplatScene(data.splatPath, { progressiveLoad: true }).then(() => {
      viewer.start();
      const scene = viewer.threeScene;

      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(5, 10, 7);
      dirLight.castShadow = true;
      scene.add(dirLight);

      data.models.forEach(model => {
        if(model.name.toLowerCase().endsWith('.glb')) {
          loader.load('assets/' + model.name, gltf => {
            const obj = gltf.scene;
            obj.name = model.name;
            if(model.position) obj.position.fromArray(model.position);
            if(model.rotation) obj.rotation.set(...model.rotation);
            if(model.scale) obj.scale.setScalar(model.scale);
            
            obj.traverse(c => {
              if (c.isMesh) {
                c.castShadow = c.receiveShadow = true;
              }
            });
            
            scene.add(obj);

            if (gltf.animations && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(obj);
              gltf.animations.forEach(clip => {
                mixer.clipAction(clip).play();
              });
              mixers.push(mixer);
            }
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

      scene.onBeforeRender = () => {
        const delta = clock.getDelta();
        mixers.forEach(m => m.update(delta));
      };
    });
  })
  .catch(err => console.error('Failed to load scene.json', err));
`;

  const json = JSON.stringify(sceneData, null, 2);

  function downloadFile(filename, content, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  downloadFile('index.html', html, 'text/html');
  downloadFile('main.js', js, 'text/javascript');
  downloadFile('scene.json', json, 'application/json');

  models.forEach(m => {
    if (m.name.toLowerCase().endsWith('.glb') && m.fileUrl) {
      fetch(m.fileUrl)
        .then(res => res.blob())
        .then(blob => downloadFile('assets/' + m.name, blob, 'model/gltf-binary'));
    }
  });
}