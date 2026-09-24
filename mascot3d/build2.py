"""Dizrupt mascot, built on a real human base.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P mascot3d/build2.py

The first attempt grew the body from a stick figure with the Skin modifier. It gave tapered tubes
and slabs where limbs met, which is all that modifier can give — no deltoid, no calf, no foot. This
starts from MakeHuman's base mesh instead (released CC0 in 2020, stated in the file's own header),
which carries proper anatomy and, usefully, 125 marker cubes sitting at the real joint centres. The
rig is built from those markers rather than from my guesses, so the elbow bends where an elbow is.
"""
import bpy
import json
import math
import os
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET_HEIGHT = 1.98  # tall and lean, the way the reference reads

# marker -> bone chains. Blender is Z-up and the OBJ is Y-up, so the import converts as it reads.
CHAINS = {
    'spine': ['joint-pelvis', 'joint-spine-3', 'joint-spine-1', 'joint-neck', 'joint-head'],
    'armL': ['joint-l-shoulder', 'joint-l-elbow', 'joint-l-hand'],
    'armR': ['joint-r-shoulder', 'joint-r-elbow', 'joint-r-hand'],
    'legL': ['joint-l-upper-leg', 'joint-l-knee', 'joint-l-ankle', 'joint-l-foot-1'],
    'legR': ['joint-r-upper-leg', 'joint-r-knee', 'joint-r-ankle', 'joint-r-foot-1'],
}

"""Where each limb points, in world space, rather than how far to rotate it.

Euler angles on a chain are guesswork — the parent turns, and the child's axes go with it. Aiming
is stated in the terms the silhouette is actually read in: the left elbow goes out and slightly
back, the forearm comes up and across to put the fist in front of the chest, the right arm hangs.
X is the figure's left, -Y is towards the camera, Z is up.
"""
AIM = [
    ('armL.0', (0.90, 0.16, -0.40)),   # upper arm out, elbow clear of the ribs
    ('armL.1', (-0.46, -0.76, 0.44)),  # forearm up and across, fist to the chest
    ('armR.0', (-0.20, 0.04, -0.98)),  # the other arm just hangs
    ('armR.1', (-0.09, -0.14, -0.99)),
    ('legL.0', (0.12, -0.06, -0.99)),
    ('legL.1', (0.03, 0.03, -1.00)),
    ('legR.0', (-0.17, 0.03, -0.98)),
    ('legR.1', (-0.05, 0.02, -1.00)),
]

def obj_to_blender(p):
    """OBJ ships Y-up; Blender works Z-up. Same convention the importer uses below."""
    return Vector((p[0], -p[2], p[1]))


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_body():
    bpy.ops.wm.obj_import(filepath=os.path.join(HERE, 'body.obj'))
    body = bpy.context.selected_objects[0]
    body.name = 'Mascot'
    return body


def fit(body, markers):
    """Scale the whole set-up to a human height and stand it on the floor."""
    lo = min((body.matrix_world @ v.co).z for v in body.data.vertices)
    hi = max((body.matrix_world @ v.co).z for v in body.data.vertices)
    scale = TARGET_HEIGHT / (hi - lo)
    body.scale = (scale, scale, scale)
    body.location.z = -lo * scale
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return {name: p * scale + Vector((0, 0, -lo * scale)) for name, p in markers.items()}


