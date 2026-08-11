---
name: ai-tutor-infographic-studio
description: Create, revise, and quality-check vertical bilingual ICT teaching infographics featuring the AI Tutor character from YAML job files. Use when Codex needs to process infographic job YAML, assemble image-generation prompts, select character references and outfits, generate a page in an ICT series, or review an output for character drift, terminology, readability, layout, and Traditional Chinese accuracy.
---

# AI Tutor Infographic Studio

Use YAML as the source of truth. Keep the generated prompt and image subordinate to the job settings.

## Process a job

1. Read `project.yaml`, then the requested file under `jobs/`.
2. Merge project defaults with job values; job values win.
3. Resolve character images relative to this skill folder. Use every listed identity reference when generating or editing.
4. Read `references/visual-guidelines.md` before image generation or visual QA.
5. Read `references/job-schema.md` only when creating, repairing, or validating YAML.
6. Run `python scripts/validate_job.py <job.yaml>` and fix blocking errors before generation.
7. Run `python scripts/build_prompt.py <job.yaml>` to create the normalized prompt. Review the prompt against the source material; never invent unsupported curriculum facts.
8. Present the prompt for approval when the user asks to review it. Otherwise generate the infographic directly when requested.
9. Inspect the output at full resolution. Check character identity, Traditional Chinese, bilingual terminology, content accuracy, information hierarchy, text size, and aspect ratio.
10. Save approved images to the job's `output.directory` with its `output.filename`.

## Interpret user requests

- For “create/generate this job,” validate, build the prompt, generate, inspect, and save.
- For “preview/build the prompt,” stop after returning the normalized prompt.
- For “review/check this image,” use the job plus `references/visual-guidelines.md` and report actionable issues.
- For “make another page like this,” duplicate the nearest job and change topic-specific fields only.

## Preserve consistency

- Treat face reference, hair construction, glasses, and apparent age as identity-critical.
- Treat outfit, props, palette, pose, and layout as configurable.
- Use Traditional Chinese for explanations and pair important terms as `中文（English）`.
- Keep the teaching content dominant; use the character as a guide, not decoration that crowds out learning.
- Do not silently relax rejected conditions from `project.yaml` or the job.

## UI

Use `ui/index.html` to configure a job. Run `scripts/start_ui.ps1` on Windows, or serve the skill folder with a local static server. The UI exports YAML into `jobs/`; downloaded files may be moved there before processing.

