"use strict";

const DICT = {
  ELE: [["EID", "VARCHAR", "4", "科目代碼", "PK"], ["ENAME", "VARCHAR", "20", "科目完整名稱", ""], ["Teacher", "VARCHAR", "30", "負責老師", ""], ["MaxQuota", "INTEGER", "-", "收生名額上限", ""]],
  STD: [["SID", "VARCHAR", "8", "學生註冊編號", "PK"], ["SName", "VARCHAR", "30", "學生姓名", ""], ["CLS", "VARCHAR", "2", "學生班別", ""], ["CNO", "INTEGER", "-", "班內學號", ""]],
  ENROLL: [["SID", "VARCHAR", "8", "參照 STD.SID", "PK, FK"], ["EID", "VARCHAR", "4", "參照 ELE.EID", "PK, FK"], ["AYEAR", "VARCHAR", "9", "選修學年", ""], ["Pref", "INTEGER", "-", "志願優先次序", ""]]
};

function mission(prompt, tables, levelOrTokens, optionalTokens) {
  const tableList = Array.isArray(tables) ? tables : [tables];
  const tokens = optionalTokens || levelOrTokens;
  const level = optionalTokens ? levelOrTokens : tokens.some((token) => token[1] === "WHERE") ? "medium" : "basic";
  const qualified = tableList.length > 1;
  const fields = tableList.flatMap((table) => DICT[table].map((field) => qualified ? `${table}.${field[0]}` : field[0]));
  return { prompt, table: tableList[0], tables: tableList, fields, level, tokens };
}

