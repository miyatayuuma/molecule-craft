"""Convert the original BlendSwap pedestal into a web GLB and a 2D fallback.

Usage (from repository root):
  blender -b -t 4 --python scripts/prepare-compare-pedestal.py -- \
    /path/to/tech_pedestal.blend /path/to/texture

Source: Scifi pedestal turntable by bill1411, BlendSwap blend #93410,
https://blendswap.com/blend/22567, CC BY 3.0.
The source itself is distributed in GitHub Release compare-stage-source.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(arguments) != 2:
    raise SystemExit('Expected Blender file and texture directory after --')
source = Path(arguments[0]).resolve()
textures = Path(arguments[1]).resolve()
target_glb = ROOT / 'assets/compare/scifi-pedestal.glb'
target_png = ROOT / 'assets/compare/pedestal-preview.png'

bpy.ops.wm.open_mainfile(filepath=str(source))
pedestal = bpy.data.objects.get('tech_pedestal')
if pedestal is None or pedestal.type != 'MESH':
    raise RuntimeError('Source pedestal mesh not found')

for obj in list(bpy.data.objects):
    if obj is not pedestal:
        bpy.data.objects.remove(obj, do_unlink=True)

# Restore the authored UV/PBR surface using the accompanying official maps.
# Blender 2.79's old mixed emission shader isn't directly compatible with glTF.
material = bpy.data.materials.new('bill1411 pedestal PBR')
material.use_nodes = True
nodes = material.node_tree.nodes
nodes.clear()
links = material.node_tree.links
output = nodes.new('ShaderNodeOutputMaterial')
shader = nodes.new('ShaderNodeBsdfPrincipled')
shader.inputs['Metallic'].default_value = 0.65
shader.inputs['Roughness'].default_value = 0.38
shader.inputs['Emission Strength'].default_value = 0.7
links.new(shader.outputs['BSDF'], output.inputs['Surface'])

for suffix, input_name, color_space in (
    ('COL', 'Base Color', 'sRGB'),
    ('METALLIC', 'Metallic', 'Non-Color'),
    ('ROUGHNESS', 'Roughness', 'Non-Color'),
    ('EMIT', 'Emission Color', 'sRGB'),
):
    path = textures / f'tech_pedestal_{suffix}.png'
    if not path.is_file():
        raise RuntimeError(f'Missing PBR map: {path}')
    texture = nodes.new('ShaderNodeTexImage')
    texture.label = f'Original {suffix} map'
    texture.image = bpy.data.images.load(str(path), check_existing=True)
    texture.image.colorspace_settings.name = color_space
    texture.interpolation = 'Linear'
    links.new(texture.outputs['Color'], shader.inputs[input_name])

pedestal.data.materials.clear()
pedestal.data.materials.append(material)
pedestal.hide_render = False
pedestal.hide_viewport = False
pedestal.select_set(True)
bpy.context.view_layer.objects.active = pedestal

# Convert only the real sculpted source mesh, without preview cameras/lights.
bpy.ops.export_scene.gltf(
    filepath=str(target_glb), export_format='GLB',
    use_selection=True, export_apply=True,
    export_materials='EXPORT', export_cameras=False, export_lights=False,
)
print('Exported', target_glb)

# An angle and silhouette matching the live device's Three.js presentation.
# This is a render of the source mesh, not a substitute hand-built pedestal.
pedestal.scale = (0.087, 0.087, 0.087)
pedestal.location = (0, 0, 0)
bpy.context.view_layer.update()

def add_area(name, position, strength, tint, size):
    light_data = bpy.data.lights.new(name, 'AREA')
    light_data.energy = strength
    light_data.color = tint
    light_data.shape = 'DISK'
    light_data.size = size
    light = bpy.data.objects.new(name, light_data)
    bpy.context.collection.objects.link(light)
    light.location = position
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()

add_area('softbox', (0, -3.4, 4.0), 310, (0.72, 0.88, 1), 4.0)
add_area('cyan rim', (2.5, 2.6, 2.8), 170, (0.17, 0.7, 1), 2.7)

camera_data = bpy.data.cameras.new('Pedestal preview camera')
camera = bpy.data.objects.new('Pedestal preview camera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (0.20, -5.2, 3.9)
camera.rotation_euler = (-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2.10
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
for view_layer in scene.view_layers:
    view_layer.cycles.use_denoising = False
scene.render.resolution_x = 620
scene.render.resolution_y = 390
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = str(target_png)
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.65
bpy.ops.render.render(write_still=True)
print('Rendered', target_png)
