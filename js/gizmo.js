export function createTransformGizmo() {
  const gizmo = new THREE.Group();
  
  const axes = [
    { color: 0xff0000, direction: new THREE.Vector3(1, 0, 0), name: 'x' },
    { color: 0x00ff00, direction: new THREE.Vector3(0, 1, 0), name: 'y' },
    { color: 0x0000ff, direction: new THREE.Vector3(0, 0, 1), name: 'z' }
  ];
  
  axes.forEach(axis => {
    // Arrow
    const arrow = new THREE.ArrowHelper(
      axis.direction,
      new THREE.Vector3(0, 0, 0),
      1,
      axis.color,
      0.3,
      0.2
    );
    arrow.userData.axis = axis.name;
    gizmo.add(arrow);
    
    // Handle (invisible cylinder for picking)
    const handleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    const handleMaterial = new THREE.MeshBasicMaterial({ 
      color: axis.color,
      transparent: true,
      opacity: 0.5,
      visible: false
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.copy(axis.direction.clone().multiplyScalar(0.4));
    handle.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      axis.direction.clone().normalize()
    );
    handle.userData.axis = axis.name;
    handle.userData.isHandle = true;
    gizmo.add(handle);
  });
  
  return gizmo;
}
