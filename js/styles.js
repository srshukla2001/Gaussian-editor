export const styleTag = document.createElement('style');
styleTag.innerHTML = `
  :root {
    --sidebar-w: 280px;
    --bg: #1e1e1e;
    --panel: #252526;
    --header-bg: #2d2d30;
    --muted: #969696;
    --accent: #0078d4;
    --accent-hover: #1b8bf9;
    --danger: #f44747;
    --glass: rgba(255,255,255,0.05);
    --border: #3e3e42;
    --section-header: #37373d;
  }

  body { 
    margin: 0; 
    font-family: "Segoe UI", Roboto, system-ui, -apple-system; 
    background: #000; 
    color: #cccccc;
    font-size: 13px;
  }

  .hp-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--sidebar-w);
    height: 100%;
    background: var(--panel);
    color: #cccccc;
    box-shadow: 2px 0 12px rgba(0,0,0,0.8);
    padding: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    z-index: 30;
    border-right: 1px solid var(--border);
  }

  .hp-header { 
    background: var(--header-bg);
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }

  .hp-title { 
    font-weight: 600; 
    font-size: 15px; 
    color: #ffffff;
    letter-spacing: 0.3px;
  }

  .hp-sub { 
    color: var(--muted); 
    font-size: 11px; 
    margin-top: 2px;
  }

  .hp-content {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hp-controls { 
    display: flex; 
    gap: 6px; 
  }

  .hp-btn {
    background: var(--glass);
    border: 1px solid var(--border);
    color: inherit;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.1s ease;
    white-space: nowrap;
  }

  .hp-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .hp-btn.primary { 
    background: var(--accent); 
    color: #ffffff; 
    font-weight: 500;
    border-color: var(--accent);
  }

  .hp-btn.primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .hp-section { 
    max-height: 350px;
    min-height: 110px;
    background: var(--header-bg); 
    border-radius: 6px; 
    border: 1px solid var(--border);
    overflow: auto;
  }

  .hp-section-header {
    background: var(--section-header);
    padding: 10px 12px;
    font-weight: 600;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }

  .hp-section-content {
    padding: 12px;
  }

  .hp-list { 
    overflow: auto; 
    display: flex; 
    flex-direction: column; 
    gap: 4px; 
  }

  .model-item {
    display: flex; 
    flex-direction: column;
    align-items: center; 
    justify-content: space-between;
    gap: 8px; 
    padding: 6px 8px; 
    border-radius: 4px; 
    cursor: pointer;
    background: transparent;
    font-size: 12px;
    transition: background 0.1s ease;
  }

  .model-item:hover { 
    background: rgba(255,255,255,0.05); 
  }

  .model-item.selected {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .model-item .name { 
    color: #ffffffff; 
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .model-item .actions { 
    display: flex; 
    gap: 4px; 
  }

  .small-btn { 
    padding: 4px 6px; 
    border-radius: 3px; 
    font-size: 11px; 
    border: none; 
    cursor: pointer; 
    background: transparent; 
    color: var(--muted); 
    transition: all 0.1s ease;
  }

  .small-btn:hover { 
    background: rgba(255,255,255,0.08); 
  }

  .small-btn.danger { 
    color: var(--danger); 
  }

  .small-btn.danger:hover {
    background: rgba(244, 71, 71, 0.15);
  }

  .hp-footer { 
    padding: 12px 16px;
    background: var(--header-bg);
    border-top: 1px solid var(--border);
    display: flex; 
    gap: 8px; 
  }

  .file-input { 
    display: none; 
  }

  .help-text {
    margin-top: 6px; 
    font-size: 11px; 
    color: var(--muted);
    line-height: 1.4;
  }

  .selected-info {
    font-size: 12px; 
    color: var(--muted);
    margin-bottom: 12px;
  }

  .transform-section {
    margin-top: 12px;
  }

  .transform-label {
    font-size: 11px; 
    color: var(--muted); 
    margin-bottom: 6px;
  }

  .transform-grid {
    display: grid; 
    grid-template-columns: auto 1fr; 
    gap: 6px; 
    font-size: 12px;
  }

  .transform-values {
    color: #cccccc;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 10px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 5px;
    border: 2px solid var(--panel);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #4a4a4a;
  }

  /* Tooltip styling */
  .hp-tooltip {
    position: absolute;
    background: rgba(30, 30, 30, 0.95);
    color: #fff;
    padding: 10px 12px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    transform: translate(-50%, -100%);
    z-index: 60;
    min-width: 180px;
    border: 1px solid var(--border);
  }

  .hp-tooltip h4 { 
    margin: 0 0 6px 0; 
    font-size: 13px; 
    color: #ffffff;
  }

  .hp-tooltip p { 
    margin: 0 0 8px 0; 
    font-size: 12px; 
    color: var(--muted); 
  }

  .hp-tooltip button { 
    border-radius: 4px; 
    padding: 6px 8px; 
    border: none; 
    cursor: pointer; 
    background: var(--accent); 
    color: #ffffff; 
    font-weight: 500; 
    font-size: 12px;
  }

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

  /* Transform controls */
  .transform-controls {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    background: var(--panel);
    padding: 8px;
    border-radius: 6px;
    z-index: 40;
    border: 1px solid var(--border);
  }

  .transform-btn {
    background: var(--glass);
    border: 1px solid var(--border);
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.1s ease;
  }

  .transform-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .transform-btn.active {
    background: var(--accent);
    color: #ffffff;
    font-weight: 500;
    border-color: var(--accent);
  }
    .group-item {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-item:hover {
  background-color: var(--bg-secondary);
}

.group-item .name {
  font-weight: 500;
  margin-bottom: 2px;
}
    #transformHistory {
    max-height: 100px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 8px;
    background: var(--bg-secondary);
    font-size: 11px;
  }
  
  #transformHistory div {
    margin-bottom: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-light);
  }
  
  #transformHistory div:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .hp-bottombar {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 20px;
    background: var(--header-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--muted);
  }
`;
