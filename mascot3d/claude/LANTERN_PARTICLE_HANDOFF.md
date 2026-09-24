# Lantern particle hero handoff

## What to open

- Browser study: `http://localhost:8765/mascot-energy-lab.html`
- Source: `/Users/sid/studio-site/mascot-energy-lab.html`
- Pose source: `/Users/sid/studio-site/mascot3d/claude/claude.blend`
- Flex point cloud: `/Users/sid/studio-site/mascot-flex-claude.bin`
- Anchor metadata: `/Users/sid/studio-site/mascot-transition-claude.json`

This is deliberately separate from the production intro. It is a look-development file for the mascot handoff.

## Target silhouette

Match the supplied Green Lantern reference closely in anatomy and attitude:

- broad deltoids and upper chest;
- narrow waist with distinct abdominal planes;
- thick upper arms and forearms;
- square jaw, strong chin, cheek planes, brow ridge and short swept hair;
- angular domino mask with narrow eye openings;
- left side relaxed and the opposite fist raised beside the head;
- energy orb centered on the raised fist.

Do not add realistic pores or detailed eyeballs. Facial identity should come from the jaw, brow, nose bridge, mouth line, hair silhouette and mask.

## Particle treatment already implemented

The browser study contains these reusable layers:

1. Claude flex body sampled to 70,000 surface points.
2. Spatial suit zoning in `loadClaude()`:
   - black-green undersuit;
   - emerald torso;
   - pale gauntlets;
   - warm face particles;
   - dark emerald mask band.
3. `makeHeroDetails()` adds particle-only mask, eye slits, hair, jaw/nose/mouth strokes, chest badge and suit seams.
4. White-hot orb is attached to the exported raised-hand anchor.
5. Teal and green energy ribbons radiate from the same anchor.
6. Body reveal is bottom-to-top; face detail resolves after the body reaches roughly 34% reveal.

## Coordinates in the exported web space

- Head center: approximately `(-0.315, 2.05, 0.325)`
- Chest badge center: approximately `(-0.315, 1.13, 0.398)`
- Raised fist / orb anchor: approximately `(1.022, 2.193, 0.051)`

The exporter maps Blender `(x, y, z)` to web `(x, z, -y)` and then applies the study's body scale.

## If refining the Blender mesh

Keep the current pose and proportions as the rigging base, then prioritize:

1. Resculpt head into a square heroic skull with a planar face.
2. Add mask geometry slightly above the skin so its particle layer stays distinct.
3. Push deltoid, pectoral, bicep, oblique and quadricep volumes.
4. Make the raised fist compact and readable from the front camera.
5. Keep all eyes non-emissive; the hand orb is the only white-hot focal point.
6. Preserve object transforms and run `export_transition.py` again so neutral and flex clouds remain paired point-for-point.

## Intended reveal order

`orb spark -> mask/eyes -> face planes -> full body -> suit seams/badge -> energy overload`

The live site transition can later use the same order without importing the entire lab scene.
