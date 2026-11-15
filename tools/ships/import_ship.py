"""Prépare un navire 3D externe (GLB sous licence libre) pour Empire Of Sea, avec Blender (module bpy).

- regroupe les morceaux par matériau (peu d'appels de dessin en jeu) ;
- allège la géométrie (décimation) jusqu'au budget de triangles ;
- met à l'échelle (longueur hors tout en mètres), centre, pose la ligne de flottaison à z = 0 ;
- oriente la proue vers -Y de Blender (= +Z du jeu après export glTF) ;
- exporte en GLB et fait des rendus de contrôle.

Usage : python import_ship.py entree.glb sortie.glb --length 34 --tris 60000 [--flip] [--waterline 0.18] [--render dossier]
"""
import math
import os
import sys

import bpy
from mathutils import Vector


def arg(name, default=None, cast=str):
    if name in sys.argv:
        return cast(sys.argv[sys.argv.index(name) + 1])
    return default


src, dst = sys.argv[1], sys.argv[2]
LENGTH = arg('--length', 34.0, float)
TRIS = arg('--tris', 60000, int)
WATER = arg('--waterline', 0.18, float)  # part de la hauteur de coque sous l'eau
RENDER = arg('--render')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == 'MESH']

# Applique toutes les transformations (matrices Sketchfab comprises) puis détache des parents.
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
with bpy.context.temp_override(selected_editable_objects=meshes, selected_objects=meshes, active_object=meshes[0]):
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in sc.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o)

# Fusion de tout, puis séparation par matériau.
with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes, selected_objects=meshes):
    bpy.ops.object.join()
ship = meshes[0]
ship.name = 'navire'

# Encombrement : l'axe le plus long horizontal est la longueur du navire.
vs = [ship.matrix_world @ v.co for v in ship.data.vertices]
mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
size = mx - mn
print('encombrement brut', [round(c, 2) for c in size])
# Rotation pour aligner la longueur sur Y.
if size.x > size.y:
    ship.rotation_euler = (0, 0, math.pi / 2)
    with bpy.context.temp_override(selected_editable_objects=[ship], selected_objects=[ship], active_object=ship):
        bpy.ops.object.transform_apply(rotation=True)
if '--flip' in sys.argv:
    ship.rotation_euler = (0, 0, math.pi)
    with bpy.context.temp_override(selected_editable_objects=[ship], selected_objects=[ship], active_object=ship):
        bpy.ops.object.transform_apply(rotation=True)

vs = [v.co for v in ship.data.vertices]
mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
k = LENGTH / (mx.y - mn.y)
center = (mn + mx) / 2
for v in ship.data.vertices:
    v.co = (v.co - Vector((center.x, center.y, mn.z))) * k
height = (mx.z - mn.z) * k
# Ligne de flottaison : on enfonce la coque d'une fraction de la hauteur de la coque seule (~ 25 % de la hauteur totale).
sink = height * 0.25 * WATER / 0.18 * 0.18
for v in ship.data.vertices:
    v.co.z -= height * 0.25 * WATER
ship.data.update()
print('hauteur totale', round(height, 1), 'm ; enfoncement', round(height * 0.25 * WATER, 2), 'm')

# Allègement.
tris = sum(len(p.vertices) - 2 for p in ship.data.polygons)
print('triangles avant', tris)
if tris > TRIS:
    mod = ship.modifiers.new('allegement', 'DECIMATE')
    mod.ratio = TRIS / tris
    mod.use_collapse_triangulate = True
    with bpy.context.temp_override(object=ship, active_object=ship):
        bpy.ops.object.modifier_apply(modifier=mod.name)
tris = sum(len(p.vertices) - 2 for p in ship.data.polygons)
print('triangles après', tris)
ship.data.polygons.foreach_set('use_smooth', [True] * len(ship.data.polygons))

# Séparation par matériau (un maillage par matériau).
with bpy.context.temp_override(selected_editable_objects=[ship], selected_objects=[ship], active_object=ship, edit_object=ship):
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
parts = [o for o in sc.objects if o.type == 'MESH']
for o in parts:
    o.name = (o.active_material.name if o.active_material else 'piece')
root = bpy.data.objects.new('Navire', None)
sc.collection.objects.link(root)
for o in parts:
    o.parent = root
print('maillages', len(parts), [o.name for o in parts])

os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
print('exporté', dst, round(os.path.getsize(dst) / 1e6, 2), 'Mo')

if RENDER:
    os.makedirs(RENDER, exist_ok=True)
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'AgX'
    sea = bpy.data.materials.new('mer')
    sea.use_nodes = True
    sea.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.012, 0.045, 0.17, 1)
    me = bpy.data.meshes.new('mer')
    me.from_pydata([(-300, -300, 0), (300, -300, 0), (300, 300, 0), (-300, 300, 0)], [], [(0, 1, 2, 3)])
    mer = bpy.data.objects.new('mer', me)
    me.materials.append(sea)
    sc.collection.objects.link(mer)
    sun = bpy.data.objects.new('soleil', bpy.data.lights.new('soleil', 'SUN'))
    sun.data.energy = 4.2
    sun.rotation_euler = (math.radians(38), 0, math.radians(-130))
    sc.collection.objects.link(sun)
    w = bpy.data.worlds.new('ciel')
    w.color = (0.35, 0.5, 0.7)
    sc.world = w
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    for nom, elev, azim, dist, res in (('34', 55, -35, 2.6, (1000, 700)), ('profil', 10, -90, 2.2, (1000, 600)), ('dessus', 80, -10, 2.8, (700, 700))):
        e, a = math.radians(elev), math.radians(azim)
        target = Vector((0, 0, height * 0.3))
        cam.location = target + Vector((math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), math.sin(e))) * LENGTH * dist
        cam.rotation_euler = (target - cam.location).normalized().to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.filepath = os.path.join(RENDER, f'controle_{nom}.png')
        bpy.ops.render.render(write_still=True)
