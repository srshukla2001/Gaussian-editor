# 🌌 3D Scene Editor

A powerful **web-based 3D scene editor** built with **Three.js** and **Gaussian Splatting** technology for creating interactive 3D experiences with splat scenes, GLB models, and custom primitives.

---

## 🚀 Features
- **3D Scene Editing**: Visual editor with transform gizmos  
- **Gaussian Splatting**: High-quality point cloud rendering  
- **GLB Model Support**: Import and manipulate 3D models  
- **Tooltip System**: Interactive information displays  
- **Camera Control API**: Programmatic camera manipulation  
- **Export Functionality**: Save and deploy scenes  
- **Real-time Preview**: Instant visual feedback  

---

## 📁 Project Structure
project/
├── index.html # Main application
├── main-app.js # Primary application logic
├── export.js # Scene export functionality
├── api/
│ ├── camera.js # Camera control API
│ └── tooltip.js # Tooltip management API
├── lib/ # Third-party libraries
└── assets/ # Model and resource files



---

## 🎮 Camera API
The **Camera API** provides programmatic control over the scene camera with smooth animations and precise positioning.

### Available Functions

| Function        | Parameters | Description | Returns |
|-----------------|------------|-------------|---------|
| `setCamera(position, lookAt, up)` | `position: Array/Vector3`, `lookAt: Array/Vector3 (optional)`, `up: Array/Vector3 (optional)` | Set camera position and orientation | `boolean` |
| `getCameraState()` | - | Get current camera position and rotation | `Object` |
| `resetCamera()` | - | Reset camera to initial position | `boolean` |
| `moveCamera(offset)` | `offset: Array/Vector3` | Move camera by relative offset | `boolean` |
| `lookAt(target)` | `target: Array/Vector3` | Set camera to look at specific point | `boolean` |
| `animateTo(targetPosition, targetLookAt, duration, easing, onComplete)` | `targetPosition: Array/Vector3`, `targetLookAt: Array/Vector3`, `duration: number (ms)`, `easing: string`, `onComplete: function` | Animate camera to position | `string (animation ID)` |
| `orbitAround(center, radius, startAngle, endAngle, duration, easing)` | `center: Array/Vector3`, `radius: number`, `startAngle: number (rad)`, `endAngle: number (rad)`, `duration: number (ms)`, `easing: string` | Orbit around a point | `-` |
| `moveAlongPath(points, pointDuration, easing)` | `points: Array of points`, `pointDuration: number (ms)`, `easing: string` | Move camera along path | `-` |
| `stopAnimation()` | - | Stop ongoing camera animation | `-` |

### Easing Functions
- `linear`
- `easeInQuad`, `easeOutQuad`, `easeInOutQuad`
- `easeInCubic`, `easeOutCubic`, `easeInOutCubic`

### Usage Examples
```javascript
// Set camera to specific position
setCamera([5, 3, 8], [0, 1, 0]);

// Animate camera smoothly
animateTo([2, 4, 6], [1, 2, 3], 2000, 'easeInOutQuad');

// Orbit around an object
orbitAround([0, 1, 0], 10, 0, Math.PI * 2, 5000);

// Get current camera state
const cameraState = getCameraState();
console.log('Camera position:', cameraState.position);
```
💬 Tooltip API

The Tooltip API manages interactive information displays for 3D objects with various trigger modes.
| Function                            | Parameters                     | Description                       | Returns                 |
| ----------------------------------- | ------------------------------ | --------------------------------- | ----------------------- |
| `hideTooltip(modelName)`            | `modelName: string`            | Hide tooltip for specific model   | `boolean`               |
| `showTooltip(modelName)`            | `modelName: string`            | Show tooltip for specific model   | `boolean`               |
| `toggleTooltip(modelName)`          | `modelName: string`            | Toggle tooltip visibility         | `boolean (new state)`   |
| `hideAllTooltips()`                 | -                              | Hide all tooltips                 | `number (count hidden)` |
| `showAllTooltips()`                 | -                              | Show all tooltips                 | `number (count shown)`  |
| `releaseTooltipOverride(modelName)` | `modelName: string (optional)` | Release API control over tooltips | `boolean or number`     |
| `getTooltipVisibility(modelName)`   | `modelName: string`            | Get tooltip visibility state      | `boolean or null`       |
| `listTooltips()`                    | -                              | List all tooltips with status     | `Array`                 |


Tooltip Trigger Modes

onhover: Show when mouse hovers over object

onclick: Show when object is clicked (toggle)

always: Always visible (can be overridden by API)
```javascript
// Hide specific tooltip
hideTooltip('Box');

// Show tooltip regardless of trigger setting
showTooltip('Chair_01');

// Toggle tooltip visibility
toggleTooltip('Table');

// Get all tooltip statuses
const allTooltips = listTooltips();
allTooltips.forEach(tooltip => {
    console.log(`${tooltip.name}: ${tooltip.visible ? 'Visible' : 'Hidden'}`);
});
```
### 🎨 Editor Interface
Sidebar Controls

- `Model Management`: Add, remove, and configure 3D objects

- `Tooltip Settings`: Configure name, description, button text, and triggers

- `Group Management`: Organize objects into groups for collective manipulation

- `Export Tools`: Generate deployable scenes

### 3D Editor Features

- Transform Gizmo: Move, rotate, and scale objects visually

- Real-time Preview: Instant visual feedback for all changes

- Object Selection: Click to select and manipulate objects

- Camera Controls: Orbital navigation with mouse/touch

### 📤 Export System
Export Process

- Scene Configuration: Set up models, tooltips, and camera positions

- Validation: Automatic check for missing assets or configurations

- Export Generation: Creates standalone HTML file with all dependencies

- Asset Packaging: Bundles all required models and resources

Exported Structure
export/
├── index.html              # Standalone viewer
├── scene.json              # Scene configuration
├── assets/                 # Model files and resources
├── lib/                    # Required libraries
└── api/                    # Camera and Tooltip APIs

Export Options

Full Scene: Complete scene with all models and configurations

Compressed: Optimized version for web deployment

Development: Full source with debug capabilities