const MISSIONS = [
  mission("顯示所有科目資料。", "ELE", [["keyword", "SELECT"], ["field", "*"], ["keyword", "FROM"], ["table", "ELE"]]),
  mission("顯示所有科目的完整名稱。", "ELE", [["keyword", "SELECT"], ["field", "ENAME"], ["keyword", "FROM"], ["table", "ELE"]]),
  mission("顯示所有科目的負責老師。", "ELE", [["keyword", "SELECT"], ["field", "Teacher"], ["keyword", "FROM"], ["table", "ELE"]]),
  mission("找出收生名額上限至少為 30 的科目完整名稱。", "ELE", [["keyword", "SELECT"], ["field", "ENAME"], ["keyword", "FROM"], ["table", "ELE"], ["keyword", "WHERE"], ["field", "MaxQuota"], ["operator", ">="], ["value", "30"]]),
  mission("找出由 'Chan Tai Man' 負責的科目代碼。", "ELE", [["keyword", "SELECT"], ["field", "EID"], ["keyword", "FROM"], ["table", "ELE"], ["keyword", "WHERE"], ["field", "Teacher"], ["operator", "="], ["value", "'Chan Tai Man'"]]),
  mission("顯示收生名額上限少於 25 的所有科目資料。", "ELE", [["keyword", "SELECT"], ["field", "*"], ["keyword", "FROM"], ["table", "ELE"], ["keyword", "WHERE"], ["field", "MaxQuota"], ["operator", "<"], ["value", "25"]]),
  mission("顯示所有學生資料。", "STD", [["keyword", "SELECT"], ["field", "*"], ["keyword", "FROM"], ["table", "STD"]]),
  mission("顯示所有學生的姓名。", "STD", [["keyword", "SELECT"], ["field", "SName"], ["keyword", "FROM"], ["table", "STD"]]),
  mission("找出 1A 班所有學生的姓名。", "STD", [["keyword", "SELECT"], ["field", "SName"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "WHERE"], ["field", "CLS"], ["operator", "="], ["value", "'1A'"]]),
  mission("找出班內學號大於 20 的學生註冊編號。", "STD", [["keyword", "SELECT"], ["field", "SID"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "WHERE"], ["field", "CNO"], ["operator", ">"], ["value", "20"]]),
  mission("找出學生註冊編號為 '20240001' 的學生姓名。", "STD", [["keyword", "SELECT"], ["field", "SName"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "WHERE"], ["field", "SID"], ["operator", "="], ["value", "'20240001'"]]),
  mission("顯示 2B 班所有學生資料。", "STD", [["keyword", "SELECT"], ["field", "*"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "WHERE"], ["field", "CLS"], ["operator", "="], ["value", "'2B'"]]),
  mission("顯示所有選修記錄。", "ENROLL", [["keyword", "SELECT"], ["field", "*"], ["keyword", "FROM"], ["table", "ENROLL"]]),
  mission("顯示所有選修記錄中的學生註冊編號。", "ENROLL", [["keyword", "SELECT"], ["field", "SID"], ["keyword", "FROM"], ["table", "ENROLL"]]),
  mission("找出 2025-2026 學年的所有科目代碼。", "ENROLL", [["keyword", "SELECT"], ["field", "EID"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "WHERE"], ["field", "AYEAR"], ["operator", "="], ["value", "'2025-2026'"]]),
  mission("找出列為第一志願的學生註冊編號。", "ENROLL", [["keyword", "SELECT"], ["field", "SID"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "WHERE"], ["field", "Pref"], ["operator", "="], ["value", "1"]]),
  mission("顯示科目代碼為 'ICT1' 的所有選修記錄。", "ENROLL", [["keyword", "SELECT"], ["field", "*"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "WHERE"], ["field", "EID"], ["operator", "="], ["value", "'ICT1'"]]),
  mission("找出志願優先次序不高於 2 的科目代碼。", "ENROLL", [["keyword", "SELECT"], ["field", "EID"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "WHERE"], ["field", "Pref"], ["operator", "<="], ["value", "2"]]),
  mission("找出學生註冊編號為 '20240008' 的選修學年。", "ENROLL", [["keyword", "SELECT"], ["field", "AYEAR"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "WHERE"], ["field", "SID"], ["operator", "="], ["value", "'20240008'"]]),
  mission("顯示志願優先次序大於 3 的所有選修記錄。", "ENROLL", [["keyword", "SELECT"], ["field", "*"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "WHERE"], ["field", "Pref"], ["operator", ">"], ["value", "3"]]),
  mission("顯示所有不同的學生班別。", "STD", "medium", [["keyword", "SELECT"], ["keyword", "DISTINCT"], ["field", "CLS"], ["keyword", "FROM"], ["table", "STD"]]),
  mission("按班內學號由小至大顯示學生姓名。", "STD", "medium", [["keyword", "SELECT"], ["field", "SName"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "ORDER BY"], ["field", "CNO"], ["keyword", "ASC"]]),
  mission("按收生名額上限由大至小顯示科目完整名稱。", "ELE", "medium", [["keyword", "SELECT"], ["field", "ENAME"], ["keyword", "FROM"], ["table", "ELE"], ["keyword", "ORDER BY"], ["field", "MaxQuota"], ["keyword", "DESC"]]),
  mission("計算學生總人數。", "STD", "medium", [["keyword", "SELECT"], ["expression", "COUNT(*)"], ["keyword", "FROM"], ["table", "STD"]]),
  mission("計算所有科目的平均收生名額上限。", "ELE", "medium", [["keyword", "SELECT"], ["expression", "AVG(MaxQuota)"], ["keyword", "FROM"], ["table", "ELE"]]),
  mission("找出最大的班內學號。", "STD", "medium", [["keyword", "SELECT"], ["expression", "MAX(CNO)"], ["keyword", "FROM"], ["table", "STD"]]),
  mission("計算所有科目的收生名額上限總和。", "ELE", "medium", [["keyword", "SELECT"], ["expression", "SUM(MaxQuota)"], ["keyword", "FROM"], ["table", "ELE"]]),
  mission("找出最小的志願優先次序。", "ENROLL", "medium", [["keyword", "SELECT"], ["expression", "MIN(Pref)"], ["keyword", "FROM"], ["table", "ENROLL"]]),
  mission("按學生班別分組，計算每班學生人數。", "STD", "hard", [["keyword", "SELECT"], ["expression", "CLS, COUNT(*)"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "GROUP BY"], ["field", "CLS"]]),
  mission("按科目代碼分組，計算每科選修記錄數目。", "ENROLL", "hard", [["keyword", "SELECT"], ["expression", "EID, COUNT(*)"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "GROUP BY"], ["field", "EID"]]),
  mission("找出選修記錄超過 5 筆的科目代碼及記錄數目。", "ENROLL", "hard", [["keyword", "SELECT"], ["expression", "EID, COUNT(*)"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "GROUP BY"], ["field", "EID"], ["keyword", "HAVING"], ["expression", "COUNT(*)"], ["operator", ">"], ["value", "5"]]),
  mission("找出平均志願優先次序不高於 2 的科目代碼及平均值。", "ENROLL", "hard", [["keyword", "SELECT"], ["expression", "EID, AVG(Pref)"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "GROUP BY"], ["field", "EID"], ["keyword", "HAVING"], ["expression", "AVG(Pref)"], ["operator", "<="], ["value", "2"]]),
  mission("連接學生與選修記錄，顯示學生姓名及所選科目代碼。", ["STD", "ENROLL"], "hard", [["keyword", "SELECT"], ["expression", "STD.SName, ENROLL.EID"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "INNER JOIN"], ["table", "ENROLL"], ["keyword", "ON"], ["field", "STD.SID"], ["operator", "="], ["field", "ENROLL.SID"]]),
  mission("連接科目與選修記錄，顯示科目完整名稱及學生註冊編號。", ["ELE", "ENROLL"], "hard", [["keyword", "SELECT"], ["expression", "ELE.ENAME, ENROLL.SID"], ["keyword", "FROM"], ["table", "ELE"], ["keyword", "INNER JOIN"], ["table", "ENROLL"], ["keyword", "ON"], ["field", "ELE.EID"], ["operator", "="], ["field", "ENROLL.EID"]]),
  mission("連接三個資料表，顯示學生姓名及所選科目的完整名稱。", ["STD", "ENROLL", "ELE"], "hard", [["keyword", "SELECT"], ["expression", "STD.SName, ELE.ENAME"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "INNER JOIN"], ["table", "ENROLL"], ["keyword", "ON"], ["field", "STD.SID"], ["operator", "="], ["field", "ENROLL.SID"], ["keyword", "INNER JOIN"], ["table", "ELE"], ["keyword", "ON"], ["field", "ENROLL.EID"], ["operator", "="], ["field", "ELE.EID"]]),
  mission("連接學生與選修記錄，顯示 2025-2026 學年的學生姓名及科目代碼。", ["STD", "ENROLL"], "hard", [["keyword", "SELECT"], ["expression", "STD.SName, ENROLL.EID"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "INNER JOIN"], ["table", "ENROLL"], ["keyword", "ON"], ["field", "STD.SID"], ["operator", "="], ["field", "ENROLL.SID"], ["keyword", "WHERE"], ["field", "ENROLL.AYEAR"], ["operator", "="], ["value", "'2025-2026'"]]),
  mission("連接科目與選修記錄，找出選修人數至少為 10 的科目名稱及人數。", ["ELE", "ENROLL"], "hard", [["keyword", "SELECT"], ["expression", "ELE.ENAME, COUNT(*)"], ["keyword", "FROM"], ["table", "ELE"], ["keyword", "INNER JOIN"], ["table", "ENROLL"], ["keyword", "ON"], ["field", "ELE.EID"], ["operator", "="], ["field", "ENROLL.EID"], ["keyword", "GROUP BY"], ["field", "ELE.ENAME"], ["keyword", "HAVING"], ["expression", "COUNT(*)"], ["operator", ">="], ["value", "10"]]),
  mission("按選修學年分組計算記錄數目，並按學年排序。", "ENROLL", "hard", [["keyword", "SELECT"], ["expression", "AYEAR, COUNT(*)"], ["keyword", "FROM"], ["table", "ENROLL"], ["keyword", "GROUP BY"], ["field", "AYEAR"], ["keyword", "ORDER BY"], ["field", "AYEAR"], ["keyword", "ASC"]]),
  mission("連接學生與選修記錄，按志願優先次序顯示學生姓名。", ["STD", "ENROLL"], "hard", [["keyword", "SELECT"], ["expression", "STD.SName, ENROLL.Pref"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "INNER JOIN"], ["table", "ENROLL"], ["keyword", "ON"], ["field", "STD.SID"], ["operator", "="], ["field", "ENROLL.SID"], ["keyword", "ORDER BY"], ["field", "ENROLL.Pref"], ["keyword", "ASC"]]),
  mission("找出學生人數至少為 20 的班別及學生人數。", "STD", "hard", [["keyword", "SELECT"], ["expression", "CLS, COUNT(*)"], ["keyword", "FROM"], ["table", "STD"], ["keyword", "GROUP BY"], ["field", "CLS"], ["keyword", "HAVING"], ["expression", "COUNT(*)"], ["operator", ">="], ["value", "20"]])
];

const DISTRACTORS = {
  keyword: ["SELECT", "DISTINCT", "FROM", "WHERE", "INNER JOIN", "ON", "GROUP BY", "HAVING", "ORDER BY", "ASC", "DESC"],
  field: ["*", ...new Set(Object.values(DICT).flatMap((fields) => fields.map((field) => field[0]))), ...Object.entries(DICT).flatMap(([table, fields]) => fields.map((field) => `${table}.${field[0]}`))],
  expression: ["COUNT(*)", "AVG(MaxQuota)", "MAX(CNO)", "MIN(Pref)", "SUM(MaxQuota)", "CLS, COUNT(*)", "EID, COUNT(*)", "AYEAR, COUNT(*)", "EID, AVG(Pref)", "STD.SName, ENROLL.EID", "ELE.ENAME, ENROLL.SID"],
  table: Object.keys(DICT),
  operator: ["=", "!=", ">", "<", ">=", "<=", "LIKE"],
  value: ["1", "2", "3", "20", "25", "30", "'1A'", "'2B'", "'ICT1'", "'2025-2026'", "'20240001'"]
};

