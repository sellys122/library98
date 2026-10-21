"""Index transparent walking sheets; never resample or modify their pixels."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

assets=Path(__file__).resolve().parent/'assets'
def runs(mask,max_gap=1):
 values=np.flatnonzero(mask);groups=[]
 for value in values:
  if not groups or value-groups[-1][-1]>max_gap:groups.append([int(value)])
  else:groups[-1].append(int(value))
 return [(g[0],g[-1]+1) for g in groups]

for name in ['librarian-carry-one','librarian-carry-stack']:
 image=Image.open(assets/(name+'-sprites.png')).convert('RGBA');alpha=np.asarray(image)[:,:,3]>32
 counts=alpha.sum(axis=1);cuts=[0]
 for row in range(1,4):
  center=round(image.height*row/4);margin=image.height//18;start=center-margin;end=center+margin
  cuts.append(start+int(np.argmin(counts[start:end])))
 cuts.append(image.height);rows=list(zip(cuts,cuts[1:]))
 frames=[]
 for row,(y0,y1) in enumerate(rows):
  top_limit=0 if row==0 else (rows[row-1][1]+y0)//2
  bottom_limit=image.height if row==3 else (y1+rows[row+1][0])//2
  columns=[(a,b) for a,b in runs(alpha[y0:y1].sum(axis=0)>3,max_gap=5) if b-a>70]
  assert len(columns)==3,(name,y0,columns)
  for x0,x1 in columns:
   yy,xx=np.nonzero(alpha[y0:y1,x0:x1]);head=alpha[y0:y0+max(1,(y1-y0)//3),x0:x1];_,head_x=np.nonzero(head)
   center=x0+(head_x.min()+head_x.max())/2
   frames.append({'center':center,'left':x0+int(xx.min())-2,'right':x0+int(xx.max())+3,'top':max(top_limit,y0+int(yy.min())-2),'bottom':min(bottom_limit,y0+int(yy.max())+3)})
 width=int(np.ceil(max(max(f['center']-f['left'],f['right']-f['center'])*2 for f in frames)))
 rects=[]
 for f in frames:
  left=int(round(f['center']-width/2));rects.append([max(0,left),max(0,f['top']),min(image.width,left+width),min(image.height,f['bottom'])])
 result={'width':image.width,'height':image.height,'directions':['down','left','right','up'],'frames':rects,'logicalHeight':64}
 (assets/(name+'-sprites.json')).write_text(json.dumps(result,indent=2))
 print(name,len(rects),'frames',width,'pixel frame width')
