"""Dizrupt mascot in the cosmic-void style — Claude's build, kept apart from the others.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P mascot3d/claude/build.py

Reads body.obj + joints.json (cut by morph.py from MakeHuman's CC0 base with the male and face
targets applied), writes claude.blend, renders to renders/. Touches nothing outside this folder.

Everything on him is real geometry now. The earlier build masked the head, hands and feet off and
stood primitives in their place; that gave an egg and two balls, which is not a face or a fist. So:

  - The face keeps its structure — jaw, cheekbones, brow — and loses its features through
    MakeHuman's own morph targets (nose and mouth shrunk, chin brought forward and squared, ears
    shrunk), with a light smoothing pass over the nose-and-mouth zone to erase what is left.
  - The hands keep their fingers and are closed into fists by real finger bones, three per finger,
    built from the marker cubes and curled about the knuckle axis.
  - The feet are simply left alone: the base has proper toes.
  - The body is warped into the reference's proportions: a width profile down the height for the
    V from shoulders to waist, longer legs, a smaller head — applied to the markers too, so the
    rig's joints stay inside the limbs.
  - The outline is an inverted hull, which holds evenly where a fresnel blotched.

Deliberately absent: the horned crest and the chest emblem, the two things that would identify
the character this look is borrowed from.
"""
import bmesh
import bpy
import json
import math
import os
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
HEIGHT = 2.0

WIDTH_PROFILE = [
    (0.00, 0.96), (0.30, 0.98), (0.47, 0.96),
    (0.57, 0.86),
    (0.70, 1.02), (0.78, 1.12),
    (0.85, 0.98),
    (0.88, 1.00), (1.00, 0.99),   # the head keeps its natural width; pinching it made a long oval
]
CROTCH = 0.47
LEG_STRETCH = 1.14
NECK = 0.895        # fraction of height where the head begins
HEAD_SQUASH = 0.92  # the head is shortened about the neck line, so the face is not elongated

# Where each limb points, in world space. X is the figure's left, -Y towards the camera, Z up.
AIM = [
    ('armL.0', (0.30, 0.04, -0.95)), ('armL.1', (0.10, -0.12, -0.99)),
    ('armR.0', (-0.30, 0.04, -0.95)), ('armR.1', (-0.10, -0.12, -0.99)),
    ('legL.0', (0.07, -0.02, -1.00)), ('legL.1', (0.01, 0.00, -1.00)),
    ('legR.0', (-0.07, -0.02, -1.00)), ('legR.1', (-0.01, 0.00, -1.00)),
]

# how far each finger joint closes, base to tip, in degrees — the thumb wraps less and lower
CURL = {1: (52, 64, 46), 2: (62, 88, 52), 3: (64, 90, 55), 4: (62, 88, 52), 5: (58, 84, 50)}


def chains():
    out = {
        'spine': (['joint-pelvis', 'joint-spine-3', 'joint-spine-1', 'joint-neck', 'joint-head'], None),
        'armL': (['joint-l-shoulder', 'joint-l-elbow', 'joint-l-hand'], 'spine.2'),
        'armR': (['joint-r-shoulder', 'joint-r-elbow', 'joint-r-hand'], 'spine.2'),
        'legL': (['joint-l-upper-leg', 'joint-l-knee', 'joint-l-ankle', 'joint-l-foot-1'], 'spine.0'),
        'legR': (['joint-r-upper-leg', 'joint-r-knee', 'joint-r-ankle', 'joint-r-foot-1'], 'spine.0'),
    }
    for side in 'LR':
        s = side.lower()
        out[f'hand{side}'] = ([f'joint-{s}-hand', f'joint-{s}-finger-3-1'], f'arm{side}.1')
        for finger in range(1, 6):
            names = [f'joint-{s}-finger-{finger}-{k}' for k in range(1, 5)]
            out[f'finger{side}{finger}'] = (names, f'hand{side}.0')
    return out


def obj_to_blender(p):
    return Vector((p[0], -p[2], p[1]))


def width_at(frac):
    for (f0, w0), (f1, w1) in zip(WIDTH_PROFILE, WIDTH_PROFILE[1:]):
        if f0 <= frac <= f1:
            t = (frac - f0) / (f1 - f0) if f1 > f0 else 0.0
            return w0 + (w1 - w0) * t
    return WIDTH_PROFILE[-1][1]


def stylise(p, height):
    crotch = CROTCH * height
    z = p.z * LEG_STRETCH if p.z < crotch else crotch * LEG_STRETCH + (p.z - crotch)
    z *= height / (crotch * LEG_STRETCH + (height - crotch))
    neck = NECK * height
    if z > neck:
        z = neck + (z - neck) * HEAD_SQUASH
    w = width_at(z / height)
    return Vector((p.x * w, p.y * w, z))


