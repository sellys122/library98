import {Renderer,pose,assetFetch} from './engine.js?v=20261021-books';
import {blocked,pathfind} from './navigation.js?v=20261021-books';
import {SHIFT_SECONDS,CATEGORIES,SORT_LESSONS,WORK_BOOKS,splitCallNumber,labelParts,insertionSlot,workClock,newRecord,recordMistake,nextRecordDay} from './rules.js';
import {INTRO,AFTER_SORT,AFTER_CART,BEFORE_CALL,OUTRO,CAREER_ARC} from './story.js';

const $=id=>document.getElementById(id),canvas=$('scene'),keys=new Set(),SAVE_KEY='library98-volunteer-demo-v1',HAND_LIMIT=5,CART_RADIUS=.64,PUSH_DISTANCE=.92;
let renderer,assets,layout,player,actors,state,path=[],nearby,pendingInteraction=null,last=0,time=0,toastUntil=0,saveAt=0,angle=.27,zoom=8.5,view='follow',stick={x:0,z:0},drag=null,previewBackup=null,session=false,stepAfterDialog=null,cartContentsKey='';
const clone=o=>JSON.parse(JSON.stringify(o)),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),byId=id=>actors.find(a=>a.id===id);
const hasModal=()=>!!document.querySelector('dialog[open]');
const OBJECTIVES={intro:['첫 봉사 전','계약직 선생님과 인사하고 책 꽂는 법을 배워보세요'],sort:['1 · 책 꽂는 법','청구기호를 비교해 책을 맞는 사이에 꽂아주세요'],collect:['2 · 북카트 사용','북카트 옆의 책을 집어주세요'],load:['2 · 북카트 사용','북카트에 가까이 가서 책을 담아주세요'],cart:['2 · 북카트 사용','북카트를 연결하고 800 문학 서가 앞으로 옮겨주세요'],shelve:['2 · 북카트 사용','카트에서 책을 꺼내 800 문학 서가에 꽂아주세요'],service:['3 · 이용자 응대','이용자의 말을 듣고 응대해 보세요'],escort:['3 · 이용자 응대','이용자를 900 역사 서가까지 안내해 주세요'],report:['4 · 담당자에게 연결','기기 앞 이용자의 말을 듣고 담당 선생님께 연결해 주세요'],call:['4 · 담당자에게 연결','데스크 옆 주무관 선생님께 도움을 요청해 주세요'],helping:['4 · 담당자에게 연결','담당 선생님이 문제를 확인하고 있어요'],outro:['첫 봉사 준비 완료','계약직 선생님과 이야기를 마무리해 보세요'],ready:['첫 봉사 준비 완료','1일차 봉사를 시작해 보세요'],work:['오늘의 봉사','책을 모두 꽂고 이용자를 응대해 주세요'],review:['봉사 마무리','오늘의 활동을 확인해 주세요'],failed:['봉사활동 종료','봉사 참여가 종료되었습니다'],complete:['인트로 샘플 완료','다음 이야기는 주말계약직으로 이어집니다']};

function hudMarkup(){return '<div class="status-hud"><span class="rank-text"></span><span class="hearts" aria-label="HP 5">♥♥♥♥♥</span><div class="warning"><span class="warning-icon">⚠</span><span class="warning-count"></span></div><div class="clock-wrap"><svg class="clock-face" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="27" fill="#fff9e9" stroke="#967e5d" stroke-width="2"/>'+Array.from({length:12},(_,i)=>'<line x1="30" y1="5" x2="30" y2="8" stroke="#8d795f" transform="rotate('+i*30+' 30 30)"/>').join('')+'<line class="hour-hand" x1="30" y1="31" x2="30" y2="15" stroke="#465b47" stroke-width="3" stroke-linecap="round"/><line class="minute-hand" x1="30" y1="33" x2="30" y2="9" stroke="#5a4a37" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="30" r="2.5" fill="#8b4b35"/></svg><div><span class="clock-text"></span><small class="clock-label"></small></div></div></div>'}
function updateHUD(){
 const r=state.record,isWork=['work','review','failed','complete'].includes(state.phase),clock=workClock(r.elapsed);
 for(const el of document.querySelectorAll('.rank-text'))el.textContent=isWork?r.day+'일차 · 자원봉사자':'첫 봉사 전 · 자원봉사자';
 for(const el of document.querySelectorAll('.clock-text'))el.textContent=isWork?clock.text:'09:00';
 for(const el of document.querySelectorAll('.clock-label'))el.textContent=isWork?'13:00 봉사 종료':'인수인계 · 연습 중';
 for(const el of document.querySelectorAll('.warning'))el.classList.toggle('lit',r.mistakes>0);
 for(const el of document.querySelectorAll('.warning-count'))el.textContent=isWork?'오늘 '+r.mistakes+'회'+(r.previousMistakes>=2?' · 어제 2회':''):'경고 없음';
 for(const el of document.querySelectorAll('.hour-hand'))el.setAttribute('transform','rotate('+(isWork?clock.minutes:540)/2+' 30 30)');
 for(const el of document.querySelectorAll('.minute-hand'))el.setAttribute('transform','rotate('+((isWork?clock.minutes:540)%60*6)+' 30 30)');
 const q=OBJECTIVES[state.phase]||OBJECTIVES.work;$('quest-step').textContent=q[0];$('objective').textContent=q[1];
 if(state.phase==='shelve'&&state.hand.length)$('objective').textContent='800 문학 서가 앞으로 가서 들고 있는 책을 꽂아주세요';
 if(state.phase==='work')$('objective').textContent='남은 책 '+remainingBooks()+'권 · 응대 '+r.served+'회'+(r.previousMistakes>=2?' · 어제 경고 2회, 오늘 응대에 유의해 주세요':'');
 $('inventory-text').textContent='손 '+state.hand.length+'권 · 북카트 '+state.cart.books.length+'권';$('cart-toggle').textContent=state.cart.attached?'북카트 분리 · C':'북카트 연결 · C';$('cart-toggle').classList.toggle('connected',state.cart.attached);
}
function clearInputs(){keys.clear();stick={x:0,z:0};path=[];pendingInteraction=null;$('knob').style.transform='translate(0,0)'}
function say(text){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=time+4}
function closeAll(){for(const d of document.querySelectorAll('dialog[open]'))d.close();clearInputs()}
function closeDialogue(){if($('dialogue').open)$('dialogue').close();clearInputs();canvas.focus({preventScroll:true})}
// The illustrated rows do not divide into equal thirds. Crop each portrait explicitly.
const PORTRAIT_RECTS=[[0,0,512,524],[512,0,512,524],[0,528,512,510],[512,528,512,510],[0,1044,512,492],[512,1044,512,492]];
function portraitCrop(el,index){const [x,y,w,h]=PORTRAIT_RECTS[index];el.style.backgroundSize=(1024/w*100)+'% '+(1536/h*100)+'%';el.style.backgroundPosition=(x/(1024-w)*100)+'% '+(y/(1536-h)*100)+'%'}
function setPortrait(who){
 const indexes={mentor:1,'mentor-look':2,officer:3,boy:4,patron:5},right=document.querySelector('.portrait.right');
 const index=indexes[who]??1;right.hidden=false;portraitCrop($('hero-art'),0);portraitCrop($('npc-art'),index);
 document.querySelector('.portrait.left').classList.toggle('inactive',who!=='player');right.classList.toggle('inactive',who==='player'||who==='narrator');
}
function openLine(who,name,text,label='계속',action=closeDialogue){
 clearInputs();$('dialogue').classList.remove('has-choices');setPortrait(who);$('speaker').textContent=name||' ';$('line').textContent=text;$('choices').replaceChildren();$('next').hidden=false;$('next').textContent=label;$('next').onclick=action;
 if(!$('dialogue').open)$('dialogue').showModal();syncDialogueLayout();updateHUD();
}
function syncDialogueLayout(){if($('dialogue').open)$('dialogue').style.setProperty('--speech-height',(document.querySelector('.speech').offsetHeight||160)+'px')}
function sequence(lines,done){let index=0;const next=()=>{if(index===lines.length){closeDialogue();done?.();return}const line=lines[index++];openLine(line.who,line.name,line.text,'계속',next)};next()}
function choices(who,name,text,options){openLine(who,name,text);$('dialogue').classList.add('has-choices');$('next').hidden=true;options.forEach((o,i)=>{const b=document.createElement('button');b.className='choice-book';const num=document.createElement('span');num.className='choice-number';num.textContent=['I','II','III','IV'][i]||'◇';const caption=document.createElement('span');caption.textContent=o.label;b.append(num,caption);b.onclick=()=>{closeDialogue();o.run()};$('choices').append(b)});syncDialogueLayout()}
function phase(value){state.phase=value;updateHUD();save()}
function snapshot(){return {version:1,layoutRevision:layout.revision||1,state:clone(state),player:clone(player),actors:clone(actors)}}
function save(){if(!session||previewBackup)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot()))}catch{}}
function restore(data){state=clone(data.state);player=clone(data.player);actors=clone(data.actors);path=[];const movedLayout=(data.layoutRevision||1)!==(layout.revision||1);if(movedLayout){Object.assign(player,layout.spawn,{moving:false});Object.assign(state.cart,layout.cart,{attached:false,offset:null,angle:0});for(const job of state.jobs)if(job.status!=='done'){job.status='queued';job.remaining=2}}for(const a of actors){a.moving=false;a.route=movedLayout?[]:a.route||[];if(a.home){a.home={...layout[a.id]};if(movedLayout||a.status==='idle'){Object.assign(a,a.home);a.status='idle'}}}updateHUD()}

