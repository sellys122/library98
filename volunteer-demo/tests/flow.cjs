// Dependency-free interaction harness. Runs the real game handlers and navigation.
// It verifies flow, not browser layout or WebGL. Actual GLSL is checked separately.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
class Element{
 constructor(tag='div',doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.attributes={};this.style={setProperty(k,v){this[k]=v}};this.dataset={};this.open=false;this.hidden=false;this._text='';this.clientWidth=1280;this.clientHeight=720;this.listeners={}}
 get id(){return this.attributes.id||''}set id(v){this.attributes.id=v}
 get className(){return this.attributes.class||''}set className(v){this.attributes.class=v}
 get classList(){const el=this;return {contains:s=>el.className.split(/\s+/).includes(s),add(...v){el.className=[...new Set([...el.className.split(/\s+/),...v])].filter(Boolean).join(' ')},remove(...v){el.className=el.className.split(/\s+/).filter(s=>!v.includes(s)).join(' ')},toggle(s,force){let has=this.contains(s),on=force===undefined?!has:force;if(on)this.add(s);else this.remove(s);return on}}}
 set textContent(v){this._text=String(v);this.children=[]}get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
 set innerHTML(v){this.children=[];this._text='';parseHTML(v,this,this.doc)}
 get innerHTML(){return this._text+this.children.map(c=>c.outerHTML).join('')}
 get outerHTML(){return '<'+this.tagName.toLowerCase()+Object.entries(this.attributes).map(([k,v])=>' '+k+'="'+String(v).replaceAll('"','&quot;')+'"').join('')+'>'+this.innerHTML+'</'+this.tagName.toLowerCase()+'>'}
 append(...children){for(let c of children){if(typeof c==='string'){const n=new Element('span',this.doc);n.textContent=c;c=n}c.parentNode=this;this.children.push(c)}}
 replaceChildren(...c){this.children=[];this._text='';this.append(...c)}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this)}
 setAttribute(k,v){this.attributes[k]=String(v);if(k==='hidden')this.hidden=true;if(k.startsWith('data-'))this.dataset[k.slice(5)]=String(v)}
 removeAttribute(k){delete this.attributes[k]}
 getAttribute(k){return this.attributes[k]}
 matches(selector){return selector.split(',').some(sel=>{const id=sel.match(/#([\w-]+)/),classes=[...sel.matchAll(/\.([\w-]+)/g)].map(m=>m[1]),tag=sel.match(/^[a-zA-Z]+/),attr=sel.match(/\[([\w-]+)\]/);return(!id||this.id===id[1])&&classes.every(c=>this.classList.contains(c))&&(!tag||this.tagName===tag[0].toUpperCase())&&(!attr||(attr[1]==='open'?this.open:this.attributes[attr[1]]!==undefined))})}
 querySelectorAll(sel){let list=[];for(const c of this.children){if(c.matches(sel))list.push(c);list.push(...c.querySelectorAll(sel))}return list}
 querySelector(sel){return this.querySelectorAll(sel)[0]||null}
 closest(sel){return this.matches(sel)?this:this.parentNode?.closest(sel)}
 showModal(){this.open=true}close(){this.open=false}
 addEventListener(k,v){(this.listeners[k]??=[]).push(v)}
 focus(){}setPointerCapture(){}
 getBoundingClientRect(){return {x:0,y:0,left:0,top:0,width:this.clientWidth,height:this.clientHeight}}
 cloneNode(deep){const el=new Element(this.tagName,this.doc);el.attributes={...this.attributes};el._text=this._text;if(deep)for(const c of this.children)el.append(c.cloneNode(true));return el}
}
function parseHTML(html,parent,doc){const stack=[parent];for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){if(token.startsWith('<!--')||token.startsWith('<!'))continue;if(token.startsWith('</')){if(stack.length>1)stack.pop();continue}if(token.startsWith('<')){const m=token.match(/^<([\w-]+)/);if(!m)continue;const el=new Element(m[1],doc);for(const a of token.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){if(a.index<=m[1].length)continue;el.setAttribute(a[1],a[2]||'')}stack.at(-1).append(el);if(!/\/$/.test(token.slice(0,-1))&&!['meta','link','br','img','input','hr'].includes(m[1]))stack.push(el)}else{stack.at(-1)._text+=token}}}

(async()=>{
 const rules=await import(root+'/rules.js'),story=await import(root+'/story.js'),navigation=await import(root+'/navigation.js');
 assert.equal(navigation.pathfind({x:0,z:0},{x:3,z:3},[]).length,1,'clear floor must use a direct segment');
 for(const [obstacles,companion]of [
  [[{x:1.5,z:1.5,w:1,d:1}],null],
  [[{x:1,z:1.5,w:.5,d:.5}],{x:1,z:0,radius:.64}]
 ]){
  const start={x:0,z:0},end=companion?{x:0,z:3}:{x:3,z:3},route=navigation.pathfind(start,end,obstacles,.23,companion);assert(route.length>1);let from=start;for(const p of route){assert(navigation.segmentClear(from,p,obstacles,.23,companion));from=p}
 }
 assert(rules.compareCallNumbers('808.3가125ㄴ','808.3가55ㄴ')<0);
 assert(rules.compareCallNumbers('808.3가9ㄴ','808.3가125ㄴ')>0);
 assert(rules.compareCallNumbers('808.3가125ㄴ','808.3가1250ㄴ')===0);
 assert(rules.compareCallNumbers('808.3가012ㄴ','808.3가12ㄴ')<0);
 assert(rules.compareCallNumbers('808.3가55ㄴ','808.3가55ㄹ')<0);
 assert(rules.compareCallNumbers('206.85가12ㄴ','207가12ㄴ')<0);
 for(const lesson of rules.SORT_LESSONS)assert.deepEqual([...lesson.books].sort(rules.compareCallNumbers),lesson.books);
 for(const [seconds,text]of [[0,'09:00'],[45,'10:00'],[90,'11:00'],[135,'12:00'],[180,'13:00']])assert.equal(rules.workClock(seconds).text,text);
 const warning=rules.newRecord();rules.recordMistake(warning,'a');rules.recordMistake(warning,'a');assert.equal(warning.mistakes,1);rules.recordMistake(warning,'b');assert(!warning.failed);rules.nextRecordDay(warning);rules.recordMistake(warning,'c');assert(!warning.failed);rules.recordMistake(warning,'d');assert(warning.failed);
 const interrupted=rules.newRecord();rules.recordMistake(interrupted,'1');rules.recordMistake(interrupted,'2');rules.nextRecordDay(interrupted);rules.nextRecordDay(interrupted);rules.recordMistake(interrupted,'3');rules.recordMistake(interrupted,'4');assert(!interrupted.failed);rules.recordMistake(interrupted,'5');assert(interrupted.failed);
 const doc=new Element('document');doc.hidden=false;doc.createElement=tag=>new Element(tag,doc);doc.getElementById=id=>doc.querySelector('#'+id);doc.addEventListener=()=>{};parseHTML(fs.readFileSync(root+'/index.html','utf8'),doc,doc);doc.body=doc.querySelector('body');
 const layout=JSON.parse(fs.readFileSync(root+'/assets/layout.json'));const storage=new Map();let frame;
 const ctx={...rules,...story,document:doc,window:{addEventListener(){},matchMedia:()=>({matches:false})},navigator:{maxTouchPoints:0},localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)},requestAnimationFrame:cb=>frame=cb,console,Math,Intl,Set,Map,pose:()=>[],assetFetch:async()=>({json:async()=>layout})};
 ctx.Renderer=class{async load(url){return {url}}async loadSprite(name){const meta=JSON.parse(fs.readFileSync(root+'/assets/'+name+'-sprites.json'));assert.equal(meta.frames.length,12);return {name,meta}}project(){return {x:300,y:250}}render(objects,e,t,z,a,sprites){assert(sprites.every(s=>s.asset?.meta));assert.equal(sprites.filter(s=>s.asset.name.startsWith('librarian')).length,1);this.stats={spriteCount:sprites.length,heroSprite:sprites[0].asset.name}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/navigation.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync(root+'/game.js','utf8').replace(/^import .*?;\n/gm,''),ctx);await new Promise(r=>setImmediate(r));
 const api=ctx.window.library98Demo,$=id=>doc.getElementById(id);assert(api,$('loading-message')?.textContent);
 const clickNext=()=>{assert(!$('next').hidden);$('next').onclick()},clickChoice=text=>{const button=$('choices').children.find(c=>c.textContent.includes(text));assert(button,'choice missing: '+text+'; '+$('choices').textContent);button.onclick()};
 assert.equal($('line').textContent,story.INTRO[0].text);
 for(let i=0;i<story.INTRO.length;i++)clickNext();assert.equal(api.state.phase,'sort');assert($('sorting').open);
 api.selectSlot(0);api.confirmSort();assert.equal(api.state.lesson,0);assert.equal(api.state.record.mistakes,0);
 for(const [index,lesson]of rules.SORT_LESSONS.entries()){assert.equal($('sort-target').querySelector('.compare-focus').textContent,['206.85','라','5','ㄹ'][index]);assert.equal($('sort-target').querySelectorAll('.compare-focus').length,1);api.selectSlot(rules.insertionSlot(lesson.books,lesson.target));assert(api.confirmSort())}
 assert.equal(api.state.phase,'collect');for(let i=0;i<story.AFTER_SORT.length;i++)clickNext();assert(!$('dialogue').open);
 const collectState=api.snapshot();api.state.pile=Array.from({length:7},(_,i)=>({...rules.WORK_BOOKS[0],id:'pick-'+i,title:'선택 책 '+i}));api.interact({type:'pile'});assert($('pickup').open);assert.equal(api.state.hand.length,0,'opening the picker must not collect books');const pick=$('pickup-books').children;for(let i=0;i<5;i++)pick[i].onclick();assert(pick[5].disabled);pick[0].onclick();pick[5].onclick();$('pickup-confirm').onclick();assert.equal(api.state.hand.length,5);assert.equal(api.state.pile.length,2);assert(!api.state.hand.some(b=>b.id==='pick-0'));assert(api.state.hand.some(b=>b.id==='pick-5'));api.restore(collectState);
 api.interact({type:'pile'});$('pickup-books').children[0].onclick();$('close-pickup').onclick();assert.equal(api.state.hand.length,0,'cancel must preserve the pile');assert.equal(api.state.pile.length,3);
 api.teleport(.9,4.1);api.draw();assert.equal(api.nearby.type,'pile');api.interact();assert($('pickup').open);for(const button of $('pickup-books').children)button.onclick();$('pickup-confirm').onclick();assert.equal(api.state.hand.length,3);assert.equal(api.state.phase,'load');
 api.draw();assert.equal(api.nearby.type,'cart');api.interact();clickChoice('담는다');assert.equal(api.state.cart.books.length,3);assert.equal(api.state.phase,'cart');
 api.toggleCart();assert(api.state.cart.attached);assert(Math.abs(Math.hypot(api.player.x-api.state.cart.x,api.player.z-api.state.cart.z)-.92)<.001,'the librarian must stand at the cart handle');const start=api.player.z,cstart=api.state.cart.z;assert(api.movePlayer(0,-.1)>.09);assert(api.player.z<start);assert(Math.abs((api.state.cart.z-cstart)-(api.player.z-start))<.000001);
 const literature=layout.shelves.find(s=>s.category===8),history=layout.shelves.find(s=>s.category===9);api.goTo(literature.cartDock.x-api.state.cart.offset.x,literature.cartDock.z-api.state.cart.offset.z);for(let i=0;i<400;i++)api.advance(.05);assert.equal(api.state.phase,'shelve','cart must actually arrive at the shelf');
 api.draw();api.interact({type:'cart',obj:api.state.cart});clickChoice('책을 꺼낸다');assert(!api.state.cart.attached);assert.equal(api.state.hand.length,3);
 api.goTo(literature.approach.x,literature.approach.z);for(let i=0;i<300;i++)api.advance(.05);assert(Math.hypot(api.player.x-literature.approach.x,api.player.z-literature.approach.z)<.6,'shelf approach after cart detached');api.interact({type:'shelf',obj:literature});clickChoice('제자리에');assert.equal(api.state.phase,'service');
 for(let i=0;i<story.AFTER_CART.length;i++)clickNext();clickChoice('안내해드릴게요');assert.equal(api.state.phase,'escort');assert.equal(api.state.guide,'boy');
 api.closeAll();api.goTo(history.approach.x,history.approach.z);for(let i=0;i<650;i++)api.advance(.05);api.draw();assert.equal(api.nearby.type,'shelf','following patron must not hide the shelf interaction');assert.equal(api.nearby.obj.code,'900');api.interact();clickChoice('안내한다');assert.equal(api.state.phase,'report');
 for(let i=0;i<story.BEFORE_CALL.length+1;i++)clickNext();api.interact({type:'npc',obj:api.actors.find(a=>a.id==='patron')});clickChoice('담당 선생님');assert.equal(api.state.phase,'call');
 api.interact({type:'npc',obj:api.actors.find(a=>a.id==='officer')});clickChoice('오류');assert.equal(api.state.phase,'helping');assert.equal(api.state.jobs.length,1);
 const officer=api.actors.find(a=>a.id==='officer'),mentor=api.actors.find(a=>a.id==='mentor');let workingStart=null,resolvedAt=null;
 for(let i=0;i<1800&&api.state.phase==='helping';i++){api.advance(.05);const job=api.state.jobs[0];if(job.status==='working'&&workingStart===null)workingStart=i;if(job.status==='returning'&&resolvedAt===null)resolvedAt=i}
 assert.equal(api.state.phase,'outro','officer must visit, solve and return');assert(workingStart!==null&&resolvedAt-workingStart>=39,'resolution timer starts after arrival');assert.equal(officer.x,officer.home.x);assert.equal(officer.z,officer.home.z);assert.equal(mentor.x,mentor.home.x);
 for(let i=0;i<story.OUTRO.length;i++)clickNext();assert.equal(api.state.phase,'ready');assert($('line').textContent.includes('할 수 있겠다'));clickChoice('봉사 시작');assert.equal(api.state.phase,'work');assert.equal(api.state.record.elapsed,0);assert.equal(api.state.record.totalShelved,0,'practice must not inflate work statistics');
 for(let i=0;i<900;i++)api.advance(.05);assert(Math.abs(api.state.record.elapsed-45)<.001);assert.equal(rules.workClock(api.state.record.elapsed+.0001).text,'10:00');
 api.inspectScene('warning');api.closeAll();const n=api.actors.find(a=>a.id==='patron');api.interact({type:'npc',obj:n});clickChoice('직접 기기');assert(api.state.record.failed);assert.equal(api.state.record.mistakes,2);assert.equal(api.state.phase,'failed');
 api.exitPreview();assert.equal(api.state.phase,'work');assert.equal(api.state.record.mistakes,0);assert(Math.abs(api.state.record.elapsed-45)<.001);api.closeAll();for(let i=0;i<2701;i++)api.advance(.05);assert.equal(api.state.phase,'review');assert.equal(api.state.record.elapsed,180);clickChoice('다음 날');assert.equal(api.state.record.day,2);assert.equal(api.state.record.elapsed,0);
 assert(storage.size);
 const restoreWork=api.snapshot();api.inspectScene('cart');api.closeAll();api.state.phase='service';api.teleport(api.state.cart.x-.92,api.state.cart.z);api.toggleCart();assert(api.state.cart.attached);const cartRouteState=api.snapshot();
 for(const shelf of layout.shelves){api.restore(cartRouteState);const offset=api.state.cart.offset;api.goTo(shelf.cartDock.x-offset.x,shelf.cartDock.z-offset.z);for(let i=0;i<1000;i++)api.advance(.05);assert(Math.hypot(api.state.cart.x-shelf.cartDock.x,api.state.cart.z-shelf.cartDock.z)<.65,'cart route must reach shelf '+shelf.code);assert(!navigation.blocked(api.player.x,api.player.z,layout.colliders,.23));assert(!navigation.blocked(api.state.cart.x,api.state.cart.z,layout.colliders,.64))}
 const legacy=api.snapshot();delete legacy.layoutRevision;legacy.player.x=0;legacy.player.z=2;api.restore(legacy);assert.equal(api.player.x,layout.spawn.x);assert.equal(api.player.z,layout.spawn.z);assert(!api.state.cart.attached);const resetMentor=api.actors.find(a=>a.id==='mentor');assert.equal(resetMentor.x,layout.mentor.x);assert.equal(resetMentor.z,layout.mentor.z);
 assert.equal(resetMentor.angle,Math.PI);assert.equal(api.actors.find(a=>a.id==='officer').angle,Math.PI);assert(layout.mentor.z>layout.desk.z,'staff must work on the foreground side');
 for(const count of [0,1,2,3,5]){api.state.hand=Array.from({length:count},(_,i)=>({...rules.WORK_BOOKS[0],id:'pose-'+i}));api.draw();assert.equal(api.renderer.stats.heroSprite,count>=3?'librarian-carry-stack':count?'librarian-carry-one':'librarian')}
 api.inspectScene('cart');api.closeAll();api.state.phase='service';api.teleport(2.5,.9);api.approachTarget({type:'cart',obj:api.state.cart});assert.equal(api.route.length,1,'clicking a visible cart across a clear aisle must approach it directly');let walked=0,previous={...api.player};for(let i=0;i<100;i++){api.advance(.05);walked+=Math.hypot(api.player.x-previous.x,api.player.z-previous.z);previous={...api.player}}assert(walked<1.6);assert($('dialogue').open);assert($('line').textContent.includes('북카트'));
 api.restore(restoreWork);console.log('PASS: full tutorial, 5-book selection and cancel, cart handle spacing, all 10 cart routes, old-save migration, officer visit/resolve/return, 180-second shift, two-day warnings, duplicate protection, preview restore, day rollover.');
})();
