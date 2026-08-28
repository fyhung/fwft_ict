import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const htmlPath = path.join(root, "sweetchie-room.html");
const testHtmlPath = path.join(root, "sweetchie-room-test.html");
const html = fs.readFileSync(htmlPath, "utf8");
const testHtml = fs.readFileSync(testHtmlPath, "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

for (const [label, document] of [["production", html], ["test", testHtml]]) {
  expect(!document.includes("__SWEETCHIE_"), `${label}: all embedded-asset placeholders must be replaced`);
  expect(!document.includes("__ICT_TOPIC_E_BANK_SCRIPT__"), `${label}: the question-bank placeholder must be replaced`);
  expect(!document.includes("__TEST_PANEL_"), `${label}: test-panel build markers must be removed`);
  expect(!document.includes("__ROOM_VARIANT__"), `${label}: room-variant build marker must be replaced`);
  expect((document.match(/data:image\/png;base64,/g) || []).length === 3, `${label}: exactly three PNG atlases must be embedded`);
  expect(!/(?:src|href)=["']https?:/i.test(document), `${label}: prototype must not load external resources`);
  expect(!/\bfetch\s*\(/.test(document), `${label}: prototype must not fetch resources at runtime`);
  expect(document.includes("window.ICT_TOPIC_E_BANK="), `${label}: standalone HTML must embed the Topic E bank`);
  const scripts = [...document.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  expect(scripts.length >= 2, `${label}: must contain its question bank and inline room engine`);
  for (const script of scripts) {
    try { new Function(script[1]); }
    catch (error) { failures.push(`${label}: inline JavaScript must parse: ${error.message}`); }
  }
}

expect(html.includes('<canvas id="room" width="1152" height="832"'), "logical canvas must remain 1152x832");
expect(html.includes('row = horizontal >= 0 ? 0 : 1'), "northward movement must select the rear left/right atlas rows");
expect(html.includes('row = horizontal >= 0 ? 1 : 2'), "southward movement must select the existing front left/right rows");
expect(html.includes("findPath(startPoint, endPoint)"), "pathfinding must be included");
expect(html.includes("playSequence(sequence, label"), "object action sequencing must be included");
expect(html.includes('name === "twirl" ? 155'), "twirl must use its smoother 155 ms cadence");
expect(html.includes('name === "twirl" ? Math.max(4, loops)'), "twirl must play at least four complete rotations");
expect((html.match(/data-animation=/g) || []).length === 0, "production HTML must contain no animation-test buttons");
expect(html.includes('<body class="production">'), "production HTML must use the learner-facing responsive variant");
expect(testHtml.includes('<body class="test">'), "test HTML must identify the animation-test variant");
expect(html.includes("@media (max-width: 1024px)"), "production HTML must include the tablet layout");
expect(html.includes("@media (max-width: 700px)"), "production HTML must include the mobile layout");
expect(html.includes("@media (orientation: landscape) and (max-height: 560px)"), "production HTML must include the landscape-phone layout");
expect(html.includes("env(safe-area-inset-bottom)"), "production HTML must respect mobile safe areas");
expect((testHtml.match(/data-animation=/g) || []).length === 27, "test HTML must contain all 27 movement and action buttons");
expect(testHtml.includes("Animation test buttons"), "test HTML must show the animation laboratory");
expect(!html.includes("Animation test buttons"), "production HTML must omit the animation laboratory");
expect(html.includes('walkNorthWest: { source: "backWalk", row: 1'), "north-west preview must use rear atlas row 1");
expect(html.includes('walkNorthEast: { source: "backWalk", row: 0'), "north-east preview must use rear atlas row 0");
expect(html.includes("this.previewAction(button.dataset.animation)"), "animation test buttons must be connected to the room engine");
expect(html.includes("class QuizController"), "the offline quiz controller must be included");
expect(html.includes("sweetchie-ict-quiz-progress-v1"), "local progress persistence must be included");
expect(html.includes("reactToQuizAnswer(correct, stats)"), "performance reactions must be connected");
expect(html.includes('["think", "wait", "yawn", "stretch"]'), "idle quiz reactions must be included");
expect(html.includes('id: "quizDesk"') && html.includes('id: "reviewShelf"') && html.includes('id: "dashboard"'), "all three quiz-room objects must be included");
expect(!html.includes('id: "bed"'), "the quiz room must not include a bed object");
expect(fs.statSync(htmlPath).size > 9_500_000, "self-contained HTML should include the artwork and question-bank payloads");
expect(fs.statSync(testHtmlPath).size > fs.statSync(htmlPath).size, "test HTML should be larger because it includes the animation laboratory");

const bankSource = fs.readFileSync(path.join(root, "ICT_E", "ict-topic-e-all.js"), "utf8");
const bankContext = { window: {} };
vm.runInNewContext(bankSource, bankContext);
expect(bankContext.window.ICT_TOPIC_E_BANK?.questions?.length === 1000, "the embedded source bank must contain exactly 1,000 questions");

for (const filename of ["sweetchie-atlas.png", "sweetchie-extra-actions.png", "sweetchie-back-walk.png"]) {
  const bytes = fs.readFileSync(path.join(root, "assets", filename));
  expect(bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `${filename} must be a valid PNG`);
}

if (failures.length) {
  console.error(failures.map(message => `FAIL: ${message}`).join("\n"));
  process.exit(1);
}

console.log("PASS: self-contained Sweetchie room prototype verified");
