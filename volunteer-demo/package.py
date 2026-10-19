"""Build an offline, double-clickable sample and a source archive."""
from pathlib import Path
import base64,json,re,zipfile
r=Path(__file__).resolve().parent
embedded={}
for p in (r/'assets').iterdir():
 if p.suffix in ['.png','.json','.gz'] and not p.name.startswith('preview-'):
  embedded['assets/'+p.name]=base64.b64encode(p.read_bytes()).decode()
html=(r/'index.html').read_text()
css=(r/'style.css').read_text().replace('assets/dialogue-portraits.png','data:image/png;base64,'+embedded.pop('assets/dialogue-portraits.png'))
js='\n'.join(re.sub(r'^import .*?;\n','',(r/name).read_text(),flags=re.M).replace('export ','') for name in ['engine.js','navigation.js','rules.js','story.js','game.js'])
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>').replace('<script type="module" src="game.js"></script>','<script>window.LIBRARY_EMBEDDED='+json.dumps(embedded)+';</script><script>'+js+'</script>')
(r/'play.html').write_text(html)
(r.parent/'library98-volunteer-demo.html').write_text(html)
with zipfile.ZipFile(r.parent/'library98-volunteer-demo.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for p in r.rglob('*'):
  if p.is_file() and p.suffix not in ['.glb','.pyc'] and '__pycache__' not in p.parts:archive.write(p,p.relative_to(r))
print('Offline demo:',len(html.encode()),'bytes; embedded assets:',len(embedded))