function freshWorld(){
 player={...layout.spawn,angle:0,walk:0,moving:false};state={phase:'intro',lesson:0,slot:null,record:newRecord(),hand:[],pile:clone(WORK_BOOKS),cart:{...layout.cart,books:[],attached:false,offset:null,angle:0},guide:null,jobs:[],nextEvent:1};
 actors=[{id:'mentor',name:'계약직 선생님',appearance:'mentor',...layout.mentor,home:{...layout.mentor},status:'idle',angle:layout.mentor.angle||0,walk:0,route:[]},{id:'officer',name:'주무관 선생님',appearance:'officer',...layout.officer,home:{...layout.officer},status:'idle',angle:layout.officer.angle||0,walk:0,route:[]},{id:'boy',name:'지호 · 이용자',appearance:'boy-blue',x:1.5,z:2.0,angle:0,walk:0,height:1.08,status:'hidden',category:9,request:'guide',eventId:'training-guide',route:[]},{id:'patron',name:'이용자',appearance:'patron',x:5.6,z:3.4,angle:-.7,walk:0,height:1.5,status:'hidden',request:'repair',eventId:'training-repair',route:[]}];
 path=[];nearby=null;clearInputs();
}
function startIntro(){closeAll();freshWorld();session=true;phase('intro');sequence(INTRO,()=>{phase('sort');openSorting()})}
function continueScene(){
 if(state.phase==='intro')sequence(INTRO,()=>{phase('sort');openSorting()});
 else if(state.phase==='sort')openSorting();
 else if(state.phase==='outro')showOutro();
 else if(state.phase==='ready')ready();
 else if(state.phase==='review')showReview();
 else if(state.phase==='failed')showFailure();
 else if(state.phase==='complete')showComplete();
}

