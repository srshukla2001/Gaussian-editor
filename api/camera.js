/* **Example Usage**


***************Basic Camera Controls****************

1) setCamera([5, 5, 5], [0, 0, 0]); // Position at [5,5,5], look at origin
2) setCamera(new THREE.Vector3(2, 3, 4)); // Just set position
3) resetCamera(); // Reset to initial position
4) moveCamera([1, 0, 0]); // Move right by 1 unit
5) lookAt([0, 1, 0]); // Look at specific point
6) getCameraState(); // Get current camera state


**************Camera Animation:****************

1) animateCameraTo([5, 3, 8], [0, 1, 0], 3000, 'easeInOutCubic'); // Animate to specific position and look at point
2) orbitCamera([0, 1, 0], 10, 0, Math.PI * 2, 5000); // Orbit around a point
const path = [
    [0, 2, 10],
    [5, 3, 8],
    [8, 4, 5],
    [3, 2, 3]
];
3) moveCameraAlongPath(path, 1500); // Move along a path
4) stopCameraAnimation(); // Stop animation
5) const state = getCameraState(); // Get current state
console.log('Camera state:', state);


*/
import * as THREE from '../lib/three.module.js';
// Camera control functions
const CameraAPI = {
    /**
     * Set camera position and lookAt target
     * @param {number[]|THREE.Vector3} position - Camera position [x, y, z] or THREE.Vector3
     * @param {number[]|THREE.Vector3} [lookAt] - Target position to look at [x, y, z] or THREE.Vector3
     * @param {number[]|THREE.Vector3} [up] - Camera up direction [x, y, z] or THREE.Vector3 (default: [0, -1, 0])
     */
    setCamera: function (position, lookAt, up) {
        const viewer = this._getViewer();
        if (!viewer) return false;

        const camera = viewer.camera;

        // Set position
        if (Array.isArray(position)) {
            camera.position.set(position[0], position[1], position[2]);
        } else if (position instanceof THREE.Vector3) {
            camera.position.copy(position);
        } else {
            console.error('Invalid position parameter. Use array [x, y, z] or THREE.Vector3.');
            return false;
        }

        // Set lookAt target if provided
        if (lookAt) {
            let target;
            if (Array.isArray(lookAt)) {
                target = new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]);
            } else if (lookAt instanceof THREE.Vector3) {
                target = lookAt.clone();
            } else {
                console.error('Invalid lookAt parameter. Use array [x, y, z] or THREE.Vector3.');
                return false;
            }
            camera.lookAt(target);
        }

        // Set up direction if provided
        if (up) {
            if (Array.isArray(up)) {
                camera.up.set(up[0], up[1], up[2]);
            } else if (up instanceof THREE.Vector3) {
                camera.up.copy(up);
            } else {
                console.error('Invalid up parameter. Use array [x, y, z] or THREE.Vector3.');
                return false;
            }
        }

        console.log('Camera set to:', camera.position.toArray(), 'looking at:', lookAt);
        return true;
    },

    /**
     * Get current camera position and rotation
     * @returns {Object} Camera state with position and rotation
     */
    getCameraState: function () {
        const viewer = this._getViewer();
        if (!viewer) return null;

        const camera = viewer.camera;
        return {
            position: camera.position.toArray(),
            rotation: camera.rotation.toArray(),
            up: camera.up.toArray(),
            quaternion: camera.quaternion.toArray()
        };
    },

    /**
     * Reset camera to initial position
     */
    resetCamera: function () {
        const initialPosition = [1.54163, 2.68515, -6.37228];
        const initialLookAt = [0.45622, 1.95338, 1.51278];
        const initialUp = [0, -1, 0];

        return this.setCamera(initialPosition, initialLookAt, initialUp);
    },

    /**
     * Move camera by relative offset
     * @param {number[]|THREE.Vector3} offset - Relative movement [x, y, z] or THREE.Vector3
     */
    moveCamera: function (offset) {
        const viewer = this._getViewer();
        if (!viewer) return false;

        const camera = viewer.camera;

        if (Array.isArray(offset)) {
            camera.position.x += offset[0];
            camera.position.y += offset[1];
            camera.position.z += offset[2];
        } else if (offset instanceof THREE.Vector3) {
            camera.position.add(offset);
        } else {
            console.error('Invalid offset parameter. Use array [x, y, z] or THREE.Vector3.');
            return false;
        }

        console.log('Camera moved to:', camera.position.toArray());
        return true;
    },

    /**
     * Set camera to look at a specific point
     * @param {number[]|THREE.Vector3} target - Target position [x, y, z] or THREE.Vector3
     */
    lookAt: function (target) {
        const viewer = this._getViewer();
        if (!viewer) return false;

        const camera = viewer.camera;
        let targetVector;

        if (Array.isArray(target)) {
            targetVector = new THREE.Vector3(target[0], target[1], target[2]);
        } else if (target instanceof THREE.Vector3) {
            targetVector = target.clone();
        } else {
            console.error('Invalid target parameter. Use array [x, y, z] or THREE.Vector3.');
            return false;
        }

        camera.lookAt(targetVector);
        console.log('Camera now looking at:', targetVector.toArray());
        return true;
    },

    /**
     * Internal method to get viewer instance
     * @private
     */
    _getViewer: function () {
        // Try multiple ways to access the viewer
        if (window.viewer) {
            return window.viewer;
        } else if (window.app && window.app.viewer) {
            return window.app.viewer;
        } else {
            console.error('Viewer not found. Make sure the viewer is initialized and available globally.');
            return null;
        }
    },



    animateTo: function (targetPosition, targetLookAt, duration = 2000, easing = 'easeInOutQuad', onComplete = null) {
        const viewer = this._getViewer();
        if (!viewer) return false;

        // Cancel any ongoing animation
        this._stopAnimation();

        const camera = viewer.camera;
        const startPosition = camera.position.clone();
        const startQuaternion = camera.quaternion.clone();

        // Convert target parameters to Vector3
        const endPosition = Array.isArray(targetPosition) ?
            new THREE.Vector3(targetPosition[0], targetPosition[1], targetPosition[2]) :
            targetPosition.clone();

        const endLookAt = Array.isArray(targetLookAt) ?
            new THREE.Vector3(targetLookAt[0], targetLookAt[1], targetLookAt[2]) :
            targetLookAt.clone();

        // Calculate target rotation
        const tempCamera = camera.clone();
        tempCamera.position.copy(endPosition);
        tempCamera.lookAt(endLookAt);
        const endQuaternion = tempCamera.quaternion.clone();

        let startTime = null;
        const animationId = `camera_anim_${Date.now()}`;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Apply easing
            const easedProgress = this._easingFunctions[easing](progress);

            // Interpolate position
            camera.position.lerpVectors(startPosition, endPosition, easedProgress);

            // Interpolate rotation using slerp for smooth rotation
            camera.quaternion.slerpQuaternions(startQuaternion, endQuaternion, easedProgress);

            if (progress < 1) {
                this._currentAnimation = requestAnimationFrame(animate);
            } else {
                // Animation complete
                camera.position.copy(endPosition);
                camera.quaternion.copy(endQuaternion);
                this._currentAnimation = null;
                console.log('Camera animation completed');
                if (onComplete) onComplete();
            }
        };

        this._currentAnimation = requestAnimationFrame(animate);
        return animationId;
    },

    /**
     * Orbit around a target point
     * @param {number[]|THREE.Vector3} center - Center point to orbit around
     * @param {number} radius - Orbit radius
     * @param {number} startAngle - Starting angle in radians
     * @param {number} endAngle - Ending angle in radians
     * @param {number} duration - Animation duration in milliseconds
     * @param {string} easing - Easing function name
     */
    orbitAround: function (center, radius, startAngle, endAngle, duration = 3000, easing = 'easeInOutQuad') {
        const centerPoint = Array.isArray(center) ?
            new THREE.Vector3(center[0], center[1], center[2]) :
            center.clone();

        const angleDiff = endAngle - startAngle;
        let startTime = null;

        const animateOrbit = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easedProgress = this._easingFunctions[easing](progress);
            const currentAngle = startAngle + (angleDiff * easedProgress);

            // Calculate position on circle
            const x = centerPoint.x + radius * Math.cos(currentAngle);
            const z = centerPoint.z + radius * Math.sin(currentAngle);

            this.setCamera([x, centerPoint.y, z], centerPoint.toArray());

            if (progress < 1) {
                this._currentAnimation = requestAnimationFrame(animateOrbit);
            } else {
                this._currentAnimation = null;
            }
        };

        this._currentAnimation = requestAnimationFrame(animateOrbit);
    },

    /**
     * Move camera along a path of points
     * @param {Array} points - Array of points [[x1,y1,z1], [x2,y2,z2], ...]
     * @param {number} pointDuration - Duration per point in milliseconds
     * @param {string} easing - Easing function name
     */
    moveAlongPath: function (points, pointDuration = 1000, easing = 'easeInOutQuad') {
        if (points.length < 2) {
            console.error('Path needs at least 2 points');
            return;
        }

        let currentPointIndex = 0;

        const moveToNextPoint = () => {
            if (currentPointIndex >= points.length - 1) {
                console.log('Path animation completed');
                return;
            }

            const startPoint = points[currentPointIndex];
            const endPoint = points[currentPointIndex + 1];

            this.animateTo(endPoint, [0, 0, 0], pointDuration, easing, () => {
                currentPointIndex++;
                moveToNextPoint();
            });
        };

        this.setCamera(points[0], [0, 0, 0]);
        setTimeout(moveToNextPoint, 100);
    },

    /**
     * Stop any ongoing camera animation
     */
    stopAnimation: function () {
        this._stopAnimation();
        console.log('Camera animation stopped');
    },

    /**
     * Internal method to stop animation
     * @private
     */
    _stopAnimation: function () {
        if (this._currentAnimation) {
            cancelAnimationFrame(this._currentAnimation);
            this._currentAnimation = null;
        }
    },

    /**
     * Easing functions
     * @private
     */
    _easingFunctions: {
        linear: t => t,
        easeInQuad: t => t * t,
        easeOutQuad: t => t * (2 - t),
        easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: t => t * t * t,
        easeOutCubic: t => (--t) * t * t + 1,
        easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
    },

    _currentAnimation: null,