# --- scene ------------------------------------------------------------------------------------
def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_body():
    bpy.ops.wm.obj_import(filepath=os.path.join(HERE, 'body.obj'))
    body = bpy.context.selected_objects[0]
    body.name = 'Mascot'
    return body


def fit_and_warp(body, markers):
    zs = [(body.matrix_world @ v.co).z for v in body.data.vertices]
    lo, hi = min(zs), max(zs)
    scale = HEIGHT / (hi - lo)
    body.scale = (scale, scale, scale)
    body.location.z = -lo * scale
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for v in body.data.vertices:
        v.co = stylise(v.co, HEIGHT)
    return {name: stylise(p * scale + Vector((0, 0, -lo * scale)), HEIGHT) for name, p in markers.items()}


def soften_features(body, markers):
    """Structure stays, features go.

    The base body carries the inside of the mouth and the eye sockets as surface — a bag of faces
    behind the lips and behind the lids. Shrink the mouth and that bag folds, and a fold lets the
    outline hull's inner face show through as a white bar; the lid rims likewise cut through the
    eyes. So the cavities are cut out and the openings patched flat, and the smoothing below turns
    the patches into a closed mouth and closed eyes. The jaw edge, the cheekbones and the brow lie
    outside every group here, so the structure is untouched.
    """
    head = markers['joint-head']
    eye_l, eye_r = markers['joint-l-eye'], markers['joint-r-eye']
    mesh = body.data

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()
    in_mouth = lambda c: head.z - 0.046 < c.z < head.z + 0.032 and abs(c.x) < 0.078 and c.y < head.y
    near_eye = lambda c: any((c - eye).length < 0.032 for eye in (eye_l, eye_r))
    # Cavity faces are the ones that do not face forward: the inside of the lips turns back into
    # the mouth, the socket lining turns back behind the lids. Depth from the lip apex was tried
    # and missed the corners, which sit further back and kept their inner surfaces.
    doomed = [f for f in bm.faces
              if (in_mouth(f.calc_center_median()) or near_eye(f.calc_center_median())) and f.normal.y > -0.5]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    rims = [e for e in bm.edges if e.is_boundary]
    made = bmesh.ops.holes_fill(bm, edges=rims, sides=0)
    # the new faces come out facing whichever way, and the hull shells any that face inward as a
    # white rim — so the patches are turned to face forward outright rather than left to a guess
    bm.normal_update()
    backwards = [f for f in made['faces'] if f.normal.y > 0]
    if backwards:
        bmesh.ops.reverse_faces(bm, faces=backwards)
    print(f'cut {len(doomed)} cavity faces, sealed {len(rims)} rim edges with {len(made["faces"])} faces')
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    features = body.vertex_groups.new(name='features')
    ears = body.vertex_groups.new(name='ears')
    for v in mesh.vertices:
        c = v.co
        if head.z - 0.045 < c.z < eye_l.z + 0.025 and c.y < head.y - 0.045:
            edge = min((c.z - (head.z - 0.045)) / 0.02, (eye_l.z + 0.025 - c.z) / 0.02, 1.0)
            features.add([v.index], max(0.0, edge), 'REPLACE')
        if abs(c.x) > 0.055 and head.z - 0.03 < c.z < eye_l.z + 0.04 and abs(c.y - head.y) < 0.05:
            ears.add([v.index], 1.0, 'REPLACE')

    smooth = body.modifiers.new('Features', 'SMOOTH')
    smooth.vertex_group = 'features'
    smooth.factor = 0.7
    smooth.iterations = 34
    # ears are flaps, and smoothing pulls a flap flat against what it grows from
    flatten = body.modifiers.new('Ears', 'SMOOTH')
    flatten.vertex_group = 'ears'
    flatten.factor = 1.0
    flatten.iterations = 40


