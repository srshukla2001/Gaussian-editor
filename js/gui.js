import * as THREE from '/lib/three.module.js';
import GUI from 'lil-gui';

export function createGUI(obj, isGroup = false, groupObjects = []) {
  const gui = new GUI();
  
  if (isGroup && groupObjects.length > 0) {
    // GUI for group
    const groupParams = {
      name: obj.name || 'Group',
      posX: obj.position.x, 
      posY: obj.position.y, 
      posZ: obj.position.z,
      rotX: obj.rotation.x, 
      rotY: obj.rotation.y, 
      rotZ: obj.rotation.z,
      scale: obj.scale.x,
      visible: obj.visible
    };

    // Group name
    gui.add(groupParams, 'name').name('Group Name').onChange(v => {
      obj.name = v;
    });

    // Position folder
    const posFolder = gui.addFolder('Position');
    posFolder.add(groupParams, 'posX', -20, 20, 0.01).name('X').onChange(v => {
      const delta = v - obj.position.x;
      groupObjects.forEach(object => {
        object.position.x += delta;
        object.updateMatrix();
      });
      obj.position.x = v;
    });
    posFolder.add(groupParams, 'posY', -20, 20, 0.01).name('Y').onChange(v => {
      const delta = v - obj.position.y;
      groupObjects.forEach(object => {
        object.position.y += delta;
        object.updateMatrix();
      });
      obj.position.y = v;
    });
    posFolder.add(groupParams, 'posZ', -20, 20, 0.01).name('Z').onChange(v => {
      const delta = v - obj.position.z;
      groupObjects.forEach(object => {
        object.position.z += delta;
        object.updateMatrix();
      });
      obj.position.z = v;
    });

    // Rotation folder
    const rotFolder = gui.addFolder('Rotation');
    rotFolder.add(groupParams, 'rotX', 0, Math.PI * 2, 0.01).name('X').onChange(v => {
      const center = new THREE.Vector3(groupParams.posX, groupParams.posY, groupParams.posZ);
      const deltaAngle = v - obj.rotation.x;
      groupObjects.forEach(object => {
        const relativePos = new THREE.Vector3().subVectors(object.position, center);
        relativePos.applyAxisAngle(new THREE.Vector3(1, 0, 0), deltaAngle);
        object.position.copy(center).add(relativePos);
        object.rotation.x += deltaAngle;
        object.updateMatrix();
      });
      obj.rotation.x = v;
    });
    rotFolder.add(groupParams, 'rotY', 0, Math.PI * 2, 0.01).name('Y').onChange(v => {
      const center = new THREE.Vector3(groupParams.posX, groupParams.posY, groupParams.posZ);
      const deltaAngle = v - obj.rotation.y;
      groupObjects.forEach(object => {
        const relativePos = new THREE.Vector3().subVectors(object.position, center);
        relativePos.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaAngle);
        object.position.copy(center).add(relativePos);
        object.rotation.y += deltaAngle;
        object.updateMatrix();
      });
      obj.rotation.y = v;
    });
    rotFolder.add(groupParams, 'rotZ', 0, Math.PI * 2, 0.01).name('Z').onChange(v => {
      const center = new THREE.Vector3(groupParams.posX, groupParams.posY, groupParams.posZ);
      const deltaAngle = v - obj.rotation.z;
      groupObjects.forEach(object => {
        const relativePos = new THREE.Vector3().subVectors(object.position, center);
        relativePos.applyAxisAngle(new THREE.Vector3(0, 0, 1), deltaAngle);
        object.position.copy(center).add(relativePos);
        object.rotation.z += deltaAngle;
        object.updateMatrix();
      });
      obj.rotation.z = v;
    });

    // Scale folder
    const scaleFolder = gui.addFolder('Scale');
    scaleFolder.add(groupParams, 'scale', 0.1, 5, 0.1).name('Uniform Scale').onChange(v => {
      const center = new THREE.Vector3(groupParams.posX, groupParams.posY, groupParams.posZ);
      const scaleFactor = v / obj.scale.x;
      groupObjects.forEach(object => {
        const relativePos = new THREE.Vector3().subVectors(object.position, center);
        relativePos.multiplyScalar(scaleFactor);
        object.position.copy(center).add(relativePos);
        object.scale.multiplyScalar(scaleFactor);
        object.updateMatrix();
      });
      obj.scale.setScalar(v);
    });

    // Visibility
    gui.add(groupParams, 'visible').name('Visible').onChange(v => {
      groupObjects.forEach(object => {
        object.visible = v;
      });
      obj.visible = v;
    });

    // Objects count display
    gui.add({ objects: groupObjects.length }, 'objects').name('Objects').disable();

  } else {
    // GUI for individual object
    const params = {
      name: obj.name || 'Object',
      color: obj.material?.color ? '#' + obj.material.color.getHexString() : '#ffffff',
      posX: obj.position.x, 
      posY: obj.position.y, 
      posZ: obj.position.z,
      rotX: obj.rotation.x, 
      rotY: obj.rotation.y, 
      rotZ: obj.rotation.z,
      scale: obj.scale.x,
      visible: obj.visible,
      shape: obj.geometry?.type || 'BoxGeometry'
    };

    // Object name
    gui.add(params, 'name').name('Name').onChange(v => {
      obj.name = v;
    });

    // Color (if material exists)
    if (obj.material?.color) {
      gui.addColor(params, 'color').name('Color').onChange(v => {
        obj.material.color.set(v);
      });
    }

    // Position folder
    const posFolder = gui.addFolder('Position');
    posFolder.add(params, 'posX', -20, 20, 0.01).name('X').onChange(v => obj.position.x = v);
    posFolder.add(params, 'posY', -20, 20, 0.01).name('Y').onChange(v => obj.position.y = v);
    posFolder.add(params, 'posZ', -20, 20, 0.01).name('Z').onChange(v => obj.position.z = v);

    // Rotation folder
    const rotFolder = gui.addFolder('Rotation');
    rotFolder.add(params, 'rotX', 0, Math.PI * 2, 0.01).name('X').onChange(v => obj.rotation.x = v);
    rotFolder.add(params, 'rotY', 0, Math.PI * 2, 0.01).name('Y').onChange(v => obj.rotation.y = v);
    rotFolder.add(params, 'rotZ', 0, Math.PI * 2, 0.01).name('Z').onChange(v => obj.rotation.z = v);

    // Scale
    gui.add(params, 'scale', 0.1, 5, 0.1).name('Scale').onChange(v => obj.scale.setScalar(v));

    // Visibility
    gui.add(params, 'visible').name('Visible').onChange(v => obj.visible = v);

    // Shape (only for primitive geometries)
    if (obj.geometry && ['BoxGeometry', 'SphereGeometry', 'CylinderGeometry'].includes(obj.geometry.type)) {
      gui.add(params, 'shape', ['BoxGeometry', 'TrapeziumGeometry', 'CylinderGeometry']).name('Shape').onChange(v => {
        let newGeom;
        switch (v) {
          case 'BoxGeometry':
            newGeom = new THREE.BoxGeometry(1, 1, 1); break;
          case 'TrapeziumGeometry':
            newGeom = new THREE.CylinderGeometry(0.5, 1, 1, 4); break;
          case 'CylinderGeometry':
            newGeom = new THREE.CylinderGeometry(0.5, 0.5, 1, 16); break;
          default:
            newGeom = new THREE.BoxGeometry(1, 1, 1);
        }
        obj.geometry = newGeom;
      });
    }

    // Type display
    gui.add({ type: obj.type }, 'type').name('Type').disable();
  }

  return gui;
}