function bookLabel(code,cls='sort-book'){
 const el=document.createElement('div');el.className=cls;const p=splitCallNumber(code),top=document.createElement('span'),bottom=document.createElement('small');
 const focus=cls==='sort-book'?['classification','author','digit','suffix'][state.lesson]:null;
 const bold=text=>{const strong=document.createElement('strong');strong.className='compare-focus';strong.textContent=text;return strong};
 top.append(focus==='classification'?bold(p.classificationText):p.classificationText);
 bottom.append(focus==='author'?bold(p.author):p.author);
 if(focus==='digit')bottom.append(bold(p.number[0]),p.number.slice(1));else bottom.append(p.number);
 bottom.append(focus==='suffix'?bold(p.suffix):p.suffix);el.append(top,bottom);return el;
}
function openSorting(){
 clearInputs();const p=SORT_LESSONS[state.lesson];$('sort-title').textContent=p.title;$('sort-hint').textContent=p.hint;$('sort-progress').textContent=state.lesson+' / '+SORT_LESSONS.length+' 완료';$('sort-feedback').textContent='';state.slot=null;renderSorting();if(!$('sorting').open)$('sorting').showModal();
}
function selectSlot(slot){state.slot=slot;renderSorting();$('sort-feedback').textContent='위치를 골랐어요. 확인 버튼을 눌러주세요.'}
function renderSorting(){
 const p=SORT_LESSONS[state.lesson],shelf=$('sorting-shelf');shelf.replaceChildren();
 for(let i=0;i<=p.books.length;i++){
  const gap=document.createElement('button');gap.className='sort-slot'+(state.slot===i?' chosen':'');gap.dataset.slot=String(i);gap.setAttribute('aria-label',(i+1)+'번째 책 사이');
  if(state.slot===i)gap.append(bookLabel(p.target));else gap.textContent='+';
  gap.onclick=()=>selectSlot(i);gap.ondragover=e=>{e.preventDefault();gap.classList.add('drag-over')};gap.ondragleave=()=>gap.classList.remove('drag-over');gap.ondrop=e=>{e.preventDefault();selectSlot(i)};shelf.append(gap);if(i<p.books.length)shelf.append(bookLabel(p.books[i]));
 }
 const source=$('sorting-source');source.replaceChildren();const text=document.createElement('span');text.textContent='꽂을 책';const target=bookLabel(p.target);target.id='sort-target';target.draggable=true;target.ondragstart=e=>e.dataTransfer.setData('text/plain',p.target);source.append(text,target);
 let ghost=null;target.onpointerdown=e=>{if(e.pointerType==='mouse')return;e.preventDefault();target.setPointerCapture(e.pointerId);ghost=target.cloneNode(true);ghost.removeAttribute('id');ghost.classList.add('drag-ghost');ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';$('sorting').append(ghost)};
 target.onpointermove=e=>{if(!ghost)return;ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px'};
 const end=e=>{if(!ghost)return;ghost.remove();ghost=null;const gap=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');if(gap)selectSlot(Number(gap.dataset.slot))};target.onpointerup=end;target.onpointercancel=()=>{ghost?.remove();ghost=null};$('sort-confirm').disabled=state.slot===null;
}
function confirmSort(){
 const p=SORT_LESSONS[state.lesson];if(state.slot===null)return;
 if(state.slot!==insertionSlot(p.books,p.target)){$('sort-feedback').textContent=p.retry(splitCallNumber(p.target));state.slot=null;renderSorting();return false}
 state.lesson++;save();if(state.lesson<SORT_LESSONS.length){openSorting();$('sort-feedback').textContent='정확히 꽂았어요! 다음 순서도 비교해 보세요.'}
 else{$('sorting').close();phase('collect');sequence(AFTER_SORT,()=>say('북카트 옆 책으로 가서 확인 버튼이나 E키로 책을 집어주세요.'))}return true;
}

function staticColliders(){return layout.colliders}
function allColliders(){return [...staticColliders(),{id:'cart',x:state.cart.x,z:state.cart.z,w:1.2,d:1.2}]}
function canStep(dx,dz){
 const c=state.cart,colliders=c.attached?staticColliders():allColliders();if(blocked(player.x+dx,player.z+dz,colliders,.23))return false;
 if(c.attached&&blocked(c.x+dx,c.z+dz,staticColliders(),CART_RADIUS))return false;return true;
}
function movePlayer(dx,dz){const ox=player.x,oz=player.z;if(canStep(dx,0)){player.x+=dx;if(state.cart.attached)state.cart.x+=dx}if(canStep(0,dz)){player.z+=dz;if(state.cart.attached)state.cart.z+=dz}const moved=Math.hypot(player.x-ox,player.z-oz);if(moved>.0001){player.angle=state.cart.attached?state.cart.angle:Math.atan2(player.x-ox,player.z-oz);player.walk+=moved*7;player.moving=true}return moved}
function moveAlong(entity,route,dt,speed=1.8){entity.moving=false;if(!route.length)return;let p=route[0],d=dist(entity,p);if(d<.06){route.shift();return}let step=Math.min(speed*dt,d),dx=(p.x-entity.x)/d*step,dz=(p.z-entity.z)/d*step;
 if(!blocked(entity.x+dx,entity.z+dz,allColliders(),.22)){entity.x+=dx;entity.z+=dz;entity.angle=Math.atan2(dx,dz);entity.walk+=step*7;entity.moving=true}
 else entity.route=pathfind(entity,route.at(-1),allColliders(),.23);
}
function updatePlayer(dt){
 player.moving=false;if(hasModal())return;
 let dx=Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft'))+stick.x,dz=Number(keys.has('s')||keys.has('ArrowDown'))-Number(keys.has('w')||keys.has('ArrowUp'))+stick.z;
 if(dx||dz){path=[];pendingInteraction=null;let n=Math.hypot(dx,dz),c=Math.cos(angle),s=Math.sin(angle),speed=state.cart.attached?1.85:2.65;movePlayer((dx*c+dz*s)/n*dt*speed,(-dx*s+dz*c)/n*dt*speed)}
 else if(path.length){const goal=path[0],d=dist(player,goal);if(d<.10)path.shift();else{const step=Math.min(dt*(state.cart.attached?1.85:2.65),d);if(movePlayer((goal.x-player.x)/d*step,(goal.z-player.z)/d*step)<.0001)path=[]}}
 if(keys.has('q'))angle-=dt;if(keys.has('r'))angle+=dt;
 if(!path.length&&pendingInteraction){const target=pendingInteraction;pendingInteraction=null;if(dist(player,target.obj)<(target.type==='cart'?1.85:1.65))interact(target)}
}
function goTo(x,z){pendingInteraction=null;path=pathfind(player,{x,z},state.cart.attached?staticColliders():allColliders(),.23,state.cart.attached?{...state.cart.offset,radius:CART_RADIUS}:null);if(!path.length)say('통로의 다른 위치를 눌러주세요.')}
function approachTarget(target){
 const reach=target.type==='cart'?1.85:1.65;if(dist(player,target.obj)<reach){interact(target);return}
 const radius=target.type==='cart'?1.2:.9,startAngle=Math.atan2(player.x-target.obj.x,player.z-target.obj.z),colliders=state.cart.attached?staticColliders():allColliders(),companion=state.cart.attached?{...state.cart.offset,radius:CART_RADIUS}:null;
 let best=null;for(let i=0;i<16;i++){const turn=i===0?0:Math.ceil(i/2)*(i%2?1:-1)*Math.PI/8,a=startAngle+turn,goal={x:target.obj.x+Math.sin(a)*radius,z:target.obj.z+Math.cos(a)*radius};if(blocked(goal.x,goal.z,colliders,.23))continue;const route=pathfind(player,goal,colliders,.23,companion);if(!route.length||dist(route.at(-1),target.obj)>=reach)continue;let cost=0,from=player;for(const p of route){cost+=dist(from,p);from=p}if(!best||cost<best.cost)best={route,cost};if(i===0&&route.length===1)break}
 if(!best){say('가까이 갈 수 있는 통로를 먼저 확인해 주세요.');return}path=best.route;pendingInteraction=target;
}
function screenTarget(clientX,clientY){
 const rect=canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top,hits=[];
 for(const a of actors.filter(n=>!['hidden','served','leaving'].includes(n.status))){const feet=renderer.project(a.x,.03,a.z),head=renderer.project(a.x,a.spriteState?.worldHeight||a.height||1.5,a.z),width=Math.max(17,Math.abs(feet.y-head.y)*.37);if(Math.abs(x-feet.x)<width&&y>head.y-14&&y<feet.y+4)hits.push({type:'npc',obj:a,depth:feet.y})}
 const c=state.cart,corners=[];for(const dx of [-.64,.64])for(const dz of [-.64,.64])for(const h of [.02,1.24])corners.push(renderer.project(c.x+dx,h,c.z+dz));
 if(x>=Math.min(...corners.map(p=>p.x))&&x<=Math.max(...corners.map(p=>p.x))&&y>=Math.min(...corners.map(p=>p.y))-16&&y<=Math.max(...corners.map(p=>p.y))+4)hits.push({type:'cart',obj:c,depth:renderer.project(c.x,0,c.z).y});
 hits.sort((a,b)=>b.depth-a.depth);return hits[0]||null;
}
function toggleCart(){if(hasModal())return;if(state.cart.attached){state.cart.attached=false;state.cart.offset=null;path=[];say('북카트를 놓았습니다.');save();updateHUD();return}const distance=dist(player,state.cart);if(distance>1.85||distance<.1){say('북카트 가까이에서 연결해 주세요.');return}const dx=(state.cart.x-player.x)/distance,dz=(state.cart.z-player.z)/distance,handle={x:state.cart.x-dx*PUSH_DISTANCE,z:state.cart.z-dz*PUSH_DISTANCE};for(let i=1;i<=8;i++){const t=i/8;if(blocked(player.x+(handle.x-player.x)*t,player.z+(handle.z-player.z)*t,allColliders(),.23)){say('손잡이 뒤에 설 수 있도록 카트 가까운 빈자리로 와 주세요.');return}}Object.assign(player,handle);player.angle=Math.atan2(dx,dz);state.cart.angle=player.angle;state.cart.attached=true;state.cart.offset={x:dx*PUSH_DISTANCE,z:dz*PUSH_DISTANCE};path=[];say('이제 걸어가면 바로 앞의 북카트를 밀 수 있어요.');save();updateHUD()}
function pickBooks(){
 if(!state.pile.length)return;const room=HAND_LIMIT-state.hand.length;if(room<=0){say('이미 책 5권을 들고 있어요. 북카트에 담거나 서가에 꽂아주세요.');return}
 clearInputs();const selected=new Set(),buttons=new Map(),list=$('pickup-books');list.replaceChildren();
 const update=()=>{$('pickup-count').textContent='선택 '+selected.size+'권 / 최대 '+room+'권';$('pickup-confirm').disabled=!selected.size;for(const [id,button]of buttons){const chosen=selected.has(id);button.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',String(chosen));button.querySelector('.pickup-state').textContent=chosen?'✓ 들고 갈 책':'선택하기';button.disabled=!chosen&&selected.size>=room}};
 for(const book of state.pile){const button=document.createElement('button');button.className='pickup-book';const title=document.createElement('strong');title.textContent=book.title;const code=bookLabel(book.code,'pickup-code');const chosen=document.createElement('span');chosen.className='pickup-state';button.append(title,code,chosen);button.onclick=()=>{if(selected.has(book.id))selected.delete(book.id);else if(selected.size<room)selected.add(book.id);update()};buttons.set(book.id,button);list.append(button)}
 $('pickup-confirm').onclick=()=>{const picked=state.pile.filter(b=>selected.has(b.id)).slice(0,room);if(!picked.length)return;state.hand.push(...picked);const ids=new Set(picked.map(b=>b.id));state.pile=state.pile.filter(b=>!ids.has(b.id));$('pickup').close();if(state.phase==='collect')phase('load');save();updateHUD();say(picked.length+'권을 집었어요. 북카트 옆에서 확인 버튼이나 E키로 책을 담아주세요.')};update();$('pickup').showModal();
}
function cartMenu(){
 const options=[];if(state.hand.length)options.push({label:'들고 있는 책을 카트에 담는다',run:()=>{state.cart.books.push(...state.hand.splice(0));if(state.phase==='load')phase('cart');save();updateHUD();say('화면의 북카트 연결 버튼을 누른 다음, 800 문학 서가 앞으로 걸어가 보세요.')}});
 if(state.cart.books.length&&state.hand.length<HAND_LIMIT&&(state.phase==='work'||state.phase==='shelve'))options.push({label:state.cart.attached?'카트를 놓고 책을 꺼낸다':'카트에서 책을 꺼낸다',run:()=>{state.cart.attached=false;state.cart.offset=null;state.hand.push(...state.cart.books.splice(0,HAND_LIMIT-state.hand.length));save();updateHUD();say('책을 꺼냈어요. 800 문학 서가 앞으로 가서 확인 버튼이나 E키를 눌러주세요.')}});
 options.push({label:state.cart.attached?'카트를 놓는다':'카트를 연결한다',run:toggleCart});choices('player','나 · 자원봉사자','북카트에 책 '+state.cart.books.length+'권이 담겨 있다.',options);
}
function nearLiterature(){const shelf=layout.shelves.find(s=>s.category===8);return Math.min(dist(player,shelf),dist(state.cart,shelf))<2.5}
function shelfMenu(shelf){
 if(['collect','load','cart'].includes(state.phase)){say('이번에는 책을 카트에 담고 연결해서 서가 앞으로 옮겨보세요.');return}
 if(state.guide){const n=byId(state.guide);choices(n.appearance==='boy-blue'?'boy':'patron',n.name,'여기가 제가 찾는 책이 있는 곳인가요?',[{label:shelf.code+' '+CATEGORIES[shelf.category]+' 서가로 안내한다',run:()=>finishGuide(shelf)},{label:'다른 서가를 더 확인한다',run:()=>say('이용자의 질문을 떠올리며 서가를 확인해 주세요.')}]);return}
 if(state.hand.length){choices('player','나 · 자원봉사자',shelf.code+' '+CATEGORIES[shelf.category]+' 서가다. 책의 청구기호를 확인하자.',[{label:'들고 있는 책을 제자리에 꽂는다',run:()=>{
   const matching=state.hand.filter(b=>b.category===shelf.category);if(!matching.length){say('책의 청구기호와 다른 서가예요. 책은 그대로 들고 있습니다.');return}
   state.hand=state.hand.filter(b=>b.category!==shelf.category);state.record.shelved+=matching.length;state.record.totalShelved+=matching.length;save();updateHUD();say(matching.length+'권을 제자리에 꽂았습니다.');
   if(['cart','shelve'].includes(state.phase)&&!remainingBooks()){state.cart.attached=false;const boy=byId('boy');boy.status='waiting';phase('service');sequence(AFTER_CART,()=>talkVisitor(boy))}
   else if(state.phase==='shelve'&&!state.hand.length&&!state.cart.books.length&&state.pile.length){phase('collect');say('아직 바닥에 책이 남아 있어요. 남은 책도 골라 카트로 옮겨 볼까요?')}
 }}]);return}
 const extra=state.cart.books.length&&dist(state.cart,shelf)<2.6?' 가까운 카트에서 책을 꺼낼 수 있어요.':'';openLine('player','나 · 자원봉사자',shelf.code+' '+CATEGORIES[shelf.category]+' 서가다.'+extra,'돌아가기');
}
function remainingBooks(){return state.hand.length+state.cart.books.length+state.pile.length}

function actorPortrait(n){return n.id==='boy'?'boy':n.id==='mentor'?'mentor':n.id==='officer'?'officer':'patron'}
function questionFor(n){if(n.request==='repair')return '이 기계가 계속 오류를 내는데요. 담당자 좀 불러줘요.';if(n.request==='loan')return '책을 빌리려고 하는데, 대출 좀 해주세요.';return {9:'우리나라 역사책은 어디에 있어요?',8:'소설을 읽고 싶은데 어느 서가로 가면 돼요?',4:'동물에 관한 책은 어디에 있어요?'}[n.category]}
function talkVisitor(n){
 if(['assigned','served','leaving'].includes(n.status)){openLine(actorPortrait(n),n.name,n.status==='assigned'?'알려주셨다니 기다릴게요.':'고맙습니다.','돌아가기');return}
 if(n.status==='escorting'){say('이용자와 함께 서가 앞으로 가서 확인 버튼이나 E키를 눌러주세요.');return}
 if(state.guide&&state.guide!==n.id){say('먼저 안내하고 있는 이용자의 응대를 마쳐주세요.');return}
 const training=state.phase!=='work';
 if(n.request==='guide')choices(actorPortrait(n),n.name,questionFor(n),[
  {label:'제가 안내해드릴게요',run:()=>{state.guide=n.id;n.status='escorting';n.route=[];if(training)phase('escort');say('이용자가 따라옵니다. 원하는 서가까지 안내해 주세요.');save()}},
  {label:'입구에서 알아서 찾아보세요',run:()=>wrongResponse(n,'도서관이 낯선 이용자는 책이 있는 곳을 찾지 못했습니다.')},
 ]);
 else choices('patron',n.name,questionFor(n),[
  {label:'담당 선생님께 말씀드릴게요',run:()=>{n.status='reported';if(training)phase('call');save();say(n.request==='repair'?'주무관 선생님께 도움을 요청해 주세요.':'데스크의 계약직 선생님께 연결해 주세요.')}},
  {label:n.request==='repair'?'직접 기기를 열어 고쳐본다':'내가 직접 대출을 처리한다',run:()=>wrongResponse(n,n.request==='repair'?'기기 고장은 봉사자가 직접 처리할 수 있는 업무가 아닙니다.':'봉사자는 대출·반납을 직접 처리할 수 없습니다.')},
 ]);
}
function wrongResponse(n,reason){
 if(state.phase!=='work'){const help={guide:'처음 오는 분은 서가를 찾기 어려울 수 있어요. 어떤 책을 찾으시는지 듣고, 그 책이 있는 서가까지 같이 가 주세요.',repair:'기기는 직접 열지 마시고, 데스크 옆 주무관 선생님께 말씀해 주세요. 선생님이 와서 봐주실 거예요.',loan:'대출은 제가 처리할게요. 이용자분께 기다려 달라고 하고 저한테 알려 주세요.'};openLine('mentor','계약직 선생님',help[n.request]||reason,'다시 응대하기',()=>{closeDialogue();talkVisitor(n)});return}
 if(recordMistake(state.record,n.eventId)){n.status='served';n.availableAt=state.record.elapsed+17;n.route=pathfind(n,{x:1,z:5.4},allColliders());state.guide=null;save();updateHUD();if(state.record.failed){showFailure();return}openLine('officer','주무관 선생님',reason,'봉사 계속하기',closeDialogue)}
}
function finishGuide(shelf){
 const n=byId(state.guide);if(!n)return;
 if(dist(n,player)>2){say('안내 중인 이용자가 따라올 때까지 잠깐 기다려 주세요.');return}
 if(shelf.category!==n.category){if(state.phase==='work'){wrongResponse(n,'원하는 주제와 다른 서가로 안내했습니다.');return}openLine('boy',n.name,'여기에는 우리나라 역사책이 안 보이는데요.','다시 안내하기',()=>{closeDialogue();say('서가 위 팻말에서 900 역사를 찾아, 이용자와 함께 그 앞으로 가 주세요.')});return}
 n.status='served';state.guide=null;state.record.served++;state.record.totalServed++;n.availableAt=state.record.elapsed+17;n.route=pathfind(n,{x:1,z:5.4},allColliders());save();
 if(state.phase==='escort'){phase('report');byId('patron').status='waiting';sequence([{who:'boy',name:n.name,text:'여기군요. 감사합니다!'},...BEFORE_CALL],()=>say('기기 앞 이용자에게 다시 말을 걸어 응대해 주세요.'))}
 else openLine('boy',n.name,'찾았어요. 감사합니다!','봉사 계속하기');
}
function staffMenu(n){
 if(n.id!=='mentor'&&['intro','sort','outro','ready'].includes(state.phase)){openLine(n.id,n.name,'옆의 계약직 선생님께 인수인계를 받으시면 돼요.','돌아가기');return}
 if(state.phase==='intro'){continueScene();return}if(state.phase==='sort'){openSorting();return}if(['outro','ready'].includes(state.phase)){continueScene();return}
 const request=actors.find(a=>a.status==='reported'&&((n.id==='officer')===(a.request==='repair')));
 if(request){choices(n.id,n.name,request.request==='repair'?'어디에 문제가 생겼나요?':'이용자분이 어떤 도움을 필요로 하세요?',[{label:request.request==='repair'?'기기 오류가 났다고 말씀드린다':'대출·반납 문의를 전달한다',run:()=>assignJob(n,request)}]);return}
 const elsewhere=actors.find(a=>a.status==='reported');
 if(elsewhere){openLine(n.id,n.name,n.id==='mentor'?'기기 고장은 주무관 선생님께 말씀드려 주세요. 저도 직접 수리할 수는 없어요.':'대출·반납 문의는 계약직 선생님이 데스크에서 도와드려요.','돌아가기');return}
 if(n.status!=='idle'){openLine(n.id,n.name,'지금 요청하신 일을 확인하고 있어요.','돌아가기');return}
 openLine(n.id,n.name,n.id==='mentor'?'책을 옮길 땐 카트를 쓰세요. 대출·반납 문의가 있으면 저한테 알려주시고요.':'저는 여기 있어요. 처리하기 어려운 문제가 생기면 알려주세요.','돌아가기');
}
function assignJob(staff,n){
 if(state.jobs.some(j=>j.eventId===n.eventId)){say('이미 담당 선생님께 전달한 일이에요.');return}
 n.status='assigned';state.jobs.push({staffId:staff.id,actorId:n.id,eventId:n.eventId,status:'queued',remaining:2,training:state.phase!=='work'});if(state.phase==='call')phase('helping');save();say('선생님께 전달했습니다. 이용자는 기다리고 있어요.');
}
function updateStaff(dt){
 for(const staff of actors.filter(a=>a.home)){
  staff.moving=false;let job=state.jobs.find(j=>j.staffId===staff.id&&j.status!=='done');if(!job)continue;
  if(job.status==='queued'){job.status='walking';staff.status='walking';const n=byId(job.actorId);staff.route=pathfind(staff,{x:n.x-.65,z:n.z-.5},allColliders(),.23);if(!staff.route.length&&dist(staff,n)>1.3){job.status='queued';continue}}
  if(job.status==='walking'){moveAlong(staff,staff.route,dt);if(!staff.route.length){job.status='working';staff.status='working'}continue}
  if(job.status==='working'){job.remaining-=dt;if(job.remaining<=0){const n=byId(job.actorId);n.status='served';n.availableAt=state.record.elapsed+20;n.route=pathfind(n,{x:1,z:5.4},allColliders());state.record.served++;state.record.totalServed++;say('문제가 해결되었습니다.');job.status='returning';staff.status='returning';staff.route=pathfind(staff,staff.home,allColliders(),.23);save()}continue}
  if(job.status==='returning'){moveAlong(staff,staff.route,dt);if(!staff.route.length){staff.x=staff.home.x;staff.z=staff.home.z;staff.angle=staff.home.angle||0;staff.status='idle';job.status='done';if(job.training&&state.phase==='helping')showOutro()}}
 }
}
function showOutro(){phase('outro');sequence(OUTRO,ready)}
function ready(){phase('ready');choices('player','나 · 자원봉사자','이 정도면 나도 할 수 있겠다. 한 시까지 책부터 다 꽂아 놔야지.',[{label:'1일차 봉사 시작',run:startDay}])}
function startDay(){
 closeAll();const record=['review','work'].includes(state.phase)?clone(state.record):newRecord();record.elapsed=0;record.shelved=0;record.served=0;freshWorld();state.record=record;state.pile=clone(WORK_BOOKS);state.lesson=SORT_LESSONS.length;phase('work');
 for(const n of actors.filter(a=>!a.home)){n.status='waiting';n.eventId='d'+record.day+'-'+n.id+'-0';n.serial=0}session=true;save();say('봉사 시작! 오후 한 시 전까지 책을 모두 꽂아주세요.');
}
function finishDay(){if(state.phase!=='work')return;state.record.elapsed=SHIFT_SECONDS;state.guide=null;state.cart.attached=false;phase('review');showReview()}
function showReview(){closeAll();const left=remainingBooks(),r=state.record;choices('player','나 · 자원봉사자',r.day+'일차 봉사 종료. 책 '+r.shelved+'권 배가 · 응대 '+r.served+'회 · 경고 '+r.mistakes+'회.'+(left?' 남은 책 '+left+'권. 배가 목표는 미완료다.':' 책도 다 꽂았다. 역시 나한테 잘 맞는 일 같다!'),[{label:r.day<5?'다음 날 봉사하기':'주말계약직 공고를 확인한다',run:()=>{if(r.day<5){nextRecordDay(state.record);startDay()}else showComplete()}},{label:'오늘 결과 다시 보기',run:showReview}]);save()}
function showFailure(){closeAll();state.phase='failed';state.record.failed=true;updateHUD();save();choices('officer','봉사활동이 종료되었습니다',state.record.mistakes>=3?'오늘 잘못된 응대가 세 차례 있었습니다. 이후 봉사 참여는 어렵겠습니다.':'이틀 연속으로 잘못된 응대가 두 차례 이상 있었습니다. 이후 봉사 참여는 어렵겠습니다.',[{label:'처음부터 다시 시작',run:startIntro}])}
function showComplete(){phase('complete');choices('player','나 · 자원봉사자','봉사도 해봤으니까 계약직도 잘할 수 있겠지? 좋아, 지원해 보자!\n\n이번 샘플은 여기까지입니다. 다음 이야기는 주말계약직으로 이어집니다.',[{label:'인트로 다시 보기',run:startIntro},{label:'봉사자 첫날 다시 해보기',run:()=>{freshWorld();startDay()}}]);save()}

function updateVisitors(dt){
 for(const n of actors.filter(a=>!a.home)){
  n.moving=false;if(n.status==='escorting'){
   const d=dist(n,player);if(d>.9){n.route=pathfind(n,player,allColliders(),.23);moveAlong(n,n.route,dt,d>2?2.8:2.2)}
  }else if(n.status==='served'){
   if(n.route.length)moveAlong(n,n.route,dt,1.2);
   if(state.phase==='work'&&state.record.elapsed>n.availableAt){n.serial++;n.eventId='d'+state.record.day+'-'+n.id+'-'+n.serial;n.status='waiting';if(n.id==='boy'){n.x=1.5;n.z=2;n.category=[9,8,4][n.serial%3]}else{n.x=5.6;n.z=3.4;n.request=n.serial%2?'loan':'repair'}n.route=[]}
  }
 }
}
function closest(){
 const list=[];for(const n of actors){if(['hidden','served','escorting','leaving'].includes(n.status))continue;const d=dist(player,n);if(d<1.65)list.push({type:'npc',obj:n,d,text:n.name+'에게 말 걸기'})}
 if(state.pile.length&&dist(player,layout.bookPile)<1.25)list.push({type:'pile',obj:layout.bookPile,d:dist(player,layout.bookPile),text:'배가할 책 집기'});
 if(dist(player,state.cart)<1.85)list.push({type:'cart',obj:state.cart,d:dist(player,state.cart),text:'북카트 사용'});
 for(const s of layout.shelves){const d=Math.hypot(Math.max(Math.abs(player.x-s.x)-(s.w||2.25)/2,0),Math.max(Math.abs(player.z-s.z)-(s.d||.6)/2,0));if(d<1.05)list.push({type:'shelf',obj:s,d,text:s.code+' '+CATEGORIES[s.category]+' 서가'})}
 list.sort((a,b)=>a.d-b.d);return list[0]||null;
}
function interact(target=nearby){
 if(hasModal()||!target)return;const {type,obj}=target;
 if(type==='pile')pickBooks();else if(type==='cart')cartMenu();else if(type==='shelf')shelfMenu(obj);else if(obj.home)staffMenu(obj);else talkVisitor(obj);
}
const labels=new Map();
function cartContents(){
 const panel=$('cart-contents');panel.hidden=hasModal()||!state.cart.books.length;if(panel.hidden)return;
 const signature=state.cart.books.map(b=>b.id+':'+b.code).join('|');if(signature!==cartContentsKey){cartContentsKey=signature;panel.replaceChildren();const title=document.createElement('strong');title.textContent='북카트에 담긴 책 · '+state.cart.books.length+'권';panel.append(title);const list=document.createElement('div');list.className='cart-book-list';for(const book of state.cart.books){const item=document.createElement('div');item.className='cart-book';const name=document.createElement('span');name.textContent=book.title;const code=document.createElement('small');code.textContent=book.code;item.append(name,code);list.append(item)}panel.append(list)}
 const q=renderer.project(state.cart.x,1.0,state.cart.z);if(q.x<0||q.y<0||q.x>canvas.clientWidth||q.y>canvas.clientHeight){panel.hidden=true;return}const width=panel.offsetWidth||190,height=panel.offsetHeight||110;panel.style.left=Math.max(8,Math.min(canvas.clientWidth-width-8,q.x+44))+'px';panel.style.top=Math.max(8,Math.min(canvas.clientHeight-height-72,q.y-height/2))+'px';
}
function label(id,text,p,height=1,cls=''){
 let el=labels.get(id);if(!el){el=document.createElement('div');labels.set(id,el);$('labels').append(el)}el.className='world-label '+cls;el.textContent=text;const q=renderer.project(p.x,height,p.z);el.style.left=q.x+'px';el.style.top=q.y+'px';el.hidden=q.x<0||q.y<0||q.x>canvas.clientWidth||q.y>canvas.clientHeight;
}
function draw(){
 const target=view==='overview'?[0,.5,0]:[player.x,.9,player.z],eye=[target[0]+Math.sin(angle)*16,11,target[2]+Math.cos(angle)*16],aspect=canvas.clientWidth/canvas.clientHeight,z=view==='overview'?Math.max(17,20/aspect):zoom;
 const objects=[{asset:assets.library,matrix:pose(0,0,0)},{asset:assets.cart,matrix:pose(state.cart.x,0,state.cart.z,state.cart.angle||0)}];
 const addBook=(x,y,z,i)=>objects.push({asset:assets.book,matrix:pose(x,y,z,(i%2)*.15)});
 for(let i=0;i<state.pile.length;i++)addBook(layout.bookPile.x+(i-1)*.12,.18,layout.bookPile.z,i);
 for(let i=0;i<state.cart.books.length;i++)addBook(state.cart.x+(i-1)*.12,.88,state.cart.z,i);
 const heroSprite=state.hand.length>=3?'librarian-carry-stack':state.hand.length?'librarian-carry-one':'librarian';
 const visible=actors.filter(a=>a.status!=='hidden');renderer.render(objects,eye,target,z,{warmth:.08,level:.95,phase:.4,sky:[.70,.72,.62]},[{entity:player,asset:assets[heroSprite],height:1.5},...visible.map(n=>({entity:n,asset:assets[n.appearance],height:n.height||1.5}))]);
 for(const s of layout.shelves)label('shelf-'+s.code,s.code+' '+CATEGORIES[s.category],s,2.3,(state.phase==='escort'&&s.category===9||['cart','shelve'].includes(state.phase)&&s.category===8)?'target':'');
 for(const n of actors){if(n.status==='hidden'){if(labels.has(n.id))labels.get(n.id).hidden=true;continue}label(n.id,n.name+(n.status==='working'?' · 확인 중…':''),n,(n.spriteState?.worldHeight||n.height||1.5)+.28,n.home?'staff':['waiting','reported'].includes(n.status)?'patron':'')}
 label('player','나 · 자원봉사자',player,(player.spriteState?.worldHeight||1.5)+.27);
 label('cart','북카트 · '+state.cart.books.length+'권',state.cart,1.35,state.phase==='load'||state.phase==='cart'?'target':'');
 cartContents();
 if(state.pile.length)label('pile','배가할 책 '+state.pile.length+'권',layout.bookPile,.7,'target');else if(labels.has('pile'))labels.get('pile').hidden=true;
 nearby=closest();$('prompt').hidden=!nearby||hasModal()||['review','failed','complete'].includes(state.phase);if(nearby)$('prompt').textContent='E · '+nearby.text;
}
function advance(dt){
 if(!hasModal()&&!document.hidden&&!['review','failed','complete'].includes(state.phase)){
  updatePlayer(dt);updateStaff(dt);updateVisitors(dt);
  if(state.phase==='cart'&&state.cart.attached&&dist(state.cart,layout.shelves.find(s=>s.category===8).cartDock)<.9){path=[];phase('shelve');say('카트 옆에서 확인 버튼이나 E키를 누르고, 카트를 놓고 책을 꺼내 보세요.')}
  if(state.phase==='work'){state.record.elapsed=Math.min(SHIFT_SECONDS,state.record.elapsed+dt);if(state.record.elapsed>=SHIFT_SECONDS)finishDay()}
 }
}
function tick(now){const dt=last?Math.max(0,(now-last)/1000):0;last=now;time+=dt;if(dt<2){let rest=dt;while(rest>.00001){const step=Math.min(rest,.05);advance(step);rest-=step}}
 if(time>toastUntil)$('toast').classList.remove('show');if(time-saveAt>4){save();saveAt=time}updateHUD();draw();requestAnimationFrame(tick)}

function inspectScene(scene){
 if(!previewBackup)previewBackup=snapshot();closeAll();freshWorld();$('preview-exit').hidden=false;
 if(scene==='intro'){sequence(INTRO,()=>{phase('sort');openSorting()})}
 if(scene==='sort'){phase('sort');openSorting()}
 if(scene==='cart'){phase('collect');player.x=.9;player.z=4.1;say('책을 집고 카트에 담아 옮겨보세요.')}
 if(scene==='service'){state.pile=[];byId('boy').status='waiting';phase('service');player.x=1.5;player.z=2.7;talkVisitor(byId('boy'))}
 if(scene==='call'){state.pile=[];byId('patron').status='waiting';phase('report');player.x=5;player.z=3.2;talkVisitor(byId('patron'))}
 if(scene==='outro')showOutro();
 if(scene==='work')startDay();
 if(scene==='warning'){startDay();state.record.previousMistakes=2;state.record.mistakes=1;state.record.counted=['inspect-previous'];say('어제 경고 2회 · 오늘 1회. 잘못 응대하면 연속일 조건으로 종료됩니다.')}
 if(scene==='arc')choices('mentor-look','이후 이야기의 방향',CAREER_ARC.map(a=>a[0]+' — '+a[2]).join('\n'),[{label:'장면 검수로 돌아가기',run:()=> $('inspection').showModal()}]);
 updateHUD();
}
function exitPreview(){closeAll();if(previewBackup){restore(previewBackup);previewBackup=null}$('preview-exit').hidden=true;continueScene()}
function bindControls(){
 $('main-hud').innerHTML=hudMarkup();$('dialogue-hud').innerHTML=hudMarkup();
 $('next').onclick=closeDialogue;$('close-dialog').onclick=closeDialogue;$('close-sort').onclick=()=>$('sorting').close();$('sort-confirm').onclick=confirmSort;
 $('close-pickup').onclick=()=>$('pickup').close();
 for(const d of document.querySelectorAll('dialog'))d.addEventListener('cancel',e=>{e.preventDefault();d.close();clearInputs()});
 $('prompt').onclick=()=>interact();$('interact').onclick=()=>interact();$('cart-toggle').onclick=toggleCart;$('book-list').onclick=()=>{const books=[...state.hand.map(b=>'손 · '+b.title+' / '+b.code),...state.cart.books.map(b=>'카트 · '+b.title+' / '+b.code)];openLine('player','가지고 있는 책',books.length?books.join('\n'):'지금 손이나 카트에 담긴 책은 없습니다.','돌아가기')};$('overview').onclick=()=>{view='overview'};$('follow').onclick=()=>{view='follow';zoom=8.5};
 const scenes=[['인트로 대사','intro'],['책 꽂기 미니게임','sort'],['북카트 사용','cart'],['이용자 응대','service'],['주무관 호출','call'],['인수인계 마지막 장면','outro'],['봉사자 3분 근무','work'],['이틀 연속 경고 판정','warning'],['전체 시놉시스 방향','arc']];
 for(const [label,id]of scenes){const b=document.createElement('button');b.textContent=label;b.onclick=()=>inspectScene(id);$('inspect-buttons').append(b)}$('inspect-open').onclick=()=>$('inspection').showModal();$('close-inspect').onclick=()=>$('inspection').close();$('preview-exit').onclick=exitPreview;
 window.addEventListener('keydown',e=>{if(e.target?.matches('input,textarea'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();if(hasModal()){if(k==='Escape'){closeAll()}return}if(['w','a','s','d','q','r','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k))keys.add(k);if(!e.repeat&&k==='e')interact();if(!e.repeat&&k==='c')toggleCart()});
 window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',clearInputs);window.addEventListener('resize',syncDialogueLayout);document.addEventListener('visibilitychange',()=>{clearInputs();last=0;save()});window.addEventListener('beforeunload',save);
 canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(hasModal())return;drag={button:e.button,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(drag?.button===2){angle+=(e.clientX-drag.x)*.008;drag.x=e.clientX}});
 canvas.addEventListener('pointerup',e=>{if(drag?.button===0&&!hasModal()&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<7){const target=screenTarget(e.clientX,e.clientY);if(target)approachTarget(target);else{const p=renderer.ground(e.clientX,e.clientY);if(nearby&&dist(p,nearby.obj)<.75)interact();else goTo(p.x,p.z)}}drag=null});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(5.5,Math.min(18,zoom+e.deltaY*.008))},{passive:false});
 const touch=!!navigator.maxTouchPoints||window.matchMedia('(pointer:coarse)').matches;document.body.classList.toggle('touch',touch);if(touch){const resize=()=>{document.body.style.setProperty('--game-height',(window.visualViewport?.height||innerHeight)+'px');clearInputs()};resize();window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);const joy=$('joystick');let down=false;const move=e=>{if(!down)return;const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dz=e.clientY-r.top-r.height/2,scale=Math.min(1,28/Math.max(1,Math.hypot(dx,dz)));stick={x:dx*scale/28,z:dz*scale/28};$('knob').style.transform='translate('+dx*scale+'px,'+dz*scale+'px)'};joy.addEventListener('pointerdown',e=>{e.preventDefault();down=true;joy.setPointerCapture(e.pointerId);move(e)});joy.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(type,()=>{down=false;stick={x:0,z:0};$('knob').style.transform='translate(0,0)'})}
}

async function init(){try{
 renderer=new Renderer(canvas);const spriteNames=['librarian','librarian-carry-one','librarian-carry-stack','mentor','officer','patron','boy-blue'];const [library,cart,book,sprites,data]=await Promise.all([renderer.load('assets/library.glb.gz'),renderer.load('assets/cart.glb.gz'),renderer.load('assets/book.glb.gz'),Promise.all(spriteNames.map(n=>renderer.loadSprite(n))),assetFetch('assets/layout.json').then(r=>r.json())]);assets={library,cart,book,...Object.fromEntries(spriteNames.map((n,i)=>[n,sprites[i]]))};layout=data;freshWorld();bindControls();$('loading').remove();
 let saved;try{saved=JSON.parse(localStorage.getItem(SAVE_KEY))}catch{}if(saved?.version===1&&saved.state?.record&&saved.actors?.length===4){choices('player','나 · 자원봉사자','이전에 진행하던 봉사 기록이 있어요.',[{label:'이어서 하기',run:()=>{restore(saved);session=true;continueScene()}},{label:'처음부터 새로 시작',run:startIntro}])}else startIntro();
 window.library98Demo={get state(){return state},get player(){return player},get actors(){return actors},get layout(){return layout},get nearby(){return nearby},get renderer(){return renderer},get route(){return path},interact,approachTarget,inspectScene,exitPreview,openSorting,selectSlot,confirmSort,toggleCart,movePlayer,goTo,closeAll,startIntro,startDay,advance,draw,teleport:(x,z)=>{player.x=x;player.z=z;path=[];pendingInteraction=null;nearby=closest()},snapshot,restore,workClock,recordMistake};requestAnimationFrame(tick);
 }catch(error){console.error(error);$('loading-message').textContent='불러오지 못했습니다: '+error.message}}
init();
