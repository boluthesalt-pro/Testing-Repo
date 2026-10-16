# Headless Blender script: engraved VXIII wordmark and verse line on a titanium temple (1 unit = 1 mm).
# Run: Blender -b -P temple_engraving.py -- <output.png> [width height samples]
import bpy, bmesh, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/temple.png"
RW = int(argv[1]) if len(argv) > 1 else 2400
RH = int(argv[2]) if len(argv) > 2 else 1350
SAMPLES = int(argv[3]) if len(argv) > 3 else 128

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat(name, rgb, metal=0.0, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m, b

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

ti, tib = mat("Titanium", srgb("#B9BCBE"), 1.0, 0.30)
# brushed grain: noise stretched along the temple
nt = ti.node_tree
tex = nt.nodes.new("ShaderNodeTexNoise"); tex.inputs["Scale"].default_value = 6
tex.inputs["Detail"].default_value = 8
mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.4, 1.0, 90.0)
tc = nt.nodes.new("ShaderNodeTexCoord")
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08
nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], tib.inputs["Normal"])
screw, _ = mat("Screw", srgb("#8E908B"), 1.0, 0.25)
bg, _ = mat("Ground", srgb("#ECEAE3"), 0.0, 0.9)

# temple bar, 3.6 mm tall, 1.7 mm thick, inner face toward -Y
bpy.ops.mesh.primitive_cube_add(size=1); bar = bpy.context.object; bar.name = "Temple"
bar.scale = (90, 1.7, 3.6); bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.modifier_add(type="BEVEL"); bar.modifiers["Bevel"].width = 0.22; bar.modifiers["Bevel"].segments = 3
bpy.ops.object.modifier_apply(modifier="Bevel")
bar.location = (22, 0, 0); bpy.ops.object.transform_apply(location=True)
bar.data.materials.append(ti)
FACE_Y = -0.85

# hinge barrel and screw at the left end for context
bpy.ops.mesh.primitive_cylinder_add(radius=1.25, depth=3.4, vertices=48, location=(-18, 0, 0))
barrel = bpy.context.object; barrel.data.materials.append(ti)
bpy.ops.mesh.primitive_cylinder_add(radius=0.62, depth=0.25, vertices=6, location=(-18, 0, 1.75))
hexs = bpy.context.object; hexs.data.materials.append(screw)

# wordmark geometry, same construction as the identity SVG
H, SW, G = 100.0, 11.0, 16.0
def stroke(p, q, w):
    d = Vector((q[0] - p[0], q[1] - p[1])); n = Vector((-d.y, d.x)).normalized() * (w / 2)
    return [(p[0] + n.x, p[1] + n.y), (q[0] + n.x, q[1] + n.y), (q[0] - n.x, q[1] - n.y), (p[0] - n.x, p[1] - n.y)]
def clip_y(poly, lo, hi):
    def cut(pts, keep, edge):
        out = []
        for i, a in enumerate(pts):
            b = pts[(i + 1) % len(pts)]
            ia, ib = keep(a), keep(b)
            if ia: out.append(a)
            if ia != ib:
                t = (edge - a[1]) / (b[1] - a[1]); out.append((a[0] + t * (b[0] - a[0]), edge))
            if not ia and ib and False: pass
        return out
    p = cut(poly, lambda v: v[1] >= lo, lo)
    return cut(p, lambda v: v[1] <= hi, hi) if p else []
ext = 20.0
segs = []; x = 0.0
ox = ext * 32 / 100
segs.append(((x - ox, -ext), (x + 32, H + 0.0)))
segs.append(((x + 32, H), (x + 64 + ox, -ext)))
x += 64 + G
ox = ext * 64 / 100
segs.append(((x - ox, -ext), (x + 64 + ox, H + ext)))
segs.append(((x + 64 + ox, -ext), (x - ox, H + ext)))
x += 64 + G
for i in range(3):
    segs.append(((x + SW / 2, -5), (x + SW / 2, H + 5))); x += SW + (G if i < 2 else 0)
WIDTH = x
SCALE = 2.0 / 100.0   # 2.0 mm cap height
CX = -6.0
DEPTH = 0.14

def add_cutter(poly2d):
    bm = bmesh.new()
    vs = [bm.verts.new((CX + (px - WIDTH / 2) * SCALE, FACE_Y - 0.1, (H / 2 - py) * SCALE)) for px, py in poly2d]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    vv = [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0.1 + DEPTH, 0), verts=vv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("cut"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("cut", me); sc.collection.objects.link(ob); return ob

def carve(cutter):
    m = bar.modifiers.new("b", "BOOLEAN"); m.operation = "DIFFERENCE"; m.object = cutter; m.solver = "EXACT"
    bpy.context.view_layer.objects.active = bar
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

for p, q in segs:
    poly = clip_y(stroke(p, q, SW), 0.0, H)
    if len(poly) >= 3: carve(add_cutter(poly))

# verse line
cu = bpy.data.curves.new("verse", "FONT"); cu.body = "YE ARE THE SALT OF THE EARTH"
cu.size = 0.55; cu.extrude = 0.1; cu.space_character = 1.35; cu.align_x = "LEFT"
tob = bpy.data.objects.new("verse", cu); sc.collection.objects.link(tob)
tob.rotation_euler = (math.pi / 2, 0, 0)
tob.location = (-2.4, FACE_Y + DEPTH - 0.1, -0.28)
bpy.context.view_layer.objects.active = tob; tob.select_set(True)
bpy.ops.object.convert(target="MESH")
tob = bpy.context.object
carve(tob)

# ground behind
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 14, 0), rotation=(math.pi / 2, 0, 0))
gp = bpy.context.object; gp.data.materials.append(bg)

# lights
def area(loc, size, e, rgb=(1, 1, 1)):
    d = bpy.data.lights.new("a", "AREA"); d.energy = e; d.size = size; d.color = rgb
    o = bpy.data.objects.new("a", d); sc.collection.objects.link(o); o.location = loc
    dr = Vector((0, 0, 0)) - Vector(loc); o.rotation_euler = dr.to_track_quat("-Z", "Y").to_euler()
area((-30, -45, 28), 40, 5000)
area((-14, -70, 2), 90, 16000)
area((35, -40, -10), 25, 9000)
area((0, -60, 45), 30, 6000)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bgn = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
bgn.inputs["Color"].default_value = (*srgb("#ECEAE3"), 1); bgn.inputs["Strength"].default_value = 0.6

# camera, oblique macro
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 100; cam_d.sensor_width = 36
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 9
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
target = Vector((0.5, FACE_Y, 0.0))
cam.location = (-12, -58, 15)
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_d.dof.focus_distance = (target - cam.location).length

sc.render.engine = "CYCLES"
sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x = RW; sc.render.resolution_y = RH; sc.render.resolution_percentage = 100
sc.render.filepath = OUT; sc.render.image_settings.file_format = "PNG"
sc.view_settings.view_transform = "Standard"
bpy.ops.render.render(write_still=True)
print("DONE", OUT)
