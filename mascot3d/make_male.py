"""Morph the neutral base mesh into a male body, then re-cut the pieces the build needs.

MakeHuman ships its body types as targets: a list of per-vertex deltas that carry the neutral base
to a specific build. They are CC0 like the mesh. Applying one is just base + delta, which means a
genuinely male body rather than me widening shoulders by eye and hoping.

The deltas cover every vertex in the file, the 125 joint-marker cubes included — so the rig markers
travel with the morph and the elbow stays inside the elbow. That is why the markers are re-read
here rather than reused from the neutral mesh.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
WEIGHT = 1.0  # full male; MakeHuman blends these, but one target at full strength is the endpoint


def read_vertices(path):
    verts, rest = [], []
    for line in open(path):
        if line.startswith('v '):
            verts.append([float(x) for x in line.split()[1:4]])
        rest.append(line)
    return verts, rest


def apply_target(verts, target_path, weight):
    moved = 0
    for line in open(target_path):
        if line.startswith('#') or not line.strip():
            continue
        parts = line.split()
        index = int(parts[0])
        if index >= len(verts):
            continue
        for axis in range(3):
            verts[index][axis] += float(parts[axis + 1]) * weight
        moved += 1
    return moved


def write_obj(path, verts, lines, only_group=None):
    out, cur, keep, i = [], None, True, 0
    for line in lines:
        if line.startswith('v '):
            x, y, z = verts[i]
            out.append(f'v {x:.6f} {y:.6f} {z:.6f}\n')
            i += 1
        elif line.startswith('g '):
            cur = line[2:].strip()
            keep = (only_group is None or cur == only_group)
            if keep:
                out.append(line)
        elif line.startswith('f '):
            if keep:
                out.append(line)
        elif line.startswith(('vt ', 'vn ')):
            out.append(line)
    open(path, 'w').writelines(out)


def joint_centroids(verts, lines):
    groups, cur = {}, None
    for line in lines:
        if line.startswith('g '):
            cur = line[2:].strip()
            groups.setdefault(cur, set())
        elif line.startswith('f ') and cur:
            for token in line.split()[1:]:
                groups[cur].add(int(token.split('/')[0]) - 1)
    out = {}
    for name, idx in groups.items():
        if not name.startswith('joint-') or not idx:
            continue
        pts = [verts[i] for i in idx]
        out[name] = [round(sum(p[k] for p in pts) / len(pts), 4) for k in range(3)]
    return out


if __name__ == '__main__':
    verts, lines = read_vertices(os.path.join(HERE, 'human_base.obj'))
    moved = apply_target(verts, os.path.join(HERE, 'male.target'), WEIGHT)
    print(f'moved {moved} vertices of {len(verts)}')

    write_obj(os.path.join(HERE, 'body.obj'), verts, lines, only_group='body')
    markers = joint_centroids(verts, lines)
    json.dump(markers, open(os.path.join(HERE, 'joints.json'), 'w'), indent=1)

    body_z = [v[1] for v in verts]
    print('markers re-read:', len(markers), ' height:', round(max(body_z) - min(body_z), 3))
    print('shoulder span:', round(abs(markers['joint-l-shoulder'][0] - markers['joint-r-shoulder'][0]), 3))