const NAMES = ["你", "Ada", "Grace", "Linus", "Margaret", "Alan", "Radia", "Tim", "Barbara", "James", "Annie", "Edsger", "Jean", "Ken", "Frances", "Dennis"];
const COLORS = ["#4de5ff", "#ff8faf", "#ffc766", "#72f1a6", "#a880ff", "#ff7f63", "#61a5ff", "#d5f56b", "#ff9ee8", "#7be0c3", "#cf9cff", "#ffb56e", "#8cbcff", "#c6ff78", "#ef7d93", "#80e3ff"];
const TIMER_CIRCUMFERENCE = Math.PI * 54;
const FOOT_OFFSET = 15;
const DIFFICULTY_CONFIG = {
  easy: { minimumLanes: 2, maximumLanes: 2, botSkill: .76 },
  normal: { minimumLanes: 2, maximumLanes: 3, botSkill: .68 },
  hard: { minimumLanes: 3, maximumLanes: 4, botSkill: .61 },
  nightmare: { minimumLanes: 4, maximumLanes: 5, botSkill: .54 }
};
const QUESTION_LEVELS = {
  basic: { label: "基礎 · BASIC" },
  medium: { label: "中等 · MEDIUM" },
  hard: { label: "困難 · HARD" }
};

const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const elements = Object.fromEntries([
  "roundValue", "aliveValue", "phaseValue", "missionTitle", "missionCopy", "schemaName", "schemaFields", "queryValue", "phaseBanner", "timerWrap", "timerCircle", "timerNumber", "statusMessage", "rankingList", "eventMessage", "pauseButton", "resetButton", "answerButton", "boundsButton", "skipButton", "startOverlay", "difficultySelect", "timeSelect", "runnerSelect", "startButton", "readyOverlay", "readyDifficulty", "readyQuestion", "readyTable", "readyFields", "readyPoolCount", "readyButton", "readyRefreshBasic", "readyRefreshMedium", "readyRefreshHard", "readyBackButton", "resultOverlay", "resultIcon", "resultTitle", "resultCopy", "resultQuery", "resultStandings", "raceAgainButton", "toast"
].map((id) => [id, document.getElementById(id)]));

const state = {
  running: false,
  paused: false,
  phase: "ready",
  phaseElapsed: 0,
  speed: 1,
  showAnswer: false,
  showBounds: false,
  pendingMission: null,
  mission: null,
  difficulty: "normal",
  sections: [],
  completed: [],
  currentStep: 0,
  scrollRows: 0,
  decisionSeconds: 5,
  roadRowsPerSecond: .1,
  players: [],
  player: null,
  keys: new Set(),
  touch: new Set(),
  lastTime: performance.now(),
  accumulator: 0,
  fallReason: "",
  fallElapsed: 0,
  finishPending: false,
  toastTimer: 0
};

const geometry = {
  width: 900,
  height: 650,
  dpr: 1,
  roadLeft: 190,
  roadWidth: 520,
  rowHeight: 220,
  originY: 240
};

const PHASE_LABELS = {
  ready: "準備", prepare: "預備", choosing: "移動", locked: "已鎖定", reveal: "公布",
  breaking: "崩塌", advance: "前進", falling: "墜落", results: "結果"
};

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function approach(value, target, amount) { return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount); }
function fieldDescription(table, fieldName) {
  if (fieldName === "*") return "全部欄位";
  const parts = fieldName.split(".");
  const sourceTable = parts.length > 1 ? parts[0] : table;
  const bareName = parts.length > 1 ? parts.slice(1).join(".") : fieldName;
  const localField = DICT[sourceTable]?.find((field) => field[0] === bareName);
  const anyField = localField || Object.values(DICT).flat().find((field) => field[0] === bareName);
  return anyField?.[3] || "欄位";
}
function bilingualField(table, fieldName) { return `${fieldName} · ${fieldDescription(table, fieldName)}`; }

function phaseDurations() {
  return { prepare: .3, choosing: state.decisionSeconds, locked: .2, reveal: .45, breaking: .65, advance: .8 };
}

function createSection(token, step) {
  const difficulty = DIFFICULTY_CONFIG[state.difficulty] || DIFFICULTY_CONFIG.normal;
  const laneCount = difficulty.minimumLanes + Math.floor(Math.random() * (difficulty.maximumLanes - difficulty.minimumLanes + 1));
  const allWrongTokens = shuffle(Object.entries(DISTRACTORS).flatMap(([kind, values]) =>
    values.map((value) => [kind, value]).filter((candidate) => candidate[0] !== token[0] || candidate[1] !== token[1])
  ));
  const differentType = allWrongTokens.filter((candidate) => candidate[0] !== token[0]);
  const wrongTokens = [randomItem(differentType)];
  for (const candidate of allWrongTokens) {
    if (wrongTokens.length >= laneCount - 1) break;
    if (!wrongTokens.some((selected) => selected[0] === candidate[0] && selected[1] === candidate[1])) wrongTokens.push(candidate);
  }
  const options = shuffle([token, ...wrongTokens]);
  return {
    step,
    laneCount,
    options,
    correctLane: options.findIndex((option) => option[1] === token[1]),
    breakProgress: 0
  };
}

function resizeCanvas() {
  const rectangle = canvas.getBoundingClientRect();
  const oldWidth = geometry.width || rectangle.width;
  const oldHeight = geometry.height || rectangle.height;
  geometry.width = Math.max(320, rectangle.width || 900);
  geometry.height = Math.max(420, rectangle.height || 650);
  geometry.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(geometry.width * geometry.dpr);
  canvas.height = Math.round(geometry.height * geometry.dpr);
  context.setTransform(geometry.dpr, 0, 0, geometry.dpr, 0, 0);
  geometry.roadWidth = clamp(geometry.width * .66, 300, 660);
  geometry.roadLeft = (geometry.width - geometry.roadWidth) / 2;
  geometry.rowHeight = clamp(geometry.height * .44, 230, 310);
  if (state.player) {
    state.player.x *= geometry.width / oldWidth;
    state.player.y *= geometry.height / oldHeight;
  }
  const footY = state.player ? state.player.y + FOOT_OFFSET : geometry.height * .72 + FOOT_OFFSET;
  geometry.originY = footY - geometry.rowHeight * .9;
  if (state.running && state.sections[state.currentStep]) adjustRoadSpeedForTimer();
}

function sectionY(step) { return geometry.originY + (state.scrollRows - step) * geometry.rowHeight; }
function laneWidth(section) { return geometry.roadWidth / section.laneCount; }
function laneAtX(section, x) {
  if (x < geometry.roadLeft || x > geometry.roadLeft + geometry.roadWidth) return -1;
  return clamp(Math.floor((x - geometry.roadLeft) / laneWidth(section)), 0, section.laneCount - 1);
}
function laneCenter(section, lane) { return geometry.roadLeft + laneWidth(section) * (lane + .5); }

