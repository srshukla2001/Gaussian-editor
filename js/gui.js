import * as THREE from '/lib/three.module.js';
import GUI from 'lil-gui';

export function createGUI(obj) {
  // create and return a GUI instance (caller holds reference)
  const gui = new GUI();
  const params = {
    color: obj.material?.color ? '#' + obj.material.color.getHexString() : '#ffffff',
    posX: obj.position.x, posY: obj.position.y, posZ: obj.position.z,
    rotX: obj.rotation.x, rotY: obj.rotation.y, rotZ: obj.rotation.z,
    scale: obj.scale.x,
    shape: obj.geometry?.type || 'BoxGeometry'
  };
  if (obj.material?.color) gui.addColor(params, 'color').onChange(v => obj.material.color.set(v));
  gui.add(params, 'posX', -10, 10, 0.01).onChange(v => obj.position.x = v);
  gui.add(params, 'posY', -10, 10, 0.01).onChange(v => obj.position.y = v);
  gui.add(params, 'posZ', -10, 10, 0.01).onChange(v => obj.position.z = v);
  gui.add(params, 'rotX', 0, Math.PI * 2, 0.01).onChange(v => obj.rotation.x = v);
  gui.add(params, 'rotY', 0, Math.PI * 2, 0.01).onChange(v => obj.rotation.y = v);
  gui.add(params, 'rotZ', 0, Math.PI * 2, 0.01).onChange(v => obj.rotation.z = v);
  gui.add(params, 'scale', 0.1, 5, 0.1).onChange(v => obj.scale.setScalar(v));
  gui.add(params, 'shape', ['BoxGeometry', 'TrapeziumGeometry', 'CylinderGeometry']).onChange(v => {
    let newGeom;
    switch (v) {
      case 'BoxGeometry':
        newGeom = new THREE.BoxGeometry(1, 1, 1); break;
      case 'TrapeziumGeometry':
        newGeom = new THREE.CylinderGeometry(0.5, 1, 1, 4); break;
      case 'CylinderGeometry':
        newGeom = new THREE.CylinderGeometry(0.5, 0.5, 1, 16); break;
      default:
        newGeom = new THREE.BoxGeometry(1,1,1);
    }
    obj.geometry = newGeom;
  });
  return gui;
}