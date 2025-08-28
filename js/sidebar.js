export const sidebar = document.createElement('aside');
sidebar.className = 'hp-sidebar';
sidebar.innerHTML = `
  <div class="hp-header">
    <div>
      <div class="hp-title">Gaussian 3D Editor</div>
      <div class="hp-sub">Scene editor • Bonsai</div>
    </div>
  </div>

  <div class="hp-section">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-weight:600">Scene</div>
      <div class="hp-controls">
        <button id="addSelectableBtn" class="hp-btn">Add Cube</button>
        <button id="exportBtnSidebar" class="hp-btn primary">Export</button>
      </div>
    </div>
    <div style="margin-top:8px; font-size:12px; color:var(--muted);">
      Click objects to select. Dragging is available via gizmo.
    </div>
  </div>

  <div class="hp-section" id="modelsSection">
    <div style="font-weight:600">Models</div>
    <div class="hp-list" id="modelsList"></div>
  </div>

  <div class="hp-section">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-weight:600">Import</div>
      <label class="hp-btn" style="margin-left:8px;">
        <input id="glbFileInput" class="file-input" type="file" accept=".glb" />
        Load GLB
      </label>
    </div>
    <div style="margin-top:8px; font-size:12px; color:var(--muted);">Supported: .glb</div>
  </div>

  <div class='hp-section'>
    <div style="font-weight:600">Selected</div>
    <div id="selectedInfo" style="margin-top:8px; font-size:13px; color:var(--muted)">None</div>
  </div>

  <div class="hp-footer">
    <button id="centerCameraBtn" class="hp-btn">Center Camera</button>
    <button id="resetSceneBtn" class="hp-btn">Reset</button>
  </div>
`;
