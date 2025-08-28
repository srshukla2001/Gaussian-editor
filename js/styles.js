export const styleTag = document.createElement('style');
styleTag.innerHTML = `
  :root {
    --sidebar-w: 260px;
    --bg: #111214;
    --panel: #15161a;
    --muted: #9aa0a6;
    --accent: #7bd389;
    --glass: rgba(255,255,255,0.03);
  }
  body { margin: 0; font-family: Inter, Roboto, system-ui, -apple-system; background: #000; }
  .hp-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--sidebar-w);
    height: 100%;
    background: linear-gradient(180deg, var(--panel), #0f1113);
    color: #e6eef4;
    box-shadow: 2px 0 18px rgba(0,0,0,0.7);
    padding: 14px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 30;
  }
  .hp-header { display:flex; align-items:center; gap:10px; }
  .hp-title { font-weight:600; font-size:16px; }
  .hp-sub { color: var(--muted); font-size:12px; }
  .hp-controls { display:flex; gap:8px; }
  .hp-btn {
    background: var(--glass);
    border: 1px solid rgba(255,255,255,0.04);
    color: inherit;
    padding:8px 10px;
    border-radius:8px;
    cursor:pointer;
    font-size:13px;
  }
  .hp-btn.primary { background: linear-gradient(90deg,var(--accent), #6dd3b2); color: #05120b; font-weight:600; }
  .hp-section { background: rgba(255,255,255,0.02); border-radius:10px; padding:10px; }
  .hp-list { max-height: 320px; overflow:auto; display:flex; flex-direction:column; gap:8px; margin-top:8px; }
  .model-item {
    display:flex; align-items:center; justify-content:space-between;
    gap:8px; padding:8px; border-radius:8px; cursor:pointer;
    background: transparent;
  }
  .model-item:hover { background: rgba(255,255,255,0.02); }
  .model-item .name { font-size:13px; color:#e6eef4; }
  .model-item .actions { display:flex; gap:6px; }
  .small-btn { padding:6px 8px; border-radius:7px; font-size:12px; border: none; cursor:pointer; background: rgba(255,255,255,0.02); color: var(--muted); }
  .small-btn.danger { color: #ff8b8b; }
  .hp-footer { margin-top:auto; display:flex; gap:8px; }
  .file-input { display:none; }
  .hp-tooltip {
    position: absolute;
    pointer-events: auto;
    background: rgba(10,11,12,0.9);
    color: #fff;
    padding: 10px 12px;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.6);
    transform: translate(-50%, -100%);
    z-index: 60;
    min-width: 180px;
  }
  .hp-tooltip h4 { margin:0 0 6px 0; font-size:13px; }
  .hp-tooltip p { margin:0 0 8px 0; font-size:12px; color:var(--muted); }
  .hp-tooltip button { border-radius:6px; padding:6px 8px; border: none; cursor:pointer; background: var(--accent); color:#052018; font-weight:600; }
  .tooltip-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }
  .tooltip-toggle input[type="checkbox"] {
    margin: 0;
  }
  .transform-controls {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    background: var(--panel);
    padding: 10px;
    border-radius: 8px;
    z-index: 40;
  }
  .transform-btn {
    background: var(--glass);
    border: 1px solid rgba(255,255,255,0.1);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }
  .transform-btn.active {
    background: var(--accent);
    color: #052018;
    font-weight: 600;
  }
`;
