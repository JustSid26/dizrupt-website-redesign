"""Realistic faceless Dizrupt mascot built from the site's original mascot proportions.

The pose is matched to https://dizrupt.in/dist/images/mascot-v2.gif: one relaxed arm, one raised
forearm, a long athletic trunk, and an offset stance.  The model uses the CC0 MakeHuman body already
present in this folder for real anatomy, then turns it into a clean featureless mannequin.

Run:
    /Applications/Blender.app/Contents/MacOS/Blender -b -P mascot3d/build_gptblend_realistic.py
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector


HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import build2 as human
import build_gptblend as kit


# Match the actual site mascot: screen-right arm bent up, opposite arm hanging, weight carried by
# one leg.  These are world-space directions, so the pose remains readable and easy to tune.
REFERENCE_AIM = [
    ("armL.0", (0.62, -0.04, -0.78)),
    ("armL.1", (0.34, -0.14, 0.82)),
    ("armR.0", (-0.14, 0.02, -0.99)),
    ("armR.1", (-0.06, -0.05, -1.00)),
    ("legL.0", (0.26, -0.03, -0.97)),
    ("legL.1", (0.17, 0.02, -0.99)),
    ("legR.0", (-0.08, 0.02, -1.00)),
    ("legR.1", (-0.02, 0.02, -1.00)),
]


def smoothstep(a, b, value):
    t = max(0.0, min(1.0, (value - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def shape_body(body, markers):
    """Add restrained mass, erase the face, and turn the raised hand into a loose fist."""
    head_base = markers["joint-head"]
    head_top = markers["joint-head-2"]
    head_center = Vector((head_base.x, head_base.y, head_base.z + (head_top.z - head_base.z) * 0.38))
    head_radii = Vector((0.095, 0.108, max(0.15, (head_top.z - head_base.z) * 0.66)))

    hand_marker = markers["joint-l-hand"]
    fist_center = hand_marker + Vector((0.035, -0.004, 0.005))
    fist_radii = Vector((0.062, 0.055, 0.069))

    for vertex in body.data.vertices:
        point = vertex.co.copy()

        # A small amount of shoulder/chest depth: visibly fit, still a normal human rather than a
        # superhero body-builder.  The falloff leaves the waist and lower body untouched.
        chest = 1.0 - abs(point.z - 1.38) / 0.34
        chest = max(0.0, min(1.0, chest))
        if point.z > 1.05:
            point.x *= 1.0 + 0.055 * chest
            point.y *= 1.0 + 0.035 * chest

        # Project the head surface onto one continuous ellipsoid.  This removes nose, mouth, brows,
        # and ears while preserving the neck connection and the original human-sized skull.
        if point.z > head_center.z - head_radii.z:
            direction = point - head_center
            denominator = math.sqrt(
                (direction.x / head_radii.x) ** 2
                + (direction.y / head_radii.y) ** 2
                + (direction.z / head_radii.z) ** 2
            )
            if denominator > 1e-5:
                projected = head_center + direction / denominator
                blend = smoothstep(head_center.z - head_radii.z, head_center.z - head_radii.z * 0.70, point.z)
                point = point.lerp(projected, blend)

        # The source mesh has an open hand.  Fold its outer vertices into a rounded, relaxed fist;
        # the armature then carries that compact hand into the raised pose.
        # In the rest pose this hand is the outermost geometry on +X, so this catches every finger
        # tip without touching the forearm.  Spatial-radius tests left the long fingertips behind.
        if point.x > hand_marker.x - 0.045:
            direction = point - fist_center
            denominator = math.sqrt(
                (direction.x / fist_radii.x) ** 2
                + (direction.y / fist_radii.y) ** 2
                + (direction.z / fist_radii.z) ** 2
            )
            if denominator > 1e-5:
                point = fist_center + direction / denominator

        vertex.co = point


def mannequin_material():
    material = bpy.data.materials.new("Dizrupt_Mannequin")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (0.18, 0.115, 0.29, 1)
    shader.inputs["Roughness"].default_value = 0.38
    shader.inputs["Metallic"].default_value = 0.08
    if "Coat Weight" in shader.inputs:
        shader.inputs["Coat Weight"].default_value = 0.16
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def add_short_horns(markers, material, collection):
    """Keep the Alien X identity without changing the site's familiar head silhouette too much."""
    top = markers["joint-head-2"]
    for suffix, sign in (("L", 1), ("R", -1)):
        kit.curve_horn(
            f"AX_Horn_{suffix}",
            [
                (top.x + sign * 0.045, top.y + 0.008, top.z - 0.010),
                (top.x + sign * 0.064, top.y + 0.018, top.z + 0.045),
                (top.x + sign * 0.086, top.y + 0.034, top.z + 0.094),
                (top.x + sign * 0.098, top.y + 0.052, top.z + 0.126),
            ],
            [0.75, 0.55, 0.30, 0.03],
            material,
            collection,
        )


