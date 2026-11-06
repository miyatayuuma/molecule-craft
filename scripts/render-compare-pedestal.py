"""Render a static fallback of the third-party CC0 GLB when WebGL is disabled.

Usage: blender -b --factory-startup -P scripts/render-compare-pedestal.py
The source art is the Grab3D Hologram Projector (see docs/compare-physics-preview.md).
"""
import bpy
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/compare/hologram-projector-cc0.glb'
TARGET = ROOT / 'assets/compare/pedestal-preview.png'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
for obj in list(bpy.context.scene.objects):
    if 'hologram_glow' in obj.name:
        bpy.data.objects.remove(obj, do_unlink=True)

art = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
for obj in art:
    obj.rotation_euler = (0, 0, 0)
    for material in obj.data.materials:
        if material and material.use_nodes:
            shader = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if shader:
                tint = material.node_tree.nodes.new('ShaderNodeMixRGB')
                tint.blend_type = 'MULTIPLY'
                tint.inputs[0].default_value = 1.0
                tint.inputs[2].default_value = (0.16, 0.24, 0.29, 1.0)
                base_color = shader.inputs['Base Color']
                if base_color.is_linked:
                    prior = base_color.links[0]
                    material.node_tree.links.new(prior.from_socket, tint.inputs[1])
                    material.node_tree.links.remove(prior)
                else:
                    tint.inputs[1].default_value = base_color.default_value
                material.node_tree.links.new(tint.outputs[0], base_color)
                shader.inputs['Metallic'].default_value = 0.67
                shader.inputs['Roughness'].default_value = 0.30

points = [obj.matrix_world @ Vector(corner) for obj in art for corner in obj.bound_box]
lo = Vector([min(p[k] for p in points) for k in range(3)])
hi = Vector([max(p[k] for p in points) for k in range(3)])
center = (lo + hi) / 2
scale = 2.7 / max(hi.x - lo.x, hi.y - lo.y)
for obj in art:
    obj.location = (obj.location - center) * scale
    obj.scale *= scale

def area(name, loc, power, color, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.color = color
    data.shape = 'DISK'
    data.size = size
    lamp = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(lamp)
    lamp.location = loc
    direction = Vector((0, 0, 0)) - lamp.location
    lamp.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

area('soft box', (1, -3, 4), 370, (0.83, 0.96, 1.0), 4)
area('cyan rim', (-3, 2, 2), 260, (0.08, 0.75, 1.0), 3)

camera_data = bpy.data.cameras.new('Analyzer pedestal camera')
camera = bpy.data.objects.new('Analyzer pedestal camera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (3.8, -5, 3.5)
direction = Vector((0, 0, 0)) - camera.location
camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 7.2
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
for layer in scene.view_layers:
    layer.cycles.use_denoising = False
scene.render.resolution_x = 620
scene.render.resolution_y = 390
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = str(TARGET)
scene.world.color = (0.12, 0.2, 0.28)
bpy.ops.render.render(write_still=True)
print('Saved', TARGET)