function supportAt(x, y) {
  if (x < geometry.roadLeft || x > geometry.roadLeft + geometry.roadWidth) return null;
  for (let step = -4; step < state.sections.length; step += 1) {
    const top = sectionY(step);
    if (y < top || y >= top + geometry.rowHeight) continue;
    if (step < 0) return { step, lane: 0, solid: true, section: null };
    const section = state.sections[step];
    const lane = laneAtX(section, x);
    let solid = true;
    if (step < state.currentStep) solid = lane === section.correctLane;
    if (step === state.currentStep && ["breaking", "advance"].includes(state.phase)) solid = lane === section.correctLane;
    return { step, lane, solid, section };
  }
  return null;
}

function renderReadyMission() {
  const level = QUESTION_LEVELS[state.pendingMission.level];
  elements.readyDifficulty.dataset.level = state.pendingMission.level;
  elements.readyDifficulty.textContent = level.label;
  elements.readyQuestion.textContent = state.pendingMission.prompt;
  elements.readyTable.textContent = state.pendingMission.tables.join(" + ");
  elements.readyFields.replaceChildren(...state.pendingMission.fields.map((field) => {
    const code = document.createElement("code");
    code.textContent = bilingualField(state.pendingMission.table, field);
    return code;
  }));
  elements.readyPoolCount.textContent = String(MISSIONS.length);
}

function prepareReadyScreen() {
  state.pendingMission = randomItem(MISSIONS);
  renderReadyMission();
  elements.startOverlay.classList.add("hidden");
  elements.readyOverlay.classList.remove("hidden");
}

function refreshReadyMission(level) {
  const alternatives = MISSIONS.filter((candidate) => candidate !== state.pendingMission && (!level || candidate.level === level));
  state.pendingMission = randomItem(alternatives);
  renderReadyMission();
  const levelLabel = level ? QUESTION_LEVELS[level].label : "隨機";
  showToast(`已換成${levelLabel}題目`);
}

function beginRace() {
  state.difficulty = elements.difficultySelect.value;
  state.decisionSeconds = clamp(Number(elements.timeSelect.value) || 5, 2, 10);
  state.mission = state.pendingMission || randomItem(MISSIONS);
  state.pendingMission = null;
  state.sections = state.mission.tokens.map(createSection);
  state.completed = [];
  state.currentStep = 0;
  state.scrollRows = 0;
  state.fallElapsed = 0;
  state.fallReason = "";
  state.finishPending = false;
  state.keys.clear();
  state.touch.clear();

  const runnerCount = Number(elements.runnerSelect.value);
  state.players = Array.from({ length: runnerCount }, (_, index) => ({
    id: index,
    name: NAMES[index],
    color: COLORS[index],
    human: index === 0,
    alive: true,
    falling: false,
    fallElapsed: 0,
    safeSteps: 0,
    eliminatedAt: null,
    averageReaction: null,
    reactionTotal: 0,
    reactions: 0,
    targetLane: null,
    lockedLane: null,
    choices: [],
    deathReason: "",
    commitAt: 0,
    x: geometry.width / 2,
    y: geometry.height * .72,
    vx: 0,
    vy: 0
  }));
  state.player = state.players[0];
  resizeCanvas();
  state.player.x = geometry.width / 2;
  state.player.y = geometry.height * .72;
  geometry.originY = state.player.y + FOOT_OFFSET - geometry.rowHeight * .9;
  adjustRoadSpeedForTimer();
  state.running = true;
  state.paused = false;
  state.lastTime = performance.now();
  elements.pauseButton.textContent = "Ⅱ";
  elements.startOverlay.classList.add("hidden");
  elements.readyOverlay.classList.add("hidden");
  elements.resultOverlay.classList.add("hidden");
  renderMission();
  prepareBots();
  enterPhase("prepare", "下一組地面板塊正在接近");
  renderRanking();
  showToast("雙腳必須留在實體板塊上");
}

function renderMission() {
  elements.missionTitle.textContent = `${state.mission.tables.join(" + ")} 資料表查詢`;
  elements.missionCopy.textContent = state.mission.prompt;
  elements.schemaName.textContent = state.mission.tables.join(" + ");
  elements.schemaFields.replaceChildren(...state.mission.fields.map((field) => {
    const span = document.createElement("span");
    span.textContent = bilingualField(state.mission.table, field);
    return span;
  }));
}

function prepareBots() {
  const section = state.sections[state.currentStep];
  const skill = (DIFFICULTY_CONFIG[state.difficulty] || DIFFICULTY_CONFIG.normal).botSkill;
  for (const runner of state.players) {
    if (runner.human || !runner.alive) continue;
    runner.lockedLane = null;
    runner.commitAt = state.decisionSeconds * (.12 + Math.random() * .7);
    if (Math.random() < skill) runner.targetLane = section.correctLane;
    else runner.targetLane = randomItem([...Array(section.laneCount).keys()].filter((lane) => lane !== section.correctLane));
  }
}

function enterPhase(phase, message) {
  state.phase = phase;
  state.phaseElapsed = 0;
  elements.phaseBanner.dataset.phase = phase;
  elements.phaseBanner.textContent = message;
  if (phase === "locked") lockChoices();
  if (phase === "breaking") resolveChoices();
  renderHud();
  updateStatus();
}

function lockChoices() {
  const section = state.sections[state.currentStep];
  const support = supportAt(state.player.x, state.player.y + FOOT_OFFSET);
  state.player.lockedLane = support?.step === state.currentStep ? support.lane : null;
  state.player.choices[state.currentStep] = choiceRecord(section, state.player.lockedLane);
  for (const runner of state.players) {
    if (runner.human || !runner.alive) continue;
    runner.lockedLane = laneAtX(section, runner.x);
    runner.choices[state.currentStep] = choiceRecord(section, runner.lockedLane);
  }
  elements.eventMessage.textContent = state.player.lockedLane === null
    ? "位置鎖定時，你沒有站在目前的板塊區域。"
    : `你的位置已鎖定在第 ${state.player.lockedLane + 1} 條跑道。`;
}

function choiceRecord(section, lane) {
  if (lane === null || lane < 0 || lane >= section.laneCount) return { value: "離開跑道", lane: null, correct: false };
  return { value: section.options[lane][1], lane, correct: lane === section.correctLane };
}

function resolveChoices() {
  const section = state.sections[state.currentStep];
  const eliminated = [];
  for (const runner of state.players) {
    if (!runner.alive) continue;
    if (runner.lockedLane === section.correctLane) {
      runner.safeSteps += 1;
      continue;
    }
    if (runner.human) {
      triggerPlayerDeath(runner.lockedLane === null ? "鎖定前你已離開目前的板塊區域。" : "你腳下的 SQL 板塊崩塌了。");
    } else {
      runner.alive = false;
      runner.falling = true;
      runner.fallElapsed = 0;
      runner.eliminatedAt = state.currentStep;
      runner.deathReason = `選擇了 ${runner.choices[state.currentStep]?.value ?? "離開跑道"}`;
      eliminated.push(runner.name);
    }
  }
  if (state.phase !== "falling") {
    elements.eventMessage.textContent = eliminated.length
      ? `${eliminated.join("、")} 墜落了。錯誤板塊已經消失。`
      : "所有玩家都留在安全板塊上。";
  }
  renderRanking();
}

