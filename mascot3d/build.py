"""Dizrupt mascot — a first pass at the figure in 3D.

Run headless:
    /Applications/Blender.app/Contents/MacOS/Blender -b -P mascot3d/build.py

The joint positions below are read off the silhouette pulled from mascot-v2.gif: roughly eight
heads tall, athletic, weight on the right leg, the left fist raised to chest height. The body is
grown from a stick figure with the Skin modifier rather than sculpted, because the mascot has no
face and no fingers — it is a smooth silhouette, which is exactly what this produces. Alien X is
the same in that respect, so the look survives the method.
"""
import bpy
import os
import math

HEIGHT = 1.85  # metres, so the lighting and camera behave like a real set

# (name, x, y, z, radius) — y is depth, negative is towards the camera
JOINTS = {
    # spine — the chest carries the mass, the waist takes it away again
    'pelvis':    (0.00, 0.00, 0.98, 0.122),
    'waist':     (0.00, -0.01, 1.12, 0.108),
    'ribs':      (0.00, -0.02, 1.28, 0.140),
    'chest':     (0.00, -0.02, 1.40, 0.150),
    'neckBase':  (0.00, 0.00, 1.50, 0.070),
    'neck':      (0.00, 0.00, 1.56, 0.052),
    'head':      (0.00, 0.00, 1.64, 0.086),
    'skull':     (0.00, 0.00, 1.77, 0.090),

    # shoulder caps sit proud of the chest, which is what gives a body shoulders instead of a slab
    'deltL':     (0.20, 0.00, 1.44, 0.082),
    'bicepL':    (0.29, -0.03, 1.31, 0.058),
    'elbowL':    (0.35, -0.05, 1.22, 0.050),
    'foreL':     (0.33, -0.13, 1.29, 0.047),
    'wristL':    (0.30, -0.19, 1.35, 0.038),
    'fistL':     (0.28, -0.24, 1.40, 0.060),

    'deltR':     (-0.20, 0.00, 1.44, 0.082),
    'bicepR':    (-0.24, -0.01, 1.28, 0.056),
    'elbowR':    (-0.26, -0.01, 1.17, 0.048),
    'foreR':     (-0.28, -0.02, 1.04, 0.045),
    'wristR':    (-0.30, -0.02, 0.92, 0.036),
    'handR':     (-0.31, -0.04, 0.83, 0.052),

    # legs: thigh, a calf that bulges behind the shin, then a foot with a heel and a ball
    'hipL':      (0.10, 0.00, 0.94, 0.098),
    'thighL':    (0.12, -0.02, 0.74, 0.088),
    'kneeL':     (0.13, -0.03, 0.55, 0.060),
    'calfL':     (0.14, 0.01, 0.38, 0.068),
    'ankleL':    (0.14, 0.01, 0.11, 0.040),
    'heelL':     (0.14, 0.07, 0.038, 0.044),
    'ballL':     (0.14, -0.09, 0.036, 0.050),
    'toeL':      (0.14, -0.17, 0.030, 0.034),

    'hipR':      (-0.10, 0.00, 0.94, 0.098),
    'thighR':    (-0.13, 0.01, 0.74, 0.088),
    'kneeR':     (-0.155, 0.02, 0.54, 0.060),
    'calfR':     (-0.18, 0.04, 0.37, 0.068),
    'ankleR':    (-0.20, 0.04, 0.11, 0.040),
    'heelR':     (-0.21, 0.10, 0.038, 0.044),
    'ballR':     (-0.21, -0.06, 0.036, 0.050),
    'toeR':      (-0.22, -0.14, 0.030, 0.034),
}

BONES = [
    ('pelvis', 'waist'), ('waist', 'ribs'), ('ribs', 'chest'),
    ('chest', 'neckBase'), ('neckBase', 'neck'), ('neck', 'head'), ('head', 'skull'),

    ('chest', 'deltL'), ('deltL', 'bicepL'), ('bicepL', 'elbowL'),
    ('elbowL', 'foreL'), ('foreL', 'wristL'), ('wristL', 'fistL'),
    ('chest', 'deltR'), ('deltR', 'bicepR'), ('bicepR', 'elbowR'),
    ('elbowR', 'foreR'), ('foreR', 'wristR'), ('wristR', 'handR'),

    ('pelvis', 'hipL'), ('hipL', 'thighL'), ('thighL', 'kneeL'), ('kneeL', 'calfL'),
    ('calfL', 'ankleL'), ('ankleL', 'heelL'), ('ankleL', 'ballL'), ('ballL', 'toeL'),
    ('pelvis', 'hipR'), ('hipR', 'thighR'), ('thighR', 'kneeR'), ('kneeR', 'calfR'),
    ('calfR', 'ankleR'), ('ankleR', 'heelR'), ('ankleR', 'ballR'), ('ballR', 'toeR'),
]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_body():
    names = list(JOINTS)
    index = {name: i for i, name in enumerate(names)}
    verts = [JOINTS[n][:3] for n in names]
    edges = [(index[a], index[b]) for a, b in BONES]

    mesh = bpy.data.meshes.new('mascot')
    mesh.from_pydata(verts, edges, [])
    mesh.update()
    body = bpy.data.objects.new('Mascot', mesh)
    bpy.context.collection.objects.link(body)

    skin = body.modifiers.new('Skin', 'SKIN')
    skin.use_smooth_shade = True
    skin.branch_smoothing = 0.35  # stops the shoulders and hips knotting where limbs meet

    layer = mesh.skin_vertices[0].data
    for name, i in index.items():
        radius = JOINTS[name][3]
        layer[i].radius = (radius, radius)
    layer[index['pelvis']].use_root = True

    sub = body.modifiers.new('Subdivision', 'SUBSURF')
    sub.levels = sub.render_levels = 2

    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return body


