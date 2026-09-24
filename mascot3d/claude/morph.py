"""Male body plus a sculpted, featureless face, cut from the neutral base with MakeHuman's own
targets. Every target is a list of per-vertex deltas from the neutral mesh and they simply add, so
the face morphs stack on the male one. The joint-marker cubes move with them, which is why markers
are re-read here rather than reused."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
TARGETS = [('../male.target', 1.0),
           ('targets/nose-scale-depth-decr.target', 1.9), ('targets/nose-scale-vert-decr.target', 1.3),
           ('targets/nose-scale-horiz-decr.target', 1.0), ('targets/mouth-scale-depth-decr.target', 1.0),
           ('targets/mouth-scale-vert-decr.target', 1.0), ('targets/mouth-scale-horiz-decr.target', 0.7),
           ('targets/chin-prominent-incr.target', 0.5), ('targets/chin-triangle.target', 0.35),
           ('targets/l-ear-scale-decr.target', 2.3), ('targets/r-ear-scale-decr.target', 2.3),
           ('targets/l-ear-scale-depth-decr.target', 1.6), ('targets/r-ear-scale-depth-decr.target', 1.6)]
verts, lines = [], []
for line in open(os.path.join(HERE, '..', 'human_base.obj')):
    if line.startswith('v '): verts.append([float(x) for x in line.split()[1:4]])
    lines.append(line)
for rel, w in TARGETS:
    n = 0
    for line in open(os.path.join(HERE, rel)):
        if line.startswith('#') or not line.strip(): continue
        p = line.split(); i = int(p[0])
        if i < len(verts):
            for a in range(3): verts[i][a] += float(p[a + 1]) * w
            n += 1
    print(f'{os.path.basename(rel):32} x{w:<4} {n} verts')
out, cur, keep, i = [], None, True, 0
for line in lines:
    if line.startswith('v '):
        x, y, z = verts[i]; out.append(f'v {x:.6f} {y:.6f} {z:.6f}\n'); i += 1
    elif line.startswith('g '):
        cur = line[2:].strip(); keep = (cur == 'body')
        if keep: out.append(line)
    elif line.startswith('f '):
        if keep: out.append(line)
    elif line.startswith(('vt ', 'vn ')): out.append(line)
open(os.path.join(HERE, 'body.obj'), 'w').writelines(out)
groups, cur = {}, None
for line in lines:
    if line.startswith('g '): cur = line[2:].strip(); groups.setdefault(cur, set())
    elif line.startswith('f ') and cur:
        for tok in line.split()[1:]: groups[cur].add(int(tok.split('/')[0]) - 1)
markers = {}
for name, idx in groups.items():
    if name.startswith('joint-') and idx:
        pts = [verts[k] for k in idx]
        markers[name] = [round(sum(p[a] for p in pts) / len(pts), 4) for a in range(3)]
json.dump(markers, open(os.path.join(HERE, 'joints.json'), 'w'), indent=1)
print('markers', len(markers))
