"""Déclinaisons élite 1 à 15 d'un navire de base (ici Le Corsaire), sous Blender.

Pour chaque niveau : nouvelle livrée (coque, voiles, bandeau, bois, dorures) et équipements ajoutés au fil
des niveaux (canons de chasse à l'avant, seconde batterie sur les flancs, canons de retraite à l'arrière,
lanternes et figure de proue dorées, flammes au sommet des mâts, voiles lumineuses). Chaque version est
exportée en GLB puis pré-rendue en images par sprites.py.

Usage : python elite_variants.py base.glb dossier_sortie [--levels 1-15] [--frames 32] [--px 320] [--samples 24]
"""
import math
import os
import subprocess
import sys

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
src, out = sys.argv[1], sys.argv[2]


def arg(name, default, cast=str):
    return cast(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


lv = arg('--levels', '1-15')
a, b = (int(x) for x in lv.split('-')) if '-' in lv else (int(lv), int(lv))
FRAMES, PX, SAMPLES = arg('--frames', 32, int), arg('--px', 320, int), arg('--samples', 24, int)


def srgb(h):
    """Couleur hexadécimale (sRGB) -> couleur linéaire Blender."""
    def ch(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (ch((h >> 16) & 255), ch((h >> 8) & 255), ch(h & 255))


# Livrées : coque, voiles, bandeau/bords de voiles, bois sombre, bois clair (mâts, rambardes),
# emblèmes et canons, lueur (0 = aucune). Plus le niveau monte, plus la livrée est sombre et précieuse.
LIVERIES = {
    1: dict(name='Corsaire pourpre', hull=0x4a1410, sail=0x8a1c18, accent=0xb02a22, wood=0x2a160c, light=0x5a3a20, metal=0x141414, glow=0),
    2: dict(name='Vert de Bretagne', hull=0x2a3418, sail=0x7a9a48, accent=0x3a5a22, wood=0x2a2210, light=0x6a5432, metal=0x141414, glow=0),
    3: dict(name='Cuivre de Saint-Malo', hull=0x4a2410, sail=0xd07a34, accent=0x8a3a14, wood=0x2a180c, light=0x7a5030, metal=0x1a1410, glow=0),
    4: dict(name='Sable des Antilles', hull=0x5a4628, sail=0xe8d8a8, accent=0x9a6a2a, wood=0x3a2a18, light=0x8a6a40, metal=0x1a1a1a, glow=0),
    5: dict(name='Ivoire royal', hull=0x2a2014, sail=0xf2ece0, accent=0x2a4a8a, wood=0x241a10, light=0xc9a24a, metal=0x16181c, glow=0),
    6: dict(name='Bleu de France', hull=0x14244a, sail=0xe6ecf6, accent=0x2a5ac0, wood=0x1a1a24, light=0xd8b04a, metal=0x101418, glow=0),
    7: dict(name='Argent de Versailles', hull=0x3c4048, sail=0xc8ccd6, accent=0x8a94a4, wood=0x24262c, light=0xd8dce4, metal=0x2a2c30, glow=0),
    8: dict(name='Corbeau', hull=0x141416, sail=0x2a2a2e, accent=0x5a5a62, wood=0x1a1a1c, light=0x8a8a92, metal=0x101010, glow=0),
    9: dict(name='Nuit dorée', hull=0x14100c, sail=0x2e2618, accent=0xc9922e, wood=0x1a140e, light=0xe0b040, metal=0x2a2010, glow=0),
    10: dict(name='Braise', hull=0x1a0c08, sail=0x7a2410, accent=0xff7a2a, wood=0x1e100a, light=0xe08a30, metal=0x241008, glow=0xff5a10),
    11: dict(name='Bronze du Ponant', hull=0x2a1a0c, sail=0xb8822a, accent=0xe8a848, wood=0x24160a, light=0xf0c060, metal=0x5a3a14, glow=0xffa030),
    12: dict(name='Émeraude noire', hull=0x0c1a12, sail=0x1a5a3c, accent=0x40e090, wood=0x101a14, light=0x9ad8a8, metal=0x0e2a1a, glow=0x30ff90),
    13: dict(name='Pourpre de l\'Amiral', hull=0x24081c, sail=0x6a1460, accent=0xff4ab8, wood=0x1a0a16, light=0xf0a0d8, metal=0x2a0a24, glow=0xff40c0),
    14: dict(name='Abysse', hull=0x080e24, sail=0x12286a, accent=0x5aa8ff, wood=0x0a0e1a, light=0xa8d0ff, metal=0x0a1430, glow=0x3a8aff),
    15: dict(name='Légende des mers', hull=0x0a0806, sail=0x161008, accent=0xffd060, wood=0x0e0a06, light=0xffe08a, metal=0x6a4a10, glow=0xffc040),
}


def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    return {o.active_material.name: o for o in bpy.context.scene.objects if o.type == 'MESH'}


def split_sails(parts):
    """Les voiles et la coque partagent un matériau dans le modèle d'origine : on sépare les faces des voiles
    (hautes dans la mâture, ou la civadière sous le beaupré) dans un matériau à part."""
    o = parts['koyukrmz']
    sail = bpy.data.materials.new('voiles')
    sail.use_nodes = True
    o.data.materials.append(sail)
    idx = len(o.data.materials) - 1
    for p in o.data.polygons:
        c = p.center
        high = c.z > 8.5 and not (c.y > 8 and c.z < 11.5)
        sprit = c.y < -12 and c.z < 5.5
        if high or sprit:
            p.material_index = idx
    return sail


def set_mat(m, color, rough=0.6, metal=0.0, glow=0, glow_k=0.0):
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if glow:
        b.inputs['Emission Color'].default_value = (*srgb(glow), 1)
        b.inputs['Emission Strength'].default_value = glow_k


def new_mat(name, color, rough=0.5, metal=0.0, glow=0, glow_k=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    set_mat(m, color, rough, metal, glow, glow_k)
    return m


def tube(name, pts, r, mat, segs=10):
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        u = d.cross(up).normalized()
        v = d.cross(u).normalized()
        rr = r[i] if isinstance(r, list) else r
        rings.append([bm.verts.new(p + (u * math.cos(t) + v * math.sin(t)) * rr) for t in [2 * math.pi * k / segs for k in range(segs)]])
    for i in range(len(rings) - 1):
        for k in range(segs):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def cannon(at, direction, length, mat):
    """Fût de canon à renforts et bouche évasée."""
    d = Vector(direction).normalized()
    r = length * 0.085
    prof = [(0.0, 1.15), (0.1, 1.2), (0.14, 1.0), (0.5, 0.92), (0.54, 1.05), (0.58, 0.88), (0.9, 0.8), (0.95, 1.0), (1.0, 1.0)]
    pts = [Vector(at) + d * (t * length) for t, _ in prof]
    return tube('canon', pts, [k * r for _, k in prof], mat)


def hull_x(y, z):
    """Demi-largeur de la coque à l'abscisse y et à la hauteur z (relevée sur le modèle)."""
    table = [(-11, 2.0), (-8, 3.3), (-5, 4.6), (-2, 5.2), (1, 5.4), (4, 5.5), (7, 5.5), (10, 5.6), (13, 5.2), (15.5, 3.4)]
    for (y0, x0), (y1, x1) in zip(table, table[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    return table[0][1] if y < table[0][0] else table[-1][1]


def build(level):
    L = LIVERIES[level]
    parts = load()
    sail = split_sails(parts)
    glow = L['glow']
    set_mat(parts['koyukrmz'].data.materials[0], L['hull'], 0.55)
    set_mat(sail, L['sail'], 0.9, 0.0, glow if level >= 14 else 0, 0.35 if level >= 14 else 0)
    set_mat(parts['krmz'].active_material, L['accent'], 0.45, 0.3 if level >= 9 else 0.0, glow, 0.6 if glow else 0)
    set_mat(parts['koyukahve'].active_material, L['wood'], 0.7)
    gold = level >= 6
    set_mat(parts['kahverengi'].active_material, L['light'], 0.35 if gold else 0.7, 0.85 if gold else 0.0)
    set_mat(parts['siyah'].active_material, L['metal'], 0.4, 0.7, glow if level >= 12 else 0, 0.8 if level >= 12 else 0)
    set_mat(parts['Metal'].active_material, 0xc9a24a if level >= 9 else 0x2a2a2a, 0.3, 0.9)

    iron = new_mat('fer', 0x141414 if level < 9 else 0x8a6420, 0.4, 0.85)
    gold_m = new_mat('or', 0xe8b84a, 0.25, 1.0, glow if level >= 10 else 0, 0.4)
    extra = []
    # Niveau 3+ : deux canons de chasse sur le gaillard d'avant.
    if level >= 3:
        for s in (-1, 1):
            extra.append(cannon(Vector((s * 1.3, -9.5, 5.1)), (s * 0.15, -1, 0.03), 2.6, iron))
    # Niveau 5+ : seconde batterie de canons sur les flancs (pont supérieur).
    if level >= 5:
        n = 6 if level < 10 else 8
        for s in (-1, 1):
            for i in range(n):
                y = -5 + i * (15.0 / (n - 1))
                x = hull_x(y, 5.6) - 0.6
                extra.append(cannon(Vector((s * x, y, 5.7)), (s, 0, 0.02), 1.9, iron))
    # Niveau 7+ : canons de retraite tirant vers l'arrière.
    if level >= 7:
        for s in (-1, 1):
            extra.append(cannon(Vector((s * 1.6, 15.2, 7.4)), (s * 0.1, 1, 0.02), 2.4, iron))
    # Niveau 9+ : figure de proue et lanternes de poupe dorées.
    if level >= 9:
        extra.append(tube('figure', [Vector((0, -15.2, 3.0)), Vector((0, -16.6, 4.0)), Vector((0, -17.3, 5.0)), Vector((0, -17.2, 5.9))], [0.35, 0.42, 0.32, 0.18], gold_m))
        lamp = new_mat('lanterne', 0xffe0a0, 0.3, 0.0, 0xffc060, 6.0)
        for s in (-1, 0, 1):
            extra.append(tube('lanterne', [Vector((s * 2.2, 16.6, 11.2)), Vector((s * 2.2, 16.6, 12.4))], 0.35, lamp))
    # Niveau 13+ : longues flammes au sommet des mâts.
    if level >= 13:
        flag = new_mat('flamme', L['accent'], 0.6, 0.0, glow, 0.8)
        for (y, z) in ((-5.5, 18.6), (2.0, 19.4), (10.0, 17.0)):
            me = bpy.data.meshes.new('flamme')
            me.from_pydata([(0, y, z), (0, y + 4.5, z - 0.4), (0, y, z - 0.9)], [], [(0, 1, 2)])
            ob = bpy.data.objects.new('flamme', me)
            ob.data.materials.append(flag)
            bpy.context.scene.collection.objects.link(ob)
            extra.append(ob)
    path = os.path.join(out, f'elite_{level:02d}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_cameras=False, export_lights=False)
    return path


os.makedirs(out, exist_ok=True)
py = sys.executable
for level in range(a, b + 1):
    glb = build(level)
    sheet = os.path.join(out, f'corsaire_e{level}.webp')
    subprocess.run([py, os.path.join(HERE, 'sprites.py'), glb, sheet, '--frames', str(FRAMES), '--px', str(PX), '--span', '50', '--samples', str(SAMPLES)], check=True,
                   stdout=subprocess.DEVNULL)
    print('élite', level, LIVERIES[level]['name'], '->', sheet, flush=True)
