"""Sample the posed figure into the point cloud the website morphs its particles into.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P mascot3d/claude/export_points.py

Writes ../../mascot-points-claude.bin: int16 × 4 per point — x, y, z in a unit box, then a fourth
channel the site reads two ways:

    w > 0   how much of the head this point belongs to (1 at the skull, fading to 0 down the neck),
            so the head can turn on the neck without the shoulders following
    w = -1  an eye point: drawn in the eye colour, bigger and brighter

And ../../mascot-claude.json with the neck pivot the head turns about, in the same unit box.

Points are scattered over the *evaluated* body — posed, with the feature smoothing applied — but
with the outline hull switched off, or the cloud would carry a second copy of the skin 8mm out.
"""
import bpy
import json
import os
import random
import struct
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
BODY_POINTS = 69000
EYE_POINTS = 1000
NECK_FADE = 0.07   # metres over which head weight fades out below the neck line
CUT = 0.44         # fraction of the figure's height below which nothing is kept: a bust, fists included
DISSOLVE = 0.14    # fraction of height over which the bust thins out towards that cut, rather than ending flat


def surface_sampler(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    matrix = evaluated.matrix_world
    tris, cum, total = [], [], 0.0
    for tri in mesh.loop_triangles:
        a, b, c = (matrix @ mesh.vertices[i].co for i in tri.vertices)
        area = (b - a).cross(c - a).length * 0.5
        if area <= 0:
            continue
        total += area
        tris.append((a, b, c))
        cum.append(total)

    def sample(n):
        out = []
        for _ in range(n):
            t = random.random() * total
            lo, hi = 0, len(cum) - 1
            while lo < hi:
                mid = (lo + hi) // 2
                if cum[mid] < t:
                    lo = mid + 1
                else:
                    hi = mid
            a, b, c = tris[lo]
            u, v = random.random(), random.random()
            if u + v > 1:
                u, v = 1 - u, 1 - v
            out.append(a + (b - a) * u + (c - a) * v)
        return out

    points = sample
    evaluated_ref = evaluated
    return points, lambda: evaluated_ref.to_mesh_clear()


if __name__ == '__main__':
    bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'claude.blend'))
    body = bpy.data.objects['Mascot']
    body.modifiers['Outline'].show_render = body.modifiers['Outline'].show_viewport = False
    rig = bpy.data.objects['Rig']
    bpy.context.view_layer.update()

    # the neck line, from the posed rig: the top of the last spine bone
    neck = rig.matrix_world @ rig.pose.bones['spine.3'].head
    neck_z = neck.z

    sample_body, clear_body = surface_sampler(body)
    body_z = [ (body.matrix_world @ v.co).z for v in body.data.vertices ]
    floor, top = min(body_z), max(body_z)
    cut = floor + (top - floor) * CUT
    fade = (top - floor) * DISSOLVE
    points = []
    # Upper body only. Points near the cut are kept with falling probability, so the bust thins
    # out into scattered particles instead of ending on a hard line across the hips.
    while len(points) < BODY_POINTS:
        for p in sample_body(4000):
            keep = (p.z - cut) / fade
            if keep <= 0 or random.random() > min(1.0, keep):
                continue
            points.append((p, max(0.0, min(1.0, (p.z - (neck_z - NECK_FADE)) / NECK_FADE))))
            if len(points) >= BODY_POINTS:
                break
    clear_body()

    for name in ('EyeL', 'EyeR'):
        eye = bpy.data.objects[name]
        sample_eye, clear_eye = surface_sampler(eye)
        points += [(p, -1.0) for p in sample_eye(EYE_POINTS // 2)]
        clear_eye()

    xs = [p.x for p, _ in points]; ys = [p.y for p, _ in points]; zs = [p.z for p, _ in points]
    centre = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    height = max(zs) - min(zs)
    scale = 32767 / 0.75
    packed = bytearray()
    for p, w in points:
        q = (p - centre) / height
        for value in (q.x, q.y, q.z):
            packed += struct.pack('<h', max(-32767, min(32767, int(round(value * scale)))))
        packed += struct.pack('<h', -32767 if w < 0 else int(round(w * 32767)))

    out = os.path.join(SITE, 'mascot-points-claude.bin')
    with open(out, 'wb') as handle:
        handle.write(packed)
    pivot = (neck - centre) / height
    json.dump({'pivot': [round(pivot.x, 5), round(pivot.y, 5), round(pivot.z, 5)],
               'points': len(points), 'eyes': EYE_POINTS},
              open(os.path.join(SITE, 'mascot-claude.json'), 'w'))
    print(f'{len(points)} points ({EYE_POINTS} eye) from a body {height:.3f} tall -> {out} ({len(packed)} bytes); pivot {tuple(pivot)}')
