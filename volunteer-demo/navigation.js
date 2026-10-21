export function blocked(x,z,colliders,r=.28){if(Math.abs(x)>8.45-r||z>6.05-r||z< -6.05+r)return true;return colliders.some(c=>{let dx=Math.max(Math.abs(x-c.x)-c.w/2,0),dz=Math.max(Math.abs(z-c.z)-c.d/2,0);return dx*dx+dz*dz<r*r})}
export function segmentClear(start,end,colliders,r=.29,companion=null){
 const count=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.z-start.z)/.08));
 for(let i=0;i<=count;i++){const t=i/count,x=start.x+(end.x-start.x)*t,z=start.z+(end.z-start.z)*t;if(blocked(x,z,colliders,r)||(companion&&blocked(x+companion.x,z+companion.z,colliders,companion.radius)))return false}return true;
}
export function pathfind(start,end,colliders,r=.29,companion=null){const step=.5,W=49,H=41,toCell=p=>[Math.round((p.x+12)/step),Math.round((p.z+10)/step)],point=([x,z])=>({x:x*step-12,z:z*step-10}),key=(x,z)=>z*W+x,inRange=(x,z)=>x>=0&&x<W&&z>=0&&z<H;
 const occupied=(x,z)=>blocked(x,z,colliders,r)||(companion&&blocked(x+companion.x,z+companion.z,colliders,companion.radius));
 if(segmentClear(start,end,colliders,r,companion))return [{x:end.x,z:end.z}];
 let s=toCell(start),e=toCell(end);s=s.map((v,i)=>Math.max(0,Math.min(i?H-1:W-1,v)));e=e.map((v,i)=>Math.max(0,Math.min(i?H-1:W-1,v)));
 if(occupied(...Object.values(point(e)))){let candidates=[];for(let dz=-5;dz<=5;dz++)for(let dx=-5;dx<=5;dx++){let x=e[0]+dx,z=e[1]+dz,p=point([x,z]);if(inRange(x,z)&&!occupied(p.x,p.z))candidates.push({cell:[x,z],dist:Math.hypot(p.x-end.x,p.z-end.z)})}if(!candidates.length)return [];candidates.sort((a,b)=>a.dist-b.dist);e=candidates[0].cell}
 let open=[{cell:s,g:0,f:0}],cost=new Map([[key(...s),0]]),parent=new Map(),closed=new Set();let endKey=key(...e),found=false;
 while(open.length){open.sort((a,b)=>a.f-b.f);let cur=open.shift(),ck=key(...cur.cell);if(closed.has(ck))continue;closed.add(ck);if(ck===endKey){found=true;break}for(let[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){let x=cur.cell[0]+dx,z=cur.cell[1]+dz,k=key(x,z),p=point([x,z]);if(!inRange(x,z)||occupied(p.x,p.z))continue;if(dx&&dz){let p1=point([x,cur.cell[1]]),p2=point([cur.cell[0],z]);if(occupied(p1.x,p1.z)||occupied(p2.x,p2.z))continue}let g=cur.g+Math.hypot(dx,dz);if(g<(cost.get(k)??Infinity)){cost.set(k,g);parent.set(k,ck);open.push({cell:[x,z],g,f:g+Math.hypot(x-e[0],z-e[1])})}}}
 if(!found)return [];let result=[],k=endKey;while(k!==key(...s)){result.push(point([k%W,Math.floor(k/W)]));k=parent.get(k);if(k===undefined)return []}result.reverse();
 if(result.length&&!occupied(end.x,end.z)&&segmentClear(result.at(-1),end,colliders,r,companion))result.push({x:end.x,z:end.z});
 const smooth=[];let from=start,index=0;while(index<result.length){let next=result.length-1;while(next>index&&!segmentClear(from,result[next],colliders,r,companion))next--;smooth.push(result[next]);from=result[next];index=next+1}return smooth;
}
