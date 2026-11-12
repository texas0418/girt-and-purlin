"""Mockup render of a 30 x 48 x 12 post-frame building. Run headless:
Blender -b --python barn.py -- <output.jpg>
All dimensions below are in feet and converted to meters when meshes are made.
"""
import sys, math
import bpy, bmesh
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1]
FT = 0.3048
L, W, H, RISE, OH = 48.0, 30.0, 12.0, 5.0, 1.0
RIDGE = H + RISE
SLOPE = RISE / (W / 2)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def node(nt, kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def metal(name, color, axis=None, rough=0.42):
    """Painted steel. axis 0 or 1 adds 9-inch ribs running across that axis."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    if axis is not None:
        tc = node(nt, "ShaderNodeTexCoord")
        sep = node(nt, "ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs[0])
        mul = node(nt, "ShaderNodeMath", operation="MULTIPLY")
        mul.inputs[1].default_value = 2 * math.pi / (0.75 * FT)
        nt.links.new(sep.outputs[axis], mul.inputs[0])
        sin = node(nt, "ShaderNodeMath", operation="SINE")
        nt.links.new(mul.outputs[0], sin.inputs[0])
        half = node(nt, "ShaderNodeMath", operation="MULTIPLY_ADD")
        half.inputs[1].default_value = 0.5
        half.inputs[2].default_value = 0.5
        nt.links.new(sin.outputs[0], half.inputs[0])
        pw = node(nt, "ShaderNodeMath", operation="POWER")
        pw.inputs[1].default_value = 7.0
        nt.links.new(half.outputs[0], pw.inputs[0])
        bump = node(nt, "ShaderNodeBump")
        bump.inputs["Strength"].default_value = 1.0
        bump.inputs["Distance"].default_value = 0.02
        nt.links.new(pw.outputs[0], bump.inputs["Height"])
        nt.links.new(bump.outputs[0], bsdf.inputs["Normal"])
    return m


def ground_mat(name, c1, c2, scale, bump=0.3):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.95
    tc = node(nt, "ShaderNodeTexCoord")
    big = node(nt, "ShaderNodeTexNoise")
    big.inputs["Scale"].default_value = scale * 0.0018
    big.inputs["Detail"].default_value = 6
    fine = node(nt, "ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = scale * 0.3
    fine.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], big.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], fine.inputs["Vector"])
    mix = node(nt, "ShaderNodeMix", data_type="RGBA")
    mix.inputs["A"].default_value = (*c1, 1)
    mix.inputs["B"].default_value = (*c2, 1)
    nt.links.new(big.outputs[0], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    b = node(nt, "ShaderNodeBump")
    b.inputs["Strength"].default_value = bump
    nt.links.new(fine.outputs[0], b.inputs["Height"])
    nt.links.new(b.outputs[0], bsdf.inputs["Normal"])
    return m


def glass_mat():
    m = bpy.data.materials.new("Glass")
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.03, 0.045, 0.05, 1)
    bsdf.inputs["Roughness"].default_value = 0.04
    return m


def prism(name, pts, extrude, mat):
    """Extrude a flat polygon (feet) along a vector (feet)."""
    bm = bmesh.new()
    e = Vector(extrude) * FT
    a = [bm.verts.new(Vector(p) * FT) for p in pts]
    b = [bm.verts.new(Vector(p) * FT + e) for p in pts]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    n = len(pts)
    for i in range(n):
        bm.faces.new([a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def box(name, x0, x1, y0, y1, z0, z1, mat):
    return prism(name, [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, z1 - z0), mat)


WALL = (0.40, 0.42, 0.41)
DARK = (0.022, 0.025, 0.028)
WHITE = (0.70, 0.70, 0.68)
wall_x = metal("WallSide", WALL, 0)
wall_y = metal("WallEnd", WALL, 1)
wains_x = metal("WainSide", DARK, 0)
wains_y = metal("WainEnd", DARK, 1)
roof_m = metal("Roof", DARK, 0, rough=0.35)
trim = metal("Trim", WHITE)
dark_trim = metal("DarkTrim", DARK)
door_y = metal("SlideDoor", WHITE, 1)
door_flat = metal("WalkDoor", WHITE, rough=0.5)
glass = glass_mat()
grass = ground_mat("Grass", (0.02, 0.06, 0.008), (0.13, 0.18, 0.035), 90, 1.0)
gravel = ground_mat("Gravel", (0.33, 0.31, 0.28), (0.46, 0.44, 0.40), 260, 1.0)
concrete = ground_mat("Concrete", (0.50, 0.49, 0.47), (0.58, 0.57, 0.55), 40, 0.1)

T = 0.12  # wall skin thickness
# ground, slab, gravel apron and drive
box("Ground", -400, 500, -400, 500, -0.5, 0, grass)
box("Slab", -0.3, L + 0.3, -0.3, W + 0.3, 0, 0.33, concrete)
box("Apron", L, L + 16, 6, 24, 0, 0.08, gravel)
box("Drive", L + 16, L + 200, 9, 21, 0, 0.06, gravel)

# side walls with wainscot
for name, y0 in (("Front", -T), ("Back", W)):
    box("Wall" + name, 0, L, y0, y0 + T, 0.33, H, wall_x)
    box("Wains" + name, 0, L, y0 - 0.03, y0 + T + 0.03, 0.33, 3.33, wains_x)
    box("WainsCap" + name, 0, L, y0 - 0.07, y0 + T + 0.07, 3.33, 3.5, trim)

# gable walls with wainscot
for name, x0 in (("Left", -T), ("Right", L)):
    prism("Gable" + name, [(x0, 0, 0.33), (x0, W, 0.33), (x0, W, H), (x0, W / 2, RIDGE), (x0, 0, H)], (T, 0, 0), wall_y)
    box("WainsG" + name, x0 - 0.03, x0 + T + 0.03, 0, W, 0.33, 3.33, wains_y)
    box("WainsGCap" + name, x0 - 0.07, x0 + T + 0.07, 0, W, 3.33, 3.5, trim)

# corner trim
for cx in (-T - 0.05, L - 0.3):
    for cy in (-T - 0.05, W - 0.3):
        box("Corner", cx, cx + 0.35 + T, cy, cy + 0.35 + T, 0.33, H, trim)

# roof slabs, fascia, rake trim, ridge cap
RT = 0.14
ez = H - OH * SLOPE
for name, ye, sgn in (("F", -OH, 1), ("B", W + OH, -1)):
    prism("Roof" + name, [(-OH, ye, ez), (-OH, W / 2, RIDGE), (-OH, W / 2, RIDGE + RT), (-OH, ye, ez + RT)], (L + 2 * OH, 0, 0), roof_m)
    prism("Fascia" + name, [(-OH, ye, ez - 0.5), (-OH, ye + sgn * 0.08, ez - 0.5), (-OH, ye + sgn * 0.08, ez + 0.02), (-OH, ye, ez + 0.02)], (L + 2 * OH, 0, 0), trim)
    box("Soffit" + name, -OH, L + OH, min(ye, ye + sgn * OH), max(ye, ye + sgn * OH), ez - 0.5, ez - 0.45, trim)
    for xr in (-OH - 0.06, L + OH - 0.02):
        prism("Rake" + name, [(xr, ye, ez - 0.5), (xr, W / 2, RIDGE - 0.5), (xr, W / 2, RIDGE + RT + 0.03), (xr, ye, ez + RT + 0.03)], (0.08, 0, 0), trim)
prism("RidgeCap", [(-OH, W / 2 - 0.6, RIDGE + RT - 0.6 * SLOPE + 0.04), (-OH, W / 2, RIDGE + RT + 0.07), (-OH, W / 2 + 0.6, RIDGE + RT - 0.6 * SLOPE + 0.04), (-OH, W / 2, RIDGE + RT)], (L + 2 * OH, 0, 0), dark_trim)

# sliding door on the right gable: two leaves, frame and track
DX = L + T
box("SlideOpening", DX, DX + 0.03, 9, 21, 0.33, 10.2, dark_trim)
for y0, y1 in ((9.05, 14.97), (15.03, 20.95)):
    box("Leaf", DX + 0.05, DX + 0.2, y0, y1, 0.4, 10.1, door_y)
    for a, b_, c, d in ((y0, y1, 0.4, 0.7), (y0, y1, 9.8, 10.1), (y0, y0 + 0.3, 0.4, 10.1), (y1 - 0.3, y1, 0.4, 10.1), (y0, y1, 5.1, 5.35)):
        box("LeafRail", DX + 0.2, DX + 0.26, a, b_, c, d, trim)
box("Track", DX + 0.02, DX + 0.42, 2.5, 27.5, 10.15, 10.6, trim)

# walk door and windows on the front wall
FY = -T
box("WalkFrame", 10 - 0.25, 13 + 0.25, FY - 0.08, FY, 0.33, 7.3, trim)
box("WalkDoor", 10, 13, FY - 0.12, FY - 0.08, 0.4, 7.05, door_flat)
box("Knob", 12.6, 12.8, FY - 0.3, FY - 0.12, 3.6, 3.8, dark_trim)
for wx in (20, 32):
    box("WinFrame", wx - 0.22, wx + 4.22, FY - 0.08, FY, 4.5 - 0.22, 8.22, trim)
    box("WinGlass", wx, wx + 4, FY - 0.1, FY - 0.08, 4.5, 8, glass)
    box("WinMullion", wx + 1.94, wx + 2.06, FY - 0.14, FY - 0.1, 4.5, 8, trim)

# tree line far behind the building
import random
random.seed(7)
leaf = ground_mat("Leaf", (0.012, 0.035, 0.008), (0.04, 0.075, 0.015), 30, 1.0)
ctex = bpy.data.textures.new("Clump", "CLOUDS")
ctex.noise_scale = 1.6
for i in range(170):
    tx, ty = random.uniform(-900, 500), random.uniform(480, 760)
    th = random.uniform(28, 55)
    for k in range(4):
        r = th * random.uniform(0.22, 0.34)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=r * FT, location=((tx + random.uniform(-r, r)) * FT, (ty + random.uniform(-r, r)) * FT, (th * random.uniform(0.45, 0.8)) * FT))
        ob = bpy.context.object
        ob.scale.z = random.uniform(1.1, 1.6)
        ob.data.materials.append(leaf)
        for poly in ob.data.polygons:
            poly.use_smooth = True
        dm = ob.modifiers.new("d", "DISPLACE")
        dm.texture = ctex
        dm.strength = 1.4

# sky and sun
world = bpy.data.worlds.new("Sky")
scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = next(n for n in wn.nodes if n.type == "BACKGROUND")
sky = wn.nodes.new("ShaderNodeTexSky")
for k, v in (("sun_elevation", math.radians(38)), ("sun_rotation", math.radians(215)), ("sun_size", math.radians(1.2))):
    try:
        setattr(sky, k, v)
    except Exception as err:
        print("sky", k, err)
wn.links.new(sky.outputs[0], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.075

# camera at about eye height on a small rise, looking at the door corner
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 30
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = Vector((L + 30, -40, 7.0)) * FT
target = Vector((L * 0.52, W * 0.45, 7.2)) * FT
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

looks = [i.identifier for i in scene.view_settings.bl_rna.properties["look"].enum_items]
for want in ("AgX - Medium High Contrast", "Medium High Contrast"):
    if want in looks:
        scene.view_settings.look = want
        break
scene.render.engine = "CYCLES"
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 88
scene.render.filepath = OUT
print("sky type", sky.sky_type, "view", scene.view_settings.view_transform)
bpy.ops.render.render(write_still=True)