function transitionPhase() {
  if (!state.running || state.phase === "falling") return;
  switch (state.phase) {
    case "prepare": enterPhase("choosing", "自由移動到安全板塊"); break;
    case "choosing": enterPhase("locked", "位置已鎖定"); break;
    case "locked": enterPhase("reveal", "公布安全板塊"); break;
    case "reveal": enterPhase("breaking", "錯誤板塊正在崩塌"); break;
    case "breaking": enterPhase("advance", "跑道繼續移動"); break;
    case "advance": advanceSection(); break;
  }
}

function advanceSection() {
  const token = state.mission.tokens[state.currentStep];
  state.completed.push(token);
  state.currentStep += 1;
  if (state.currentStep >= state.sections.length) return finishRace("query");
  adjustRoadSpeedForTimer();
  prepareBots();
  enterPhase("prepare", "下一組地面板塊正在接近");
}

function triggerPlayerDeath(reason) {
  if (!state.player?.alive || state.phase === "falling" || state.phase === "results") return;
  if (!state.player.choices[state.currentStep] && state.sections[state.currentStep]) {
    const section = state.sections[state.currentStep];
    const support = supportAt(state.player.x, state.player.y + FOOT_OFFSET);
    const lane = support?.step === state.currentStep ? support.lane : null;
    state.player.choices[state.currentStep] = choiceRecord(section, lane);
  }
  state.player.alive = false;
  state.player.falling = true;
  state.player.fallElapsed = 0;
  state.player.eliminatedAt = state.currentStep;
  state.player.deathReason = reason;
  state.fallReason = reason;
  state.fallElapsed = 0;
  state.phase = "falling";
  state.phaseElapsed = 0;
  elements.phaseBanner.dataset.phase = "falling";
  elements.phaseBanner.textContent = "你已墜落";
  elements.eventMessage.textContent = reason;
  elements.statusMessage.textContent = reason;
  renderHud();
  renderRanking();
}

function finishRace(reason) {
  if (state.phase === "results") return;
  state.running = false;
  state.phase = "results";
  const ranking = rankedPlayers();
  const winner = ranking[0];
  const userPlace = ranking.findIndex((runner) => runner.human) + 1;
  const userWon = winner?.human;
  elements.resultIcon.textContent = userWon ? "🏆" : "💥";
  elements.resultTitle.textContent = userWon ? "你勝出了！" : `${winner?.name ?? "沒有玩家"} 勝出`;
  elements.resultCopy.textContent = state.fallReason || (reason === "query"
    ? `SQL 查詢已完成。你的名次是第 ${userPlace} 名，共 ${ranking.length} 位玩家。`
    : `${winner?.name ?? "最後一位玩家"} 是最後生還者。你的名次是第 ${userPlace} 名，共 ${ranking.length} 位玩家。`);
  elements.resultQuery.textContent = `正確 SQL：${state.mission.tokens.map((token) => token[1]).join(" ")}`;
  renderResultStandings(ranking);
  elements.resultOverlay.classList.remove("hidden");
  renderHud();
}

function renderResultStandings(ranking) {
  elements.resultStandings.replaceChildren(...ranking.map((runner, index) => {
    const row = document.createElement("div");
    row.className = `result-player${runner.human ? " is-you" : ""}`;

    const order = document.createElement("div");
    order.className = "result-order";
    order.textContent = String(index + 1);

    const name = document.createElement("div");
    name.className = "result-name";
    name.textContent = runner.name;
    const detail = document.createElement("small");
    detail.textContent = runner.alive ? "生還" : runner.deathReason || `在第 ${runner.eliminatedAt + 1} 關墜落`;
    name.append(detail);

    const history = document.createElement("div");
    history.className = "token-history";
    for (let tokenIndex = 0; tokenIndex < state.mission.tokens.length; tokenIndex += 1) {
      const correctValue = state.mission.tokens[tokenIndex][1];
      const choice = runner.choices[tokenIndex];
      const token = document.createElement("div");
      token.className = `result-token${choice && !choice.correct ? " mistake" : ""}${!choice ? " future" : ""}`;
      const wrong = document.createElement("span");
      wrong.className = "wrong-choice";
      wrong.textContent = choice && !choice.correct ? choice.value : "";
      const correct = document.createElement("span");
      correct.className = "correct-token";
      correct.textContent = correctValue;
      token.append(wrong, correct);
      history.append(token);
    }

    row.append(order, name, history);
    return row;
  }));
}

function movementVector() {
  const has = (name) => state.keys.has(name) || state.touch.has(name);
  let x = Number(has("right")) - Number(has("left"));
  let y = Number(has("down")) - Number(has("up"));
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
}

function updatePlayer(stepSeconds) {
  if (!state.player.alive) return;
  const direction = movementVector();
  const moving = direction.x !== 0 || direction.y !== 0;
  const maxSpeed = 220;
  const acceleration = 1100;
  const drag = moving ? 820 : 1450;
  state.player.vx = approach(state.player.vx, direction.x * maxSpeed, (moving ? acceleration : drag) * stepSeconds);
  state.player.vy = approach(state.player.vy, direction.y * maxSpeed, (moving ? acceleration : drag) * stepSeconds);
  state.player.x += state.player.vx * stepSeconds;
  state.player.y += state.player.vy * stepSeconds;

  const support = supportAt(state.player.x, state.player.y + FOOT_OFFSET);
  if (!support?.solid) triggerPlayerDeath("你走出了實體板塊的邊界。");
}

function updateBots(stepSeconds) {
  const section = state.sections[state.currentStep];
  if (!section) return;
  for (const runner of state.players) {
    if (runner.human) continue;
    if (runner.falling) {
      runner.fallElapsed += stepSeconds;
      continue;
    }
    if (!runner.alive) continue;
    const shouldCommit = state.phase !== "prepare" && state.phaseElapsed >= runner.commitAt;
    const targetLane = shouldCommit ? runner.targetLane : laneAtX(section, runner.x);
    const targetX = laneCenter(section, clamp(targetLane, 0, section.laneCount - 1));
    runner.vx = approach(runner.vx, Math.sign(targetX - runner.x) * 170, 700 * stepSeconds);
    if (Math.abs(targetX - runner.x) < 4) runner.vx = 0;
    runner.x += runner.vx * stepSeconds;
    const targetY = geometry.height * (.67 + (runner.id % 3) * .025);
    runner.y += (targetY - runner.y) * Math.min(1, stepSeconds * 4);
  }
}

function updateRoad(stepSeconds) {
  if (!["prepare", "choosing", "locked", "reveal", "breaking", "advance", "falling"].includes(state.phase)) return;
  const activeTop = sectionY(state.currentStep);
  const maximumTop = geometry.height - geometry.rowHeight;
  if (activeTop >= maximumTop) return;
  const requestedRows = state.roadRowsPerSecond * stepSeconds;
  const availableRows = (maximumTop - activeTop) / geometry.rowHeight;
  state.scrollRows += Math.min(requestedRows, availableRows);
}

