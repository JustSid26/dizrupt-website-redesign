"""Export paired full-body point clouds from Claude's rigged mascot.

The first pose is the neutral Claude figure. The second raises and curls his left arm into a
bicep-flex. Both files share the same triangle samples and barycentric coordinates, so particle i
stays attached to the same patch of skin while the rig moves; the browser can therefore morph the
pose without the body boiling or swapping to another model.

Run from the site root:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python mascot3d/claude/export_transition.py
"""
import bisect
import bpy
import json
import math
import os
import random
import struct
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
BODY_POINTS = 69000
EYE_POINTS = 1000
NECK_FADE = 0.07
SEED = 73191


def evaluated_surface(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    matrix = evaluated.matrix_world
    vertices = [matrix @ vertex.co for vertex in mesh.vertices]
    triangles = [tuple(tri.vertices) for tri in mesh.loop_triangles]
    evaluated.to_mesh_clear()
    return vertices, triangles


def sample_plan(vertices, triangles, count, rng):
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
    points = []
    for tri, u, v in plan:
        ia, ib, ic = triangles[tri]
        a, b, c = vertices[ia], vertices[ib], vertices[ic]
        points.append(a + (b - a) * u + (c - a) * v)
    return points


def aim(bone, direction):
    y = Vector(direction).normalized()
    ref = Vector((0, 0, 1)) if abs(y.z) < 0.95 else Vector((0, -1, 0))
    x = ref.cross(y).normalized()
    z = x.cross(y)
    matrix = Matrix((x, y, z)).transposed().to_4x4()
    matrix.translation = bone.head
    bone.matrix = matrix


def flex_left_arm(rig):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    bones = rig.pose.bones
    # Upper arm opens to the side; forearm rises toward the shoulder. The already-closed Claude
    # fist remains parented to the forearm, so this produces a proper bicep pose rather than a ball.
    aim(bones['armL.0'], (0.96, -0.05, -0.28))
    bpy.context.view_layer.update()
    aim(bones['armL.1'], (0.12, -0.10, 0.99))
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


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
    print(f'{len(points)} paired points -> {path} ({len(payload)} bytes)')


if __name__ == '__main__':
    bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'claude.blend'))
    body = bpy.data.objects['Mascot']
    body.modifiers['Outline'].show_render = body.modifiers['Outline'].show_viewport = False
    rig = bpy.data.objects['Rig']
    neutral_vertices, triangles = evaluated_surface(body)
    rng = random.Random(SEED)
    body_plan = sample_plan(neutral_vertices, triangles, BODY_POINTS, rng)
    neutral_body = apply_plan(neutral_vertices, triangles, body_plan)

    eye_plans = {}
    neutral_eyes = []
    for name in ('EyeL', 'EyeR'):
        eye_vertices, eye_triangles = evaluated_surface(bpy.data.objects[name])
        plan = sample_plan(eye_vertices, eye_triangles, EYE_POINTS // 2, rng)
        eye_plans[name] = (eye_triangles, plan)
        neutral_eyes.extend(apply_plan(eye_vertices, eye_triangles, plan))

    flex_left_arm(rig)
    flex_hand = rig.matrix_world @ rig.pose.bones['handL.0'].tail
    flex_vertices, flex_triangles = evaluated_surface(body)
    if len(neutral_vertices) != len(flex_vertices):
        raise RuntimeError('Claude vertex topology changed between poses; paired export is unsafe')
    # The smooth modifier may choose a different diagonal when it retriangulates a deformed quad.
    # Pinning the flex samples to the neutral triangle's vertex IDs preserves the skin attachment.
    flex_body = apply_plan(flex_vertices, triangles, body_plan)
    # Eyes do not move during the arm curl; keeping the identical samples prevents facial shimmer.
    flex_eyes = [point.copy() for point in neutral_eyes]

    neutral = neutral_body + neutral_eyes
    flexed = flex_body + flex_eyes
    all_points = neutral + flexed
    xs = [p.x for p in all_points]
    ys = [p.y for p in all_points]
    zs = [p.z for p in all_points]
    centre = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2,
                     (min(zs) + max(zs)) / 2))
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
            'source': 'mascot3d/claude/claude.blend',
        }, handle)
    print(f'neutral + flex exported from Claude; pivot {tuple(round(v, 5) for v in pivot)}')
