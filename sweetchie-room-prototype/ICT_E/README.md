# Topic E MCQ bank workspace

This folder contains the preparation framework and 25 accepted batches for an original, web-ready Traditional Chinese MCQ bank on:

> E. 資訊及通訊科技對社會的影響

Batches B001–B025 contain 1,000 accepted questions. The local viewer supports chosen-question and random-question practice.

## Files

- `QUESTION_BANK_SPEC.md` — authoritative scope, style, originality, and review rules.
- `question_blueprint.json` — cumulative coverage and distribution targets.
- `question_bank.schema.json` — JSON Schema for individual questions and the bank container.
- `ict_topic_e_mcq_bank.json` — the complete authoring bank generated from accepted batches.
- `generation_ledger.json` — fingerprint reservations and frozen-batch history.
- `audit_question_bank.py` — structural, duplication, family, balance, and ledger audit.
- `test_audit_question_bank.py` — regression tests proving that duplicate and schema failures are detected.
- `build_bank.py` — builds batch files, complete distribution files, topic shards, browser data, manifest, and ledger records.
- `generate_batches.py` — range-controlled entry point for deterministic batch generation.
- `generate_b002_b010.py` — curated catalogue and generation engine retained for compatibility.
- `source/drafts/B001.authoring.json` to `B025.authoring.json` — compact authoring sources, 40 questions per batch.
- `source/batches/B001.json` to `B025.json` — expanded and accepted batch files.
- `viewer/index.html` — zero-install local quiz viewer.

## Open the viewer

Open `viewer/index.html` directly in a modern browser. It loads the local generated question bank without requiring a web server.

The viewer provides:

- filters for subtopic and difficulty;
- question-ID and keyword search;
- direct selection from matching questions;
- random selection within the current filters;
- optional option shuffling, while preserving statement-combination order;
- answer checking, explanations, and rationales for all four options;
- responsive desktop and phone layouts.

## Rebuild generated files

Review mode:

```powershell
python build_bank.py
```

After a clean strict audit, freeze the accepted batches:

```powershell
python build_bank.py --freeze
```

## Audit command

From this folder, run:

```powershell
python audit_question_bank.py
```

The command prints a JSON report. It returns a non-zero exit status for hard errors. Add `--strict` to treat warnings as failures:

```powershell
python audit_question_bank.py --strict
```

To retain a report:

```powershell
python audit_question_bank.py --report reports/latest.json
```

Run the regression tests with:

```powershell
python -m unittest -v test_audit_question_bank.py
```

## Status meanings

- `pass`: no automated findings.
- `pass_with_warnings`: structurally usable, but one or more matters require review.
- `fail`: at least one hard error must be corrected.

The audit is deliberately conservative. Similarity scores identify candidates for review; they do not prove that two questions are semantically distinct.

## Generation sequence

1. Read `QUESTION_BANK_SPEC.md`.
2. Calculate gaps against `question_blueprint.json`.
3. Reserve the next batch and its fingerprints in `generation_ledger.json`.
4. Generate no more than 40 draft questions.
5. Validate and audit the entire cumulative bank.
6. Redesign rejected or near-duplicate questions.
7. Record accepted fingerprints and freeze the batch.

The ledger and internal `control` fields may be omitted from a later public export, but they should remain in the authoring source so future batches can be audited against earlier reasoning patterns.