def build_material(body):
    """Void-black body with a field of light inside it, and a violet edge where it catches the rim.

    The starfield is a Voronoi pushed hard enough that only the cell centres survive, so the points
    read as separate sparks rather than a texture. Fed to emission, it looks lit from within rather
    than lit from outside, which is the whole character of the look.
    """
    mat = bpy.data.materials.new('AlienVoid')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()

    out = nodes.new('ShaderNodeOutputMaterial')
    out.location = (600, 0)
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (300, -150)
    principled.inputs['Base Color'].default_value = (0.012, 0.010, 0.022, 1)
    principled.inputs['Roughness'].default_value = 0.34
    if 'Specular IOR Level' in principled.inputs:
        principled.inputs['Specular IOR Level'].default_value = 0.6

    coord = nodes.new('ShaderNodeTexCoord')
    coord.location = (-700, 200)
    voronoi = nodes.new('ShaderNodeTexVoronoi')
    voronoi.location = (-500, 200)
    voronoi.feature = 'F1'
    voronoi.inputs['Scale'].default_value = 165.0
    links.new(coord.outputs['Object'], voronoi.inputs['Vector'])

    spark = nodes.new('ShaderNodeMapRange')  # keep only the cell centres
    spark.location = (-300, 200)
    spark.inputs['From Min'].default_value = 0.0
    spark.inputs['From Max'].default_value = 0.05
    spark.inputs['To Min'].default_value = 1.0
    spark.inputs['To Max'].default_value = 0.0
    spark.clamp = True
    links.new(voronoi.outputs['Distance'], spark.inputs['Value'])

    stars = nodes.new('ShaderNodeEmission')
    stars.location = (0, 250)
    stars.inputs['Color'].default_value = (0.75, 0.72, 1.0, 1)
    stars.inputs['Strength'].default_value = 7.0

    # a violet fresnel, so the silhouette keeps an edge against a black background
    fresnel = nodes.new('ShaderNodeFresnel')
    fresnel.location = (0, -320)
    fresnel.inputs['IOR'].default_value = 1.45
    rim = nodes.new('ShaderNodeEmission')
    rim.location = (200, -380)
    rim.inputs['Color'].default_value = (0.42, 0.34, 0.95, 1)
    rim.inputs['Strength'].default_value = 2.4

    mix_rim = nodes.new('ShaderNodeMixShader')
    mix_rim.location = (420, -200)
    links.new(fresnel.outputs['Fac'], mix_rim.inputs['Fac'])
    links.new(principled.outputs['BSDF'], mix_rim.inputs[1])
    links.new(rim.outputs['Emission'], mix_rim.inputs[2])

    mix_stars = nodes.new('ShaderNodeMixShader')
    mix_stars.location = (500, 60)
    links.new(spark.outputs['Result'], mix_stars.inputs['Fac'])
    links.new(mix_rim.outputs['Shader'], mix_stars.inputs[1])
    links.new(stars.outputs['Emission'], mix_stars.inputs[2])
    links.new(mix_stars.outputs['Shader'], out.inputs['Surface'])

    body.data.materials.append(mat)


def build_set():
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.004, 0.008, 1)
    bpy.context.scene.world = world

    def lamp(name, kind, location, energy, size=1.0, color=(1, 1, 1)):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = color
        if kind == 'AREA':
            data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        bpy.context.collection.objects.link(obj)
        return obj

    # two rims and one low fill: the figure should be read by its edges, not lit like a portrait
    back_l = lamp('RimL', 'AREA', (-2.4, 2.6, 2.2), 900, 2.5, (0.55, 0.45, 1.0))
    back_r = lamp('RimR', 'AREA', (2.6, 2.2, 1.9), 700, 2.0, (0.35, 0.75, 1.0))
    fill = lamp('Fill', 'AREA', (0.6, -3.2, 1.2), 90, 3.0, (0.7, 0.72, 0.9))
    for light, target in ((back_l, (0, 0, 1.1)), (back_r, (0, 0, 1.1)), (fill, (0, 0, 1.0))):
        track = light.constraints.new('TRACK_TO')
        empty = bpy.data.objects.new(f'{light.name}Target', None)
        empty.location = target
        bpy.context.collection.objects.link(empty)
        track.target = empty

    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens = 85  # long enough that the proportions read honestly
    camera = bpy.data.objects.new('Camera', cam_data)
    camera.location = (0.15, -6.6, 1.05)
    camera.rotation_euler = (math.radians(88.5), 0, math.radians(1.5))
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def render(path):
    scene = bpy.context.scene
    for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    if scene.render.engine == 'CYCLES':
        scene.cycles.samples = 48
    scene.render.resolution_x = 620
    scene.render.resolution_y = 1100
    scene.render.image_settings.file_format = 'PNG'

    scene.render.film_transparent = False
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

    # ...and the same frame as a matte. Thresholding the beauty pass to find the body is guesswork
    # once there is a rim light on it; the alpha channel is the silhouette, exactly.
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    matte = path.replace('.png', '_matte.png')
    scene.render.filepath = matte
    bpy.ops.render.render(write_still=True)
    print('rendered ->', path, '+ matte, engine', scene.render.engine)


if __name__ == '__main__':
    clear_scene()
    body = build_body()
    build_material(body)
    build_set()
    here = os.path.dirname(os.path.abspath(__file__))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, 'mascot.blend'))
    render(os.path.join(here, 'renders', 'pass3.png'))
