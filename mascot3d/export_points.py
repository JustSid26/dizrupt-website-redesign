"""Sample the posed mascot into a point cloud the website can morph its particles into.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P mascot3d/export_points.py

The site already treats every shape as COUNT positions — the spine, the project models, all of it —
so the figure only has to arrive in the same form. Points are scattered over the *evaluated* mesh,
meaning after the armature and every modifier, which is the posed body rather than the rest pose.

Written as int16 rather than float32: the positions are normalised into a unit box first, so a
16-bit step is about 1/30000 of the body's height — far finer than a particle can show — and it
halves what the browser has to download.
"""
import bpy
import os
import random
import struct
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
POINTS = 70000   # matches COUNT on desktop, so every particle gets its own place to stand
EDGE_BIAS = 0.0  # the body reads by its volume, not its outline; no extra weight on the edges


def sample_surface(obj, count):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()

    matrix = evaluated.matrix_world
    triangles, cumulative, total = [], [], 0.0
    for tri in mesh.loop_triangles:
        a, b, c = (matrix @ mesh.vertices[i].co for i in tri.vertices)
        area = (b - a).cross(c - a).length * 0.5
        if area <= 0:
            continue
        total += area
        triangles.append((a, b, c))
        cumulative.append(total)

    points = []
    for _ in range(count):
        # area-weighted, so limbs do not end up denser than the torso
        target = random.random() * total
        lo, hi = 0, len(cumulative) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if cumulative[mid] < target:
                lo = mid + 1
            else:
                hi = mid
        a, b, c = triangles[lo]
        u, v = random.random(), random.random()
        if u + v > 1.0:
            u, v = 1.0 - u, 1.0 - v
        points.append(a + (b - a) * u + (c - a) * v)

    evaluated.to_mesh_clear()
    return points


def normalise(points):
    """Centre on the figure and scale so its height is exactly 1, leaving the site free to size it."""
    xs = [p.x for p in points]; ys = [p.y for p in points]; zs = [p.z for p in points]
    centre = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    height = max(zs) - min(zs)
    return [(p - centre) / height for p in points], height


if __name__ == '__main__':
    bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'mascot.blend'))
    body = bpy.data.objects['Mascot']
    raw = sample_surface(body, POINTS)
    points, height = normalise(raw)

    # int16 over a unit box: the body spans at most 1 in height, so ±0.75 covers every limb
    scale = 32767 / 0.75
    packed = bytearray()
    for p in points:
        for value in (p.x, p.y, p.z):
            packed += struct.pack('<h', max(-32767, min(32767, int(round(value * scale)))))

    out = os.path.join(os.path.dirname(HERE), 'mascot-points.bin')
    with open(out, 'wb') as handle:
        handle.write(packed)
    print(f'sampled {len(points)} points from a body {height:.3f} tall -> {out} ({len(packed)} bytes)')