function adjustRoadSpeedForTimer() {
  const activeTop = sectionY(state.currentStep);
  const maximumTop = geometry.height - geometry.rowHeight;
  const remainingRows = Math.max(0, (maximumTop - activeTop) / geometry.rowHeight);
  const travelSeconds = phaseDurations().prepare + state.decisionSeconds;
  state.roadRowsPerSecond = remainingRows / Math.max(.1, travelSeconds);
  return state.roadRowsPerSecond;
}

function updateGame(stepSeconds) {
  if (!state.running || state.paused) return;
  updateRoad(stepSeconds);
  if (state.phase === "falling") {
    state.fallElapsed += stepSeconds;
    state.player.fallElapsed += stepSeconds;
    updateBots(stepSeconds);
    if (state.fallElapsed >= 1.15) finishRace("fall");
    return;
  }

  state.phaseElapsed += stepSeconds;
  updatePlayer(stepSeconds);
  updateBots(stepSeconds);
  if (state.phase === "breaking") {
    state.sections[state.currentStep].breakProgress = clamp(state.phaseElapsed / phaseDurations().breaking, 0, 1);
  }
  const phaseComplete = state.phaseElapsed >= phaseDurations()[state.phase];
  const currentPlateTouchesBottom = sectionY(state.currentStep) + geometry.rowHeight >= geometry.height - .5;
  const mayTransition = state.phase !== "advance" || currentPlateTouchesBottom;
  if (state.phase !== "falling" && phaseComplete && mayTransition) transitionPhase();
}

function skipPhase() {
  if (!state.running || state.paused || state.phase === "falling") return;
  const duration = phaseDurations()[state.phase];
  state.phaseElapsed = duration;
  if (state.phase !== "advance") transitionPhase();
}

function setPaused(paused) {
  if (!state.running) return;
  state.paused = paused;
  state.keys.clear();
  state.touch.clear();
  elements.pauseButton.textContent = paused ? "▶" : "Ⅱ";
  elements.phaseBanner.textContent = paused ? "原型已暫停" : phaseMessage(state.phase);
  renderHud();
}

function phaseMessage(phase) {
  return {
    prepare: "下一組地面板塊正在接近", choosing: "自由移動到安全板塊", locked: "位置已鎖定",
    reveal: "公布安全板塊", breaking: "錯誤板塊正在崩塌", advance: "跑道繼續移動", falling: "你已墜落"
  }[phase] || phase;
}

function rankedPlayers() {
  return [...state.players].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (a.safeSteps !== b.safeSteps) return b.safeSteps - a.safeSteps;
    return (a.averageReaction ?? Infinity) - (b.averageReaction ?? Infinity) || a.name.localeCompare(b.name);
  });
}

function renderHud() {
  elements.roundValue.textContent = state.mission ? `${Math.min(state.currentStep + 1, state.sections.length)}/${state.sections.length}` : "—";
  elements.aliveValue.textContent = state.players.length ? `${state.players.filter((runner) => runner.alive).length}/${state.players.length}` : "—";
  elements.phaseValue.textContent = state.paused ? "已暫停" : PHASE_LABELS[state.phase] || state.phase;
}

function renderRanking() {
  elements.rankingList.replaceChildren(...rankedPlayers().map((runner, index) => {
    const row = document.createElement("div");
    row.className = `rank-row${runner.human ? " you" : ""}${runner.alive ? "" : " out"}`;
    row.style.setProperty("--runner-color", runner.color);
    const rank = document.createElement("span"); rank.className = "rank-number"; rank.textContent = String(index + 1);
    const dot = document.createElement("span"); dot.className = "rank-dot";
    const name = document.createElement("span"); name.className = "rank-name"; name.textContent = runner.name;
    const score = document.createElement("span"); score.className = "rank-score"; score.textContent = runner.alive ? `${runner.safeSteps} 關安全` : `第 ${runner.eliminatedAt + 1} 關墜落`;
    row.append(rank, dot, name, score);
    return row;
  }));
}

function updateStatus() {
  if (!state.player?.alive) return;
  const support = supportAt(state.player.x, state.player.y + FOOT_OFFSET);
  const messages = {
    prepare: "地面會持續移動，請站在板塊中央。",
    choosing: support?.step === state.currentStep ? `你目前位於第 ${support.lane + 1} 條跑道。請在鎖定前順暢移動。` : "請在鎖定前返回發光的目前板塊區域。",
    locked: state.player.lockedLane === null ? "你錯過了目前的板塊區域。" : `已鎖定第 ${state.player.lockedLane + 1} 條跑道。`,
    reveal: state.player.lockedLane === state.sections[state.currentStep]?.correctLane ? "地面正確，繼續向上跑。" : "地面錯誤，板塊即將墜落。",
    breaking: "已崩塌的板塊現在是空洞。",
    advance: "下一組 SQL 板塊正向你移動。"
  };
  elements.statusMessage.textContent = messages[state.phase] || "繼續移動。";
}

function updateTimer() {
  const duration = phaseDurations()[state.phase] || 1;
  const remaining = Math.max(0, duration - state.phaseElapsed);
  const fraction = clamp(remaining / duration, 0, 1);
  elements.timerCircle.style.strokeDasharray = TIMER_CIRCUMFERENCE;
  elements.timerCircle.style.strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - fraction);
  elements.timerNumber.textContent = state.phase === "choosing" ? remaining.toFixed(1) : ["ready", "results", "falling"].includes(state.phase) ? "—" : "•";
  elements.timerWrap.classList.toggle("danger", state.phase === "choosing" && fraction < .25);
}

function updateQuery() {
  elements.queryValue.textContent = state.completed.map((token) => token[1]).join(" ") + (state.completed.length ? " " : "");
  const cursor = document.createElement("i");
  elements.queryValue.append(cursor);
}

function drawBackground(time) {
  const gradient = context.createLinearGradient(0, 0, 0, geometry.height);
  gradient.addColorStop(0, "#102a49");
  gradient.addColorStop(.55, "#0a1b30");
  gradient.addColorStop(1, "#030811");
  context.fillStyle = gradient;
  context.fillRect(0, 0, geometry.width, geometry.height);

  context.strokeStyle = "rgba(104, 192, 255, .12)";
  context.lineWidth = 2;
  for (let index = 0; index < 28; index += 1) {
    const side = index % 2 ? -1 : 1;
    const baseX = side < 0 ? geometry.roadLeft - 22 - (index % 7) * 22 : geometry.roadLeft + geometry.roadWidth + 22 + (index % 7) * 22;
    const y = (index * 73 + state.scrollRows * geometry.rowHeight * 1.8) % (geometry.height + 90) - 45;
    context.beginPath();
    context.moveTo(baseX, y - 20);
    context.lineTo(baseX + side * 7, y + 20);
    context.stroke();
  }

  context.fillStyle = "rgba(2, 7, 13, .68)";
  context.fillRect(geometry.roadLeft - 12, 0, geometry.roadWidth + 24, geometry.height);
  context.strokeStyle = "rgba(77,229,255,.25)";
  context.strokeRect(geometry.roadLeft - 8, -2, geometry.roadWidth + 16, geometry.height + 4);
}