def add_face_and_emblem(markers, void, green, dark, detail_collection, body_collection):
    # Eye-target markers sit on the face plane.  The earlier attempt used the eye centres inside the
    # skull, which is why its glowing spheres appeared down around the cheeks.
    left = markers["joint-l-eye-target"]
    right = markers["joint-r-eye-target"]
    # The MakeHuman eye-target markers point horizontally from the eyeballs and land at mouth
    # height on this older base mesh.  Lift them to the brow line and keep a clear bridge gap.
    eye_lift = 0.084
    kit.almond_eye("AX_Eye_L", (left.x, left.y - 0.006, left.z + eye_lift), 0.022, 0.009, math.radians(-7), green, detail_collection)
    kit.almond_eye("AX_Eye_R", (right.x, right.y - 0.006, right.z + eye_lift), 0.022, 0.009, math.radians(7), green, detail_collection)

    kit.emblem_hourglass(green, dark, detail_collection)
    # The helper is shared with the stylised build.  Lift its centre to the realistic body's sternum.
    # Deselect the rigged body first: origin_set operates on *every* selected object, and moving a
    # skinned body's origin breaks the armature relationship even though its mesh is untouched.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in detail_collection.objects:
        if obj.name.startswith("AX_Omnitrix"):
            obj.location.z += 0.105
            obj.location.y += 0.018
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
            obj.scale *= 0.56
            obj.select_set(False)

    add_short_horns(markers, void, body_collection)


def build_realistic_mascot():
    human.clear()
    raw_markers = json.load(open(os.path.join(HERE, "joints.json")))
    markers = {name: human.obj_to_blender(value) for name, value in raw_markers.items()}

    body = human.load_body()
    body.name = "Mascot"
    markers = human.fit(body, markers)
    rig = human.build_rig(body, markers)
    rig.name = "Mascot_Rig"
    # Automatic weights need the untouched anatomical mesh.  Once those weights exist, the same
    # vertices can safely be reshaped into the faceless head and compact fist.
    shape_body(body, markers)
    human.AIM = REFERENCE_AIM
    human.pose(rig)
    # Neutral clay-like material keeps the anatomy legible while the website remains free to render
    # the final sampled points in any colour.
    void = mannequin_material()
    body.data.materials.clear()
    body.data.materials.append(void)
    for polygon in body.data.polygons:
        polygon.use_smooth = True

    body_collection = kit.make_collection("Dizrupt_Mascot_Body")

    # Move the imported objects out of the scene collection so Fable gets a clean hierarchy.
    kit.move_to_collection(body, body_collection)
    kit.move_to_collection(rig, body_collection)

    root = bpy.data.objects.new("Dizrupt_Mascot_ROOT", None)
    body_collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.22
    # The armature already owns the body; attach only independent details to the shared root.
    rig.parent = root
    for obj in list(body_collection.objects):
        if obj not in (root, rig, body) and obj.parent is None:
            obj.parent = root
    return body


if __name__ == "__main__":
    build_realistic_mascot()
    kit.studio_setup()
    kit.compositor_glow()
    scene = bpy.context.scene
    scene.view_settings.look = "AgX - Medium High Contrast"
    output = os.path.join(HERE, "gptblend.blend")
    bpy.ops.wm.save_as_mainfile(filepath=output)
    kit.render_previews()
    bpy.ops.wm.save_as_mainfile(filepath=output)
    print(f"GPTBLEND_REALISTIC_READY {output}")
