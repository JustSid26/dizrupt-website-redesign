"""The mascot, built in one pass.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P mascot3d/claude/build_mascot2.py

This replaces the layered edits that built up in claude.blend. Everything that shapes the figure
now happens once, in order, from the same inputs every time: the CC0 base body is loaded, stylised,
its features softened, refined, sculpted, rigged, posed and shaded. Re-running it reproduces the
figure exactly; nothing depends on what a previous run left behind.

What is deliberately NOT from scratch is the anatomy. The base is MakeHuman's CC0 mesh, which has a
real ribcage, real joints and topology that deforms properly. Modelling a convincing human out of
primitives would take far longer and land somewhere worse, so the work here is what sits on top of
it: the proportions, the muscle, the pose and the look.

Written to mascot2.blend, alongside the old file rather than over it.
"""
import math
import os
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build as base   # the proven halves: loading, stylising, feature softening, rigging, shading

OUT = os.path.join(HERE, 'mascot2.blend')

# --- the shape of him ---------------------------------------------------------------------------
# Athletic rather than heavy. GAIN scales every muscle's mass; the creases that separate them are
# scaled by CUT instead, and held higher — definition is what reads at a distance, not bulk.
GAIN, CUT = 0.55, 0.80
SHOULDERS, WAIST = 0.125, 0.085   # how far the frame opens at the shoulders and draws in at the waist

# Where each muscle sits, as an ellipsoid just under the skin. Every centre here was measured off
# the built body rather than guessed: the chest surface sits at y ≈ -0.17, and fields placed by eye
# at -0.085 missed it entirely and did nothing at all.
F, B, S, U = (0, -1, 0), (0, 1, 0), (1, 0, 0), (0, 0, 1)
MUSCLES = [
    # back
    ((0.000, 0.085, 1.420), (0.024, 0.055, 0.230), -0.022, B, 1.0, False),  # channel down the spine
    ((0.075, 0.078, 1.640), (0.145, 0.070, 0.130),  0.032, B, 1.0, True),   # trapezius
    ((0.150, 0.082, 1.560), (0.090, 0.060, 0.075),  0.026, B, 1.0, True),   # shoulder blade
    ((0.175, 0.075, 1.450), (0.110, 0.090, 0.215),  0.052, B, 0.8, True),   # latissimus
    ((0.138, 0.062, 1.370), (0.030, 0.060, 0.125), -0.017, B, 1.0, True),   # its inner edge
    ((0.038, 0.088, 1.250), (0.046, 0.050, 0.125),  0.020, B, 1.0, True),   # erector spinae
    ((0.202,-0.020, 1.470), (0.078, 0.118, 0.195),  0.040, S, 1.0, True),   # lat into the silhouette
    # shoulders and arms
    ((0.158, 0.010, 1.692), (0.170, 0.128, 0.098),  0.026, U, 0.5, True),   # trap, pulled back off the
                                                                            # chest it was spilling onto
    ((0.250,-0.030, 1.610), (0.132, 0.130, 0.142),  0.050, None, 1.0, True),# deltoid cap
    ((0.214,-0.112, 1.585), (0.040, 0.082, 0.120), -0.026, None, 1.0, True),# delt / pec seam, so the
                                                                            # chest stops where the
                                                                            # shoulder starts
    ((0.345,-0.105, 1.520), (0.088, 0.055, 0.092),  0.046, F, 1.0, True),   # biceps
    ((0.345, 0.055, 1.520), (0.088, 0.055, 0.092),  0.040, B, 1.0, True),   # triceps
    ((0.460,-0.090, 1.375), (0.078, 0.068, 0.078),  0.032, None, 1.0, True),# forearm
    # chest
    ((0.132,-0.150, 1.586), (0.113, 0.105, 0.126, 0.058),  0.100, F, 1.0, True),  # pectoral: full on top,
                                                                            # falling away fast beneath,
                                                                            # which is the shelf
    ((0.132,-0.168, 1.502), (0.120, 0.048, 0.022), -0.016, F, 1.0, True),   # a hint of shadow under it,
                                                                            # per side: run across the
                                                                            # whole chest it reads as
                                                                            # one slab with a ledge
    ((0.000,-0.156, 1.566), (0.030, 0.055, 0.130), -0.054, F, 1.0, False),  # the valley between them
    # midsection
    ((0.048,-0.150, 1.355), (0.085, 0.058, 0.145),  0.032, F, 1.0, True),   # rectus abdominis
    ((0.000,-0.158, 1.350), (0.016, 0.050, 0.150), -0.025, F, 1.0, False),  # linea alba
    ((0.048,-0.166, 1.445), (0.076, 0.048, 0.011), -0.024, F, 1.0, True),   # the three bands
    ((0.048,-0.160, 1.390), (0.076, 0.048, 0.011), -0.024, F, 1.0, True),
    ((0.048,-0.155, 1.335), (0.076, 0.048, 0.011), -0.024, F, 1.0, True),
    ((0.152,-0.040, 1.330), (0.062, 0.105, 0.105),  0.032, None, 1.0, True),# obliques
    ((0.130,-0.128, 1.460), (0.050, 0.060, 0.058),  0.016, F, 1.0, True),   # serratus
    ((0.098,-0.138, 1.208), (0.072, 0.052, 0.026), -0.024, F, 1.0, True),   # the V at the hip
    # legs and neck
    ((0.145,-0.120, 0.900), (0.095, 0.070, 0.205),  0.036, F, 1.0, True),   # quadriceps
    ((0.108, 0.080, 1.090), (0.095, 0.070, 0.105),  0.034, B, 1.0, True),   # glute
    ((0.196, 0.050, 0.440), (0.065, 0.058, 0.128),  0.032, B, 1.0, True),   # calf
    ((0.000,-0.060, 1.780), (0.088, 0.088, 0.072),  0.020, None, 1.0, False),# neck
]

