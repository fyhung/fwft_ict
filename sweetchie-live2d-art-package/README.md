# Sweetchie Live2D cut-art package

This package is a Cubism-ready **cut-art prototype** based on Sweetchie's established design.

## Main deliverables

- `Sweetchie-Live2D-Cut-Art.psd` — named layer groups with alternate mouths/lids hidden.
- `layers/` — 36 registration-aligned transparent PNG layers at 1024 × 1024.
- `preview/sweetchie-assembled-preview.png` — transparent assembled character.
- `sweetchie-live2d-preview.html` — offline moving preview using the actual PNG layers.
- `docs/layer-map.md`, `.png`, and `.json` — draw order and intended parameter links.
- `docs/validation.json` — mechanical package checks.

## Import into Cubism

1. Open the PSD in Live2D Cubism Editor.
2. Confirm the layer groups and draw order.
3. Create ArtMeshes, then rig Angle X/Y/Z before physics.
4. Bind eye-open and mouth keyforms.
5. Add hair, earring, and bow physics last.

This is artwork preparation, not a completed rig. Cubism Editor is still required to create deformers, parameters, physics, and the exported `.moc3` model.

## Live preview

Double-click `sweetchie-live2d-preview.html`. **Bust Lab exact** is the default render mode and uses the approved Bust Lab atlas without identity drift. It supports blinking, talking, happy, surprised, breathing, pointer tilt, and motion-strength controls. **Separated cut art** remains available as an experimental inspection mode for the generated Live2D pieces. Enable **Static alignment overlay** to freeze motion and compare either mode against its neutral reference. Everything loads from local files and works offline.

Run `scripts/build_package.py` with the bundled Python runtime to reproduce the PNGs, PSD, previews, and maps from the source production sheet.