def build_rig(body, markers):
    armature = bpy.data.armatures.new('Rig')
    rig = bpy.data.objects.new('Rig', armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for chain, (names, parent_name) in chains().items():
        pts = [markers[n] for n in names]
        parent = armature.edit_bones.get(parent_name) if parent_name else None
        for i in range(len(pts) - 1):
            bone = armature.edit_bones.new(f'{chain}.{i}')
            bone.head, bone.tail = pts[i], pts[i + 1]
            if parent:
                bone.parent = parent
                bone.use_connect = (i > 0)  # the root of a limb hangs off its parent, unconnected
            parent = bone
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return rig


def aim(bone, direction):
    y = Vector(direction).normalized()
    ref = Vector((0, 0, 1)) if abs(y.z) < 0.95 else Vector((0, -1, 0))
    x = ref.cross(y).normalized()
    z = x.cross(y)  # right-handed; the other order is a reflection and mirrors the limb
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = bone.head
    bone.matrix = m


def turn(bone, axis, degrees):
    """Rotate a bone about a world-space axis through its head, keeping its roll."""
    m = bone.matrix.copy()
    head = m.translation.copy()
    m.translation = Vector((0, 0, 0))
    m = Matrix.Rotation(math.radians(degrees), 4, axis) @ m
    m.translation = head
    bone.matrix = m


def pose(rig):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    bones = rig.pose.bones
    for name, direction in AIM:
        bpy.context.view_layer.update()
        aim(bones[name], direction)
    bpy.context.view_layer.update()

    for side in 'LR':
        finger_bones = [bones[f'finger{side}{f}.{k}'] for f in range(1, 6) for k in range(3)]
        rest = {b.name: b.matrix_basis.copy() for b in finger_bones}
        wrist = bones[f'hand{side}.0'].head
        knuckle = lambda f: bones[f'finger{side}{f}.0'].head
        across_dir = (knuckle(5) - knuckle(2)).normalized()

        def curl(palm):
            for b in finger_bones:
                b.matrix_basis = rest[b.name]
            # the thumb does not fold like the fingers: it closes towards the palm and across it,
            # towards the little finger, to lie over the closed fingers
            thumb_way = (palm * 0.6 + across_dir).normalized()  # more across than down: it lies over the fingers
            for finger in range(1, 6):
                towards = thumb_way if finger == 1 else palm
                for k, degrees in enumerate(CURL[finger]):
                    bone = bones[f'finger{side}{finger}.{k}']
                    bpy.context.view_layer.update()
                    direction = (bone.tail - bone.head).normalized()
                    axis = direction.cross(towards)
                    if axis.length > 1e-4:
                        turn(bone, axis.normalized(), degrees)
            bpy.context.view_layer.update()
            # how much of a fist is it? the tips of a closed hand sit near the wrist
            return sum((bones[f'finger{side}{f}.2'].tail - wrist).length for f in range(2, 6))

        # Which way is the palm? Guessing from the thumb, then from the fingers' rest flex, both
        # picked wrong. So every plausible direction is tried and the one that closes the hand
        # is kept: a wrong curl throws the fingertips outward, a right one tucks them in.
        knuckle = lambda f: bones[f'finger{side}{f}.0'].head
        across = (knuckle(5) - knuckle(2)).normalized()
        across_dir = across
        along = (bones[f'finger{side}3.0'].tail - knuckle(3)).normalized()
        normal = across.cross(along).normalized()
        best = min([normal, -normal, across, -across], key=curl)
        curl(best)

        # The aiming that hung the arm left its roll to chance, and the palm landed facing the
        # camera — a fist seen head-on. Twist the forearm about its own axis until the palm faces
        # the thigh, a little backward, as a hanging hand does. The fist rides along as children.
        fore = bones[f'arm{side}.1']
        axis = (fore.tail - fore.head).normalized()
        want = Vector((-1.0 if side == 'L' else 1.0, 0.35, 0.0)).normalized()
        have = best - axis * best.dot(axis)
        want = want - axis * want.dot(axis)
        if have.length > 1e-4 and want.length > 1e-4:
            angle = math.atan2(have.cross(want).dot(axis), have.dot(want))
            turn(fore, axis, math.degrees(angle))
            bpy.context.view_layer.update()

    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


# --- look -------------------------------------------------------------------------------------
def emission(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    e = nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = strength
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(e.outputs['Emission'], out.inputs['Surface'])
    return mat


def void_material():
    mat = bpy.data.materials.new('Void')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial'); out.location = (800, 0)
    base = nodes.new('ShaderNodeBsdfPrincipled'); base.location = (300, -200)
    base.inputs['Base Color'].default_value = (0.003, 0.003, 0.008, 1)
    base.inputs['Roughness'].default_value = 0.55
    coord = nodes.new('ShaderNodeTexCoord'); coord.location = (-800, 200)

    def stars(scale, cutoff, y):
        vor = nodes.new('ShaderNodeTexVoronoi'); vor.location = (-560, y)
        vor.inputs['Scale'].default_value = scale
        links.new(coord.outputs['Object'], vor.inputs['Vector'])
        m = nodes.new('ShaderNodeMapRange'); m.location = (-340, y)
        m.inputs['From Min'].default_value = 0.0
        m.inputs['From Max'].default_value = cutoff
        m.inputs['To Min'].default_value = 1.0
        m.inputs['To Max'].default_value = 0.0
        m.clamp = True
        links.new(vor.outputs['Distance'], m.inputs['Value'])
        return m

    fine, bold = stars(210.0, 0.05, 320), stars(38.0, 0.035, 80)
    add = nodes.new('ShaderNodeMath'); add.location = (-120, 200)
    add.operation = 'MAXIMUM'
    links.new(fine.outputs['Result'], add.inputs[0])
    links.new(bold.outputs['Result'], add.inputs[1])
    glow = nodes.new('ShaderNodeEmission'); glow.location = (100, 240)
    glow.inputs['Color'].default_value = (0.92, 0.95, 1.0, 1)
    glow.inputs['Strength'].default_value = 12.0
    mix = nodes.new('ShaderNodeMixShader'); mix.location = (560, 40)
    links.new(add.outputs['Value'], mix.inputs['Fac'])
    links.new(base.outputs['BSDF'], mix.inputs[1])
    links.new(glow.outputs['Emission'], mix.inputs[2])
    links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return mat


def shade(body):
    body.data.materials.clear()
    body.data.materials.append(void_material())
    outline = emission('Outline', (0.80, 0.86, 1.0), 2.6)
    outline.use_backface_culling = True
    body.data.materials.append(outline)
    for poly in body.data.polygons:
        poly.use_smooth = True
    hull = body.modifiers.new('Outline', 'SOLIDIFY')
    hull.thickness = -0.008
    hull.offset = 1.0
    hull.use_flip_normals = True
    hull.use_rim = False
    hull.material_offset = 1


def add_eyes(markers):
    """Slits set in the eye sockets: the base mesh leaves the socket open where the eyeball would
    sit, and these fill it. Tilted up and outward; plain enough not to be anyone else's eyes."""
    mat = emission('Eyes', (0.55, 1.0, 0.42), 4.5)
    for side in ('l', 'r'):
        p = markers[f'joint-{side}-eye']
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.019, location=p + Vector((0.003 if side == 'l' else -0.003, -0.020, 0.003)))
        eye = bpy.context.active_object
        eye.name = f'Eye{side.upper()}'
        eye.scale = (1.5, 0.5, 0.6)
        eye.rotation_euler = (0, math.radians(-22 if side == 'l' else 22), 0)
        eye.data.materials.append(mat)
        for poly in eye.data.polygons:
            poly.use_smooth = True


def set_up():
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.003, 0.003, 0.006, 1)
    bpy.context.scene.world = world

    def lamp(name, loc, energy, size, color, target=(0, 0, 1.05)):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.size, data.color = energy, size, color
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        bpy.context.collection.objects.link(obj)
        empty = bpy.data.objects.new(f'{name}T', None)
        empty.location = target
        bpy.context.collection.objects.link(empty)
        obj.constraints.new('TRACK_TO').target = empty

    lamp('Key', (-1.8, -3.0, 2.6), 160, 2.5, (0.75, 0.78, 1.0))
    lamp('RimL', (-2.4, 2.6, 2.2), 500, 2.5, (0.55, 0.5, 1.0))
    lamp('RimR', (2.6, 2.2, 1.9), 400, 2.0, (0.4, 0.7, 1.0))

    cam = bpy.data.cameras.new('Camera')
    cam.lens = 85
    camera = bpy.data.objects.new('Camera', cam)
    camera.location = (0.0, -7.0, 1.05)
    camera.rotation_euler = (math.radians(89.5), 0, 0)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def render(path):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 640, 1140
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('rendered ->', path)