# The mascot's stance, read off the gif: his left fist up beside the shoulder with the elbow swung
# clear of the ribs, his right arm hanging, feet a little apart.
STANCE = [
    ('armL.0', ( 0.58,  0.05, -0.81)), ('armL.1', ( 0.02, -0.50,  0.87)),
    ('armR.0', (-0.36,  0.02, -0.93)), ('armR.1', (-0.10, -0.12, -0.99)),
    ('legL.0', ( 0.12, -0.02, -0.99)), ('legL.1', ( 0.03,  0.00, -1.00)),
    ('legR.0', (-0.09, -0.02, -1.00)), ('legR.1', (-0.02,  0.00, -1.00)),
]


def refine(body):
    """One subdivision before any sculpting.

    The base body puts about 17 mm between vertices across the chest. A crease 12 mm deep has
    nowhere to live at that spacing — it lands between vertices and simply does not appear. Cutting
    every edge once takes it to 3.5 mm. smooth=0, so the silhouette is untouched.
    """
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True, smooth=0.0)
    bm.to_mesh(body.data)
    bm.free()
    body.data.update()


def sculpt(body):
    """The muscle, as displacement along each vertex's own normal."""
    me = body.data
    P = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', P)
    P = P.reshape(-1, 3).astype(np.float64)
    E = np.empty(len(me.edges) * 2, np.int32)
    me.edges.foreach_get('vertices', E)
    E = E.reshape(-1, 2)
    deg = np.maximum(np.bincount(E.ravel(), minlength=len(P)).astype(np.float64)[:, None], 1)

    def relax(field, mask, passes, rate):
        for _ in range(passes):
            acc = np.zeros_like(field)
            np.add.at(acc, E[:, 0], field[E[:, 1]])
            np.add.at(acc, E[:, 1], field[E[:, 0]])
            field = field + rate * mask * (acc / deg - field)
        return field

    # The base carries faint rib and shoulder-blade ripples across the upper back. At this scale
    # they are noise, and every muscle laid over them would inherit the wobble.
    upper_back = ((P[:, 1] > 0.02) & (P[:, 2] > 1.40) & (P[:, 2] < 1.78)).astype(np.float64)[:, None]
    P = relax(P, upper_back, 5, 0.5)

    n = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('normal', n)
    N = n.reshape(-1, 3).astype(np.float64)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)

    def band(z, lo, hi):
        t = np.clip((z - lo) / (hi - lo), 0, 1)
        return t * t * (3 - 2 * t)

    z = P[:, 2]
    # the V comes from the frame before any muscle is added: shoulders out, waist in
    P[:, 0] *= (1.0 + SHOULDERS * (band(z, 1.42, 1.60) * (1 - band(z, 1.68, 1.82)))
                    - WAIST * (band(z, 1.10, 1.25) * (1 - band(z, 1.29, 1.44))))

    disp = np.zeros_like(P)
    for centre, radii, strength, face, power, mirror in MUSCLES:
        strength *= CUT if strength < 0 else GAIN
        for side in ((1, -1) if mirror else (1,)):
            c = np.array([centre[0] * side, centre[1], centre[2]])
            rz = (np.where(P[:, 2] >= c[2], radii[2], radii[3]) if len(radii) == 4
                  else np.full(len(P), radii[2]))
            d = (P - c) / np.stack([np.full(len(P), radii[0]), np.full(len(P), radii[1]), rz], 1)
            w = np.clip(1.0 - np.einsum('ij,ij->i', d, d), 0, 1) ** 2
            if face is not None:
                f = np.array([face[0] * side, face[1], face[2]], float)
                f /= np.linalg.norm(f)
                w *= np.clip(N @ f, 0, 1) ** power
            disp += N * (strength * w)[:, None]

    # Where two fields meet at an awkward angle the skin pinches. Relaxing the displacement itself
    # takes that out; the forms and the creases are many vertices wide and survive it.
    # Relaxing the displacement is what stops the skin pinching where two fields meet, but it also
    # rounds off exactly the boundaries the chest needs. So the chest is relaxed less than the rest.
    soften = np.ones((len(P), 1))
    chest = (P[:, 1] < -0.10) & (P[:, 2] > 1.44) & (P[:, 2] < 1.70)
    soften[chest] = 0.3
    disp = relax(disp, soften, 2, 0.28)
    mag = np.linalg.norm(disp, axis=1, keepdims=True)
    disp *= np.minimum(1.0, 0.05 / np.maximum(mag, 1e-9))

    me.vertices.foreach_set('co', (P + disp).astype(np.float32).ravel())
    me.update()
    print(f'sculpted: {int((mag > 1e-4).sum())} verts moved, max {float(mag.max()):.3f} m')


