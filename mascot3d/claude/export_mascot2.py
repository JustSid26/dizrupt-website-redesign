"""Export the paired point clouds the website morphs between, from mascot2.blend.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P mascot3d/claude/export_mascot2.py

Two poses, sampled from the same triangles with the same barycentric coordinates, so particle i
stays stuck to the same patch of skin while the rig moves. The browser can then morph between them
without the body boiling.

  neutral — standing, arms hanging. What he builds into out of the eyes.
  flex    — the mascot's own stance off the gif, left fist up beside the shoulder.

Same three files and the same layout as before, so the site needs no changes to read them.
"""
import bisect
import json
import os
import random
import struct
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from build_mascot2 import STANCE          # the pose he ends in

BLEND = os.path.join(HERE, 'mascot2.blend')
BODY_POINTS = 69000
EYE_POINTS = 1000
NECK_FADE = 0.07
SEED = 73191

# arms hanging: where he starts, before he takes the stance
RELAXED = [
    ('armL.0', ( 0.30,  0.04, -0.95)), ('armL.1', ( 0.10, -0.12, -0.99)),
    ('armR.0', (-0.30,  0.04, -0.95)), ('armR.1', (-0.10, -0.12, -0.99)),
]


def aim(bone, direction):
    y = Vector(direction).normalized()
    ref = Vector((0, 0, 1)) if abs(y.z) < 0.95 else Vector((0, -1, 0))
    x = ref.cross(y).normalized()
    z = x.cross(y)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = bone.head
    bone.matrix = m


def strike(rig, pose):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for name, direction in pose:
        bpy.context.view_layer.update()
        aim(rig.pose.bones[name], direction)
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


def evaluated_surface(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    matrix = evaluated.matrix_world
    vertices = [matrix @ v.co for v in mesh.vertices]
    triangles = [tuple(t.vertices) for t in mesh.loop_triangles]
    evaluated.to_mesh_clear()
    return vertices, triangles


def sample_plan(vertices, triangles, count, rng):
    """Pick where the points go once, by area, so neither pose gets denser limbs than the other."""
    cumulative, total = [], 0.0
    for ia, ib, ic in triangles:
        a, b, c = vertices[ia], vertices[ib], vertices[ic]
        total += (b - a).cross(c - a).length * 0.5
        cumulative.append(total)
    plan = []
    for _ in range(count):
        tri = bisect.bisect_left(cumulative, rng.random() * total)
        u, v = rng.random(), rng.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        plan.append((tri, u, v))
    return plan


def apply_plan(vertices, triangles, plan):
    out = []
    for tri, u, v in plan:
        ia, ib, ic = triangles[tri]
        a, b, c = vertices[ia], vertices[ib], vertices[ic]
        out.append(a + (b - a) * u + (c - a) * v)
    return out


def pack(path, points, weights, centre, height):
    scale = 32767 / 0.75
    payload = bytearray()
    for point, weight in zip(points, weights):
        q = (point - centre) / height
        for value in (q.x, q.y, q.z):
            payload += struct.pack('<h', max(-32767, min(32767, round(value * scale))))
        payload += struct.pack('<h', -32767 if weight < 0 else round(weight * 32767))
    with open(path, 'wb') as handle:
        handle.write(payload)
    print(f'{len(points)} points -> {path} ({len(payload)} bytes)')


if __name__ == '__main__':
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    body = bpy.data.objects['Mascot']
    body.modifiers['Outline'].show_render = body.modifiers['Outline'].show_viewport = False
    rig = bpy.data.objects['Rig']
    rng = random.Random(SEED)

    strike(rig, RELAXED)
    neutral_vertices, triangles = evaluated_surface(body)
    body_plan = sample_plan(neutral_vertices, triangles, BODY_POINTS, rng)
    neutral_body = apply_plan(neutral_vertices, triangles, body_plan)

    eyes_neutral = []
    for name in ('EyeL', 'EyeR'):
        ev, et = evaluated_surface(bpy.data.objects[name])
        eyes_neutral.extend(apply_plan(ev, et, sample_plan(ev, et, EYE_POINTS // 2, rng)))

    strike(rig, STANCE)
    flex_hand = rig.matrix_world @ rig.pose.bones['handL.0'].tail
    flex_vertices, _ = evaluated_surface(body)
    if len(neutral_vertices) != len(flex_vertices):
        raise RuntimeError('topology changed between poses; the paired export would not line up')
    # Sampled against the neutral pose's triangle list on purpose: a smoothing pass can pick the
    # other diagonal when it retriangulates a deformed quad, and the skin attachment would slip.
    flex_body = apply_plan(flex_vertices, triangles, body_plan)
    # his head does not move between the two, so the eyes are the same samples and cannot shimmer
    flex_eyes = [p.copy() for p in eyes_neutral]

    neutral = neutral_body + eyes_neutral
    flexed = flex_body + flex_eyes
    every = neutral + flexed
    xs = [p.x for p in every]; ys = [p.y for p in every]; zs = [p.z for p in every]
    centre = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    height = max(zs) - min(zs)

    neck = rig.matrix_world @ rig.pose.bones['spine.3'].head
    weights = [max(0.0, min(1.0, (p.z - (neck.z - NECK_FADE)) / NECK_FADE))
               for p in neutral_body] + [-1.0] * EYE_POINTS

    pack(os.path.join(SITE, 'mascot-neutral-claude.bin'), neutral, weights, centre, height)
    pack(os.path.join(SITE, 'mascot-flex-claude.bin'), flexed, weights, centre, height)
    pivot = (neck - centre) / height
    orb = (flex_hand - centre) / height
    with open(os.path.join(SITE, 'mascot-transition-claude.json'), 'w') as handle:
        json.dump({
            'pivot': [round(pivot.x, 5), round(pivot.y, 5), round(pivot.z, 5)],
            'orb': [round(orb.x, 5), round(orb.y, 5), round(orb.z, 5)],
            'points': len(neutral),
            'eyes': EYE_POINTS,
            'source': 'mascot3d/claude/mascot2.blend',
        }, handle)
    print('exported; pivot', tuple(round(v, 5) for v in pivot))