def build_rig(body, markers):
    armature = bpy.data.armatures.new('Rig')
    rig = bpy.data.objects.new('Rig', armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')

    made = {}
    for chain, names in CHAINS.items():
        points = [markers[n] for n in names if n in markers]
        parent = None
        for i in range(len(points) - 1):
            bone = armature.edit_bones.new(f'{chain}.{i}')
            bone.head, bone.tail = points[i], points[i + 1]
            if parent:
                bone.parent = parent
                bone.use_connect = True
            parent = bone
            made[bone.name] = True
        # hang the limbs off the spine so the whole body moves together
        if chain != 'spine' and f'{chain}.0' in armature.edit_bones:
            root = armature.edit_bones[f'{chain}.0']
            anchor = 'spine.2' if 'arm' in chain else 'spine.0'
            if anchor in armature.edit_bones:
                root.parent = armature.edit_bones[anchor]

    bpy.ops.object.mode_set(mode='OBJECT')

    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')  # weights from proximity; fine for a smooth body
    return rig


def pose(rig):
    """Point each bone along its aim direction, parents before children.

    Setting the matrix outright sidesteps the chain problem: once a parent has moved, the child's
    head has already followed it, and the child only needs its own direction. The view layer has to
    be brought up to date between bones or each one would be aimed from where its parent used to be.
    """
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for name, direction in AIM:
        bone = rig.pose.bones.get(name)
        if not bone:
            continue
        bpy.context.view_layer.update()
        y = Vector(direction).normalized()
        reference = Vector((0, 0, 1)) if abs(y.z) < 0.95 else Vector((1, 0, 0))
        x = reference.cross(y).normalized()
        z = y.cross(x)
        matrix = Matrix((x, y, z)).transposed().to_4x4()
        matrix.translation = bone.head
        bone.matrix = matrix
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


def blank_features(body, markers):
    """UNSOLVED — deliberately doing nothing for now.

    The mascot has no face and no fingers. Two attempts to get there both failed and are recorded
    here so the next one does not repeat them:

      1. A Smooth modifier on a face/hand vertex group. The groups and weights were correct, but
         Laplacian smoothing only nibbles at a long thin shape; forty-eight passes still left a
         readable hand.
      2. Pushing those vertices onto a sphere. That did flatten them, but it fights the rig — the
         automatic weights around the collapsed vertices no longer agree, and the raised hand
         deformed into a shard.

    The tool that should work is a Shrinkwrap onto a smooth primitive, limited by the same vertex
    group, so the surface stays continuous and the armature still has something coherent to deform.
    """
    return


def stretch(body):
    """Lengthen and narrow him a little. The reference figure is long-limbed and slim-waisted;
    a few per cent on the vertical against a few off the width reads as that build without
    distorting anything enough to notice."""
    for v in body.data.vertices:
        v.co.x *= 0.955
        v.co.y *= 0.955
        v.co.z *= 1.045


def add_eyes(markers):
    """Two lights where the eye markers already sit. Deliberately plain ovals — the shape of the
    eyes is one of the things that identifies the character they came from, so these are only
    bright and almond, nothing more."""
    mat = bpy.data.materials.new('Eyes')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Color'].default_value = (0.45, 1.0, 0.35, 1)
    emit.inputs['Strength'].default_value = 24.0
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(emit.outputs['Emission'], out.inputs['Surface'])

    for side in ('l', 'r'):
        marker = markers.get(f'joint-{side}-eye')
        if not marker:
            continue
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.030, location=marker)
        eye = bpy.context.active_object
        eye.name = f'Eye{side.upper()}'
        eye.scale = (1.5, 0.55, 0.85)   # almond, set into the socket
        eye.data.materials.append(mat)
        for poly in eye.data.polygons:
            poly.use_smooth = True


