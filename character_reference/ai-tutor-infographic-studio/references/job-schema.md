# Job schema

Use UTF-8 YAML. Quote user-facing strings. Resolve relative paths from the skill folder.

Required fields:

- `job.id`: unique filename-safe identifier.
- `job.series.zh` and `job.series.en`: bilingual series name.
- `job.topic.zh` and `job.topic.en`: bilingual page topic.
- `job.objective`: one-sentence learning objective.
- `job.coverage`: one or more required concepts.
- `character.concept`: themed character treatment.
- `character.face_reference`: identity-critical image.
- `visual.aspect_ratio`: normally `2:3`.
- `visual.style`, `visual.palette`, `visual.density`, and `visual.layout`.
- `content.language`: normally `zh-Hant`.
- `output.directory` and `output.filename`.

Optional fields:

- `job.source_files`: curriculum sources to verify.
- `character.full_body_reference`, `outfit_reference`, and `outfit_design`.
- `visual.character_position` and `character_area_percent`.
- `content.use_diagrams` and `use_examples`.

Allowed layout presets:

- `character-plus-four-sections`
- `process-flow`
- `comparison`
- `timeline`
- `hierarchy`
- `concept-map`
- `table-and-examples`
- `comic-sequence`

