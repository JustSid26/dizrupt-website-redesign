"""Build a clean, editable Alien X inspired mascot for the Dizrupt project index.

Run from the project root:
    blender -b -P mascot3d/build_gptblend.py

Outputs:
    mascot3d/gptblend.blend
    mascot3d/renders/gptblend.png
    mascot3d/renders/gptblend_matte.png

The construction is intentionally procedural and split into clearly named objects.  That makes the
silhouette easy to tune in Blender/Fable, while avoiding the pinched shoulders and deformed hands
of the auto-rigged human-base attempt.
"""

import math
import os

import bpy
from mathutils import Vector


HERE = os.path.dirname(os.path.abspath(__file__))
RENDERS = os.path.join(HERE, "renders")
TAU = math.tau


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_collection(name):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def smooth(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def apply_transform(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)


def add_ellipsoid(name, location, scale, material, collection, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return smooth(obj)


def rounded_box(name, location, scale, rotation, material, collection, bevel=0.22):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    modifier = obj.modifiers.new("Soft silhouette", "BEVEL")
    modifier.width = min(scale) * bevel
    modifier.segments = 5
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return smooth(obj)


def ring_basis(direction):
    axis = Vector(direction).normalized()
    helper = Vector((0, 0, 1)) if abs(axis.z) < 0.92 else Vector((0, 1, 0))
    side = axis.cross(helper).normalized()
    front = side.cross(axis).normalized()
    return axis, side, front


def tapered_limb(name, start, end, radii, material, collection, front_scale=0.92):
    """A smooth capsule-like limb with an anatomical bulge between its joints."""
    start, end = Vector(start), Vector(end)
    axis, side, front = ring_basis(end - start)
    around = 24
    along = 9
    vertices = []
    faces = []

    for row in range(along):
        t = row / (along - 1)
        centre = start.lerp(end, t)
        linear = radii[0] * (1 - t) + radii[1] * t
        muscle = 1 + math.sin(math.pi * t) * radii[2]
        radius = linear * muscle
        # Keep the ends full enough to overlap neighbouring forms.  Pinching them down is what
        # makes an otherwise organic figure read like a ball-jointed robot.
        cap = 0.90 + 0.10 * math.sin(math.pi * t)
        for column in range(around):
            angle = TAU * column / around
            offset = side * (math.cos(angle) * radius * cap)
            offset += front * (math.sin(angle) * radius * front_scale * cap)
            vertices.append(tuple(centre + offset))

    for row in range(along - 1):
        for column in range(around):
            nxt = (column + 1) % around
            a = row * around + column
            b = row * around + nxt
            c = (row + 1) * around + nxt
            d = (row + 1) * around + column
            faces.append((a, b, c, d))
    faces.append(tuple(reversed(range(around))))
    faces.append(tuple((along - 1) * around + i for i in range(around)))

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    smooth(obj)
    bevel = obj.modifiers.new("Organic smoothing", "SUBSURF")
    bevel.levels = 1
    bevel.render_levels = 2
    return obj


def loft(name, sections, material, collection, around=48):
    """Create a torso or head from elliptical horizontal profiles."""
    vertices = []
    faces = []
    for x_radius, y_radius, z, x_offset, y_offset in sections:
        for column in range(around):
            angle = TAU * column / around
            x = x_offset + math.cos(angle) * x_radius
            y = y_offset + math.sin(angle) * y_radius
            vertices.append((x, y, z))

    for row in range(len(sections) - 1):
        for column in range(around):
            nxt = (column + 1) % around
            a = row * around + column
            b = row * around + nxt
            c = (row + 1) * around + nxt
            d = (row + 1) * around + column
            faces.append((a, b, c, d))
    faces.append(tuple(reversed(range(around))))
    top = (len(sections) - 1) * around
    faces.append(tuple(top + i for i in range(around)))

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    smooth(obj)
    sub = obj.modifiers.new("Sculpt smoothing", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 2
    return obj


def curve_horn(name, points, radii, material, collection):
    curve = bpy.data.curves.new(f"{name}Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 3
    curve.bevel_depth = 0.036
    curve.bevel_resolution = 5
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co, radius in zip(spline.bezier_points, points, radii):
        point.co = co
        point.radius = radius
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def almond_eye(name, centre, width, height, tilt, material, collection):
    cx, cy, cz = centre
    points = []
    count = 20
    for i in range(count):
        angle = TAU * i / count
        # sin-weighted height produces a clean pointed almond instead of a round oval.
        x = math.cos(angle) * width
        z = math.sin(angle) * height * (0.68 + 0.32 * abs(math.cos(angle)))
        xr = x * math.cos(tilt) - z * math.sin(tilt)
        zr = x * math.sin(tilt) + z * math.cos(tilt)
        points.append((cx + xr, cy, cz + zr))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(points, [], [tuple(range(count))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    solid = obj.modifiers.new("Eye depth", "SOLIDIFY")
    solid.thickness = 0.012
    bevel = obj.modifiers.new("Eye bevel", "BEVEL")
    bevel.width = 0.006
    bevel.segments = 3
    return obj


def emblem_hourglass(material_green, material_dark, collection):
    # The torus faces the camera: Blender's torus begins in XY, so rotate its normal from Z to Y.
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.102,
        minor_radius=0.018,
        major_segments=48,
        minor_segments=12,
        location=(0, -0.226, 1.315),
        rotation=(math.radians(90), 0, 0),
    )
    ring = bpy.context.object
    ring.name = "AX_Omnitrix_Ring"
    ring.data.materials.append(material_green)
    move_to_collection(ring, collection)
    smooth(ring)

    # Concave hourglass on a dark inset, shallow enough to stay attached to the chest.
    rounded_box(
        "AX_Omnitrix_Core",
        (0, -0.216, 1.315),
        (0.079, 0.012, 0.079),
        (0, math.radians(45), 0),
        material_dark,
        collection,
        bevel=0.35,
    )
    points = [
        (-0.062, -0.238, 1.371),
        (0.062, -0.238, 1.371),
        (0.022, -0.238, 1.315),
        (0.062, -0.238, 1.259),
        (-0.062, -0.238, 1.259),
        (-0.022, -0.238, 1.315),
    ]
    mesh = bpy.data.meshes.new("AX_HourglassMesh")
    mesh.from_pydata(points, [], [tuple(range(6))])
    mesh.update()
    obj = bpy.data.objects.new("AX_Omnitrix_Hourglass", mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material_green)
    solid = obj.modifiers.new("Symbol depth", "SOLIDIFY")
    solid.thickness = 0.01
    bevel = obj.modifiers.new("Symbol bevel", "BEVEL")
    bevel.width = 0.008
    bevel.segments = 3


def cosmic_material():
    mat = bpy.data.materials.new("AX_Cosmic_Void")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (900, 20)
    base = nodes.new("ShaderNodeBsdfPrincipled")
    base.location = (420, -160)
    base.inputs["Base Color"].default_value = (0.0015, 0.002, 0.006, 1)
    base.inputs["Roughness"].default_value = 0.31
    base.inputs["Metallic"].default_value = 0.08

    coord = nodes.new("ShaderNodeTexCoord")
    coord.location = (-900, 160)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-680, 180)
    noise.noise_dimensions = "3D"
    noise.inputs["Scale"].default_value = 115
    noise.inputs["Detail"].default_value = 2
    noise.inputs["Roughness"].default_value = 0.72
    links.new(coord.outputs["Generated"], noise.inputs["Vector"])

    stars_ramp = nodes.new("ShaderNodeValToRGB")
    stars_ramp.location = (-430, 180)
    stars_ramp.color_ramp.interpolation = "CONSTANT"
    stars_ramp.color_ramp.elements[0].position = 0.685
    stars_ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    stars_ramp.color_ramp.elements[1].position = 0.725
    stars_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(noise.outputs["Fac"], stars_ramp.inputs["Fac"])

    stars = nodes.new("ShaderNodeEmission")
    stars.location = (120, 220)
    stars.inputs["Color"].default_value = (0.72, 0.86, 1.0, 1)
    stars.inputs["Strength"].default_value = 4.8
    star_mix = nodes.new("ShaderNodeMixShader")
    star_mix.location = (620, 40)
    links.new(stars_ramp.outputs["Color"], star_mix.inputs["Fac"])
    links.new(base.outputs["BSDF"], star_mix.inputs[1])
    links.new(stars.outputs["Emission"], star_mix.inputs[2])

    layer = nodes.new("ShaderNodeLayerWeight")
    layer.location = (-390, -300)
    layer.inputs["Blend"].default_value = 0.22
    rim_ramp = nodes.new("ShaderNodeValToRGB")
    rim_ramp.location = (-120, -300)
    rim_ramp.color_ramp.interpolation = "EASE"
    # Layer Weight's Facing output is low on a front-facing surface and high at grazing angles.
    # Hold almost the whole body black, then let only the last few degrees become the pale rim.
    rim_ramp.color_ramp.elements[0].position = 0.80
    rim_ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    rim_ramp.color_ramp.elements[1].position = 0.97
    rim_ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    links.new(layer.outputs["Facing"], rim_ramp.inputs["Fac"])

    rim = nodes.new("ShaderNodeEmission")
    rim.location = (170, -300)
    rim.inputs["Color"].default_value = (0.62, 0.76, 1.0, 1)
    rim.inputs["Strength"].default_value = 2.1
    rim_mix = nodes.new("ShaderNodeMixShader")
    rim_mix.location = (760, -120)
    links.new(rim_ramp.outputs["Color"], rim_mix.inputs["Fac"])
    links.new(star_mix.outputs["Shader"], rim_mix.inputs[1])
    links.new(rim.outputs["Emission"], rim_mix.inputs[2])
    links.new(rim_mix.outputs["Shader"], output.inputs["Surface"])
    return mat


def emission_material(name, colour, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*colour, 1)
    emission.inputs["Strength"].default_value = strength
    mat.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return mat


def dark_material():
    mat = bpy.data.materials.new("AX_Emblem_Dark")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.002, 0.004, 0.003, 1)
    bsdf.inputs["Roughness"].default_value = 0.25
    return mat


def build_character():
    body_collection = make_collection("AlienX_Body")
    detail_collection = make_collection("AlienX_Details")
    void = cosmic_material()
    green = emission_material("AX_Green_Glow", (0.025, 1.0, 0.16), 3.5)
    emblem_dark = dark_material()

    # One uninterrupted trunk avoids the belt seam of the earlier primitive-based attempt.
    # The silhouette stays heroic at the clavicles but long and tapered through the waist.
    loft(
        "AX_Torso",
        [
            (0.170, 0.135, 0.76, 0, 0.026),
            (0.225, 0.160, 0.84, 0, 0.023),
            (0.235, 0.168, 0.92, 0, 0.019),
            (0.205, 0.150, 1.04, 0, 0.010),
            (0.190, 0.145, 1.13, 0, 0.002),
            (0.270, 0.174, 1.28, 0, -0.004),
            (0.365, 0.195, 1.43, 0, 0.000),
            (0.398, 0.184, 1.50, 0, 0.008),
            (0.160, 0.124, 1.57, 0, 0.012),
        ],
        void,
        body_collection,
    )

    # Neck and a tapered, featureless head.  The brow is wider than the jaw, unlike the human base.
    tapered_limb("AX_Neck", (0, 0.005, 1.51), (0, 0.002, 1.70), (0.126, 0.110, 0.03), void, body_collection)
    loft(
        "AX_Head",
        [
            (0.092, 0.105, 1.66, 0, -0.004),
            (0.135, 0.128, 1.73, 0, -0.006),
            (0.157, 0.142, 1.84, 0, -0.008),
            (0.145, 0.137, 1.96, 0, -0.002),
            (0.095, 0.105, 2.04, 0, 0.005),
        ],
        void,
        body_collection,
    )
    curve_horn(
        "AX_Horn_L",
        [(0.075, 0.018, 2.015), (0.102, 0.040, 2.075), (0.132, 0.070, 2.125), (0.155, 0.100, 2.165)],
        [1.0, 0.78, 0.48, 0.05],
        void,
        body_collection,
    )
    curve_horn(
        "AX_Horn_R",
        [(-0.075, 0.018, 2.015), (-0.102, 0.040, 2.075), (-0.132, 0.070, 2.125), (-0.155, 0.100, 2.165)],
        [1.0, 0.78, 0.48, 0.05],
        void,
        body_collection,
    )

    # Long, clean limb lines give the mascot a readable silhouette inside the project spiral.
    shoulders = [(-0.365, 0.010, 1.465), (0.365, 0.010, 1.465)]
    elbows = [(-0.535, -0.005, 1.115), (0.535, -0.005, 1.115)]
    wrists = [(-0.585, -0.055, 0.790), (0.585, -0.055, 0.790)]
    for suffix, shoulder, elbow, wrist in zip(("L", "R"), shoulders, elbows, wrists):
        sign = -1 if suffix == "L" else 1
        add_ellipsoid(f"AX_Deltoid_{suffix}", shoulder, (0.120, 0.125, 0.145), void, body_collection)
        tapered_limb(f"AX_UpperArm_{suffix}", shoulder, elbow, (0.098, 0.074, 0.18), void, body_collection)
        tapered_limb(f"AX_Forearm_{suffix}", elbow, wrist, (0.076, 0.056, 0.25), void, body_collection)
        add_ellipsoid(f"AX_Elbow_{suffix}", elbow, (0.076, 0.072, 0.082), void, body_collection, segments=32, rings=16)
        add_ellipsoid(f"AX_Wrist_{suffix}", wrist, (0.058, 0.060, 0.070), void, body_collection, segments=32, rings=16)
        add_ellipsoid(
            f"AX_Fist_{suffix}",
            (wrist[0] + sign * 0.010, -0.078, 0.705),
            (0.076, 0.084, 0.105),
            void,
            body_collection,
        )
        # A low thumb pad is enough to make the rounded hand read as a closed fist.
        add_ellipsoid(
            f"AX_Thumb_{suffix}",
            (wrist[0] - sign * 0.041, -0.144, 0.731),
            (0.037, 0.038, 0.061),
            void,
            body_collection,
            segments=32,
            rings=16,
        )

    hips = [(-0.150, 0.020, 0.825), (0.150, 0.020, 0.825)]
    knees = [(-0.225, 0.015, 0.440), (0.225, 0.015, 0.440)]
    ankles = [(-0.275, 0.040, 0.098), (0.275, 0.040, 0.098)]
    for suffix, hip, knee, ankle in zip(("L", "R"), hips, knees, ankles):
        tapered_limb(f"AX_Thigh_{suffix}", hip, knee, (0.125, 0.092, 0.20), void, body_collection, front_scale=0.96)
        tapered_limb(f"AX_Shin_{suffix}", knee, ankle, (0.086, 0.057, 0.31), void, body_collection, front_scale=0.90)
        add_ellipsoid(f"AX_Knee_{suffix}", knee, (0.088, 0.082, 0.090), void, body_collection)
        add_ellipsoid(f"AX_Ankle_{suffix}", ankle, (0.061, 0.066, 0.070), void, body_collection, segments=32, rings=16)
        add_ellipsoid(
            f"AX_Foot_{suffix}",
            (ankle[0], -0.105, 0.052),
            (0.108, 0.225, 0.061),
            void,
            body_collection,
        )

    almond_eye("AX_Eye_L", (-0.058, -0.145, 1.875), 0.055, 0.024, math.radians(-8), green, detail_collection)
    almond_eye("AX_Eye_R", (0.058, -0.145, 1.875), 0.055, 0.024, math.radians(8), green, detail_collection)
    emblem_hourglass(green, emblem_dark, detail_collection)

    # One parent gives Fable a clean transform while every anatomical piece stays editable.
    root = bpy.data.objects.new("AlienX_Mascot_ROOT", None)
    body_collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.24
    for collection in (body_collection, detail_collection):
        for obj in list(collection.objects):
            if obj != root and obj.parent is None:
                obj.parent = root
    return root


def aim_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def studio_setup():
    studio = make_collection("Studio")
    world = bpy.data.worlds.new("AX_Deep_Space")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0004, 0.0008, 0.0022, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.08
    bpy.context.scene.world = world

    def area(name, location, energy, size, colour, target=(0, 0, 1.12)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = colour
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        studio.objects.link(obj)
        aim_at(obj, target)
        return obj

    area("Studio_Rim_Left", (-2.4, 1.8, 2.35), 720, 2.2, (0.32, 0.48, 1.0))
    area("Studio_Rim_Right", (2.3, 1.5, 1.85), 620, 1.8, (0.55, 0.25, 1.0))
    area("Studio_Front_Fill", (0.0, -3.1, 1.45), 54, 3.2, (0.50, 0.68, 1.0))

    camera_data = bpy.data.cameras.new("Camera")
    camera_data.lens = 76
    camera = bpy.data.objects.new("Camera", camera_data)
    camera.location = (0.0, -6.45, 1.18)
    studio.objects.link(camera)
    aim_at(camera, (0, 0, 1.12))
    bpy.context.scene.camera = camera


def compositor_glow():
    scene = bpy.context.scene
    scene.use_nodes = True
    # Blender 5's new compositor API no longer exposes Scene.node_tree.  The emissive materials
    # still render correctly there; older Blender versions receive the optional fog glow below.
    if not hasattr(scene, "node_tree") or scene.node_tree is None:
        return
    nodes = scene.node_tree.nodes
    links = scene.node_tree.links
    nodes.clear()
    render = nodes.new("CompositorNodeRLayers")
    glare = nodes.new("CompositorNodeGlare")
    glare.glare_type = "FOG_GLOW"
    glare.quality = "HIGH"
    glare.threshold = 1.0
    glare.size = 7
    composite = nodes.new("CompositorNodeComposite")
    links.new(render.outputs["Image"], glare.inputs["Image"])
    links.new(glare.outputs["Image"], composite.inputs["Image"])


def render_previews():
    os.makedirs(RENDERS, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.filepath = os.path.join(RENDERS, "gptblend.png")
    scene.render.image_settings.color_mode = "RGB"
    bpy.ops.render.render(write_still=True)

    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = os.path.join(RENDERS, "gptblend_matte.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    clear_scene()
    build_character()
    studio_setup()
    compositor_glow()
    scene = bpy.context.scene
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    output = os.path.join(HERE, "gptblend.blend")
    bpy.ops.wm.save_as_mainfile(filepath=output)
    render_previews()
    # Save once more so render/compositor settings in the delivered file match the previews.
    bpy.ops.wm.save_as_mainfile(filepath=output)
    print(f"GPTBLEND_READY {output}")