def shade(body):
    """Void body, stars inside it, a pale edge holding the silhouette against the black.

    The edge is the part doing the work: the reference is drawn with a light outline, and a strong
    fresnel is how that reads in three dimensions rather than as a line drawn round it.
    """
    mat = bpy.data.materials.new('AlienVoid')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial'); out.location = (700, 0)
    base = nodes.new('ShaderNodeBsdfPrincipled'); base.location = (300, -160)
    base.inputs['Base Color'].default_value = (0.004, 0.004, 0.010, 1)
    base.inputs['Roughness'].default_value = 0.42

    coord = nodes.new('ShaderNodeTexCoord'); coord.location = (-760, 200)
    vor = nodes.new('ShaderNodeTexVoronoi'); vor.location = (-560, 200)
    vor.inputs['Scale'].default_value = 150.0
    links.new(coord.outputs['Object'], vor.inputs['Vector'])

    spark = nodes.new('ShaderNodeMapRange'); spark.location = (-340, 200)
    spark.inputs['From Min'].default_value = 0.0
    spark.inputs['From Max'].default_value = 0.075
    spark.inputs['To Min'].default_value = 1.0
    spark.inputs['To Max'].default_value = 0.0
    spark.clamp = True
    links.new(vor.outputs['Distance'], spark.inputs['Value'])

    stars = nodes.new('ShaderNodeEmission'); stars.location = (0, 260)
    stars.inputs['Color'].default_value = (0.92, 0.94, 1.0, 1)
    stars.inputs['Strength'].default_value = 11.0

    fres = nodes.new('ShaderNodeFresnel'); fres.location = (-200, -340)
    fres.inputs['IOR'].default_value = 1.9
    sharpen = nodes.new('ShaderNodeMapRange'); sharpen.location = (0, -340)
    sharpen.inputs['From Min'].default_value = 0.45   # keep the glow at the edge, not over the body
    sharpen.inputs['From Max'].default_value = 0.92
    sharpen.clamp = True
    links.new(fres.outputs['Fac'], sharpen.inputs['Value'])

    rim = nodes.new('ShaderNodeEmission'); rim.location = (220, -400)
    rim.inputs['Color'].default_value = (0.82, 0.86, 1.0, 1)
    rim.inputs['Strength'].default_value = 3.4

    mix_rim = nodes.new('ShaderNodeMixShader'); mix_rim.location = (460, -200)
    links.new(sharpen.outputs['Result'], mix_rim.inputs['Fac'])
    links.new(base.outputs['BSDF'], mix_rim.inputs[1])
    links.new(rim.outputs['Emission'], mix_rim.inputs[2])

    mix_stars = nodes.new('ShaderNodeMixShader'); mix_stars.location = (600, 60)
    links.new(spark.outputs['Result'], mix_stars.inputs['Fac'])
    links.new(mix_rim.outputs['Shader'], mix_stars.inputs[1])
    links.new(stars.outputs['Emission'], mix_stars.inputs[2])
    links.new(mix_stars.outputs['Shader'], out.inputs['Surface'])

    body.data.materials.clear()
    body.data.materials.append(mat)
    for poly in body.data.polygons:
        poly.use_smooth = True


def set_up():
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.004, 0.008, 1)
    bpy.context.scene.world = world

    def lamp(name, loc, energy, size, color, aim=(0, 0, 1.05)):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.size, data.color = energy, size, color
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        bpy.context.collection.objects.link(obj)
        empty = bpy.data.objects.new(f'{name}T', None)
        empty.location = aim
        bpy.context.collection.objects.link(empty)
        obj.constraints.new('TRACK_TO').target = empty

    lamp('RimL', (-2.4, 2.6, 2.2), 900, 2.5, (0.55, 0.45, 1.0))
    lamp('RimR', (2.6, 2.2, 1.9), 700, 2.0, (0.35, 0.75, 1.0))
    lamp('Fill', (0.6, -3.2, 1.2), 70, 3.0, (0.7, 0.72, 0.9))

    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 85
    camera = bpy.data.objects.new('Camera', cam_data)
    camera.location = (0.1, -6.6, 1.0)
    camera.rotation_euler = (math.radians(88.5), 0, math.radians(1.0))
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def render(path):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 620, 1100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.render.filepath = path.replace('.png', '_matte.png')
    bpy.ops.render.render(write_still=True)
    print('rendered ->', path)


if __name__ == '__main__':
    clear()
    markers = {k: obj_to_blender(v) for k, v in json.load(open(os.path.join(HERE, 'joints.json'))).items()}
    body = load_body()
    markers = fit(body, markers)
    rig = build_rig(body, markers)
    pose(rig)
    blank_features(body, markers)
    stretch(body)
    shade(body)
    add_eyes(markers)
    set_up()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'mascot.blend'))
    render(os.path.join(HERE, 'renders', 'alien1.png'))
