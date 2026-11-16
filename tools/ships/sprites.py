"""Pré-rendu d'un navire en images (technique des jeux navals classiques) : le modèle 3D est « photographié »
sous N angles avec la même caméra inclinée que le jeu et le même éclairage, puis assemblé en une planche
(atlas) que le jeu affiche à la place du modèle 3D.

Usage : python sprites.py modele.glb sortie.png [--frames 32] [--px 320] [--span 56] [--pitch 0.92]
 - span : largeur de la vue en mètres (doit contenir le navire et ses mâts) ;
 - pitch : inclinaison de la caméra (radians au-dessus de l'horizon), identique à celle du jeu.
Repère : la proue du modèle exporté pointe vers -Y de Blender. L'image k correspond à un navire tourné de
2πk/N autour de la verticale (même sens que le cap du jeu) ; k = 0 : proue vers la caméra.
"""
import math
import os
import sys

import bpy
from mathutils import Vector
from PIL import Image


def arg(name, default, cast=float):
    return cast(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


src, dst = sys.argv[1], sys.argv[2]
N = arg('--frames', 32, int)
PX = arg('--px', 320, int)
SPAN = arg('--span', 56.0)
PITCH = arg('--pitch', 0.92)
COLS = 8

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
pivot = bpy.data.objects.new('pivot', None)
sc.collection.objects.link(pivot)
for o in list(sc.objects):
    if o is not pivot and o.parent is None:
        o.parent = pivot

# Rendu : Cycles, fond transparent, ombre portée sur l'eau gardée (plan « attrape-ombre »).
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = arg('--samples', 48, int)
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = PX
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = arg('--exposure', 1.3)

me = bpy.data.meshes.new('ombre')
me.from_pydata([(-80, -80, 0.02), (80, -80, 0.02), (80, 80, 0.02), (-80, 80, 0.02)], [], [(0, 1, 2, 3)])
catcher = bpy.data.objects.new('ombre', me)
catcher.is_shadow_catcher = True
sc.collection.objects.link(catcher)

sun = bpy.data.objects.new('soleil', bpy.data.lights.new('soleil', 'SUN'))
sun.data.energy = 5.0
sun.data.angle = math.radians(4)
# Lumière venant du haut à gauche de l'écran (fixe par rapport à la caméra, comme dans les jeux classiques).
sun.rotation_euler = (math.radians(40), 0, math.radians(-145))
sc.collection.objects.link(sun)
world = bpy.data.worlds.new('ciel')
world.color = (0.75, 0.82, 0.95)
sc.world = world

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = SPAN
sc.collection.objects.link(cam)
sc.camera = cam
# Caméra du jeu (lacet 0) : placée côté +Z du jeu = côté -Y de Blender, inclinée de PITCH.
target = Vector((0, 0, 0))
cam.location = target + Vector((0, -math.cos(PITCH), math.sin(PITCH))) * 200
cam.rotation_euler = (target - cam.location).normalized().to_track_quat('-Z', 'Y').to_euler()

out_dir = os.path.splitext(dst)[0] + '_frames'
os.makedirs(out_dir, exist_ok=True)
rows = math.ceil(N / COLS)
atlas = Image.new('RGBA', (COLS * PX, rows * PX), (0, 0, 0, 0))
for k in range(N):
    pivot.rotation_euler = (0, 0, 2 * math.pi * k / N)
    path = os.path.join(out_dir, f'{k:02d}.png')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    atlas.paste(Image.open(path), ((k % COLS) * PX, (k // COLS) * PX))
    print('image', k + 1, '/', N, flush=True)
if dst.endswith('.webp'):
    atlas.save(dst, quality=90, method=6)
else:
    atlas.save(dst, optimize=True)
print('planche', dst, atlas.size, round(os.path.getsize(dst) / 1e6, 2), 'Mo')
