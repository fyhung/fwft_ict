import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../prototype/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../prototype/gameplay.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../prototype/styles.css", import.meta.url), "utf8");

function createElement() {
  const classes = new Set<string>();
  const element: Record<string, any> = {
    children: [],
    className: "",
    dataset: {},
    disabled: false,
    style: { setProperty() {} },
    textContent: "",
    value: "",
    classList: {
      add: (...names: string[]) => names.forEach((name) => classes.add(name)),
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      toggle: (name: string, force?: boolean) => force === undefined ? (classes.has(name) ? (classes.delete(name), false) : (classes.add(name), true)) : (force ? classes.add(name) : classes.delete(name), force),
    },
    addEventListener() {},
    append(...children: unknown[]) { element.children.push(...children); },
    replaceChildren(...children: unknown[]) { element.children = children; },
    setAttribute() {},
    getBoundingClientRect() { return { width: 900, height: 650 }; },
  };
  return element;
}

function createCanvasContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({ createLinearGradient: () => gradient }, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      return () => {};
    },
    set() { return true; },
  });
}

function loadPrototype() {
  const elements = new Map<string, ReturnType<typeof createElement>>();
  const canvas = createElement();
  canvas.getContext = () => createCanvasContext();
  const documentStub = {
    getElementById(id: string) {
      if (id === "gameCanvas") return canvas;
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    createElement,
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  documentStub.getElementById("difficultySelect")!.value = "normal";
  documentStub.getElementById("timeSelect")!.value = "5";
  documentStub.getElementById("runnerSelect")!.value = "8";
  const windowStub: Record<string, any> = { devicePixelRatio: 1, addEventListener() {} };

  const factory = new Function(
    "document", "window", "performance", "requestAnimationFrame", "setTimeout", "clearTimeout",
    source,
  );
  factory(
    documentStub,
    windowStub,
    { now: () => 1000 },
    () => 0,
    (callback: () => void) => { callback(); return 0; },
    () => {},
  );
  return windowStub.SQL_RUN_TEST_API;
}

function placePlayerOnLane(prototype: any, lane: number) {
  const section = prototype.state.sections[prototype.state.currentStep];
  prototype.state.player.x = prototype.laneCenter(section, lane);
  prototype.state.player.y = prototype.sectionY(prototype.state.currentStep) + prototype.geometry.rowHeight * .5 - prototype.footOffset;
}

describe("dynamic offline gameplay prototype", () => {
  it("uses only local prototype assets and has valid source files", () => {
    expect(() => new Function(source)).not.toThrow();
    expect(html).toContain('src="gameplay.js"');
    expect(html).toContain('href="styles.css"');
    expect(html + source + styles).not.toMatch(/https?:\/\//i);
    expect(html).toContain("動態玩法原型");
    expect(html).toContain("查看題目並準備");
    expect(html).toContain('id="readyQuestion"');
    expect(html).toContain('id="readyTable"');
    expect(html).toContain('id="readyFields"');
    expect(html).toContain('id="readyRefreshBasic"');
    expect(html).toContain('id="readyRefreshMedium"');
    expect(html).toContain('id="readyRefreshHard"');
    expect(styles).toContain('.refresh-button[data-level="basic"]');
    expect(styles).toContain('.refresh-button[data-level="medium"]');
    expect(styles).toContain('.refresh-button[data-level="hard"]');
    expect(html).toContain('id="readyDifficulty"');
    expect(styles).toContain('.question-level[data-level="basic"]');
    expect(styles).toContain('.question-level[data-level="medium"]');
    expect(styles).toContain('.question-level[data-level="hard"]');
    expect(html).toContain('id="timeSelect"');
    expect(html).toContain('value="nightmare"');
  });

  it("prepares a mission before the player confirms readiness", () => {
    const prototype = loadPrototype();
    prototype.prepareReadyScreen();
    expect(prototype.state.pendingMission).toBeTruthy();
    expect(prototype.state.pendingMission.table).toMatch(/^(ELE|STD|ENROLL)$/);
    expect(prototype.state.pendingMission.fields.length).toBeGreaterThan(0);
  });

  it("contains 40 valid missions based only on the supplied database", () => {
    const prototype = loadPrototype();
    expect(prototype.missions).toHaveLength(40);
    expect(Object.keys(prototype.dictionary)).toEqual(["ELE", "STD", "ENROLL"]);
    for (const mission of prototype.missions) {
      const qualified = mission.tables.length > 1;
      const expectedFields = mission.tables.flatMap((table: string) => prototype.dictionary[table].map((field: string[]) => qualified ? `${table}.${field[0]}` : field[0]));
      expect(mission.fields).toEqual(expectedFields);
      for (const [kind, value] of mission.tokens) {
        if (kind === "table") expect(mission.tables).toContain(value);
        if (kind === "field" && value !== "*") {
          const [possibleTable, possibleField] = value.includes(".") ? value.split(".") : [mission.table, value];
          const fieldNames = prototype.dictionary[possibleTable].map((field: string[]) => field[0]);
          expect(mission.tables).toContain(possibleTable);
          expect(fieldNames).toContain(possibleField);
        }
      }
    }
  });

  it("includes every question level and advanced SQL clauses", () => {
    const prototype = loadPrototype();
    const levels = new Set(prototype.missions.map((mission: any) => mission.level));
    expect(levels).toEqual(new Set(["basic", "medium", "hard"]));
    const tokenValues = prototype.missions.flatMap((mission: any) => mission.tokens.map((token: string[]) => token[1]));
    expect(tokenValues).toContain("GROUP BY");
    expect(tokenValues).toContain("HAVING");
    expect(tokenValues).toContain("INNER JOIN");
    expect(tokenValues).toContain("ORDER BY");
    expect(tokenValues).toContain("COUNT(*)");
    expect(prototype.missions.some((mission: any) => mission.tables.length === 3)).toBe(true);
  });

  it("shows bilingual fields and refreshes to a different selected-level mission", () => {
    const prototype = loadPrototype();
    prototype.prepareReadyScreen();
    expect(prototype.bilingualField("STD", "SName")).toBe("SName · 學生姓名");
    for (const level of ["basic", "medium", "hard"]) {
      const firstMission = prototype.state.pendingMission;
      prototype.refreshReadyMission(level);
      expect(prototype.state.pendingMission).not.toBe(firstMission);
      expect(prototype.state.pendingMission.level).toBe(level);
    }
  });

  it("uses longer plates and mixed-type distractors", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    expect(prototype.geometry.rowHeight).toBeGreaterThanOrEqual(230);
    for (const section of prototype.state.sections) {
      const correctKind = section.options[section.correctLane][0];
      expect(section.options.some((option: [string, string], lane: number) => lane !== section.correctLane && option[0] !== correctKind)).toBe(true);
    }
  });

  it("supports four independent difficulty ranges from two to five plates", () => {
    const prototype = loadPrototype();
    const expected: Record<string, [number, number]> = { easy: [2, 2], normal: [2, 3], hard: [3, 4], nightmare: [4, 5] };
    for (const [difficulty, [minimum, maximum]] of Object.entries(expected)) {
      prototype.state.difficulty = difficulty;
      const laneCounts = Array.from({ length: 40 }, (_, step) => prototype.createSection(["keyword", "SELECT"], step).laneCount);
      expect(Math.min(...laneCounts)).toBeGreaterThanOrEqual(minimum);
      expect(Math.max(...laneCounts)).toBeLessThanOrEqual(maximum);
      if (minimum === maximum) expect(new Set(laneCounts)).toEqual(new Set([minimum]));
    }
  });

  it("reads the time limit separately and times the road to reach the bottom", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    expect(prototype.state.difficulty).toBe("normal");
    expect(prototype.state.decisionSeconds).toBe(5);
    const travelSeconds = .3 + prototype.state.decisionSeconds;
    const startTop = prototype.sectionY(0);
    const remainingRows = (prototype.geometry.height - prototype.geometry.rowHeight - startTop) / prototype.geometry.rowHeight;
    expect(prototype.state.roadRowsPerSecond).toBeCloseTo(remainingRows / travelSeconds, 8);
    prototype.updateRoad(travelSeconds - .01);
    expect(prototype.sectionY(0) + prototype.geometry.rowHeight).toBeLessThan(prototype.geometry.height);
    prototype.updateRoad(.01);
    expect(prototype.sectionY(0) + prototype.geometry.rowHeight).toBeCloseTo(prototype.geometry.height, 5);
  });

  it("moves faster for a shorter independently selected timer", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    prototype.state.decisionSeconds = 10;
    const slowSpeed = prototype.adjustRoadSpeedForTimer();
    prototype.state.decisionSeconds = 2;
    const fastSpeed = prototype.adjustRoadSpeedForTimer();
    expect(fastSpeed).toBeGreaterThan(slowSpeed);
  });

  it("moves the road downward and the player smoothly", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    const startingScroll = prototype.state.scrollRows;
    const startingRoadY = prototype.sectionY(0);
    const startingX = prototype.state.player.x;
    prototype.state.keys.add("right");
    prototype.updateGame(.05);
    expect(prototype.state.scrollRows).toBeGreaterThan(startingScroll);
    expect(prototype.sectionY(0)).toBeGreaterThan(startingRoadY);
    expect(prototype.state.player.x).toBeGreaterThan(startingX);
    expect(prototype.state.player.alive).toBe(true);
  });

  it("keeps the complete active plate row inside the canvas", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    prototype.updateRoad(100);
    const activeTop = prototype.sectionY(prototype.state.currentStep);
    expect(activeTop).toBeGreaterThanOrEqual(0);
    expect(activeTop + prototype.geometry.rowHeight).toBeLessThanOrEqual(prototype.geometry.height);
    expect(activeTop + prototype.geometry.rowHeight).toBeCloseTo(prototype.geometry.height, 5);
  });

  it("continues moving during locked and reveal phases until the plate touches bottom", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    prototype.state.phase = "locked";
    const beforeLocked = prototype.state.scrollRows;
    prototype.updateRoad(.5);
    expect(prototype.state.scrollRows).toBeGreaterThan(beforeLocked);
    prototype.state.phase = "reveal";
    const beforeReveal = prototype.state.scrollRows;
    prototype.updateRoad(.5);
    expect(prototype.state.scrollRows).toBeGreaterThan(beforeReveal);
    prototype.updateRoad(100);
    const stoppedAt = prototype.state.scrollRows;
    prototype.updateRoad(1);
    expect(prototype.state.scrollRows).toBe(stoppedAt);
  });

  it("keeps the runner alive on the locked correct ground plate", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    const correctLane = prototype.state.sections[0].correctLane;
    placePlayerOnLane(prototype, correctLane);
    prototype.lockChoices();
    prototype.resolveChoices();
    expect(prototype.state.player.alive).toBe(true);
    expect(prototype.state.player.safeSteps).toBe(1);
  });

  it("continues to the next SQL section when only one player remains", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    for (const runner of prototype.state.players.slice(1)) runner.alive = false;
    const correctLane = prototype.state.sections[0].correctLane;
    placePlayerOnLane(prototype, correctLane);
    prototype.lockChoices();
    prototype.resolveChoices();
    prototype.advanceSection();
    expect(prototype.state.player.alive).toBe(true);
    expect(prototype.state.currentStep).toBe(1);
    expect(prototype.state.running).toBe(true);
    expect(prototype.state.phase).toBe("prepare");
  });

  it("shows plate text only for current and completed sections", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    expect(prototype.shouldShowPlateText(0)).toBe(true);
    expect(prototype.shouldShowPlateText(1)).toBe(false);
    prototype.state.currentStep = 2;
    expect(prototype.shouldShowPlateText(0)).toBe(true);
    expect(prototype.shouldShowPlateText(2)).toBe(true);
    expect(prototype.shouldShowPlateText(3)).toBe(false);
  });

  it("drops the runner when a wrong ground plate collapses", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    const section = prototype.state.sections[0];
    const wrongLane = [...Array(section.laneCount).keys()].find((lane) => lane !== section.correctLane);
    expect(wrongLane).toBeDefined();
    placePlayerOnLane(prototype, wrongLane!);
    prototype.lockChoices();
    prototype.resolveChoices();
    expect(prototype.state.player.alive).toBe(false);
    expect(prototype.state.phase).toBe("falling");
    expect(prototype.state.player.choices[0].value).toBe(section.options[wrongLane!][1]);
    expect(prototype.state.player.choices[0].correct).toBe(false);
  });

  it("kills the runner immediately outside every plate boundary", () => {
    const prototype = loadPrototype();
    prototype.beginRace();
    prototype.state.player.x = prototype.geometry.roadLeft - 1;
    prototype.updateGame(1 / 120);
    expect(prototype.state.player.alive).toBe(false);
    expect(prototype.state.fallReason).toContain("邊界");
  });
});
