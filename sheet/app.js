(() => {
  'use strict';

  const ROWS = 100;
  const COLS = 26;
  const STORAGE_KEY = 'canvas-sheet-v1';
  const grid = document.querySelector('#sheet-grid');
  const scrollArea = document.querySelector('#sheet-scroll');
  const formulaInput = document.querySelector('#formula-input');
  const referenceLabel = document.querySelector('#cell-reference');
  const summary = document.querySelector('#selection-summary');
  const titleInput = document.querySelector('#document-title');
  const saveStatus = document.querySelector('#save-status');
  const toast = document.querySelector('#toast');
  const undoButton = document.querySelector('#undo');
  const redoButton = document.querySelector('#redo');
  const boldButton = document.querySelector('#bold');
  const italicButton = document.querySelector('#italic');
  const alignSelect = document.querySelector('#align');
  const headerToggle = document.querySelector('#header-toggle');
  const columnMenu = document.querySelector('#column-menu');
  const columnMenuTitle = document.querySelector('#column-menu-title');
  const filterSearch = document.querySelector('#filter-search');
  const filterValues = document.querySelector('#filter-values');
  const filterCount = document.querySelector('#filter-count');
  const sheetView = document.querySelector('#sheet-view');
  const pivotView = document.querySelector('#pivot-view');
  const sheetTabButton = document.querySelector('#sheet-tab');
  const pivotTabButton = document.querySelector('#pivot-tab');
  const pivotRowField = document.querySelector('#pivot-row-field');
  const pivotColumnField = document.querySelector('#pivot-column-field');
  const pivotValueField = document.querySelector('#pivot-value-field');
  const pivotFunction = document.querySelector('#pivot-function');
  const pivotTableWrap = document.querySelector('#pivot-table-wrap');
  const pivotTitle = document.querySelector('#pivot-title');
  const pivotSourceCount = document.querySelector('#pivot-source-count');
  const pivotHeaderNote = document.querySelector('#pivot-header-note');
  const sheetFooter = document.querySelector('.sheet-footer');
  const chartView = document.querySelector('#chart-view');
  const chartTabButton = document.querySelector('#chart-tab');
  const chartObjectField = document.querySelector('#chart-object-field');
  const chartDataOptions = document.querySelector('#chart-data-options');
  const chartTitle = document.querySelector('#chart-title');
  const chartSourceCount = document.querySelector('#chart-source-count');
  const chartLegend = document.querySelector('#chart-legend');
  const barChartWrap = document.querySelector('#bar-chart-wrap');
  const chartHeaderNote = document.querySelector('#chart-header-note');
  const lineView = document.querySelector('#line-view');
  const lineTabButton = document.querySelector('#line-tab');
  const lineObjectField = document.querySelector('#line-object-field');
  const lineDataOptions = document.querySelector('#line-data-options');
  const lineTitle = document.querySelector('#line-title');
  const lineSourceCount = document.querySelector('#line-source-count');
  const lineLegend = document.querySelector('#line-legend');
  const lineChartWrap = document.querySelector('#line-chart-wrap');
  const lineHeaderNote = document.querySelector('#line-header-note');
  const pieView = document.querySelector('#pie-view');
  const pieTabButton = document.querySelector('#pie-tab');
  const pieObjectField = document.querySelector('#pie-object-field');
  const pieDataOptions = document.querySelector('#pie-data-options');
  const pieTitle = document.querySelector('#pie-title');
  const pieSourceCount = document.querySelector('#pie-source-count');
  const pieLegend = document.querySelector('#pie-legend');
  const pieChartWrap = document.querySelector('#pie-chart-wrap');
  const pieHeaderNote = document.querySelector('#pie-header-note');
  const viewStage = document.querySelector('#view-stage');
  const splitViewButton = document.querySelector('#split-view-button');
  const splitViewButtonLabel = splitViewButton.querySelector('span');
  const splitViewMenu = document.querySelector('#split-view-menu');
  const splitLeftView = document.querySelector('#split-left-view');
  const splitRightView = document.querySelector('#split-right-view');
  const aboutButton = document.querySelector('#about-button');
  const aboutMenu = document.querySelector('#about-menu');
  const scenarioView = document.querySelector('#scenario-view');
  const scenarioTabButton = document.querySelector('#scenario-tab');
  const scenarioNameInput = document.querySelector('#scenario-name');
  const scenarioCellsInput = document.querySelector('#scenario-cells');
  const scenarioResultCellsInput = document.querySelector('#scenario-result-cells');
  const scenarioList = document.querySelector('#scenario-list');
  const scenarioComparison = document.querySelector('#scenario-comparison');
  const scenarioCount = document.querySelector('#scenario-count');
  const goalView = document.querySelector('#goal-view');
  const goalTabButton = document.querySelector('#goal-tab');
  const goalFormulaCell = document.querySelector('#goal-formula-cell');
  const goalTargetValue = document.querySelector('#goal-target-value');
  const goalChangingCell = document.querySelector('#goal-changing-cell');
  const goalStatus = document.querySelector('#goal-status');
  const viewElements = { sheet: sheetView, pivot: pivotView, chart: chartView, line: lineView, pie: pieView, scenario: scenarioView, goal: goalView };
  const viewButtons = { sheet: sheetTabButton, pivot: pivotTabButton, chart: chartTabButton, line: lineTabButton, pie: pieTabButton, scenario: scenarioTabButton, goal: goalTabButton };
  const viewLabels = { sheet: '工作表', pivot: '樞紐分析表', chart: '棒形圖', line: '折線圖', pie: '圓形圖', scenario: '情境管理員', goal: '目標搜尋' };

  const state = {
    cells: {},
    active: { row: 0, col: 0 },
    anchor: { row: 0, col: 0 },
    editing: false,
    dragging: false,
    hasHeader: false,
    filters: {},
    menuColumn: null,
    activeView: 'sheet',
    split: { enabled: false, left: 'sheet', right: 'chart' },
    pivot: { row: '', column: '', value: '', fn: 'sum' },
    chart: { object: '', values: [], layout: 'grouped', initialized: false },
    line: { object: '', values: [], initialized: false },
    pie: { object: '', values: [], initialized: false },
    scenarios: [],
    goal: { formula: '', target: '', changing: '', result: null },
    history: [],
    future: [],
    saveTimer: null,
    toastTimer: null
  };

  const SAMPLE_DATASETS = {
    pivot: {
      label: '樞紐分析表',
      rows: [
        ['地區', '產品', '銷售渠道', '季度', '數量', '收入'],
        ['北區', '手提電腦', '網上', '第一季', 12, 14400],
        ['北區', '顯示器', '零售', '第一季', 20, 5200],
        ['南區', '手提電腦', '零售', '第一季', 9, 10800],
        ['南區', '鍵盤', '網上', '第一季', 35, 2450],
        ['東區', '顯示器', '網上', '第一季', 18, 4680],
        ['西區', '手提電腦', '零售', '第一季', 11, 13200],
        ['北區', '鍵盤', '網上', '第二季', 42, 2940],
        ['南區', '顯示器', '零售', '第二季', 24, 6240],
        ['東區', '手提電腦', '網上', '第二季', 15, 18000],
        ['東區', '鍵盤', '零售', '第二季', 30, 2100],
        ['西區', '顯示器', '網上', '第二季', 22, 5720],
        ['西區', '鍵盤', '零售', '第二季', 28, 1960],
        ['北區', '手提電腦', '零售', '第三季', 14, 16800],
        ['南區', '鍵盤', '網上', '第三季', 40, 2800],
        ['東區', '顯示器', '零售', '第三季', 26, 6760],
        ['西區', '手提電腦', '網上', '第三季', 13, 15600]
      ]
    },
    bar: {
      label: '棒形圖',
      rows: [
        ['部門', '預算（千元）', '實際（千元）', '預測（千元）'],
        ['市場推廣', 180, 95, 240],
        ['銷售', 320, 410, 370],
        ['科技', 470, 260, 520],
        ['營運', 210, 330, 180],
        ['人力資源', 90, 145, 110],
        ['客戶支援', 150, 70, 205],
        ['研究及發展', 380, 540, 290],
        ['物流', 250, 190, 360]
      ]
    },
    line: {
      label: '折線圖',
      rows: [
        ['月份', '網上', '零售', '批發'],
        ['一月', 120, 210, 90], ['二月', 165, 185, 110], ['三月', 105, 230, 145],
        ['四月', 240, 160, 100], ['五月', 190, 205, 180], ['六月', 310, 135, 150],
        ['七月', 225, 175, 235], ['八月', 360, 120, 190], ['九月', 280, 260, 155],
        ['十月', 410, 205, 280], ['十一月', 330, 295, 220], ['十二月', 480, 250, 340]
      ]
    },
    pie: {
      label: '圓形圖',
      rows: [
        ['能源來源', '第一季佔比（%）', '第二季佔比（%）', '第三季佔比（%）', '第四季佔比（%）'],
        ['煤炭', 42, 35, 26, 18],
        ['天然氣', 28, 25, 22, 20],
        ['太陽能', 8, 16, 27, 34],
        ['風能', 12, 15, 18, 20],
        ['水力', 7, 6, 5, 5],
        ['其他', 3, 3, 2, 3]
      ]
    }
  };

  const keyOf = (row, col) => `${row}:${col}`;
  const colName = (col) => String.fromCharCode(65 + col);
  const addressOf = (row, col) => `${colName(col)}${row + 1}`;
  const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
  const getCellElement = (row, col) => grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  const getRecord = (row, col) => state.cells[keyOf(row, col)] || { value: '', bold: false, italic: false, align: 'left' };
  const dataStartRow = () => state.hasHeader ? 1 : 0;

  function createGrid() {
    const fragment = document.createDocumentFragment();
    const corner = document.createElement('div');
    corner.className = 'corner';
    corner.setAttribute('aria-hidden', 'true');
    fragment.append(corner);

    for (let col = 0; col < COLS; col += 1) {
      const header = document.createElement('div');
      header.className = 'column-header';
      header.dataset.colHeader = col;
      header.setAttribute('role', 'columnheader');
      const name = document.createElement('span');
      name.className = 'column-name';
      name.textContent = colName(col);
      const menuButton = document.createElement('button');
      menuButton.className = 'column-menu-trigger';
      menuButton.type = 'button';
      menuButton.dataset.colMenu = col;
      menuButton.setAttribute('aria-label', `排序或篩選 ${colName(col)} 欄`);
      menuButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>';
      header.append(name, menuButton);
      fragment.append(header);
    }

    for (let row = 0; row < ROWS; row += 1) {
      const header = document.createElement('div');
      header.className = 'row-header';
      header.dataset.rowHeader = row;
      header.textContent = String(row + 1);
      header.setAttribute('role', 'rowheader');
      fragment.append(header);

      for (let col = 0; col < COLS; col += 1) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.dataset.address = addressOf(row, col);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', addressOf(row, col));
        cell.tabIndex = -1;
        fragment.append(cell);
      }
    }

    grid.append(fragment);
  }

  function selectionBounds() {
    return {
      top: Math.min(state.anchor.row, state.active.row),
      bottom: Math.max(state.anchor.row, state.active.row),
      left: Math.min(state.anchor.col, state.active.col),
      right: Math.max(state.anchor.col, state.active.col)
    };
  }

  function parseAddress(address) {
    const match = /^([A-Z])([1-9]\d*)$/i.exec(address.trim());
    if (!match) return null;
    const col = match[1].toUpperCase().charCodeAt(0) - 65;
    const row = Number(match[2]) - 1;
    return row >= 0 && row < ROWS && col >= 0 && col < COLS ? { row, col } : null;
  }

  function scalarValue(row, col, trail = new Set()) {
    const record = getRecord(row, col);
    const raw = String(record.value ?? '');
    if (!raw.startsWith('=')) return numericOrText(raw);
    const id = keyOf(row, col);
    if (trail.has(id)) return '#CYCLE!';
    const nextTrail = new Set(trail);
    nextTrail.add(id);
    try {
      return evaluateFormula(raw.slice(1), nextTrail);
    } catch (error) {
      return error.message === '#CYCLE!' ? '#CYCLE!' : '#ERROR!';
    }
  }

  function numericOrText(value) {
    if (value === '') return '';
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }

  function evaluateFormula(expression, trail) {
    let source = expression.trim().toUpperCase();
    if (!source) return '';

    const functions = ['SUM', 'AVERAGE', 'AVG', 'MIN', 'MAX', 'COUNT'];
    let previous;
    do {
      previous = source;
      source = source.replace(/\b(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(([^()]*)\)/g, (_, name, args) => {
        const values = expandArguments(args, trail);
        const numbers = values.filter((value) => value !== '' && value !== null).map(Number).filter(Number.isFinite);
        let result = 0;
        if (name === 'SUM') result = numbers.reduce((sum, number) => sum + number, 0);
        if (name === 'AVERAGE' || name === 'AVG') result = numbers.length ? numbers.reduce((sum, number) => sum + number, 0) / numbers.length : 0;
        if (name === 'MIN') result = numbers.length ? Math.min(...numbers) : 0;
        if (name === 'MAX') result = numbers.length ? Math.max(...numbers) : 0;
        if (name === 'COUNT') result = numbers.length;
        return String(result);
      });
    } while (source !== previous && functions.some((name) => source.includes(`${name}(`)));

    source = source.replace(/\b([A-Z][1-9]\d*)\b/g, (address) => {
      const point = parseAddress(address);
      if (!point) throw new Error('#REF!');
      const value = scalarValue(point.row, point.col, trail);
      if (value === '#CYCLE!') throw new Error('#CYCLE!');
      const number = Number(value);
      return Number.isFinite(number) ? String(number) : '0';
    });

    if (!/^[\d\s+\-*/().%]+$/.test(source)) throw new Error('#ERROR!');
    // The character allow-list above limits this evaluator to numeric arithmetic.
    const result = Function(`"use strict"; return (${source})`)();
    if (!Number.isFinite(result)) throw new Error('#ERROR!');
    return Math.round((result + Number.EPSILON) * 1e10) / 1e10;
  }

  function expandArguments(args, trail) {
    const values = [];
    for (const part of args.split(',')) {
      const token = part.trim();
      const range = /^([A-Z][1-9]\d*):([A-Z][1-9]\d*)$/i.exec(token);
      if (range) {
        const start = parseAddress(range[1]);
        const end = parseAddress(range[2]);
        if (!start || !end) continue;
        for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
          for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col += 1) {
            values.push(scalarValue(row, col, trail));
          }
        }
      } else if (parseAddress(token)) {
        const point = parseAddress(token);
        values.push(scalarValue(point.row, point.col, trail));
      } else if (token !== '') {
        values.push(evaluateFormula(token, trail));
      }
    }
    return values;
  }

  function displayValue(row, col) {
    const value = scalarValue(row, col);
    return value === '' ? '' : String(value);
  }

  function renderAllCells() {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) renderCell(row, col);
    }
    renderDataView();
    renderVisibleAnalyses();
  }

  function rowHasContent(row) {
    for (let col = 0; col < COLS; col += 1) {
      if ((getRecord(row, col).value || '') !== '') return true;
    }
    return false;
  }

  function rowMatchesFilters(row) {
    return Object.entries(state.filters).every(([col, allowed]) => allowed.includes(displayValue(row, Number(col))));
  }

  function renderDataView() {
    for (let row = 0; row < ROWS; row += 1) {
      const isHeader = state.hasHeader && row === 0;
      const hidden = !isHeader && row >= dataStartRow() && !rowMatchesFilters(row);
      const rowHeader = grid.querySelector(`[data-row-header="${row}"]`);
      rowHeader.style.display = hidden ? 'none' : '';
      rowHeader.classList.toggle('sheet-header', isHeader);
      for (let col = 0; col < COLS; col += 1) {
        const cell = getCellElement(row, col);
        cell.style.display = hidden ? 'none' : '';
        cell.classList.toggle('sheet-header', isHeader);
      }
    }
    refreshColumnHeaders();
  }

  function refreshColumnHeaders() {
    for (let col = 0; col < COLS; col += 1) {
      const trigger = grid.querySelector(`[data-col-menu="${col}"]`);
      const filtered = Object.prototype.hasOwnProperty.call(state.filters, col);
      trigger.classList.toggle('filtered', filtered);
      trigger.setAttribute('aria-label', `${filtered ? '已套用篩選條件。' : ''}排序或篩選 ${colName(col)} 欄`);
    }
  }

  function renderCell(row, col) {
    const element = getCellElement(row, col);
    if (!element || (state.editing && row === state.active.row && col === state.active.col)) return;
    const record = getRecord(row, col);
    const displayed = displayValue(row, col);
    element.textContent = displayed;
    element.title = displayed;
    element.style.fontWeight = record.bold ? '700' : '';
    element.style.fontStyle = record.italic ? 'italic' : '';
    element.style.textAlign = record.align || 'left';
    element.classList.toggle('error', displayed.startsWith('#'));
  }

  function renderSelection({ scroll = false } = {}) {
    const bounds = selectionBounds();
    grid.querySelectorAll('.cell.active, .cell.in-range').forEach((cell) => cell.classList.remove('active', 'in-range'));
    grid.querySelectorAll('.column-header.selected, .row-header.selected').forEach((header) => header.classList.remove('selected'));

    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      for (let col = bounds.left; col <= bounds.right; col += 1) getCellElement(row, col)?.classList.add('in-range');
    }
    const activeElement = getCellElement(state.active.row, state.active.col);
    activeElement?.classList.add('active');
    grid.querySelector(`[data-col-header="${state.active.col}"]`)?.classList.add('selected');
    grid.querySelector(`[data-row-header="${state.active.row}"]`)?.classList.add('selected');

    referenceLabel.textContent = bounds.top === bounds.bottom && bounds.left === bounds.right
      ? addressOf(state.active.row, state.active.col)
      : `${addressOf(bounds.top, bounds.left)}:${addressOf(bounds.bottom, bounds.right)}`;
    formulaInput.value = getRecord(state.active.row, state.active.col).value || '';
    const cellCount = (bounds.bottom - bounds.top + 1) * (bounds.right - bounds.left + 1);
    summary.textContent = summarizeSelection(bounds, cellCount);
    updateToolbar();
    if (scroll) activeElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function summarizeSelection(bounds, cellCount) {
    const numbers = [];
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      for (let col = bounds.left; col <= bounds.right; col += 1) {
        const value = Number(scalarValue(row, col));
        if (Number.isFinite(value) && getRecord(row, col).value !== '') numbers.push(value);
      }
    }
    if (numbers.length > 1) return `${cellCount} 個儲存格 · 總和 ${formatNumber(numbers.reduce((a, b) => a + b, 0))} · 平均值 ${formatNumber(numbers.reduce((a, b) => a + b, 0) / numbers.length)}`;
    return `已選取 ${cellCount} 個儲存格`;
  }

  const formatNumber = (number) => new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 4 }).format(number);

  function setActive(row, col, extend = false, shouldScroll = true) {
    if (state.editing) finishEditing(true);
    state.active = { row: clamp(row, 0, ROWS - 1), col: clamp(col, 0, COLS - 1) };
    if (!extend) state.anchor = { ...state.active };
    renderSelection({ scroll: shouldScroll });
    scrollArea.focus({ preventScroll: true });
  }

  function snapshot() {
    return JSON.stringify(state.cells);
  }

  function recordHistory() {
    state.history.push(snapshot());
    if (state.history.length > 80) state.history.shift();
    state.future = [];
    updateHistoryButtons();
  }

  function applySnapshot(serialized) {
    state.cells = JSON.parse(serialized);
    renderAllCells();
    renderSelection();
    scheduleSave();
  }

  function undo() {
    if (!state.history.length) return;
    state.future.push(snapshot());
    applySnapshot(state.history.pop());
    updateHistoryButtons();
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(snapshot());
    applySnapshot(state.future.pop());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    undoButton.disabled = !state.history.length;
    redoButton.disabled = !state.future.length;
  }

  function setCellValue(row, col, value) {
    const key = keyOf(row, col);
    const old = getRecord(row, col);
    const clean = String(value).replace(/\r/g, '');
    if (!clean && !old.bold && !old.italic && old.align === 'left') delete state.cells[key];
    else state.cells[key] = { ...old, value: clean };
  }

  function beginEditing(initialText) {
    if (state.editing) return;
    state.editing = true;
    const cell = getCellElement(state.active.row, state.active.col);
    const raw = initialText === undefined ? getRecord(state.active.row, state.active.col).value || '' : initialText;
    cell.classList.add('editing');
    cell.contentEditable = 'plaintext-only';
    cell.textContent = raw;
    cell.focus();
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function finishEditing(commit, move = null) {
    if (!state.editing) return;
    const { row, col } = state.active;
    const cell = getCellElement(row, col);
    if (commit) {
      const next = cell.textContent.replace(/\n/g, '');
      if (next !== (getRecord(row, col).value || '')) {
        recordHistory();
        setCellValue(row, col, next);
        scheduleSave();
      }
    }
    state.editing = false;
    cell.contentEditable = 'false';
    cell.classList.remove('editing');
    renderAllCells();
    if (move) setActive(row + move.row, col + move.col);
    else renderSelection();
  }

  function commitFormulaBar() {
    const next = formulaInput.value;
    if (next !== (getRecord(state.active.row, state.active.col).value || '')) {
      recordHistory();
      setCellValue(state.active.row, state.active.col, next);
      renderAllCells();
      renderSelection();
      scheduleSave();
    }
  }

  function selectionText(raw = false) {
    const bounds = selectionBounds();
    const rows = [];
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      const columns = [];
      for (let col = bounds.left; col <= bounds.right; col += 1) {
        columns.push(raw ? getRecord(row, col).value || '' : displayValue(row, col));
      }
      rows.push(columns.join('\t'));
    }
    return rows.join('\n');
  }

  async function copySelection(showMessage = true) {
    try {
      await navigator.clipboard.writeText(selectionText(false));
      if (showMessage) showToast('已複製到剪貼簿');
    } catch {
      showToast('瀏覽器已封鎖剪貼簿存取權限');
    }
  }

  async function pasteFromClipboard() {
    try {
      pasteText(await navigator.clipboard.readText());
    } catch {
      showToast('請按 Ctrl+V 在此貼上');
    }
  }

  function pasteText(text) {
    if (typeof text !== 'string') return;
    const matrix = text.replace(/\r/g, '').split('\n').map((row) => row.split('\t'));
    if (matrix.length && matrix.at(-1).length === 1 && matrix.at(-1)[0] === '') matrix.pop();
    if (!matrix.length) return;
    recordHistory();
    matrix.forEach((values, rowOffset) => values.forEach((value, colOffset) => {
      const row = state.active.row + rowOffset;
      const col = state.active.col + colOffset;
      if (row < ROWS && col < COLS) setCellValue(row, col, value);
    }));
    state.anchor = { ...state.active };
    state.active = {
      row: clamp(state.active.row + matrix.length - 1, 0, ROWS - 1),
      col: clamp(state.active.col + Math.max(...matrix.map((row) => row.length)) - 1, 0, COLS - 1)
    };
    renderAllCells();
    renderSelection();
    scheduleSave();
    showToast(`已貼上 ${matrix.length} × ${Math.max(...matrix.map((row) => row.length))} 個儲存格`);
  }

  function clearSelection() {
    const bounds = selectionBounds();
    const hasContent = Object.keys(state.cells).some((key) => {
      const [row, col] = key.split(':').map(Number);
      return row >= bounds.top && row <= bounds.bottom && col >= bounds.left && col <= bounds.right && getRecord(row, col).value;
    });
    if (!hasContent) return;
    recordHistory();
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      for (let col = bounds.left; col <= bounds.right; col += 1) setCellValue(row, col, '');
    }
    renderAllCells();
    renderSelection();
    scheduleSave();
  }

  function applyFormat(property, value) {
    const bounds = selectionBounds();
    recordHistory();
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      for (let col = bounds.left; col <= bounds.right; col += 1) {
        const key = keyOf(row, col);
        state.cells[key] = { ...getRecord(row, col), [property]: value };
      }
    }
    renderAllCells();
    renderSelection();
    scheduleSave();
  }

  function updateToolbar() {
    const record = getRecord(state.active.row, state.active.col);
    boldButton.classList.toggle('active', Boolean(record.bold));
    italicButton.classList.toggle('active', Boolean(record.italic));
    alignSelect.value = record.align || 'left';
  }

  function columnDisplayName(col) {
    const heading = state.hasHeader ? displayValue(0, col).trim() : '';
    return heading ? `${colName(col)} 欄 · ${heading}` : `${colName(col)} 欄`;
  }

  function availableColumnValues(col) {
    const values = new Set();
    for (let row = dataStartRow(); row < ROWS; row += 1) {
      if (rowHasContent(row)) values.add(displayValue(row, col));
    }
    if (!values.size) values.add('');
    return [...values].sort((a, b) => {
      if (a === '') return 1;
      if (b === '') return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function renderFilterValues(values, selected) {
    filterValues.replaceChildren();
    const fragment = document.createDocumentFragment();
    values.forEach((value) => {
      const label = document.createElement('label');
      label.className = 'filter-value';
      label.dataset.filterText = value.toLocaleLowerCase();
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = value;
      checkbox.checked = selected.includes(value);
      const text = document.createElement('span');
      text.textContent = value === '' ? '（空白）' : value;
      if (value === '') text.className = 'filter-empty';
      label.append(checkbox, text);
      fragment.append(label);
    });
    filterValues.append(fragment);
    updateFilterCount();
  }

  function updateFilterCount() {
    const boxes = [...filterValues.querySelectorAll('input[type="checkbox"]')];
    const checked = boxes.filter((box) => box.checked).length;
    filterCount.textContent = checked === boxes.length ? `全部 ${boxes.length} 個數值` : `已選 ${checked}／${boxes.length} 個數值`;
  }

  function openColumnMenu(col, trigger) {
    state.menuColumn = col;
    columnMenuTitle.textContent = columnDisplayName(col);
    filterSearch.value = '';
    const values = availableColumnValues(col);
    const selected = state.filters[col] || values;
    renderFilterValues(values, selected);
    document.querySelector('#clear-column-filter').disabled = !Object.prototype.hasOwnProperty.call(state.filters, col);
    columnMenu.hidden = false;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = columnMenu.offsetWidth;
    const menuHeight = columnMenu.offsetHeight;
    const left = clamp(rect.right - menuWidth, 8, window.innerWidth - menuWidth - 8);
    const preferredTop = rect.bottom + 6;
    const top = preferredTop + menuHeight <= window.innerHeight - 8
      ? preferredTop
      : Math.max(8, rect.top - menuHeight - 6);
    columnMenu.style.left = `${left}px`;
    columnMenu.style.top = `${top}px`;
    filterSearch.focus();
  }

  function closeColumnMenu() {
    columnMenu.hidden = true;
    state.menuColumn = null;
  }

  function applyColumnFilter() {
    if (state.menuColumn === null) return;
    const boxes = [...filterValues.querySelectorAll('input[type="checkbox"]')];
    const selected = boxes.filter((box) => box.checked).map((box) => box.value);
    if (selected.length === boxes.length) delete state.filters[state.menuColumn];
    else state.filters[state.menuColumn] = selected;
    renderDataView();
    renderVisibleAnalyses();
    const firstVisible = findFirstVisibleRow();
    if (getCellElement(state.active.row, state.active.col).style.display === 'none') {
      state.active.row = firstVisible;
      state.anchor = { ...state.active };
    }
    renderSelection();
    scheduleSave();
    closeColumnMenu();
    showToast(selected.length === boxes.length ? '已清除篩選條件' : `正在顯示 ${visibleDataRowCount()} 列符合條件的資料`);
  }

  function visibleDataRowCount() {
    let count = 0;
    for (let row = dataStartRow(); row < ROWS; row += 1) {
      if (rowHasContent(row) && rowMatchesFilters(row)) count += 1;
    }
    return count;
  }

  function findFirstVisibleRow() {
    for (let row = dataStartRow(); row < ROWS; row += 1) {
      if (rowMatchesFilters(row)) return row;
    }
    return state.hasHeader ? 0 : dataStartRow();
  }

  function sortColumn(col, direction) {
    const start = dataStartRow();
    const rows = [];
    for (let row = start; row < ROWS; row += 1) {
      if (!rowHasContent(row)) continue;
      const records = [];
      for (let currentCol = 0; currentCol < COLS; currentCol += 1) {
        const record = state.cells[keyOf(row, currentCol)];
        records.push(record ? { ...record } : null);
      }
      rows.push({ records, sortValue: displayValue(row, col) });
    }

    rows.sort((a, b) => {
      if (a.sortValue === '' && b.sortValue !== '') return 1;
      if (b.sortValue === '' && a.sortValue !== '') return -1;
      const aNumber = Number(a.sortValue);
      const bNumber = Number(b.sortValue);
      const bothNumeric = a.sortValue !== '' && b.sortValue !== '' && Number.isFinite(aNumber) && Number.isFinite(bNumber);
      const comparison = bothNumeric
        ? aNumber - bNumber
        : a.sortValue.localeCompare(b.sortValue, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'ascending' ? comparison : -comparison;
    });

    recordHistory();
    for (let row = start; row < ROWS; row += 1) {
      for (let currentCol = 0; currentCol < COLS; currentCol += 1) delete state.cells[keyOf(row, currentCol)];
    }
    rows.forEach((rowData, rowOffset) => {
      rowData.records.forEach((record, currentCol) => {
        if (record) state.cells[keyOf(start + rowOffset, currentCol)] = record;
      });
    });
    state.active = { row: rows.length ? start : (state.hasHeader ? 0 : start), col };
    state.anchor = { ...state.active };
    renderAllCells();
    renderSelection({ scroll: true });
    scheduleSave();
    closeColumnMenu();
    showToast(`${colName(col)} 欄已按${direction === 'ascending' ? '遞增' : '遞減'}順序排列`);
  }

  function usedColumns() {
    const used = [];
    for (let col = 0; col < COLS; col += 1) {
      let hasData = state.hasHeader && getRecord(0, col).value !== '';
      for (let row = dataStartRow(); row < ROWS && !hasData; row += 1) {
        hasData = getRecord(row, col).value !== '';
      }
      if (hasData) used.push(col);
    }
    return used;
  }

  function pivotSourceRows() {
    const rows = [];
    for (let row = dataStartRow(); row < ROWS; row += 1) {
      if (rowHasContent(row)) rows.push(row);
    }
    return rows;
  }

  function fieldLabel(col) {
    if (!Number.isInteger(col)) return '';
    const heading = state.hasHeader ? displayValue(0, col).trim() : '';
    return heading || `${colName(col)} 欄`;
  }

  function fillFieldSelect(select, columns, selected) {
    select.replaceChildren();
    if (!columns.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '沒有可用欄位';
      select.append(option);
      select.disabled = true;
      return '';
    }
    select.disabled = false;
    columns.forEach((col) => {
      const option = document.createElement('option');
      option.value = String(col);
      option.textContent = `${fieldLabel(col)} (${colName(col)})`;
      select.append(option);
    });
    const value = columns.includes(Number(selected)) ? String(selected) : String(columns[0]);
    select.value = value;
    return value;
  }

  function populatePivotFields() {
    const columns = usedColumns();
    const rowFallback = columns[0];
    const columnFallback = columns[1] ?? columns[0];
    const valueFallback = columns[2] ?? columns[1] ?? columns[0];
    state.pivot.row = fillFieldSelect(pivotRowField, columns, state.pivot.row || rowFallback);
    state.pivot.column = fillFieldSelect(pivotColumnField, columns, state.pivot.column || columnFallback);
    state.pivot.value = fillFieldSelect(pivotValueField, columns, state.pivot.value || valueFallback);
    pivotFunction.value = ['sum', 'count', 'average', 'min', 'max'].includes(state.pivot.fn) ? state.pivot.fn : 'sum';
    state.pivot.fn = pivotFunction.value;
    pivotHeaderNote.hidden = state.hasHeader;
    return columns;
  }

  function pivotKey(value) {
    return value === '' ? '（空白）' : String(value);
  }

  function sortPivotKeys(values) {
    return [...values].sort((a, b) => {
      if (a === '（空白）') return 1;
      if (b === '（空白）') return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function aggregatePivot(values, fn) {
    if (fn === 'count') return values.filter((value) => value !== '').length;
    const numbers = values.filter((value) => value !== '').map(Number).filter(Number.isFinite);
    if (!numbers.length) return 0;
    if (fn === 'average') return numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
    if (fn === 'min') return Math.min(...numbers);
    if (fn === 'max') return Math.max(...numbers);
    return numbers.reduce((sum, number) => sum + number, 0);
  }

  function formatPivotValue(value) {
    return new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 4 }).format(value);
  }

  function showEmptyState(container, title, message) {
    const empty = document.createElement('div');
    empty.className = 'pivot-empty';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 48 48');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<rect x="7" y="9" width="34" height="30" rx="4"/><path d="M7 19h34M19 9v30M30 19v20M19 29h22"/>';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    empty.append(icon, heading, paragraph);
    container.replaceChildren(empty);
  }

  function showPivotEmpty(title, message) {
    showEmptyState(pivotTableWrap, title, message);
  }

  function renderPivot() {
    const columns = populatePivotFields();
    const sourceRows = pivotSourceRows();
    pivotSourceCount.textContent = `${sourceRows.length} 列來源資料`;
    summary.textContent = pivotSourceCount.textContent;
    if (!columns.length || !sourceRows.length) {
      pivotTitle.textContent = '樞紐分析表';
      showPivotEmpty('請在工作表加入資料', '當來源工作表包含資料後，樞紐分析表便會顯示在這裡。');
      return;
    }

    const rowCol = Number(state.pivot.row);
    const columnCol = Number(state.pivot.column);
    const valueCol = Number(state.pivot.value);
    const entries = sourceRows.map((row) => ({
      row: pivotKey(displayValue(row, rowCol)),
      column: pivotKey(displayValue(row, columnCol)),
      value: displayValue(row, valueCol)
    }));
    const rowKeys = sortPivotKeys(new Set(entries.map((entry) => entry.row)));
    const columnKeys = sortPivotKeys(new Set(entries.map((entry) => entry.column)));
    const functionLabel = pivotFunction.options[pivotFunction.selectedIndex]?.text || '總和';
    pivotTitle.textContent = `${fieldLabel(valueCol)}的${functionLabel}`;

    const table = document.createElement('table');
    table.className = 'pivot-table';
    table.setAttribute('aria-label', `${pivotTitle.textContent}，按${fieldLabel(rowCol)}及${fieldLabel(columnCol)}分類`);
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.scope = 'col';
    corner.textContent = `${fieldLabel(rowCol)} / ${fieldLabel(columnCol)}`;
    headerRow.append(corner);
    columnKeys.forEach((key) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = key;
      headerRow.append(th);
    });
    const totalHeader = document.createElement('th');
    totalHeader.scope = 'col';
    totalHeader.className = 'pivot-total';
    totalHeader.textContent = '總計';
    headerRow.append(totalHeader);
    thead.append(headerRow);

    const tbody = document.createElement('tbody');
    rowKeys.forEach((rowKey) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = rowKey;
      tr.append(th);
      columnKeys.forEach((columnKey) => {
        const td = document.createElement('td');
        const values = entries.filter((entry) => entry.row === rowKey && entry.column === columnKey).map((entry) => entry.value);
        td.textContent = formatPivotValue(aggregatePivot(values, state.pivot.fn));
        tr.append(td);
      });
      const total = document.createElement('td');
      total.className = 'pivot-total';
      total.textContent = formatPivotValue(aggregatePivot(entries.filter((entry) => entry.row === rowKey).map((entry) => entry.value), state.pivot.fn));
      tr.append(total);
      tbody.append(tr);
    });

    const grandRow = document.createElement('tr');
    grandRow.className = 'pivot-grand-total';
    const grandLabel = document.createElement('th');
    grandLabel.scope = 'row';
    grandLabel.textContent = '總計';
    grandRow.append(grandLabel);
    columnKeys.forEach((columnKey) => {
      const td = document.createElement('td');
      td.textContent = formatPivotValue(aggregatePivot(entries.filter((entry) => entry.column === columnKey).map((entry) => entry.value), state.pivot.fn));
      grandRow.append(td);
    });
    const allTotal = document.createElement('td');
    allTotal.textContent = formatPivotValue(aggregatePivot(entries.map((entry) => entry.value), state.pivot.fn));
    grandRow.append(allTotal);
    tbody.append(grandRow);

    table.append(thead, tbody);
    pivotTableWrap.replaceChildren(table);
  }

  const CHART_COLORS = ['#23875b', '#4f72c8', '#d88535', '#8a62b8', '#cf5964', '#3d9da4', '#9a8040', '#d06fa5', '#6b8e3f', '#5b677a', '#a65f3d', '#6a9f78'];
  const seriesColor = (col) => CHART_COLORS[(Math.abs(Number(col)) * 5) % CHART_COLORS.length];

  function numericColumns(columns, rows) {
    return columns.filter((col) => rows.some((row) => {
      const value = displayValue(row, col);
      return value !== '' && Number.isFinite(Number(value));
    }));
  }

  function fillObjectSelect(select, columns, selectedValue) {
    select.replaceChildren();
    if (!columns.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '沒有可用欄位';
      select.append(option);
      select.disabled = true;
      return '';
    }
    select.disabled = false;
    columns.forEach((col) => {
      const option = document.createElement('option');
      option.value = String(col);
      option.textContent = `${fieldLabel(col)} (${colName(col)})`;
      select.append(option);
    });
    const selected = columns.includes(Number(selectedValue)) ? Number(selectedValue) : columns[0];
    select.value = String(selected);
    return String(selected);
  }

  function renderDataOptions(container, columns, config) {
    container.replaceChildren();
    const selected = config.values.map(Number).filter((col) => columns.includes(col));
    const effectiveSelected = config.initialized ? selected : columns.slice(0, Math.min(2, columns.length));
    const fragment = document.createDocumentFragment();
    columns.forEach((col) => {
      const label = document.createElement('label');
      label.className = 'chart-data-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(col);
      checkbox.checked = effectiveSelected.includes(col);
      const name = document.createElement('span');
      name.textContent = fieldLabel(col);
      const letter = document.createElement('small');
      letter.textContent = colName(col);
      label.append(checkbox, name, letter);
      fragment.append(label);
    });
    container.append(fragment);
    config.values = effectiveSelected.map(String);
    config.initialized = true;
  }

  function populateChartFields() {
    const columns = usedColumns();
    const rows = pivotSourceRows();
    state.chart.object = fillObjectSelect(chartObjectField, columns, state.chart.object);
    renderDataOptions(chartDataOptions, numericColumns(columns, rows), state.chart);
    const layout = state.chart.layout === 'stacked' ? 'stacked' : 'grouped';
    state.chart.layout = layout;
    const radio = document.querySelector(`input[name="chart-layout"][value="${layout}"]`);
    if (radio) radio.checked = true;
    chartHeaderNote.hidden = state.hasHeader;
    return { columns, rows };
  }

  function chartDataset(rows, config = state.chart) {
    const objectCol = Number(config.object);
    const valueCols = config.values.map(Number);
    return rows.map((row, index) => ({
      label: displayValue(row, objectCol) || `第 ${row + 1} 列`,
      key: `${row}-${index}`,
      values: valueCols.map((col) => {
        const raw = displayValue(row, col);
        const numeric = Number(raw);
        return { col, raw, value: raw !== '' && Number.isFinite(numeric) ? numeric : 0 };
      })
    }));
  }

  function svgElement(name, attributes = {}, text = '') {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== '') element.textContent = text;
    return element;
  }

  function niceChartMax(value) {
    if (!Number.isFinite(value) || value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
  }

  function showChartTooltip(event, label, series, value) {
    let tooltip = document.querySelector('#chart-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'chart-tooltip';
      tooltip.className = 'chart-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      document.body.append(tooltip);
    }
    tooltip.textContent = `${label} · ${series}: ${typeof value === 'number' ? formatPivotValue(value) : String(value)}`;
    tooltip.hidden = false;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    tooltip.style.left = `${clamp(event.clientX + 12, 8, window.innerWidth - width - 8)}px`;
    tooltip.style.top = `${clamp(event.clientY - height - 10, 8, window.innerHeight - height - 8)}px`;
  }

  function hideChartTooltip() {
    const tooltip = document.querySelector('#chart-tooltip');
    if (tooltip) tooltip.hidden = true;
  }

  function renderSeriesLegend(container, valueCols) {
    container.replaceChildren();
    valueCols.forEach((col) => {
      const item = document.createElement('span');
      item.className = 'chart-legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'chart-legend-swatch';
      swatch.style.setProperty('--series-color', seriesColor(col));
      const label = document.createElement('span');
      label.textContent = fieldLabel(col);
      item.append(swatch, label);
      container.append(item);
    });
  }

  function renderBarChart() {
    const { columns, rows } = populateChartFields();
    const valueCols = state.chart.values.map(Number);
    const objectCol = Number(state.chart.object);
    const chartRows = rows.filter((row) => displayValue(row, objectCol) !== '' || valueCols.some((col) => displayValue(row, col) !== ''));
    const data = chartDataset(chartRows);
    chartSourceCount.textContent = `${data.length} 個項目`;
    summary.textContent = chartSourceCount.textContent;
    renderSeriesLegend(chartLegend, valueCols);
    if (!columns.length || !rows.length || !valueCols.length) {
      chartTitle.textContent = '棒形圖';
      showEmptyState(barChartWrap, '請在工作表加入數值資料', '請選擇項目欄位及至少一個數值系列。');
      return;
    }

    const layout = state.chart.layout;
    const objectLabel = fieldLabel(objectCol);
    const seriesCount = valueCols.length;
    chartTitle.textContent = seriesCount === 1
      ? `按${objectLabel}繪製的棒形圖`
      : `按${objectLabel}繪製的${layout === 'stacked' ? '堆疊' : '並排'}棒形圖`;
    const positiveMax = layout === 'stacked'
      ? Math.max(...data.map((item) => item.values.reduce((sum, series) => sum + Math.max(0, series.value), 0)), 0)
      : Math.max(...data.flatMap((item) => item.values.map((series) => Math.max(0, series.value))), 0);
    const negativeMin = layout === 'stacked'
      ? Math.min(...data.map((item) => item.values.reduce((sum, series) => sum + Math.min(0, series.value), 0)), 0)
      : Math.min(...data.flatMap((item) => item.values.map((series) => Math.min(0, series.value))), 0);
    const yMax = niceChartMax(positiveMax);
    const yMin = negativeMin < 0 ? -niceChartMax(Math.abs(negativeMin)) : 0;
    const yRange = yMax - yMin || 1;

    const margin = { top: 24, right: 28, bottom: 82, left: 68 };
    const categoryWidth = layout === 'grouped' ? Math.max(74, seriesCount * 26 + 26) : 76;
    const width = Math.max(barChartWrap.clientWidth || 720, margin.left + margin.right + data.length * categoryWidth);
    const height = Math.max(420, Math.min(610, (barChartWrap.parentElement?.clientHeight || 520) - 10));
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const y = (value) => margin.top + ((yMax - value) / yRange) * plotHeight;
    const baseline = y(0);

    const svg = svgElement('svg', {
      class: 'bar-chart', width, height, viewBox: `0 0 ${width} ${height}`,
      role: 'img', 'aria-label': `${chartTitle.textContent}，包含 ${data.length} 個項目及 ${seriesCount} 個數據系列。`
    });
    svg.append(svgElement('title', {}, chartTitle.textContent));
    svg.append(svgElement('desc', {}, `${layout === 'stacked' ? '堆疊' : '並排'}棒形圖，按${objectLabel}比較${valueCols.map(fieldLabel).join('、')}。`));

    const ticks = 5;
    for (let tick = 0; tick <= ticks; tick += 1) {
      const value = yMin + (yRange * tick / ticks);
      const tickY = y(value);
      svg.append(svgElement('line', { class: 'chart-grid-line', x1: margin.left, x2: width - margin.right, y1: tickY, y2: tickY }));
      svg.append(svgElement('text', { class: 'chart-axis-text', x: margin.left - 9, y: tickY + 4, 'text-anchor': 'end' }, formatPivotValue(value)));
    }
    svg.append(svgElement('line', { class: 'chart-zero-line', x1: margin.left, x2: width - margin.right, y1: baseline, y2: baseline }));
    svg.append(svgElement('line', { class: 'chart-axis-line', x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom }));
    svg.append(svgElement('text', { class: 'chart-axis-title', x: 15, y: margin.top + plotHeight / 2, transform: `rotate(-90 15 ${margin.top + plotHeight / 2})`, 'text-anchor': 'middle' }, valueCols.length === 1 ? fieldLabel(valueCols[0]) : '數值'));
    svg.append(svgElement('text', { class: 'chart-axis-title', x: margin.left + plotWidth / 2, y: height - 13, 'text-anchor': 'middle' }, objectLabel));

    const slot = plotWidth / data.length;
    data.forEach((item, itemIndex) => {
      const center = margin.left + slot * itemIndex + slot / 2;
      const maxLabelLength = Math.max(8, Math.floor(slot / 7));
      const shownLabel = item.label.length > maxLabelLength ? `${item.label.slice(0, Math.max(5, maxLabelLength - 1))}…` : item.label;
      const label = svgElement('text', { class: 'chart-axis-text', x: center, y: height - margin.bottom + 18, 'text-anchor': 'end', transform: `rotate(-35 ${center} ${height - margin.bottom + 18})` }, shownLabel);
      label.append(svgElement('title', {}, item.label));
      svg.append(label);

      let positiveStack = 0;
      let negativeStack = 0;
      item.values.forEach((series, seriesIndex) => {
        const groupedWidth = Math.min(22, (slot * .75) / seriesCount);
        const stackedWidth = Math.min(48, slot * .62);
        let x;
        let barTopValue;
        let barBottomValue;
        if (layout === 'stacked') {
          x = center - stackedWidth / 2;
          if (series.value >= 0) {
            barBottomValue = positiveStack;
            positiveStack += series.value;
            barTopValue = positiveStack;
          } else {
            barTopValue = negativeStack;
            negativeStack += series.value;
            barBottomValue = negativeStack;
          }
        } else {
          x = center - (groupedWidth * seriesCount) / 2 + seriesIndex * groupedWidth;
          barTopValue = Math.max(0, series.value);
          barBottomValue = Math.min(0, series.value);
        }
        const rectY = Math.min(y(barTopValue), y(barBottomValue));
        const rectHeight = Math.max(1, Math.abs(y(barBottomValue) - y(barTopValue)));
        const barWidth = layout === 'stacked' ? stackedWidth : Math.max(4, groupedWidth - 2);
        const rect = svgElement('rect', {
          class: 'chart-bar', x, y: rectY, width: barWidth, height: rectHeight,
          rx: layout === 'stacked' ? 0 : 2,
          fill: seriesColor(series.col),
          tabindex: '0', 'aria-label': `${item.label}, ${fieldLabel(series.col)}: ${formatPivotValue(series.value)}`
        });
        rect.addEventListener('pointermove', (event) => showChartTooltip(event, item.label, fieldLabel(series.col), series.value));
        rect.addEventListener('pointerleave', hideChartTooltip);
        rect.addEventListener('focus', () => {
          const box = rect.getBoundingClientRect();
          showChartTooltip({ clientX: box.left + box.width / 2, clientY: box.top }, item.label, fieldLabel(series.col), series.value);
        });
        rect.addEventListener('blur', hideChartTooltip);
        svg.append(rect);

        if (layout === 'grouped' && data.length * seriesCount <= 24 && rectHeight > 16) {
          const valueY = series.value >= 0 ? rectY - 5 : rectY + rectHeight + 12;
          svg.append(svgElement('text', { class: 'chart-value-label', x: x + barWidth / 2, y: valueY }, formatPivotValue(series.value)));
        }
      });
    });
    barChartWrap.replaceChildren(svg);
  }

  function populateSimpleChartFields(config, objectSelect, optionsContainer, note) {
    const columns = usedColumns();
    const rows = pivotSourceRows();
    config.object = fillObjectSelect(objectSelect, columns, config.object);
    renderDataOptions(optionsContainer, numericColumns(columns, rows), config);
    note.hidden = state.hasHeader;
    return { columns, rows };
  }

  function relevantChartRows(rows, config) {
    const objectCol = Number(config.object);
    const valueCols = config.values.map(Number);
    return rows.filter((row) => displayValue(row, objectCol) !== '' || valueCols.some((col) => displayValue(row, col) !== ''));
  }

  function renderLineChart() {
    const { columns, rows } = populateSimpleChartFields(state.line, lineObjectField, lineDataOptions, lineHeaderNote);
    const valueCols = state.line.values.map(Number);
    const chartRows = relevantChartRows(rows, state.line);
    const objectCol = Number(state.line.object);
    lineSourceCount.textContent = `${chartRows.length} 個項目`;
    summary.textContent = lineSourceCount.textContent;
    renderSeriesLegend(lineLegend, valueCols);
    if (!columns.length || !chartRows.length || !valueCols.length) {
      lineTitle.textContent = '折線圖';
      showEmptyState(lineChartWrap, '請在工作表加入數值資料', '請選擇項目欄位及至少一個數值系列。');
      return;
    }

    const objectLabel = fieldLabel(objectCol);
    lineTitle.textContent = `按${objectLabel}顯示的${valueCols.length > 1 ? '多個數據系列' : fieldLabel(valueCols[0])}`;
    const series = valueCols.map((col) => ({
      col,
      points: chartRows.map((row, index) => {
        const raw = displayValue(row, col);
        return {
          index,
          label: displayValue(row, objectCol) || `第 ${row + 1} 列`,
          value: raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null
        };
      })
    }));
    const numericValues = series.flatMap((item) => item.points.map((point) => point.value).filter(Number.isFinite));
    if (!numericValues.length) {
      showEmptyState(lineChartWrap, '沒有數值', '已選取的系列沒有這些項目的數值資料。');
      return;
    }

    const rawMin = Math.min(...numericValues, 0);
    const rawMax = Math.max(...numericValues, 0);
    const yMin = rawMin < 0 ? -niceChartMax(Math.abs(rawMin)) : 0;
    const yMax = niceChartMax(rawMax);
    const yRange = yMax - yMin || 1;
    const margin = { top: 28, right: 30, bottom: 82, left: 68 };
    const categoryWidth = 82;
    const width = Math.max(lineChartWrap.clientWidth || 720, margin.left + margin.right + Math.max(1, chartRows.length - 1) * categoryWidth + 60);
    const height = Math.max(420, Math.min(610, (lineChartWrap.parentElement?.clientHeight || 520) - 10));
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = (index) => chartRows.length === 1 ? margin.left + plotWidth / 2 : margin.left + (index / (chartRows.length - 1)) * plotWidth;
    const y = (value) => margin.top + ((yMax - value) / yRange) * plotHeight;
    const svg = svgElement('svg', {
      class: 'bar-chart line-chart', width, height, viewBox: `0 0 ${width} ${height}`,
      role: 'img', 'aria-label': `${lineTitle.textContent}，包含 ${chartRows.length} 個項目及 ${valueCols.length} 個數據系列。`
    });
    svg.append(svgElement('title', {}, lineTitle.textContent));
    svg.append(svgElement('desc', {}, `折線圖按${objectLabel}比較${valueCols.map(fieldLabel).join('、')}。`));

    for (let tick = 0; tick <= 5; tick += 1) {
      const value = yMin + (yRange * tick / 5);
      const tickY = y(value);
      svg.append(svgElement('line', { class: 'chart-grid-line', x1: margin.left, x2: width - margin.right, y1: tickY, y2: tickY }));
      svg.append(svgElement('text', { class: 'chart-axis-text', x: margin.left - 9, y: tickY + 4, 'text-anchor': 'end' }, formatPivotValue(value)));
    }
    svg.append(svgElement('line', { class: 'chart-zero-line', x1: margin.left, x2: width - margin.right, y1: y(0), y2: y(0) }));
    svg.append(svgElement('line', { class: 'chart-axis-line', x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom }));
    svg.append(svgElement('text', { class: 'chart-axis-title', x: 15, y: margin.top + plotHeight / 2, transform: `rotate(-90 15 ${margin.top + plotHeight / 2})`, 'text-anchor': 'middle' }, valueCols.length === 1 ? fieldLabel(valueCols[0]) : '數值'));
    svg.append(svgElement('text', { class: 'chart-axis-title', x: margin.left + plotWidth / 2, y: height - 13, 'text-anchor': 'middle' }, objectLabel));

    chartRows.forEach((row, index) => {
      const label = displayValue(row, objectCol) || `第 ${row + 1} 列`;
      const maxLength = Math.max(8, Math.floor(categoryWidth / 7));
      const shown = label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
      const text = svgElement('text', { class: 'chart-axis-text', x: x(index), y: height - margin.bottom + 18, 'text-anchor': 'end', transform: `rotate(-35 ${x(index)} ${height - margin.bottom + 18})` }, shown);
      text.append(svgElement('title', {}, label));
      svg.append(text);
    });

    series.forEach((item) => {
      const color = seriesColor(item.col);
      const segments = [];
      let current = [];
      item.points.forEach((point) => {
        if (point.value === null) {
          if (current.length) segments.push(current);
          current = [];
        } else current.push(point);
      });
      if (current.length) segments.push(current);
      segments.forEach((segment) => {
        const pathData = segment.map((point, index) => `${index ? 'L' : 'M'} ${x(point.index)} ${y(point.value)}`).join(' ');
        const path = svgElement('path', { class: 'chart-series-line', d: pathData });
        path.style.setProperty('--series-color', color);
        svg.append(path);
      });
      item.points.filter((point) => point.value !== null).forEach((point) => {
        const circle = svgElement('circle', {
          class: 'chart-series-point', cx: x(point.index), cy: y(point.value), r: 4,
          tabindex: '0', 'aria-label': `${point.label}, ${fieldLabel(item.col)}: ${formatPivotValue(point.value)}`
        });
        circle.style.setProperty('--series-color', color);
        circle.addEventListener('pointermove', (event) => showChartTooltip(event, point.label, fieldLabel(item.col), point.value));
        circle.addEventListener('pointerleave', hideChartTooltip);
        circle.addEventListener('focus', () => {
          const box = circle.getBoundingClientRect();
          showChartTooltip({ clientX: box.left + box.width / 2, clientY: box.top }, point.label, fieldLabel(item.col), point.value);
        });
        circle.addEventListener('blur', hideChartTooltip);
        svg.append(circle);
      });
    });
    lineChartWrap.replaceChildren(svg);
  }

  function objectPalette(labels) {
    const map = new Map();
    labels.forEach((label, index) => map.set(label, CHART_COLORS[index % CHART_COLORS.length]));
    return map;
  }

  function renderObjectLegend(container, labels, colors) {
    container.replaceChildren();
    labels.forEach((label) => {
      const item = document.createElement('span');
      item.className = 'chart-legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'chart-legend-swatch';
      swatch.style.setProperty('--series-color', colors.get(label));
      const text = document.createElement('span');
      text.textContent = label;
      item.append(swatch, text);
      container.append(item);
    });
  }

  function donutPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
    const safeEnd = Math.min(endAngle, startAngle + Math.PI * 2 - 0.00001);
    const point = (radius, angle) => [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    const outerStart = point(outerRadius, startAngle);
    const outerEnd = point(outerRadius, safeEnd);
    const innerEnd = point(innerRadius, safeEnd);
    const innerStart = point(innerRadius, startAngle);
    const largeArc = safeEnd - startAngle > Math.PI ? 1 : 0;
    return `M ${outerStart[0]} ${outerStart[1]} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerEnd[0]} ${innerEnd[1]} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart[0]} ${innerStart[1]} Z`;
  }

  function renderPieChart() {
    const { columns, rows } = populateSimpleChartFields(state.pie, pieObjectField, pieDataOptions, pieHeaderNote);
    const valueCols = state.pie.values.map(Number);
    const chartRows = relevantChartRows(rows, state.pie);
    const objectCol = Number(state.pie.object);
    pieSourceCount.textContent = `${chartRows.length} 個項目`;
    summary.textContent = pieSourceCount.textContent;
    if (!columns.length || !chartRows.length || !valueCols.length) {
      pieTitle.textContent = '圓形圖';
      pieLegend.replaceChildren();
      showEmptyState(pieChartWrap, '請在工作表加入數值資料', '請選擇項目欄位及至少一個數值欄。');
      return;
    }

    const objectLabel = fieldLabel(objectCol);
    pieTitle.textContent = `按${objectLabel}顯示的${valueCols.length > 1 ? '多個圓形圖' : fieldLabel(valueCols[0])}`;
    const labels = [];
    chartRows.forEach((row) => {
      const label = displayValue(row, objectCol) || `第 ${row + 1} 列`;
      if (!labels.includes(label)) labels.push(label);
    });
    const colors = objectPalette(labels);
    renderObjectLegend(pieLegend, labels, colors);
    const fragment = document.createDocumentFragment();

    valueCols.forEach((col) => {
      const values = new Map(labels.map((label) => [label, 0]));
      chartRows.forEach((row) => {
        const label = displayValue(row, objectCol) || `第 ${row + 1} 列`;
        const numeric = Number(displayValue(row, col));
        if (Number.isFinite(numeric) && numeric > 0) values.set(label, values.get(label) + numeric);
      });
      const entries = labels.map((label) => ({ label, value: values.get(label) })).filter((entry) => entry.value > 0);
      const total = entries.reduce((sum, entry) => sum + entry.value, 0);
      const panel = document.createElement('section');
      panel.className = 'pie-panel';
      const heading = document.createElement('h3');
      heading.textContent = fieldLabel(col);
      panel.append(heading);
      if (!total) {
        const note = document.createElement('p');
        note.className = 'pie-empty-note';
        note.textContent = '沒有可供顯示的正數值。';
        panel.append(note);
        fragment.append(panel);
        return;
      }

      const size = 300;
      const center = size / 2;
      const outerRadius = 116;
      const innerRadius = 62;
      const svg = svgElement('svg', { class: 'pie-chart', viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': `${fieldLabel(col)}，按${objectLabel}分類，總計 ${formatPivotValue(total)}。` });
      svg.append(svgElement('title', {}, `${fieldLabel(col)}，按${objectLabel}分類`));
      svg.append(svgElement('desc', {}, entries.map((entry) => `${entry.label}: ${formatPivotValue(entry.value)}`).join('. ')));
      let angle = -Math.PI / 2;
      entries.forEach((entry) => {
        const span = (entry.value / total) * Math.PI * 2;
        const end = angle + span;
        const path = svgElement('path', {
          class: 'pie-slice', d: donutPath(center, center, outerRadius, innerRadius, angle, end),
          fill: colors.get(entry.label), tabindex: '0',
          'aria-label': `${entry.label}, ${fieldLabel(col)}: ${formatPivotValue(entry.value)} (${formatPivotValue(entry.value / total * 100)}%)`
        });
        path.addEventListener('pointermove', (event) => showChartTooltip(event, entry.label, fieldLabel(col), `${formatPivotValue(entry.value)} (${formatPivotValue(entry.value / total * 100)}%)`));
        path.addEventListener('pointerleave', hideChartTooltip);
        path.addEventListener('focus', () => {
          const box = path.getBoundingClientRect();
          showChartTooltip({ clientX: box.left + box.width / 2, clientY: box.top }, entry.label, fieldLabel(col), `${formatPivotValue(entry.value)} (${formatPivotValue(entry.value / total * 100)}%)`);
        });
        path.addEventListener('blur', hideChartTooltip);
        svg.append(path);
        if (span >= 0.45) {
          const mid = angle + span / 2;
          const labelRadius = (outerRadius + innerRadius) / 2;
          svg.append(svgElement('text', { class: 'chart-value-label', x: center + Math.cos(mid) * labelRadius, y: center + Math.sin(mid) * labelRadius + 3 }, `${Math.round(entry.value / total * 100)}%`));
        }
        angle = end;
      });
      svg.append(svgElement('text', { class: 'pie-center-label', x: center, y: center - 5 }, '總計'));
      svg.append(svgElement('text', { class: 'pie-center-value', x: center, y: center + 16 }, formatPivotValue(total)));
      panel.append(svg);
      fragment.append(panel);
    });
    pieChartWrap.replaceChildren(fragment);
  }

  function expandAddressList(source) {
    const addresses = [];
    const add = (address) => {
      const normalized = addressOf(address.row, address.col);
      if (!addresses.includes(normalized)) addresses.push(normalized);
    };
    const tokens = String(source).toUpperCase().split(/[,，\s]+/).map((token) => token.trim()).filter(Boolean);
    for (const token of tokens) {
      const range = /^([A-Z][1-9]\d*):([A-Z][1-9]\d*)$/.exec(token);
      if (range) {
        const start = parseAddress(range[1]);
        const end = parseAddress(range[2]);
        if (!start || !end) return null;
        for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
          for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col += 1) add({ row, col });
        }
      } else {
        const point = parseAddress(token);
        if (!point) return null;
        add(point);
      }
      if (addresses.length > 100) return null;
    }
    return addresses;
  }

  function currentSelectionAddresses() {
    const bounds = selectionBounds();
    const addresses = [];
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      for (let col = bounds.left; col <= bounds.right; col += 1) addresses.push(addressOf(row, col));
    }
    return addresses;
  }

  function scenarioMatchesCurrent(scenario) {
    return Object.entries(scenario.values).every(([address, value]) => {
      const point = parseAddress(address);
      return point && (getRecord(point.row, point.col).value || '') === value;
    });
  }

  function scenarioResultValues(scenario) {
    const resultCells = Array.isArray(scenario.resultCells) ? scenario.resultCells : [];
    if (!resultCells.length) return {};
    const backups = new Map();
    Object.entries(scenario.values).forEach(([address, value]) => {
      const point = parseAddress(address);
      if (!point) return;
      const key = keyOf(point.row, point.col);
      backups.set(key, state.cells[key] ? { ...state.cells[key] } : null);
      state.cells[key] = { ...getRecord(point.row, point.col), value };
    });
    const results = {};
    resultCells.forEach((address) => {
      const point = parseAddress(address);
      if (!point) return;
      const value = displayValue(point.row, point.col);
      results[address] = value !== '' && Number.isFinite(Number(value)) ? formatNumber(Number(value)) : (value || '（空白）');
    });
    backups.forEach((record, key) => {
      if (record) state.cells[key] = record;
      else delete state.cells[key];
    });
    return results;
  }

  function renderScenarios() {
    scenarioCount.textContent = `${state.scenarios.length} 個情境`;
    scenarioList.replaceChildren();
    scenarioComparison.replaceChildren();
    if (!state.scenarios.length) {
      const empty = document.createElement('div');
      empty.className = 'goal-status goal-status-empty';
      const content = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = '尚未儲存情境';
      const note = document.createElement('p');
      note.textContent = '在左側輸入情境名稱及可變儲存格，便可擷取目前數值。';
      content.append(heading, note);
      empty.append(content);
      scenarioList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    state.scenarios.forEach((scenario) => {
      const card = document.createElement('article');
      card.className = 'scenario-card';
      const header = document.createElement('div');
      header.className = 'scenario-card-header';
      const heading = document.createElement('h3');
      heading.textContent = scenario.name;
      header.append(heading);
      if (scenarioMatchesCurrent(scenario)) {
        const badge = document.createElement('span');
        badge.className = 'scenario-current-badge';
        badge.textContent = '目前套用';
        header.append(badge);
      }
      const note = document.createElement('p');
      const resultCells = Array.isArray(scenario.resultCells) ? scenario.resultCells : [];
      note.textContent = `可變：${Object.keys(scenario.values).join('、')}${resultCells.length ? ` · 結果：${resultCells.join('、')}` : ''}`;
      const actions = document.createElement('div');
      actions.className = 'scenario-card-actions';
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.dataset.scenarioAction = 'apply';
      apply.dataset.scenarioId = scenario.id;
      apply.textContent = '套用';
      const update = document.createElement('button');
      update.type = 'button';
      update.dataset.scenarioAction = 'update';
      update.dataset.scenarioId = scenario.id;
      update.textContent = '更新';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger-button';
      remove.dataset.scenarioAction = 'delete';
      remove.dataset.scenarioId = scenario.id;
      remove.textContent = '刪除';
      actions.append(apply, update, remove);
      card.append(header, note, actions);
      fragment.append(card);
    });
    scenarioList.append(fragment);

    const variableAddresses = [...new Set(state.scenarios.flatMap((scenario) => Object.keys(scenario.values)))];
    const resultAddresses = [...new Set(state.scenarios.flatMap((scenario) => Array.isArray(scenario.resultCells) ? scenario.resultCells : []))];
    const addresses = [...variableAddresses, ...resultAddresses.filter((address) => !variableAddresses.includes(address))];
    const resultsByScenario = new Map(state.scenarios.map((scenario) => [scenario.id, scenarioResultValues(scenario)]));
    const table = document.createElement('table');
    table.className = 'scenario-table';
    const caption = document.createElement('caption');
    caption.textContent = '情境數值比較';
    table.append(caption);
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const typeHeader = document.createElement('th');
    typeHeader.textContent = '類型';
    headerRow.append(typeHeader);
    const addressHeader = document.createElement('th');
    addressHeader.textContent = '儲存格';
    headerRow.append(addressHeader);
    state.scenarios.forEach((scenario) => {
      const th = document.createElement('th');
      th.textContent = scenario.name;
      headerRow.append(th);
    });
    thead.append(headerRow);
    const tbody = document.createElement('tbody');
    addresses.forEach((address) => {
      const row = document.createElement('tr');
      const isVariable = variableAddresses.includes(address);
      const isResult = resultAddresses.includes(address);
      if (isResult) row.classList.add('scenario-result-row');
      const type = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `scenario-type-badge ${isResult ? 'result' : 'variable'}`;
      badge.textContent = isVariable && isResult ? '可變／結果' : (isResult ? '結果' : '可變');
      type.append(badge);
      row.append(type);
      const th = document.createElement('th');
      th.textContent = address;
      row.append(th);
      state.scenarios.forEach((scenario) => {
        const td = document.createElement('td');
        const scenarioResults = resultsByScenario.get(scenario.id);
        if (Array.isArray(scenario.resultCells) && scenario.resultCells.includes(address)) td.textContent = scenarioResults[address] ?? '—';
        else td.textContent = Object.prototype.hasOwnProperty.call(scenario.values, address) ? (scenario.values[address] || '（空白）') : '—';
        row.append(td);
      });
      tbody.append(row);
    });
    table.append(thead, tbody);
    scenarioComparison.append(table);
  }

  function renderGoalSeek() {
    goalFormulaCell.value = state.goal.formula;
    goalTargetValue.value = state.goal.target;
    goalChangingCell.value = state.goal.changing;
    goalStatus.replaceChildren();
    const result = state.goal.result;
    if (!result) {
      const empty = document.createElement('div');
      empty.className = 'goal-status-empty';
      const content = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = '等待設定目標';
      const note = document.createElement('p');
      note.textContent = '設定公式儲存格、目標值及變更儲存格後，按「開始目標搜尋」。';
      content.append(heading, note);
      empty.append(content);
      goalStatus.append(empty);
      return;
    }
    const heading = document.createElement('div');
    heading.className = `goal-result-heading${result.success ? '' : ' error'}`;
    const icon = document.createElement('span');
    icon.textContent = result.success ? '✓' : '!';
    const title = document.createElement('h3');
    title.textContent = result.success ? '已找到目標值' : '未能找到目標值';
    heading.append(icon, title);
    const grid = document.createElement('div');
    grid.className = 'goal-result-grid';
    const metrics = result.success
      ? [['變更儲存格', `${result.changingAddress} = ${formatNumber(result.changingValue)}`], ['公式結果', `${result.formulaAddress} = ${formatNumber(result.achieved)}`], ['與目標的誤差', formatNumber(result.error)]]
      : [['公式儲存格', result.formulaAddress || '—'], ['變更儲存格', result.changingAddress || '—'], ['指定目標', Number.isFinite(result.target) ? formatNumber(result.target) : '—']];
    metrics.forEach(([label, value]) => {
      const item = document.createElement('div');
      const small = document.createElement('small');
      small.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      item.append(small, strong);
      grid.append(item);
    });
    const note = document.createElement('p');
    note.className = 'goal-result-note';
    note.textContent = result.message;
    goalStatus.append(heading, grid, note);
  }

  function saveCurrentScenario() {
    const name = scenarioNameInput.value.trim();
    const addresses = expandAddressList(scenarioCellsInput.value);
    const resultSource = scenarioResultCellsInput.value.trim();
    const resultCells = resultSource ? expandAddressList(resultSource) : [];
    if (!name) {
      showToast('請輸入情境名稱');
      scenarioNameInput.focus();
      return;
    }
    if (!addresses?.length) {
      showToast('請輸入有效的可變儲存格，例如 B2,B3');
      scenarioCellsInput.focus();
      return;
    }
    if (resultSource && !resultCells) {
      showToast('請輸入有效的結果儲存格，例如 C2,F8');
      scenarioResultCellsInput.focus();
      return;
    }
    const values = Object.fromEntries(addresses.map((address) => {
      const point = parseAddress(address);
      return [address, getRecord(point.row, point.col).value || ''];
    }));
    const existing = state.scenarios.find((scenario) => scenario.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) {
      existing.values = values;
      existing.resultCells = resultCells;
      showToast(`已更新情境「${name}」`);
    } else {
      state.scenarios.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, values, resultCells });
      showToast(`已儲存情境「${name}」`);
    }
    renderScenarios();
    scheduleSave();
  }

  function applyScenario(scenario) {
    recordHistory();
    Object.entries(scenario.values).forEach(([address, value]) => {
      const point = parseAddress(address);
      if (point) setCellValue(point.row, point.col, value);
    });
    renderAllCells();
    renderSelection();
    scheduleSave();
    showToast(`已套用情境「${scenario.name}」`);
  }

  function evaluateGoalAt(changingPoint, formulaPoint, value, originalRecord) {
    const key = keyOf(changingPoint.row, changingPoint.col);
    state.cells[key] = { ...(originalRecord || { bold: false, italic: false, align: 'left' }), value: String(value) };
    const result = Number(scalarValue(formulaPoint.row, formulaPoint.col));
    if (originalRecord) state.cells[key] = originalRecord;
    else delete state.cells[key];
    return result;
  }

  function runGoalSeek() {
    state.goal.formula = goalFormulaCell.value.trim().toUpperCase();
    state.goal.target = goalTargetValue.value.trim();
    state.goal.changing = goalChangingCell.value.trim().toUpperCase();
    const formulaPoint = parseAddress(state.goal.formula);
    const changingPoint = parseAddress(state.goal.changing);
    const target = state.goal.target === '' ? NaN : Number(state.goal.target);
    const fail = (message) => {
      state.goal.result = { success: false, message, formulaAddress: state.goal.formula, changingAddress: state.goal.changing, target };
      renderGoalSeek();
      scheduleSave();
    };
    if (!formulaPoint) return fail('請輸入有效的公式儲存格地址，例如 C5。');
    if (!changingPoint) return fail('請輸入有效的變更儲存格地址，例如 B2。');
    if (state.goal.formula === state.goal.changing) return fail('公式儲存格與變更儲存格必須不同。');
    if (state.goal.target === '' || !Number.isFinite(target)) return fail('請輸入有效的數值目標。');
    if (!String(getRecord(formulaPoint.row, formulaPoint.col).value || '').startsWith('=')) return fail(`${state.goal.formula} 必須包含以 = 開始的公式。`);
    const changingRaw = getRecord(changingPoint.row, changingPoint.col).value || '';
    if (changingRaw.startsWith('=') || (changingRaw !== '' && !Number.isFinite(Number(changingRaw)))) return fail(`${state.goal.changing} 必須是數值或空白儲存格。`);

    const changeKey = keyOf(changingPoint.row, changingPoint.col);
    const originalRecord = state.cells[changeKey] ? { ...state.cells[changeKey] } : null;
    let x = changingRaw === '' ? 0 : Number(changingRaw);
    let achieved = NaN;
    let iterations = 0;
    const tolerance = Math.max(1e-7, Math.abs(target) * 1e-7);
    for (; iterations < 100; iterations += 1) {
      achieved = evaluateGoalAt(changingPoint, formulaPoint, x, originalRecord);
      if (!Number.isFinite(achieved)) break;
      const error = achieved - target;
      if (Math.abs(error) <= tolerance) break;
      const h = Math.max(1e-5, Math.abs(x) * 1e-5);
      const plus = evaluateGoalAt(changingPoint, formulaPoint, x + h, originalRecord);
      const minus = evaluateGoalAt(changingPoint, formulaPoint, x - h, originalRecord);
      let derivative = (plus - minus) / (2 * h);
      if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) {
        const probe = x + Math.max(1, Math.abs(x) * 0.1);
        const probeValue = evaluateGoalAt(changingPoint, formulaPoint, probe, originalRecord);
        derivative = (probeValue - achieved) / (probe - x);
      }
      if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) break;
      const next = x - error / derivative;
      if (!Number.isFinite(next) || Math.abs(next) > 1e15) break;
      x = next;
    }
    achieved = evaluateGoalAt(changingPoint, formulaPoint, x, originalRecord);
    const error = achieved - target;
    if (!Number.isFinite(achieved) || Math.abs(error) > tolerance) return fail('搜尋未能收斂。請檢查公式是否會受變更儲存格影響，或嘗試另一個起始值。');
    const roundedCandidate = Math.round((x + Number.EPSILON) * 1e10) / 1e10;
    const nearestInteger = Math.round(roundedCandidate);
    const solvedValue = Math.abs(roundedCandidate - nearestInteger) < 1e-8 ? nearestInteger : roundedCandidate;
    recordHistory();
    setCellValue(changingPoint.row, changingPoint.col, String(solvedValue));
    const finalAchieved = Number(scalarValue(formulaPoint.row, formulaPoint.col));
    const finalError = finalAchieved - target;
    state.goal.result = {
      success: true,
      message: `經過 ${iterations + 1} 次計算後完成。變更已寫入工作表，可使用「復原」返回原來數值。`,
      formulaAddress: state.goal.formula,
      changingAddress: state.goal.changing,
      target,
      changingValue: solvedValue,
      achieved: finalAchieved,
      error: Math.abs(finalError) < 1e-12 ? 0 : finalError
    };
    renderAllCells();
    renderSelection();
    scheduleSave();
    showToast('目標搜尋已完成');
  }

  function visibleViews() {
    return state.split.enabled ? [state.split.left, state.split.right] : [state.activeView];
  }

  function isViewVisible(view) {
    return visibleViews().includes(view);
  }

  function renderVisibleAnalyses() {
    if (isViewVisible('pivot')) renderPivot();
    if (isViewVisible('chart')) renderBarChart();
    if (isViewVisible('line')) renderLineChart();
    if (isViewVisible('pie')) renderPieChart();
    if (isViewVisible('scenario')) renderScenarios();
    if (isViewVisible('goal')) renderGoalSeek();
  }

  function closeSplitViewMenu() {
    splitViewMenu.hidden = true;
    splitViewButton.setAttribute('aria-expanded', 'false');
  }

  function closeAboutMenu() {
    aboutMenu.hidden = true;
    aboutButton.setAttribute('aria-expanded', 'false');
  }

  function applyViewLayout() {
    const visible = new Set(visibleViews());
    viewStage.classList.toggle('is-split', state.split.enabled);
    Object.entries(viewElements).forEach(([view, element]) => {
      element.hidden = !visible.has(view);
      element.style.order = state.split.enabled ? String(view === state.split.left ? 0 : 1) : '';
    });
    Object.entries(viewButtons).forEach(([view, button]) => {
      const selected = visible.has(view);
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    sheetFooter.classList.toggle('pivot-active', !visible.has('sheet'));
    splitViewButton.classList.toggle('active', state.split.enabled);
    splitViewButtonLabel.textContent = state.split.enabled
      ? `${viewLabels[state.split.left]} + ${viewLabels[state.split.right]}`
      : '分割畫面';
    splitLeftView.value = state.split.left;
    splitRightView.value = state.split.right;
    closeColumnMenu();
    window.requestAnimationFrame(() => {
      renderVisibleAnalyses();
      if (visible.has('sheet')) renderSelection();
    });
  }

  function showView(view) {
    state.activeView = view;
    state.split.enabled = false;
    closeSplitViewMenu();
    applyViewLayout();
    if (view === 'sheet') scrollArea.focus({ preventScroll: true });
    scheduleSave();
  }

  function scheduleSave() {
    saveStatus.textContent = '正在儲存…';
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cells: state.cells, title: titleInput.value, hasHeader: state.hasHeader, filters: state.filters, pivot: state.pivot, chart: state.chart, line: state.line, pie: state.pie, scenarios: state.scenarios, goal: state.goal, activeView: state.activeView, split: state.split }));
      saveStatus.textContent = '已儲存';
    }, 250);
  }

  function loadSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.cells) state.cells = saved.cells;
      if (saved?.title && saved.title !== 'Untitled sheet') titleInput.value = saved.title;
      state.hasHeader = Boolean(saved?.hasHeader);
      state.filters = saved?.filters && typeof saved.filters === 'object' ? saved.filters : {};
      if (saved?.pivot && typeof saved.pivot === 'object') state.pivot = { ...state.pivot, ...saved.pivot };
      if (saved?.chart && typeof saved.chart === 'object') state.chart = { ...state.chart, ...saved.chart };
      if (saved?.line && typeof saved.line === 'object') state.line = { ...state.line, ...saved.line };
      if (saved?.pie && typeof saved.pie === 'object') state.pie = { ...state.pie, ...saved.pie };
      if (Array.isArray(saved?.scenarios)) {
        state.scenarios = saved.scenarios
          .filter((scenario) => scenario && scenario.id && scenario.name && scenario.values && typeof scenario.values === 'object')
          .map((scenario) => ({ ...scenario, resultCells: Array.isArray(scenario.resultCells) ? scenario.resultCells.filter((address) => parseAddress(address)) : [] }));
      }
      if (saved?.goal && typeof saved.goal === 'object') state.goal = { ...state.goal, ...saved.goal };
      if (viewElements[saved?.activeView]) state.activeView = saved.activeView;
      if (saved?.split && typeof saved.split === 'object') {
        const left = viewElements[saved.split.left] ? saved.split.left : 'sheet';
        const right = viewElements[saved.split.right] ? saved.split.right : 'chart';
        state.split = { enabled: Boolean(saved.split.enabled) && left !== right, left, right };
      }
      headerToggle.checked = state.hasHeader;
    } catch { /* Ignore corrupt local data. */ }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function hasSheetData() {
    return Object.values(state.cells).some((record) => record.value !== '');
  }

  function resetAnalysisConfigs(sampleName) {
    state.pivot = { row: '0', column: '1', value: sampleName === 'pivot' ? '5' : '1', fn: 'sum' };
    state.chart = {
      object: '0',
      values: sampleName === 'bar' ? ['1', '2', '3'] : ['1', '2'],
      layout: 'grouped',
      initialized: true
    };
    state.line = {
      object: '0',
      values: sampleName === 'line' ? ['1', '2', '3'] : ['1', '2'],
      initialized: true
    };
    state.pie = {
      object: '0',
      values: sampleName === 'pie' ? ['1', '2', '3', '4'] : ['1', '2'],
      initialized: true
    };
  }

  function loadSampleData(sampleName) {
    const sample = SAMPLE_DATASETS[sampleName];
    if (!sample) return;
    if (hasSheetData() && !window.confirm(`要以「${sample.label}」範例取代工作表內的全部資料嗎？`)) return;
    recordHistory();
    state.cells = {};
    sample.rows.forEach((values, row) => values.forEach((value, col) => {
      state.cells[keyOf(row, col)] = { value: String(value), bold: false, italic: false, align: 'left' };
    }));
    state.hasHeader = true;
    state.filters = {};
    state.active = { row: 0, col: 0 };
    state.anchor = { ...state.active };
    headerToggle.checked = true;
    resetAnalysisConfigs(sampleName);
    renderAllCells();
    renderSelection();
    scrollArea.scrollTo({ top: 0, left: 0 });
    scheduleSave();
    showToast(`已載入「${sample.label}」範例 · ${sample.rows.length - 1} 列資料`);
  }

  function downloadCsv() {
    let lastRow = 0;
    let lastCol = 0;
    Object.entries(state.cells).forEach(([key, record]) => {
      if (!record.value) return;
      const [row, col] = key.split(':').map(Number);
      lastRow = Math.max(lastRow, row);
      lastCol = Math.max(lastCol, col);
    });
    const lines = [];
    for (let row = 0; row <= lastRow; row += 1) {
      const values = [];
      for (let col = 0; col <= lastCol; col += 1) values.push(`"${displayValue(row, col).replace(/"/g, '""')}"`);
      lines.push(values.join(','));
    }
    const blob = new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${titleInput.value.trim() || '試算表'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('已匯出 CSV');
  }

  grid.addEventListener('pointerdown', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell || state.editing) return;
    event.preventDefault();
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    state.dragging = true;
    setActive(row, col, event.shiftKey, false);
  });

  grid.addEventListener('pointerover', (event) => {
    if (!state.dragging) return;
    const cell = event.target.closest('.cell');
    if (!cell) return;
    state.active = { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
    renderSelection();
  });

  window.addEventListener('pointerup', () => { state.dragging = false; });
  grid.addEventListener('dblclick', (event) => { if (event.target.closest('.cell')) beginEditing(); });
  grid.addEventListener('click', (event) => {
    const trigger = event.target.closest('.column-menu-trigger');
    if (!trigger) return;
    event.stopPropagation();
    openColumnMenu(Number(trigger.dataset.colMenu), trigger);
  });

  scrollArea.addEventListener('keydown', (event) => {
    if (state.editing) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); beginEditing(); return; }
    if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); clearSelection(); return; }
    if (event.key === 'Tab') { event.preventDefault(); setActive(state.active.row, state.active.col + (event.shiftKey ? -1 : 1)); return; }
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();
      const [rowDelta, colDelta] = moves[event.key];
      setActive(state.active.row + rowDelta, state.active.col + colDelta, event.shiftKey);
      return;
    }
    if (!modifier && !event.altKey && event.key.length === 1) { event.preventDefault(); beginEditing(event.key); }
  });

  scrollArea.addEventListener('paste', (event) => {
    if (state.editing) return;
    event.preventDefault();
    pasteText(event.clipboardData.getData('text/plain'));
  });

  scrollArea.addEventListener('copy', (event) => {
    if (state.editing) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', selectionText(false));
    showToast('已複製到剪貼簿');
  });

  scrollArea.addEventListener('cut', (event) => {
    if (state.editing) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', selectionText(false));
    clearSelection();
    showToast('已剪下到剪貼簿');
  });

  grid.addEventListener('keydown', (event) => {
    if (!state.editing) return;
    if (event.key === 'Enter') { event.preventDefault(); finishEditing(true, { row: 1, col: 0 }); }
    if (event.key === 'Tab') { event.preventDefault(); finishEditing(true, { row: 0, col: event.shiftKey ? -1 : 1 }); }
    if (event.key === 'Escape') { event.preventDefault(); finishEditing(false); }
  });
  grid.addEventListener('blur', (event) => { if (state.editing && event.target.classList.contains('cell')) finishEditing(true); }, true);

  formulaInput.addEventListener('input', () => {
    const cell = getCellElement(state.active.row, state.active.col);
    cell.textContent = formulaInput.value;
  });
  formulaInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); commitFormulaBar(); setActive(state.active.row + 1, state.active.col); }
    if (event.key === 'Escape') { formulaInput.value = getRecord(state.active.row, state.active.col).value || ''; scrollArea.focus(); }
  });
  formulaInput.addEventListener('blur', commitFormulaBar);

  undoButton.addEventListener('click', undo);
  redoButton.addEventListener('click', redo);
  document.querySelector('#copy').addEventListener('click', () => copySelection());
  document.querySelector('#paste').addEventListener('click', pasteFromClipboard);
  boldButton.addEventListener('click', () => applyFormat('bold', !getRecord(state.active.row, state.active.col).bold));
  italicButton.addEventListener('click', () => applyFormat('italic', !getRecord(state.active.row, state.active.col).italic));
  alignSelect.addEventListener('change', () => applyFormat('align', alignSelect.value));
  sheetTabButton.addEventListener('click', () => showView('sheet'));
  pivotTabButton.addEventListener('click', () => showView('pivot'));
  chartTabButton.addEventListener('click', () => showView('chart'));
  lineTabButton.addEventListener('click', () => showView('line'));
  pieTabButton.addEventListener('click', () => showView('pie'));
  scenarioTabButton.addEventListener('click', () => showView('scenario'));
  goalTabButton.addEventListener('click', () => showView('goal'));
  splitViewButton.addEventListener('click', () => {
    const opening = splitViewMenu.hidden;
    closeAboutMenu();
    splitViewMenu.hidden = !opening;
    splitViewButton.setAttribute('aria-expanded', String(opening));
    if (opening) splitLeftView.focus();
  });
  aboutButton.addEventListener('click', () => {
    const opening = aboutMenu.hidden;
    closeSplitViewMenu();
    closeColumnMenu();
    aboutMenu.hidden = !opening;
    aboutButton.setAttribute('aria-expanded', String(opening));
  });
  document.querySelector('#close-about-menu').addEventListener('click', closeAboutMenu);
  document.querySelector('#close-split-view-menu').addEventListener('click', closeSplitViewMenu);
  document.querySelector('#swap-split-views').addEventListener('click', () => {
    const left = splitLeftView.value;
    splitLeftView.value = splitRightView.value;
    splitRightView.value = left;
  });
  document.querySelector('#apply-split-view').addEventListener('click', () => {
    if (splitLeftView.value === splitRightView.value) {
      showToast('請選擇兩個不同的分頁');
      splitRightView.focus();
      return;
    }
    state.split = { enabled: true, left: splitLeftView.value, right: splitRightView.value };
    state.activeView = state.split.left;
    closeSplitViewMenu();
    applyViewLayout();
    scheduleSave();
    showToast(`已並排顯示「${viewLabels[state.split.left]}」及「${viewLabels[state.split.right]}」`);
  });
  document.querySelector('#single-view-button').addEventListener('click', () => {
    state.activeView = state.split.enabled ? state.split.left : splitLeftView.value;
    state.split.enabled = false;
    closeSplitViewMenu();
    applyViewLayout();
    scheduleSave();
    showToast(`已以單一畫面顯示「${viewLabels[state.activeView]}」`);
  });
  document.querySelector('#scenario-use-selection').addEventListener('click', () => {
    const addresses = currentSelectionAddresses();
    scenarioCellsInput.value = addresses.length > 12 ? `${addresses[0]}:${addresses[addresses.length - 1]}` : addresses.join(',');
    scenarioCellsInput.focus();
  });
  document.querySelector('#scenario-use-result-selection').addEventListener('click', () => {
    const addresses = currentSelectionAddresses();
    scenarioResultCellsInput.value = addresses.length > 12 ? `${addresses[0]}:${addresses[addresses.length - 1]}` : addresses.join(',');
    scenarioResultCellsInput.focus();
  });
  document.querySelector('#save-scenario').addEventListener('click', saveCurrentScenario);
  scenarioList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-scenario-action]');
    if (!button) return;
    const scenario = state.scenarios.find((item) => item.id === button.dataset.scenarioId);
    if (!scenario) return;
    if (button.dataset.scenarioAction === 'apply') applyScenario(scenario);
    if (button.dataset.scenarioAction === 'update') {
      scenarioNameInput.value = scenario.name;
      scenarioCellsInput.value = Object.keys(scenario.values).join(',');
      scenarioResultCellsInput.value = Array.isArray(scenario.resultCells) ? scenario.resultCells.join(',') : '';
      Object.keys(scenario.values).forEach((address) => {
        const point = parseAddress(address);
        if (point) scenario.values[address] = getRecord(point.row, point.col).value || '';
      });
      renderScenarios();
      scheduleSave();
      showToast(`已使用目前數值更新情境「${scenario.name}」`);
    }
    if (button.dataset.scenarioAction === 'delete' && window.confirm(`確定要刪除情境「${scenario.name}」嗎？`)) {
      state.scenarios = state.scenarios.filter((item) => item.id !== scenario.id);
      renderScenarios();
      scheduleSave();
      showToast(`已刪除情境「${scenario.name}」`);
    }
  });
  document.querySelector('#goal-use-formula-cell').addEventListener('click', () => {
    state.goal.formula = addressOf(state.active.row, state.active.col);
    goalFormulaCell.value = state.goal.formula;
  });
  document.querySelector('#goal-use-changing-cell').addEventListener('click', () => {
    state.goal.changing = addressOf(state.active.row, state.active.col);
    goalChangingCell.value = state.goal.changing;
  });
  [goalFormulaCell, goalTargetValue, goalChangingCell].forEach((input) => {
    input.addEventListener('input', () => {
      state.goal.formula = goalFormulaCell.value;
      state.goal.target = goalTargetValue.value;
      state.goal.changing = goalChangingCell.value;
      scheduleSave();
    });
  });
  document.querySelector('#run-goal-seek').addEventListener('click', runGoalSeek);
  [pivotRowField, pivotColumnField, pivotValueField, pivotFunction].forEach((control) => {
    control.addEventListener('change', () => {
      state.pivot = {
        row: pivotRowField.value,
        column: pivotColumnField.value,
        value: pivotValueField.value,
        fn: pivotFunction.value
      };
      renderPivot();
      scheduleSave();
    });
  });
  chartObjectField.addEventListener('change', () => {
    state.chart.object = chartObjectField.value;
    renderBarChart();
    scheduleSave();
  });
  chartDataOptions.addEventListener('change', () => {
    state.chart.values = [...chartDataOptions.querySelectorAll('input[type="checkbox"]:checked')].map((checkbox) => checkbox.value);
    renderBarChart();
    scheduleSave();
  });
  document.querySelectorAll('input[name="chart-layout"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.chart.layout = radio.value;
      renderBarChart();
      scheduleSave();
    });
  });
  lineObjectField.addEventListener('change', () => {
    state.line.object = lineObjectField.value;
    renderLineChart();
    scheduleSave();
  });
  lineDataOptions.addEventListener('change', () => {
    state.line.values = [...lineDataOptions.querySelectorAll('input[type="checkbox"]:checked')].map((checkbox) => checkbox.value);
    renderLineChart();
    scheduleSave();
  });
  pieObjectField.addEventListener('change', () => {
    state.pie.object = pieObjectField.value;
    renderPieChart();
    scheduleSave();
  });
  pieDataOptions.addEventListener('change', () => {
    state.pie.values = [...pieDataOptions.querySelectorAll('input[type="checkbox"]:checked')].map((checkbox) => checkbox.value);
    renderPieChart();
    scheduleSave();
  });
  headerToggle.addEventListener('change', () => {
    state.hasHeader = headerToggle.checked;
    renderAllCells();
    renderSelection();
    scheduleSave();
    showToast(state.hasHeader ? '已將第 1 列設為標題列' : '已取消標題列');
  });
  titleInput.addEventListener('input', scheduleSave);
  document.querySelectorAll('.sample-button').forEach((button) => {
    button.addEventListener('click', () => loadSampleData(button.dataset.sample));
  });
  document.querySelector('#download-csv').addEventListener('click', downloadCsv);
  document.querySelector('#clear-sheet').addEventListener('click', () => {
    if (!Object.keys(state.cells).length || !window.confirm('確定要清除這個工作表內的所有儲存格嗎？')) return;
    recordHistory();
    state.cells = {};
    state.filters = {};
    renderAllCells();
    renderSelection();
    scheduleSave();
    showToast('已清除工作表');
  });

  document.querySelector('#close-column-menu').addEventListener('click', closeColumnMenu);
  document.querySelector('#sort-ascending').addEventListener('click', () => {
    if (state.menuColumn !== null) sortColumn(state.menuColumn, 'ascending');
  });
  document.querySelector('#sort-descending').addEventListener('click', () => {
    if (state.menuColumn !== null) sortColumn(state.menuColumn, 'descending');
  });
  document.querySelector('#apply-filter').addEventListener('click', applyColumnFilter);
  document.querySelector('#clear-column-filter').addEventListener('click', () => {
    if (state.menuColumn === null) return;
    delete state.filters[state.menuColumn];
    renderDataView();
    renderVisibleAnalyses();
    renderSelection();
    scheduleSave();
    closeColumnMenu();
    showToast('已清除篩選條件');
  });
  document.querySelector('#select-all-values').addEventListener('click', () => {
    filterValues.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = true; });
    updateFilterCount();
  });
  document.querySelector('#clear-all-values').addEventListener('click', () => {
    filterValues.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = false; });
    updateFilterCount();
  });
  filterValues.addEventListener('change', updateFilterCount);
  filterSearch.addEventListener('input', () => {
    const query = filterSearch.value.trim().toLocaleLowerCase();
    filterValues.querySelectorAll('.filter-value').forEach((label) => {
      label.hidden = Boolean(query) && !label.dataset.filterText.includes(query) && !(label.dataset.filterText === '' && '（空白）'.includes(query));
    });
  });
  document.addEventListener('pointerdown', (event) => {
    if (!columnMenu.hidden && !columnMenu.contains(event.target) && !event.target.closest('.column-menu-trigger')) closeColumnMenu();
    if (!splitViewMenu.hidden && !splitViewMenu.contains(event.target) && !splitViewButton.contains(event.target)) closeSplitViewMenu();
    if (!aboutMenu.hidden && !aboutMenu.contains(event.target) && !aboutButton.contains(event.target)) closeAboutMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !columnMenu.hidden) closeColumnMenu();
    if (event.key === 'Escape' && !splitViewMenu.hidden) closeSplitViewMenu();
    if (event.key === 'Escape' && !aboutMenu.hidden) closeAboutMenu();
  });
  let chartResizeTimer;
  window.addEventListener('resize', () => {
    closeColumnMenu();
    window.clearTimeout(chartResizeTimer);
    chartResizeTimer = window.setTimeout(() => {
      renderVisibleAnalyses();
    }, 100);
  });

  createGrid();
  loadSaved();
  applyViewLayout();
  renderAllCells();
  renderSelection();
  updateHistoryButtons();
})();
