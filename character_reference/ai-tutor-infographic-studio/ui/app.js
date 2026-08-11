const form = document.querySelector('#studioForm');
const yamlOutput = document.querySelector('#yamlOutput');
const promptOutput = document.querySelector('#promptOutput');
const status = document.querySelector('#status');
const storageKey = 'ai-tutor-infographic-studio-v1';

const q = value => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const lines = value => value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'infographic-job';

function values() {
  const d = new FormData(form);
  return Object.fromEntries(d.entries());
}

function refs(v) {
  const realistic = v.referenceSet === 'realistic';
  return {
    face: realistic ? 'assets/character-reference/realistic-head-pose.png' : 'assets/character-reference/illustrated-head-pose.png',
    body: realistic ? 'assets/character-reference/realistic-full-body.png' : 'assets/character-reference/illustrated-full-body.png',
    outfit: v.outfit === 'black-uniform' ? 'assets/character-reference/realistic-full-body.png' : v.outfit === 'outdoor-sport' ? 'assets/character-reference/outdoor-outfit.png' : 'assets/character-reference/default-outfit.png',
    design: v.outfit === 'outdoor-sport' ? 'assets/character-reference/outdoor-outfit-design.png' : 'assets/character-reference/default-outfit-design.png'
  };
}

function buildYaml(v) {
  const r = refs(v), coverage = lines(v.coverage), sourceFiles = lines(v.sourceFiles);
  const list = items => items.map(x => `    - ${q(x)}`).join('\n');
  const sourceBlock = sourceFiles.length ? `  source_files:\n${list(sourceFiles)}` : '  source_files: []';
  return `job:
  id: ${q(slug(v.seriesEn + '-' + v.topicEn))}
  series:
    zh: ${q(v.seriesZh)}
    en: ${q(v.seriesEn)}
  topic:
    zh: ${q(v.topicZh)}
    en: ${q(v.topicEn)}
  objective: ${q(v.objective)}
  coverage:
${list(coverage)}
${sourceBlock}

character:
  concept: ${q(v.concept)}
  outfit: ${q(v.outfit)}
  face_reference: ${q(r.face)}
  full_body_reference: ${q(r.body)}
  outfit_reference: ${q(r.outfit)}
  outfit_design: ${q(r.design)}

visual:
  aspect_ratio: ${q(v.aspectRatio)}
  style: ${q(v.style)}
  mood: ${q(v.mood)}
  palette: ${q(v.palette)}
  density: ${q(v.density)}
  layout: ${q(v.layout)}
  character_position: ${q(v.characterPosition)}
  character_area_percent: ${Number(v.characterArea)}

content:
  language: "zh-Hant"
  bilingual_terms: ${dBool('bilingual')}
  strict_traditional_chinese: ${dBool('strictTraditional')}
  explanation_level: "secondary-school"
  use_diagrams: ${dBool('diagrams')}
  use_examples: ${dBool('examples')}

output:
  directory: ${q(v.outputDirectory)}
  filename: ${q(v.outputFilename)}
`;
}

function dBool(name) { return form.elements[name].checked ? 'true' : 'false'; }

function update() {
  const v = values();
  yamlOutput.textContent = buildYaml(v);
  promptOutput.textContent = `Use $ai-tutor-infographic-studio to validate and generate the infographic job in jobs/${slug(v.seriesEn + '-' + v.topicEn)}.yaml.`;
  document.querySelector('#characterAreaOutput').textContent = `${v.characterArea}%`;
  const r = refs(v);
  document.querySelector('#referencePreview').src = `../${r.face}`;
  const saved = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach(input => { saved[input.name] = input.checked; });
  localStorage.setItem(storageKey, JSON.stringify(saved));
  status.textContent = 'Ready';
}

function restore() {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  Object.entries(saved).forEach(([key,value]) => {
    if (!form.elements[key]) return;
    if (form.elements[key].type === 'checkbox') form.elements[key].checked = Boolean(value);
    else form.elements[key].value = value;
  });
}

form.addEventListener('input', update);
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === button));
  yamlOutput.hidden = button.dataset.target !== 'yamlOutput';
  promptOutput.hidden = button.dataset.target !== 'promptOutput';
}));
document.querySelector('#downloadButton').addEventListener('click', () => {
  const v = values(), blob = new Blob([yamlOutput.textContent], {type:'application/yaml'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${slug(v.seriesEn + '-' + v.topicEn)}.yaml`; a.click(); URL.revokeObjectURL(a.href);
  status.textContent = 'Downloaded';
});
document.querySelector('#copyButton').addEventListener('click', async () => {
  const visible = yamlOutput.hidden ? promptOutput : yamlOutput;
  await navigator.clipboard.writeText(visible.textContent); status.textContent = 'Copied';
});
document.querySelector('#resetButton').addEventListener('click', () => { localStorage.removeItem(storageKey); location.reload(); });

restore(); update();
