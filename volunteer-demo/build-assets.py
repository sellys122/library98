"""Export a separate collision-ready demo environment and movable cart from the editable scene."""
import bpy,gzip,json,math
from pathlib import Path
from mathutils import Vector,Matrix

root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root.parent/'pixel-field/models/library-field.blend'))
source=[o for o in bpy.data.objects if o.name.startswith('ENV_') and not o.name.startswith('ENV_export_') and o.type in ['MESH','FONT','CURVE']]
cart=[o for o in source if o.name.startswith('ENV_cart_') and not o.name.startswith('ENV_cart_book')]
environment=[o for o in source if not o.name.startswith('ENV_cart_')]
layout=json.loads((root.parent/'pixel-field/assets/layout.json').read_text())
old_shelves=layout['shelves']
new_shelves=[]
for category in range(10):
 if category<9:
  x=[-4.8,0,4.8][category%3];z=[-4.0,-1.0,2.0][category//3];angle=0
 else:
  x,z,angle=8.15,-2.5,-math.pi/2
 facing=(math.sin(angle),math.cos(angle))
 new_shelves.append({'x':x,'z':z,'code':str(category*100).zfill(3),'category':category,'angle':angle,
  'w':.65 if category==9 else 2.32,'d':2.32 if category==9 else .65,
  'approach':{'x':x+facing[0]*1.0,'z':z+facing[1]*1.0},
  'cartDock':{'x':x+facing[0]*1.55,'z':z+facing[1]*1.55}})
shelf_parts=('ENV_shelf_','ENV_classification_sign','ENV_book_spine')
for obj in environment:
 is_label=obj.type=='FONT' and obj.data.body in [s['code'] for s in old_shelves]
 if not (obj.name.startswith(shelf_parts) or is_label):continue
 old=min(old_shelves,key=lambda s:(obj.location.x-s['x'])**2+(obj.location.y+s['z'])**2)
 new=new_shelves[old['category']];rotation=Matrix.Rotation(new['angle'],3,'Z')
 obj.location=Vector((new['x'],-new['z'],0))+rotation@(obj.location-Vector((old['x'],-old['z'],0)))
 obj.rotation_euler.rotate_axis('Z',new['angle'])
layout['shelves']=new_shelves
layout['revision']=3
for collider in layout['colliders']:
 if collider['id'].startswith('shelf-'):
  shelf=next(s for s in new_shelves if 'shelf-'+s['code']==collider['id'])
  collider.update({k:shelf[k] for k in ['x','z','w','d']})
# The working side faces the foreground: staff show their backs to the default camera.
for obj in environment:
 if obj.name.startswith(('ENV_monitor_','ENV_keyboard')):
  obj.location.y-=.30

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
layout['cart']={'x':2.3,'z':3.5}
layout['spawn']={'x':-2.1,'z':4.1}
layout['bookPile']={'x':.9,'z':3.4}
layout['mentor']={'x':-6.05,'z':5.45,'angle':math.pi}
layout['officer']={'x':-4.75,'z':5.45,'angle':math.pi}
for i,(x,z,w,d) in enumerate([(-7.4,5.6,.45,.45),(7.7,-5.3,.45,.45),(7.7,5.5,.45,.45),(-6.7,-5.6,.5,.5),(-6.7,-4.4,.5,.5)]):
 layout['colliders'].append({'id':'fixture-'+str(i),'x':x,'z':z,'w':w,'d':d})
(root/'assets/layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2))
print('DEMO_ASSETS_READY',len(environment),len(cart))
