# Sweetchie Live2D layer map

All PNGs are 1024 × 1024 transparent canvases. Do not trim them before importing: the common canvas preserves registration.

## Draw order: back to front

1. Back Hair → Left/Right Side Hair → Hair Shadow
2. Torso Underlay → Skirt → Blouse → Sailor Collar → Clothing Shadow
3. Neck → Left Ear → Right Ear → Face Base → Face Shadow
4. Eye Whites → Irises → Open/Closed Lids → Eyebrows → selected Mouth
5. Front Hair/Bangs → Hair Highlights
6. Glasses → Earrings → Bow → Star Brooch

## Cubism parameter connections

| Parameter | Primary layers |
|---|---|
| ParamAngleX / Y / Z | Face Base, ears, eyes, irises, eyebrows, mouths, front/side hair |
| ParamEyeLOpen / ROpen | Upper Lid and Closed Lid pairs |
| ParamEyeBallX / Y | Left Iris, Right Iris |
| ParamMouthOpenY | five mouth layers used as keyforms |
| ParamMouthForm | Closed/Happy/Surprised mouth keyforms |
| ParamBodyAngleX / Y / Z | Torso, blouse, collar, skirt, bow |
| ParamBreath | Torso, blouse, collar, bow |
| Hair physics | Left/Right Side Hair, Front Hair tips, Back Hair tips |
| Accessory physics | Earrings and bow tails |

The face, ears, and neck deliberately overlap slightly. This avoids holes while deforming. Alternate mouths and closed eyelids are hidden by default in the PSD.
