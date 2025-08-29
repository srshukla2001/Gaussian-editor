// api/api.js

// Import camera API
import './camera.js';

// Export all camera API functions
export const CameraAPI = window.CameraAPI || {};

// Individual function exports
export const setCamera = CameraAPI.setCamera || function() {
    console.warn('CameraAPI not available');
    return false;
};

export const getCameraState = CameraAPI.getCameraState || function() {
    console.warn('CameraAPI not available');
    return null;
};

export const resetCamera = CameraAPI.resetCamera || function() {
    console.warn('CameraAPI not available');
    return false;
};

export const moveCamera = CameraAPI.moveCamera || function() {
    console.warn('CameraAPI not available');
    return false;
};

export const lookAt = CameraAPI.lookAt || function() {
    console.warn('CameraAPI not available');
    return false;
};

export const animateCameraTo = CameraAPI.animateTo || function() {
    console.warn('CameraAPI not available');
    return false;
};

export const orbitCamera = CameraAPI.orbitAround || function() {
    console.warn('CameraAPI not available');
    return false;
};

export const moveCameraAlongPath = CameraAPI.moveAlongPath || function() {
    console.warn('CameraAPI not available');
    return false;
};

export const stopCameraAnimation = CameraAPI.stopAnimation || function() {
    console.warn('CameraAPI not available');
    return false;
};

// Initialize function
export const initCameraAPI = function(viewerInstance) {
    if (CameraAPI.init) {
        CameraAPI.init(viewerInstance);
        return true;
    }
    console.warn('CameraAPI.init not available');
    return false;
};

// Make sure the API is available globally for console debugging
window.CameraAPI = CameraAPI;
window.setCamera = setCamera;
window.getCameraState = getCameraState;
window.resetCamera = resetCamera;
window.moveCamera = moveCamera;
window.lookAt = lookAt;
window.animateCameraTo = animateCameraTo;
window.orbitCamera = orbitCamera;
window.moveCameraAlongPath = moveCameraAlongPath;
window.stopCameraAnimation = stopCameraAnimation;

console.log('API module loaded. Camera functions available globally for debugging.');