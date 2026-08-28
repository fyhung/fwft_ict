# Sweetchie Live2D-style bust prototype

Open `sweetchie-bust.html` directly in Chrome, Edge, Firefox, or Safari. The final file is self-contained and works offline.

## Included behavior

- pointer-driven head/body tracking
- automatic and manual blinking
- two-state talking mouth loop
- neutral, happy, and surprised expressions
- breathing motion
- adjustable motion amount
- automatic demonstration sequence
- visible Live2D-style parameter meters

This is a behavior and art-direction prototype, not a genuine Live2D Cubism model. It uses a six-state raster atlas plus Canvas transforms. A production `.model3.json` version would require a layered PSD, ArtMeshes, deformers, parameters, physics, and export through Live2D Cubism Editor.

## Rebuild

Run `scripts/process-artwork.py`, then `scripts/build.py`, using Python with Pillow available. Verify with `node tests/verify.mjs`.