def stance(rig):
    """Over the top of build.pose(), which has already closed the hands. The fists are children of
    the arms, so they ride along rather than needing to be curled again."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for name, direction in STANCE:
        bpy.context.view_layer.update()
        base.aim(rig.pose.bones[name], direction)
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


def preview(path):
    """A flat clay render for judging form. The figure's own material is a dark starfield, which is
    the right look but tells you nothing about where a muscle actually is."""
    scene = bpy.context.scene
    keep = scene.render.engine
    body = bpy.data.objects['Mascot']
    body.modifiers['Outline'].show_render = False
    try:
        scene.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        scene.render.engine = keep
    shading = scene.display.shading
    shading.light = 'MATCAP'
    shading.studio_light = 'clay_brown.exr'
    shading.color_type = 'SINGLE'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    scene.render.engine = keep
    body.modifiers['Outline'].show_render = True
    print('preview ->', path)


def build(out=OUT, use_stance=True):
    """The whole figure, start to finish. `use_stance` picks the mascot's own fist-up pose off the
    gif; without it he keeps the hanging arms the base script gives him."""
    import json
    base.clear()
    markers = {k: base.obj_to_blender(v)
               for k, v in json.load(open(os.path.join(HERE, 'joints.json'))).items()}
    body = base.load_body()
    markers = base.fit_and_warp(body, markers)
    base.soften_features(body, markers)
    # Rig before refining. Blender's automatic weights are solved by heat diffusion over the mesh,
    # and it fails to converge on the subdivided one — the bones then move and the skin does not
    # follow. Rigged first, the subdivision simply interpolates the weights it already has.
    rig = base.build_rig(body, markers)
    refine(body)
    sculpt(body)
    # Half the curl the base script uses. At full strength the three joints of each finger add up
    # to well past a closed hand: the tips pass through the palm and through each other, and the
    # fist comes out a tangle. Half reads as a relaxed hand.
    base.CURL = {f: tuple(round(a * 0.5) for a in angles) for f, angles in base.CURL.items()}
    base.pose(rig)
    if use_stance:
        stance(rig)
    base.shade(body)
    base.add_eyes(markers)
    base.set_up()
    bpy.ops.wm.save_as_mainfile(filepath=out)
    print('saved ->', out)
    return out


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    hang = '--hang' in argv
    out = os.path.join(HERE, 'claude.blend') if hang else OUT
    build(out, use_stance=not hang)
    tag = 'claude' if hang else 'mascot2'
    base.render(os.path.join(HERE, 'renders', f'{tag}.png'))
    preview(os.path.join(HERE, 'renders', f'{tag}_clay.png'))