function plateSolid(section, step, lane) {
  if (step < 0) return true;
  if (step < state.currentStep) return lane === section.correctLane;
  if (step === state.currentStep && ["breaking", "advance"].includes(state.phase)) return lane === section.correctLane;
  return true;
}

function drawSections(time) {
  for (let step = -4; step < state.sections.length; step += 1) {
    const top = sectionY(step);
    if (top > geometry.height + 40 || top + geometry.rowHeight < -40) continue;
    if (step < 0) {
      drawBaseSection(top);
      continue;
    }
    drawMissionSection(state.sections[step], top, time);
  }
}

function drawBaseSection(top) {
  context.fillStyle = "#173955";
  context.fillRect(geometry.roadLeft + 3, top + 3, geometry.roadWidth - 6, geometry.rowHeight - 6);
  context.strokeStyle = "rgba(115,208,255,.2)";
  context.strokeRect(geometry.roadLeft + 3, top + 3, geometry.roadWidth - 6, geometry.rowHeight - 6);
  drawPlateTexture(geometry.roadLeft + 3, top + 3, geometry.roadWidth - 6, geometry.rowHeight - 6);
}

function shouldShowPlateText(step) {
  return step <= state.currentStep;
}

function drawMissionSection(section, top, time) {
  const width = laneWidth(section);
  const active = section.step === state.currentStep;
  const answerVisible = state.showAnswer || section.step < state.currentStep || (active && ["reveal", "breaking", "advance"].includes(state.phase));
  if (active) {
    context.fillStyle = "rgba(77,229,255,.08)";
    context.fillRect(geometry.roadLeft - 9, top - 9, geometry.roadWidth + 18, geometry.rowHeight + 18);
  }

  for (let lane = 0; lane < section.laneCount; lane += 1) {
    const solid = plateSolid(section, section.step, lane);
    const wrongBreaking = active && state.phase === "breaking" && lane !== section.correctLane;
    if (!solid && !wrongBreaking) {
      if (state.showBounds) drawBoundaryRect(section, top, lane, false);
      continue;
    }
    const breakAmount = wrongBreaking ? section.breakProgress : 0;
    const drop = breakAmount * breakAmount * geometry.rowHeight * .75;
    const x = geometry.roadLeft + lane * width + 4;
    const y = top + 4 + drop;
    const plateWidth = width - 8;
    const plateHeight = geometry.rowHeight - 8;
    const correct = lane === section.correctLane;
    const alpha = wrongBreaking ? 1 - breakAmount : 1;
    context.save();
    context.globalAlpha = alpha;
    if (wrongBreaking) {
      context.translate((Math.random() - .5) * breakAmount * 9, 0);
      context.rotate((lane % 2 ? 1 : -1) * breakAmount * .055);
    }
    const gradient = context.createLinearGradient(x, y, x, y + plateHeight);
    if (answerVisible && correct) {
      gradient.addColorStop(0, "#72f1a6"); gradient.addColorStop(1, "#2c9a5d");
    } else if (answerVisible && !correct) {
      gradient.addColorStop(0, "#7b3040"); gradient.addColorStop(1, "#3b1722");
    } else {
      gradient.addColorStop(0, active ? "#276184" : "#1c4665"); gradient.addColorStop(1, active ? "#153b5b" : "#102c45");
    }
    context.fillStyle = gradient;
    roundedRect(x, y, plateWidth, plateHeight, 12);
    context.fill();
    context.strokeStyle = active ? "rgba(117,229,255,.58)" : "rgba(130,202,244,.25)";
    context.lineWidth = active ? 2 : 1;
    context.stroke();
    drawPlateTexture(x, y, plateWidth, plateHeight);

    if (shouldShowPlateText(section.step)) {
      const token = section.options[lane];
      const labelCenterY = y + plateHeight / 2;
      context.fillStyle = answerVisible && correct ? "rgba(255,255,255,.28)" : "rgba(2,10,18,.56)";
      roundedRect(x + 9, labelCenterY - 48, plateWidth - 18, 96, 10);
      context.fill();
      context.fillStyle = answerVisible && correct ? "#062518" : "#effbff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      const valueLines = token[0] === "expression" && token[1].includes(", ") ? token[1].split(", ") : [token[1]];
      const longestValue = Math.max(...valueLines.map((value) => value.length));
      const baseFontSize = clamp(width * .17, 22, 36);
      const tokenFontSize = clamp(baseFontSize * Math.min(1, 13 / longestValue), 14, baseFontSize);
      context.font = `950 ${tokenFontSize}px ui-monospace, Consolas, monospace`;
      context.lineWidth = 4;
      context.strokeStyle = answerVisible && correct ? "rgba(255,255,255,.5)" : "rgba(1,7,12,.8)";
      const firstLineY = labelCenterY - (valueLines.length - 1) * 11 - 8;
      valueLines.forEach((value, lineIndex) => {
        const lineY = firstLineY + lineIndex * 22;
        context.strokeText(value, x + plateWidth / 2, lineY, plateWidth - 22);
        context.fillText(value, x + plateWidth / 2, lineY, plateWidth - 22);
      });
      context.fillStyle = answerVisible && correct ? "rgba(6,37,24,.65)" : "rgba(210,231,244,.72)";
      context.font = "900 10px ui-sans-serif, system-ui";
      const kindLabel = token[0] === "field"
        ? `欄位 · ${fieldDescription(state.mission.table, token[1])}`
        : { keyword: "關鍵字", expression: "運算式", table: "資料表", operator: "運算子", value: "值" }[token[0]];
      context.fillText(kindLabel, x + plateWidth / 2, labelCenterY + 27, plateWidth - 18);
    }
    context.restore();
    if (state.showBounds) drawBoundaryRect(section, top, lane, solid);
  }

  if (active) {
    context.fillStyle = "rgba(5,15,25,.86)";
    roundedRect(geometry.roadLeft + 8, top + 10, 112, 24, 7);
    context.fill();
    context.fillStyle = "#4de5ff";
    context.textAlign = "center";
    context.font = "900 9px ui-sans-serif, system-ui";
    context.fillText(`目前關卡 ${section.step + 1}`, geometry.roadLeft + 64, top + 22);
  }
}

function drawBoundaryRect(section, top, lane, solid) {
  const width = laneWidth(section);
  context.save();
  context.strokeStyle = solid ? "rgba(113,242,165,.9)" : "rgba(255,96,119,.85)";
  context.setLineDash([6, 5]);
  context.lineWidth = 2;
  context.strokeRect(geometry.roadLeft + lane * width, top, width, geometry.rowHeight);
  context.restore();
}

