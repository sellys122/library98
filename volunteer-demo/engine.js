// Small WebGL2/GLB renderer. No network, packages or third-party runtime needed.
export const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let l=Math.hypot(...a)||1;return a.map(v=>v/l)}};
export const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function mul(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
export function transform(p=[0,0,0],q=[0,0,0,1],s=[1,1,1]){let[x,y,z,w]=q;return new Float32Array([(1-2*y*y-2*z*z)*s[0],(2*x*y+2*z*w)*s[0],(2*x*z-2*y*w)*s[0],0,(2*x*y-2*z*w)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*x*w)*s[1],0,(2*x*z+2*y*w)*s[2],(2*y*z-2*x*w)*s[2],(1-2*x*x-2*y*y)*s[2],0,...p,1])}
export const pose=(x,y,z,angle=0,scale=1)=>transform([x,y,z],[0,Math.sin(angle/2),0,Math.cos(angle/2)],[scale,scale,scale]);
export function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1])}
export function lookAt(eye,target){let z=V.norm(V.sub(eye,target)),x=V.norm(V.cross([0,1,0],z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1])}
export function invert(m){let a=Array.from({length:4},(_,r)=>Array.from({length:8},(_,c)=>c<4?m[c*4+r]:(c-4===r?1:0)));for(let i=0;i<4;i++){let best=i;for(let r=i+1;r<4;r++)if(Math.abs(a[r][i])>Math.abs(a[best][i]))best=r;[a[i],a[best]]=[a[best],a[i]];let d=a[i][i];if(Math.abs(d)<1e-10)return identity();a[i]=a[i].map(v=>v/d);for(let r=0;r<4;r++)if(r!==i){let f=a[r][i];a[r]=a[r].map((v,c)=>v-f*a[i][c])}}return new Float32Array(Array.from({length:16},(_,i)=>a[i%4][4+Math.floor(i/4)]))}
export function apply(m,v){let a=[...v,v.length===3?1:undefined].slice(0,4);return [0,1,2,3].map(r=>a.reduce((s,x,c)=>s+m[c*4+r]*x,0))}
function shader(gl,type,s){let a=gl.createShader(type);gl.shaderSource(a,s);gl.compileShader(a);if(!gl.getShaderParameter(a,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(a));return a}
function program(gl,vs,fs){let p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
const VS=`#version 300 es
layout(location=0) in vec3 position; layout(location=1) in vec3 normal;
uniform mat4 world,viewProjection,lightProjection;uniform bool outlinePass;uniform vec2 pixelViewport;out vec3 N;out vec4 shadowCoord;out vec3 P;
void main(){vec4 p=world*vec4(position,1.);P=p.xyz;N=normalize(mat3(world)*normal);shadowCoord=lightProjection*p;gl_Position=viewProjection*p;if(outlinePass){vec2 edge=(viewProjection*vec4(N,0.)).xy;gl_Position.xy+=normalize(edge+vec2(.00001))*1.4/pixelViewport*gl_Position.w;}}`;
const FS=`#version 300 es
precision highp float;
in vec3 N;in vec4 shadowCoord;in vec3 P;
uniform vec4 color;uniform sampler2D shadowMap;uniform vec3 tint;uniform vec3 daylight;uniform vec3 lightDirection;uniform vec3 skyColor;uniform bool windowSurface;uniform float materialKind;uniform bool outlinePass;
out vec4 frag;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 if(outlinePass){frag=vec4(.25,.19,.13,1.);return;}
 // The old thin seam meshes must not overlay the quiet floor.
 if(materialKind==1.&&P.y>-.01&&P.y<.016&&abs(P.x)<8.8&&abs(P.z)<6.4)discard;
 vec3 n=normalize(N);vec3 c=color.rgb;
 vec2 uv=abs(n.y)>.65?P.xz:abs(n.z)>.55?P.xy:P.zy;
 vec2 pixel=floor(uv*48.);float grain=hash(floor(pixel/vec2(3.,2.)));
 if(materialKind==6.){
  // Broad boards with one low-contrast seam, filtered in world space.
  c=vec3(.55,.385,.235);
  float plank=floor((P.z+6.25)/1.25),f=fract((P.z+6.25)/1.25);
  float seamDistance=min(f,1.-f)*1.25;
  float seam=1.-smoothstep(.005,.005+max(fwidth(P.z),.004),seamDistance);
  c*=mix(.994,1.006,mod(plank,2.))*(1.-.08*seam);
 }else if(materialKind==1.){
  float fibres=hash(vec2(floor(uv.y*10.),floor(uv.x)));
  c*=fibres>.96?.97:1.;
 }else if(materialKind==2.){if(P.y>.06)c*=grain>.88?1.10:grain<.12?.88:1.;}
 else if(materialKind==3.){c*=grain>.88?1.08:1.;}
 else if(materialKind==4.){if(P.y>.25)c*=grain>.70?1.16:grain<.2?.82:1.;}
 float diffuse=max(dot(n,normalize(lightDirection)),0.);float bands=diffuse>.72?1.:diffuse>.28?.87:.73;
 vec3 q=shadowCoord.xyz/shadowCoord.w*.5+.5;float shade=1.;
 if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.){
  if(materialKind==6.){float visible=0.;vec2 texel=1./vec2(textureSize(shadowMap,0));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)visible+=q.z-.0025<=texture(shadowMap,q.xy+vec2(x,y)*texel).r?1.:0.;shade=mix(.82,1.,visible/9.);}
  else{float depth=texture(shadowMap,q.xy).r;shade=q.z-.0018>depth?.73:1.;}
 }
 c*=tint*bands*shade*daylight.y;
 c=mix(c,c*vec3(1.08,1.00,.86),.28);
 vec3 srgb=pow(max(c,vec3(.001)),vec3(1./2.2));
 if(materialKind!=6.)srgb=floor(clamp(srgb,0.,1.)*25.+.5)/25.;
 if(windowSurface){float v=floor(P.y*16.)/16.;srgb=mix(vec3(.54,.69,.59),vec3(.80,.85,.65),smoothstep(1.4,2.6,v));}
 frag=vec4(srgb,color.a);
}`;
const DVS=`#version 300 es
layout(location=0) in vec3 position;uniform mat4 world,viewProjection;void main(){gl_Position=viewProjection*world*vec4(position,1.);}`;
const DFS=`#version 300 es
precision highp float;void main(){}`;
export async function assetFetch(url){let embedded=window.LIBRARY_EMBEDDED?.[url],response=embedded?new Response(Uint8Array.from(atob(embedded),c=>c.charCodeAt(0))):await fetch(url);if(!response.ok)return response;if(url.endsWith('.gz')){if(!window.DecompressionStream)throw Error('최신 Chrome, Edge, Safari에서 실행해 주세요.');return new Response(response.body.pipeThrough(new DecompressionStream('gzip')))}return response}
export class Renderer{
 constructor(canvas){this.canvas=canvas;let gl=this.gl=canvas.getContext('webgl2',{antialias:false,alpha:false});if(!gl)throw Error('WebGL2를 사용할 수 없습니다. 최신 Chrome 또는 Edge에서 하드웨어 가속을 켜주세요.');this.program=program(gl,VS,FS);this.depthProgram=program(gl,DVS,DFS);this.uniforms={};for(let name of ['world','viewProjection','lightProjection','color','shadowMap','tint','daylight','lightDirection','skyColor','windowSurface','materialKind','outlinePass','pixelViewport'])this.uniforms[name]=gl.getUniformLocation(this.program,name);this.depthUniforms={world:gl.getUniformLocation(this.depthProgram,'world'),vp:gl.getUniformLocation(this.depthProgram,'viewProjection')};
 this.lightVP=mul(ortho(-23,23,-23,23,1,65),lookAt([15,27,12],[0,0,0]));this.shadow=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadow);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,2048,2048,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.shadow,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('그림자 렌더러 초기화 실패');gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);this.vp=identity();this.stats={};
 }
 resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;const pixelScale=Math.max(1,Math.ceil(w/2560),Math.ceil(h/1440));const width=Math.round(w/pixelScale),height=Math.round(h/pixelScale);if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height}return w/h}
 async load(url){let response=await assetFetch(url);if(!response.ok)throw Error(url+' 모델 로드 실패');let ab=await response.arrayBuffer(),dv=new DataView(ab);if(dv.getUint32(0,true)!==0x46546c67)throw Error('GLB 파일 형식 오류');let json,bin;for(let offset=12;offset<ab.byteLength;){let len=dv.getUint32(offset,true),type=dv.getUint32(offset+4,true);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(ab,offset+8,len)));if(type===0x004e4942)bin=ab.slice(offset+8,offset+8+len);offset+=len+8}let gl=this.gl;
 const data=(idx)=>{let a=json.accessors[idx],v=json.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}[a.componentType],bytes=type.BYTES_PER_ELEMENT,start=(v.byteOffset||0)+(a.byteOffset||0);if(!v.byteStride||v.byteStride===n*bytes)return new type(bin,start,a.count*n);let out=new type(a.count*n);for(let i=0;i<a.count;i++)out.set(new type(bin,start+i*v.byteStride,n),i*n);return out};
 let meshes=json.meshes.map(mesh=>mesh.primitives.map(p=>{let vao=gl.createVertexArray();gl.bindVertexArray(vao);for(let[key,loc]of [['POSITION',0],['NORMAL',1]]){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data(p.attributes[key]),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0)}let indices=data(p.indices);let ebo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);let mat=json.materials[p.material],col=mat.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];let kind=mat.name==='floor'?6:['oak','oak_light'].includes(mat.name)?1:['cardigan','ribbing','skirt','tights','paper','wall','sage','burgundy','blue','cream'].includes(mat.name)?2:mat.name.includes('hair')?3:['leaf','grass'].includes(mat.name)?4:0;return {kind,vao,count:indices.length,type:indices instanceof Uint32Array?gl.UNSIGNED_INT:indices instanceof Uint16Array?gl.UNSIGNED_SHORT:gl.UNSIGNED_BYTE,color:col,material:mat.name}}));gl.bindVertexArray(null);
 let roots=json.scenes[json.scene||0].nodes;
 return {json,meshes,roots,url};
 }
 async loadSprite(name){
  const [imageResponse,metaResponse]=await Promise.all([assetFetch('assets/'+name+'-sprites.png'),assetFetch('assets/'+name+'-sprites.json')]);
  if(!imageResponse.ok||!metaResponse.ok)throw Error(name+' 스프라이트 로드 실패');
  const [bitmap,meta]=await Promise.all([createImageBitmap(await imageResponse.blob(),{premultiplyAlpha:'none'}),metaResponse.json()]);
  const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);bitmap.close();
  if(!this.spriteProgram){
   const vertex=`#version 300 es
   layout(location=0) in vec2 corner;uniform mat4 viewProjection;uniform vec3 anchor,cameraRight;uniform vec2 size,pixelViewport,rasterSize;uniform bool shadowPass;out vec2 uv;
   void main(){uv=vec2(corner.x+.5,1.-corner.y);vec3 p=shadowPass?anchor+vec3(corner.x*size.x,.012,(corner.y-.5)*size.y):anchor+cameraRight*corner.x*size.x+vec3(0.,corner.y*size.y,0.);gl_Position=viewProjection*vec4(p,1.);if(!shadowPass){vec4 foot=viewProjection*vec4(anchor,1.);vec2 origin=floor((foot.xy/foot.w*.5+.5)*pixelViewport+.5);vec2 pixel=origin+vec2((corner.x+.5)*rasterSize.x-floor(rasterSize.x*.5),corner.y*rasterSize.y);gl_Position.xy=(pixel/pixelViewport*2.-1.)*gl_Position.w;}}`;
   const fragment=`#version 300 es
   precision highp float;in vec2 uv;uniform sampler2D atlas;uniform vec4 frameRect;uniform vec2 logicalSize;uniform bool shadowPass;uniform float variant;out vec4 frag;
   void main(){if(shadowPass){float r=length((uv-.5)*2.);if(r>1.)discard;frag=vec4(.22,.20,.13,r>.72?.10:.23);return;}vec2 cell=(floor(clamp(uv,vec2(0.),vec2(.99999))*logicalSize)+.5)/logicalSize;vec4 c=texture(atlas,mix(frameRect.xy,frameRect.zw,cell));if(c.a<.5)discard;if(variant>.5&&uv.y>.49&&uv.y<.78&&c.r>c.g*1.22&&c.r>c.b*1.30)c.rgb=c.rgb*vec3(.72,1.10,.84);frag=vec4(c.rgb,1.);}`;
   this.spriteProgram=program(gl,vertex,fragment);this.spriteUniforms={};for(const name of ['viewProjection','anchor','cameraRight','size','shadowPass','atlas','frameRect','logicalSize','variant','pixelViewport','rasterSize'])this.spriteUniforms[name]=gl.getUniformLocation(this.spriteProgram,name);
   this.spriteVAO=gl.createVertexArray();gl.bindVertexArray(this.spriteVAO);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,0,.5,0,.5,1,-.5,0,.5,1,-.5,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);
  }
  return {texture,meta,name};
 }
 drawSprites(sprites,eye,target){
  if(!sprites.length)return;const gl=this.gl,u=this.spriteUniforms,right=V.norm(V.cross([0,1,0],V.sub(eye,target))),yaw=Math.atan2(eye[0]-target[0],eye[2]-target[2]);
  gl.useProgram(this.spriteProgram);gl.bindVertexArray(this.spriteVAO);gl.disable(gl.CULL_FACE);gl.uniformMatrix4fv(u.viewProjection,false,this.vp);gl.uniform3fv(u.cameraRight,right);gl.uniform1i(u.atlas,1);gl.uniform2f(u.pixelViewport,this.canvas.width,this.canvas.height);
  gl.uniform1i(u.shadowPass,1);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform2f(u.size,.64,.35);
  for(const s of sprites){gl.uniform3fv(u.anchor,[s.entity.x,.004,s.entity.z]);gl.drawArrays(gl.TRIANGLES,0,6)}
  gl.disable(gl.BLEND);gl.depthMask(true);gl.uniform1i(u.shadowPass,0);gl.activeTexture(gl.TEXTURE1);
  for(const s of sprites){const e=s.entity,m=s.asset.meta,direction=spriteDirection(e.angle,yaw),column=e.moving?[0,1,2,1][Math.floor(e.walk*.45)%4]:1,frame=direction*3+column,b=m.frames[frame],w=b[2]-b[0],h=b[3]-b[1],baseHeight=s.height||1.50,foot=apply(this.vp,[e.x,.025,e.z]),head=apply(this.vp,[e.x,.025+baseHeight,e.z]),projectedHeight=Math.abs(head[1]/head[3]-foot[1]/foot[3])*this.canvas.height*.5,raster=spriteRasterLayout(baseHeight,w,h,projectedHeight),height=raster.worldHeight;
   gl.bindTexture(gl.TEXTURE_2D,s.asset.texture);gl.uniform3fv(u.anchor,[e.x,.025,e.z]);gl.uniform2f(u.size,height*w/h,height);gl.uniform4fv(u.frameRect,[b[0]/m.width,b[1]/m.height,b[2]/m.width,b[3]/m.height]);gl.uniform2f(u.logicalSize,raster.logicalWidth,raster.logicalHeight);gl.uniform2f(u.rasterSize,raster.width,raster.height);gl.uniform1f(u.variant,s.variant||0);gl.drawArrays(gl.TRIANGLES,0,6);s.entity.spriteState={direction,column,frame,worldHeight:height,pixelHeight:raster.height,pixelScale:raster.scale};
  }
  gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);gl.enable(gl.CULL_FACE);
 }
 flatten(instances){let draws=[];for(let inst of instances){const visit=(id,parent)=>{let n=inst.asset.json.nodes[id],local=n.matrix?new Float32Array(n.matrix):transform(n.translation,n.rotation,n.scale);if(inst.animate)local=inst.animate(n,local)||local;let world=mul(parent,local);if(n.mesh!==undefined)for(let p of inst.asset.meshes[n.mesh])draws.push({...p,outlined:!inst.asset.url.includes('library.glb'),color:p.material==='coral'&&inst.bookColor?inst.bookColor:p.color,world,tint:p.material==='apron'&&inst.tint?inst.tint:[1,1,1]});for(let child of n.children||[])visit(child,world)};for(let id of inst.asset.roots)visit(id,inst.matrix||identity())}return draws}
 render(instances,eye,target,zoom,atmosphere={warmth:0,level:1,phase:0,sky:[.925,.904,.855]},sprites=[]){let light=[Math.cos(atmosphere.phase*Math.PI)*18,12+Math.sin(atmosphere.phase*Math.PI)*18,8];this.lightVP=mul(ortho(-23,23,-23,23,1,85),lookAt(light,[0,0,0]));let gl=this.gl,aspect=this.resize();this.vp=mul(ortho(-zoom*aspect/2,zoom*aspect/2,-zoom/2,zoom/2,.1,100),lookAt(eye,target));let draws=this.flatten(instances);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,2048,2048);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.depthProgram);gl.uniformMatrix4fv(this.depthUniforms.vp,false,this.lightVP);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,4);for(let d of draws){gl.uniformMatrix4fv(this.depthUniforms.world,false,d.world);gl.bindVertexArray(d.vao);gl.drawElements(gl.TRIANGLES,d.count,d.type,0)}gl.disable(gl.POLYGON_OFFSET_FILL);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(...atmosphere.sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.uniforms.viewProjection,false,this.vp);gl.uniformMatrix4fv(this.uniforms.lightProjection,false,this.lightVP);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.shadow);gl.uniform1i(this.uniforms.shadowMap,0);gl.uniform3fv(this.uniforms.daylight,[atmosphere.warmth,atmosphere.level,atmosphere.phase]);gl.uniform3fv(this.uniforms.lightDirection,light);gl.uniform3fv(this.uniforms.skyColor,atmosphere.sky);gl.uniform2f(this.uniforms.pixelViewport,this.canvas.width,this.canvas.height);
 gl.uniform1i(this.uniforms.outlinePass,1);gl.cullFace(gl.FRONT);for(let d of draws){if(!d.outlined)continue;gl.uniformMatrix4fv(this.uniforms.world,false,d.world);gl.bindVertexArray(d.vao);gl.drawElements(gl.TRIANGLES,d.count,d.type,0)}gl.cullFace(gl.BACK);gl.uniform1i(this.uniforms.outlinePass,0);for(let d of draws){gl.uniform1f(this.uniforms.materialKind,d.kind);gl.uniformMatrix4fv(this.uniforms.world,false,d.world);gl.uniform4fv(this.uniforms.color,d.color);gl.uniform3fv(this.uniforms.tint,d.tint);gl.uniform1i(this.uniforms.windowSurface,d.material==='glass'?1:0);gl.bindVertexArray(d.vao);gl.drawElements(gl.TRIANGLES,d.count,d.type,0)}gl.bindVertexArray(null);this.drawSprites(sprites,eye,target);this.stats={drawCalls:draws.length*2+sprites.length*2,triangles:draws.reduce((s,d)=>s+d.count/3,0)+sprites.length*4,spriteCount:sprites.length};
 }
 project(x,y,z){let p=apply(this.vp,[x,y,z]);return {x:(p[0]/p[3]*.5+.5)*this.canvas.clientWidth,y:(-.5*p[1]/p[3]+.5)*this.canvas.clientHeight}}
 ground(clientX,clientY){let r=this.canvas.getBoundingClientRect(),x=(clientX-r.left)/r.width*2-1,y=1-(clientY-r.top)/r.height*2,inv=invert(this.vp),a=apply(inv,[x,y,-1]),b=apply(inv,[x,y,1]);a=a.map(v=>v/a[3]);b=b.map(v=>v/b[3]);let t=-a[1]/(b[1]-a[1]);return {x:a[0]+t*(b[0]-a[0]),z:a[2]+t*(b[2]-a[2])}}
}

export function spriteDirection(heading,cameraYaw){const a=Math.atan2(Math.sin(heading-cameraYaw),Math.cos(heading-cameraYaw));return Math.abs(a)<=Math.PI/4?0:Math.abs(a)>=Math.PI*3/4?3:a<0?1:2}

// Every source cell covers an exact integer number of display pixels.
export function spriteRasterLayout(height,frameWidth,frameHeight,projectedHeight){const logicalHeight=height<1.2?48:64,logicalWidth=Math.max(1,Math.round(frameWidth/frameHeight*logicalHeight)),scale=Math.max(1,Math.round(projectedHeight/logicalHeight));return {logicalHeight,logicalWidth,scale,width:logicalWidth*scale,height:logicalHeight*scale,worldHeight:height*logicalHeight*scale/Math.max(projectedHeight,1)}}