def closeup(target, distance, path, size=560):
    scene = bpy.context.scene
    cam = scene.camera
    keep = (cam.location.copy(), cam.rotation_euler.copy(), scene.render.resolution_x, scene.render.resolution_y)
    cam.location = Vector(target) + Vector((0, -distance, 0))
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    cam.location, cam.rotation_euler = keep[0], keep[1]
    scene.render.resolution_x, scene.render.resolution_y = keep[2], keep[3]
    print('closeup ->', path)


if __name__ == '__main__':
    clear()
    markers = {k: obj_to_blender(v) for k, v in json.load(open(os.path.join(HERE, 'joints.json'))).items()}
    body = load_body()
    markers = fit_and_warp(body, markers)
    soften_features(body, markers)
    rig = build_rig(body, markers)
    pose(rig)
    shade(body)
    add_eyes(markers)
    set_up()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'claude.blend'))
    tag = 'v25'
    render(os.path.join(HERE, 'renders', f'{tag}.png'))
    closeup((0, -0.05, 1.86), 1.0, os.path.join(HERE, 'renders', f'{tag}_head.png'))
    closeup((0.36, -0.08, 0.95), 0.75, os.path.join(HERE, 'renders', f'{tag}_hand.png'))
    closeup((0, -0.05, 0.12), 1.0, os.path.join(HERE, 'renders', f'{tag}_feet.png'))