function drawPlateTexture(x, y, width, height) {
  context.save();
  context.globalAlpha *= .18;
  context.strokeStyle = "#bceeff";
  context.lineWidth = 1;
  for (let lineY = y + 24; lineY < y + height; lineY += 34) {
    context.beginPath(); context.moveTo(x + 7, lineY); context.lineTo(x + width - 7, lineY); context.stroke();
  }
  context.restore();
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawRunner(runner, time) {
  let x = runner.x;
  let y = runner.y;
  let alpha = 1;
  let rotation = 0;
  if (runner.falling) {
    y += runner.fallElapsed * runner.fallElapsed * 260;
    x += Math.sin(runner.id + runner.fallElapsed * 4) * runner.fallElapsed * 35;
    rotation = runner.fallElapsed * (runner.id % 2 ? 3.4 : -3.4);
    alpha = clamp(1 - runner.fallElapsed * .62, 0, 1);
  }
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.rotate(rotation);
  context.fillStyle = "rgba(0,0,0,.35)";
  context.beginPath(); context.ellipse(0, FOOT_OFFSET + 2, runner.human ? 14 : 10, 4, 0, 0, Math.PI * 2); context.fill();
  const stride = Math.sin(time * .014 + runner.id) * (runner.human ? 5 : 3);
  context.strokeStyle = runner.color;
  context.lineWidth = runner.human ? 4 : 3;
  context.lineCap = "round";
  context.beginPath(); context.moveTo(0, -3); context.lineTo(-5, 6); context.lineTo(-6 + stride, 15); context.moveTo(0, -3); context.lineTo(5, 6); context.lineTo(6 - stride, 15); context.stroke();
  context.beginPath(); context.moveTo(0, -2); context.lineTo(0, -18); context.moveTo(0, -10); context.lineTo(-8 - stride * .35, -3); context.moveTo(0, -10); context.lineTo(8 + stride * .35, -3); context.stroke();
  context.fillStyle = "#ffd2b4";
  context.beginPath(); context.arc(0, -25, runner.human ? 7 : 5.5, 0, Math.PI * 2); context.fill();
  if (runner.human) {
    context.fillStyle = "#4de5ff";
    roundedRect(-18, -43, 36, 14, 7); context.fill();
    context.fillStyle = "#05111d"; context.textAlign = "center"; context.textBaseline = "middle"; context.font = "900 8px ui-sans-serif, system-ui"; context.fillText("你", 0, -36);
  }
  context.restore();
}

function render(time) {
  drawBackground(time);
  drawSections(time);
  const bots = state.players.filter((runner) => !runner.human);
  for (const runner of bots) if (runner.alive || runner.falling) drawRunner(runner, time);
  if (state.player) drawRunner(state.player, time);
  updateTimer();
  updateQuery();
  if (state.running && !state.paused && Math.floor(time / 180) !== Math.floor(state.lastRenderHud / 180)) {
    renderHud();
    updateStatus();
  }
  state.lastRenderHud = time;
}

function frame(time) {
  const elapsed = Math.min(.05, Math.max(0, (time - state.lastTime) / 1000));
  state.lastTime = time;
  state.accumulator += elapsed * state.speed;
  const fixedStep = 1 / 120;
  while (state.accumulator >= fixedStep) {
    updateGame(fixedStep);
    state.accumulator -= fixedStep;
  }
  render(time);
  requestAnimationFrame(frame);
}

function setKey(event, pressed) {
  const mapping = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
  const key = event.key.toLowerCase();
  if (key === "p" && pressed) { setPaused(!state.paused); return; }
  const direction = mapping[key];
  if (!direction) return;
  event.preventDefault();
  if (pressed) state.keys.add(direction); else state.keys.delete(direction);
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1700);
}

document.addEventListener("keydown", (event) => setKey(event, true));
document.addEventListener("keyup", (event) => setKey(event, false));
window.addEventListener("blur", () => { state.keys.clear(); state.touch.clear(); });
window.addEventListener("resize", resizeCanvas);

for (const button of document.querySelectorAll("[data-move]")) {
  const direction = button.dataset.move;
  const press = (event) => { event.preventDefault(); state.touch.add(direction); button.classList.add("active"); };
  const release = (event) => { event.preventDefault(); state.touch.delete(direction); button.classList.remove("active"); };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

elements.startButton.addEventListener("click", prepareReadyScreen);
elements.readyButton.addEventListener("click", beginRace);
elements.readyRefreshBasic.addEventListener("click", () => refreshReadyMission("basic"));
elements.readyRefreshMedium.addEventListener("click", () => refreshReadyMission("medium"));
elements.readyRefreshHard.addEventListener("click", () => refreshReadyMission("hard"));
elements.readyBackButton.addEventListener("click", () => {
  state.pendingMission = null;
  elements.readyOverlay.classList.add("hidden");
  elements.startOverlay.classList.remove("hidden");
});
elements.raceAgainButton.addEventListener("click", () => {
  state.pendingMission = null;
  elements.resultOverlay.classList.add("hidden");
  elements.readyOverlay.classList.add("hidden");
  elements.startOverlay.classList.remove("hidden");
});
elements.resetButton.addEventListener("click", () => {
  state.running = false;
  state.phase = "ready";
  state.pendingMission = null;
  elements.resultOverlay.classList.add("hidden");
  elements.readyOverlay.classList.add("hidden");
  elements.startOverlay.classList.remove("hidden");
  renderHud();
});
elements.pauseButton.addEventListener("click", () => setPaused(!state.paused));
elements.skipButton.addEventListener("click", skipPhase);
elements.answerButton.addEventListener("click", () => {
  state.showAnswer = !state.showAnswer;
  elements.answerButton.textContent = `顯示安全板塊：${state.showAnswer ? "開" : "關"}`;
  elements.answerButton.classList.toggle("active", state.showAnswer);
});
elements.boundsButton.addEventListener("click", () => {
  state.showBounds = !state.showBounds;
  elements.boundsButton.textContent = `碰撞邊界：${state.showBounds ? "開" : "關"}`;
  elements.boundsButton.classList.toggle("active", state.showBounds);
});
for (const button of document.querySelectorAll("[data-speed]")) {
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    document.querySelectorAll("[data-speed]").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
    showToast(`模擬速度：${state.speed}×`);
  });
}

window.SQL_RUN_TEST_API = {
  state,
  geometry,
  dictionary: DICT,
  missions: MISSIONS,
  questionLevels: QUESTION_LEVELS,
  difficultyConfig: DIFFICULTY_CONFIG,
  footOffset: FOOT_OFFSET,
  prepareReadyScreen,
  refreshReadyMission,
  bilingualField,
  beginRace,
  createSection,
  supportAt,
  laneCenter,
  sectionY,
  lockChoices,
  resolveChoices,
  advanceSection,
  shouldShowPlateText,
  triggerPlayerDeath,
  updateRoad,
  adjustRoadSpeedForTimer,
  updateGame
};

resizeCanvas();
renderHud();
requestAnimationFrame(frame);
