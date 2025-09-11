export const sidebar = document.createElement('aside');
sidebar.className = 'hp-sidebar';
sidebar.innerHTML = `
  <div class="hp-header">
    <div>
      <div class="hp-title">Gaussian 3D Editor</div>
      <div class="hp-sub">Scene editor • Bonsai</div>
    </div>
  </div>

  <div class="hp-content">
    <div class="hp-section">
      <div class="hp-section-header">
        <span>Scene</span>
      </div>
      <div class="hp-section-content">
        <div class="hp-controls">
          <button id="addSelectableBtn" class="hp-btn">Add Cube</button>
          <button id="exportBtnSidebar" class="hp-btn primary">Export</button>
        </div>
        <div class="help-text">
          Click objects to select. Dragging is available via gizmo.
        </div>
      </div>
    </div>

    <div class="hp-section" id="modelsSection">
      <div class="hp-section-header">
        <span>Models</span>
      </div>
      <div class="hp-section-content">
        <div class="hp-list" id="modelsList"></div>
      </div>
    </div>

    <div class="hp-section">
      <div class="hp-section-header">
        <span>Import</span>
      </div>
      <div class="hp-section-content">
        <div class="hp-controls">
          <label class="hp-btn" style="margin-left:0;">
            <input id="glbFileInput" class="file-input" type="file" accept=".glb" />
            Load GLB
          </label>
        </div>
        <div class="help-text">Supported: .glb</div>
      </div>
    </div>

    <div class="hp-section">
      <div class="hp-section-header">
        <span>Selected Object</span>
      </div>
      <div class="hp-section-content">
        <div id="selectedInfo" class="selected-info">None</div>
         <div class="section-header">
    <h3>Groups</h3>
  </div>
  <div id="groupsList" class="section-content"></div>
        <!-- Transform controls -->
        <div class="transform-section">
          <div class="transform-label">Transform</div>
          <div class="transform-grid">
            <div>Position:</div>
            <div class="transform-values">X: 0.00, Y: 0.00, Z: 0.00</div>
            <div>Rotation:</div>
            <div class="transform-values">X: 0°, Y: 0°, Z: 0°</div>
            <div>Scale:</div>
            <div class="transform-values">X: 1.00, Y: 1.00, Z: 1.00</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="hp-footer">
    <button id="centerCameraBtn" class="hp-btn">Center Camera</button>
    <button id="resetSceneBtn" class="hp-btn">Reset</button>
  </div>
`;
export const BottomBar = document.createElement('div');
BottomBar.className = 'hp-bottombar';
BottomBar.innerHTML = `
  <div class="hp-header2">
  hello
    <div>
    `;