/**
 * Initialize camera API (call this after viewer is created)
 * @param {Object} viewerInstance - The viewer instance
 */
init: function(viewerInstance) {
    window.viewer = viewerInstance;
    console.log('Camera API initialized with viewer instance');
}
};



// Make functions available globally
window.CameraAPI = CameraAPI;

window.setCamera = CameraAPI.setCamera.bind(CameraAPI);
window.getCameraState = CameraAPI.getCameraState.bind(CameraAPI);
window.resetCamera = CameraAPI.resetCamera.bind(CameraAPI);
window.moveCamera = CameraAPI.moveCamera.bind(CameraAPI);
window.lookAt = CameraAPI.lookAt.bind(CameraAPI);
window.animateCameraTo = CameraAPI.animateTo.bind(CameraAPI);
window.orbitCamera = CameraAPI.orbitAround.bind(CameraAPI);
window.moveCameraAlongPath = CameraAPI.moveAlongPath.bind(CameraAPI);
window.stopCameraAnimation = CameraAPI.stopAnimation.bind(CameraAPI);

console.log('Camera API loaded with animation functions');
console.log('Available functions: setCamera, getCameraState, resetCamera, moveCamera, lookAt,');
console.log('animateCameraTo, orbitCamera, moveCameraAlongPath, stopCameraAnimation');