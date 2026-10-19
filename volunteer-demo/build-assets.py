"""Export a separate collision-ready demo environment and movable cart from the editable scene."""
import bpy,gzip,json
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root.parent/'pixel-field/models/library-field.blend'))
source=[o for o in bpy.data.objects if o.name.startswith('ENV_') and not o.name.startswith('ENV_export_') and o.type in ['MESH','FONT','CURVE']]
cart=[o for o in source if o.name.startswith('ENV_cart_') and not o.name.startswith('ENV_cart_book')]
environment=[o for o in source if not o.name.startswith('ENV_cart_')]

def export(name,objects,offset=(0,0,0)):
 copies=[]
 for original in objects:
  c=original.copy();c.data=original.data.copy();bpy.context.collection.objects.link(c)
  c.location-=Vector(offset);copies.append(c)
 bpy.ops.object.select_all(action='DESELECT')
 for c in copies:c.select_set(True)
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.convert(target='MESH')
 groups={}
 for c in bpy.context.selected_objects:groups.setdefault(c.data.materials[0].name,[]).append(c)
 merged=[]
 for mat,objs in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for c in objs:c.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();o=bpy.context.object;o.name=name+'_'+mat;merged.append(o)
 bpy.ops.object.select_all(action='DESELECT')
 for o in merged:o.select_set(True)
 path=root/'assets'/f'{name}.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True)
 path.with_suffix('.glb.gz').write_bytes(gzip.compress(path.read_bytes()))
 for o in merged:bpy.data.objects.remove(o,do_unlink=True)

export('library',environment)
export('cart',cart,(4.3,-3.8,0))
book=next(o for o in source if o.name.startswith('ENV_cart_book'))
export('book',[book],tuple(book.location))
layout=json.loads((root.parent/'pixel-field/assets/layout.json').read_text())
layout['cart']={'x':2.3,'z':3.5}
layout['spawn']={'x':-2.1,'z':4.1}
layout['bookPile']={'x':.9,'z':3.4}
layout['mentor']={'x':-6.5,'z':3.2}
layout['officer']={'x':-4.6,'z':3.2}
for i,(x,z,w,d) in enumerate([(-7.4,5.6,.45,.45),(7.7,-5.3,.45,.45),(7.7,5.5,.45,.45),(-6.7,-5.6,.5,.5),(-6.7,-4.4,.5,.5)]):
 layout['colliders'].append({'id':'fixture-'+str(i),'x':x,'z':z,'w':w,'d':d})
(root/'assets/layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2))
print('DEMO_ASSETS_READY',len(environment),len(cart))
