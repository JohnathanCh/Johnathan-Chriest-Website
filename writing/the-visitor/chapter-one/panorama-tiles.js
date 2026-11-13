import * as THREE from 'three';
import {selectPanoramaLevel} from './panorama-quality.js?v=18';


// Stop an abandoned image decode from retaining one of the three request slots.
// TextureLoader has no abort API, so dispose its eventual result after cancel.
function decodeTexture(url,signal){
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(fn,value)=>{if(settled)return false;settled=true;signal.removeEventListener('abort',abort);fn(value);return true;};
  const abort=()=>finish(reject,new DOMException('Tile decode cancelled','AbortError'));
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  new THREE.TextureLoader().loadAsync(url).then(texture=>{if(!finish(resolve,texture))texture.dispose();},error=>finish(reject,error));
 });
}

// Detailed sphere patches share the original panorama's exact orientation and eye.
// The preview remains underneath every patch, including during failures or eviction.
export class PanoramaTiles {
 constructor({scene,camera,renderer,manifest,signal,invalidate,mobile,light}){
  Object.assign(this,{scene,camera,renderer,manifest,signal,invalidate,mobile,light});
  this.group=new THREE.Group();this.group.rotation.y=1.5*Math.PI;scene.add(this.group);
  this.entries=new Map();this.disposed=false;this.pending=0;this.queue=[];this.clock=0;this.exposure=1;this.retryTimer=null;
  this.frustum=new THREE.Frustum();this.matrix=new THREE.Matrix4();this.forward=new THREE.Vector3();
  this.state={level:0,visible:0,ready:0,pending:0,resident:0,failures:[],textureBytes:0};
  this.abort=()=>this.dispose();signal?.addEventListener('abort',this.abort,{once:true});
 }
 setExposure(value){this.exposure=value;for(const e of this.entries.values())if(e.mesh)e.mesh.material.color.setScalar(value);}
 setQuality(){this.level=null;clearTimeout(this.retryTimer);this.retryTimer=null;for(const e of this.entries.values())this.release(e);this.entries.clear();this.queue=[];this.invalidate();}
 release(e){e.controller?.abort();if(e.mesh){this.group.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.map?.dispose();e.mesh.material.dispose();e.mesh=null;}}
 entry(level,x,y){
  const key=`${level.width}/${x}/${y}`;if(this.entries.has(key))return this.entries.get(key);
  const cols=level.width/level.tileSize,rows=level.height/level.tileSize;
  const phi=(x+.5)/cols*2*Math.PI,theta=(y+.5)/rows*Math.PI;
  const center=new THREE.Vector3(Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta)).applyAxisAngle(new THREE.Vector3(0,1,0),1.5*Math.PI);
  // A latitude-aware spherical cap encloses the tile. The old constant
  // diagonal overestimated polar tiles and could crowd real screen edges out.
  const halfPhi=Math.PI/cols,theta0=y/rows*Math.PI,theta1=(y+1)/rows*Math.PI;
  const cornerDot=t=>Math.cos(theta)*Math.cos(t)+Math.sin(theta)*Math.sin(t)*Math.cos(halfPhi);
  const angle=Math.acos(Math.max(-1,Math.min(1,Math.min(cornerDot(theta0),cornerDot(theta1)))))+.0005;
  const bounds=new THREE.Sphere(center.clone().multiplyScalar(39.95*Math.cos(angle)),39.95*Math.sin(angle));
  const e={key,level,x,y,cols,rows,center,bounds,mesh:null,loading:false,lastUsed:0,retryAfter:0};this.entries.set(key,e);return e;
 }
 update(now){
  if(this.disposed)return false;
  const size=this.renderer.getDrawingBufferSize(new THREE.Vector2()),vfov=this.camera.fov,hfov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(vfov/2))*this.camera.aspect));
  let level=selectPanoramaLevel({levels:this.manifest.levels,bufferWidth:size.x,bufferHeight:size.y,horizontalFov:hfov,verticalFov:vfov,light:this.light(),maxTextureSize:this.renderer.capabilities.maxTextureSize});
  if(!level)return false;
  this.camera.updateMatrixWorld();this.camera.getWorldDirection(this.forward);
  this.matrix.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.matrix);
  const desiredLevel=level.width,capacity=this.light()?12:this.mobile()?24:40;
  const visibleAt=candidate=>{
   const result=[],cols=candidate.width/candidate.tileSize,rows=candidate.height/candidate.tileSize;
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const e=this.entry(candidate,x,y);
    if(this.frustum.intersectsSphere(e.bounds)){e.score=e.center.dot(this.forward);result.push(e);}
   }
   return result.sort((a,b)=>b.score-a.score);
  };
  let visible=visibleAt(level);
  // Prefer one complete, appropriately sized detail level to sharp centers
  // surrounded by 2K-preview holes. Wider views may need the next level down.
  while(visible.length>capacity){
   const lower=this.manifest.levels.filter(l=>l.width<level.width&&l.tileSize+2*l.gutter<=this.renderer.capabilities.maxTextureSize).sort((a,b)=>b.width-a.width)[0];
   if(!lower)break;
   level=lower;visible=visibleAt(level);
  }
  const wanted=visible.slice(0,capacity),wantedSet=new Set(wanted.map(e=>e.key));this.clock++;
  let fading=false;
  for(const e of this.entries.values()){
   if(e.mesh){e.mesh.visible=e.level.width===level.width&&wantedSet.has(e.key);if(e.mesh.visible){e.mesh.material.opacity=Math.min(1,(now-e.loadedAt)/240);if(e.mesh.material.opacity<1)fading=true;}}
  }
  for(const e of wanted)e.lastUsed=this.clock;
  const resident=[...this.entries.values()].filter(e=>e.mesh||e.loading);
  const candidates=resident.filter(e=>!wantedSet.has(e.key)).sort((a,b)=>a.lastUsed-b.lastUsed);
  let total=resident.length;
  // Keep space for all currently visible requests, evict old directions first.
  const needed=wanted.filter(e=>!e.mesh&&!e.loading).length;
  for(const e of candidates){if(total+needed<=capacity)break;this.release(e);total--;}
  this.queue=wanted.filter(e=>!e.mesh&&!e.loading&&now>=e.retryAfter);
  this.pump();
  const nextRetry=Math.min(...wanted.filter(e=>!e.mesh&&!e.loading&&Number.isFinite(e.retryAfter)&&e.retryAfter>now).map(e=>e.retryAfter));
  if(Number.isFinite(nextRetry)&&!this.retryTimer)this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.invalidate();},nextRetry-now+25);
  this.state={...this.state,level:level.width,desiredLevel,resolutionLimited:level.width<desiredLevel,visible:visible.length,requestedVisible:wanted.length,ready:wanted.filter(e=>e.mesh&&e.mesh.material.opacity===1).length,pending:this.pending,resident:[...this.entries.values()].filter(e=>e.mesh).length,textureBytes:[...this.entries.values()].filter(e=>e.mesh).reduce((sum,e)=>sum+(e.level.tileSize+2*e.level.gutter)**2*4,0),coverageLimited:visible.length>capacity};
  return fading;
 }
 pump(){while(!this.disposed&&this.pending<3&&this.queue.length){const e=this.queue.shift();if(!e.loading&&!e.mesh)this.load(e);}}
 async load(e){
  e.loading=true;this.pending++;const controller=new AbortController();e.controller=controller;
  let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true;controller.abort();},25000);let texture,url;
  try{
   const path=this.manifest.urlTemplate.replace('{level}',e.level.width).replace('{x}',e.x).replace('{y}',e.y);
   const response=await fetch(path,{signal:controller.signal});if(!response.ok)throw new Error(`tile ${response.status}`);
   url=URL.createObjectURL(await response.blob());texture=await decodeTexture(url,controller.signal);
   if(this.disposed||controller.signal.aborted){texture.dispose();return;}
   texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
   texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
   const segments=24,overlap=.5,top=Math.max(0,e.y*e.level.tileSize-overlap),bottom=Math.min(e.level.height,(e.y+1)*e.level.tileSize+overlap);
   const g=new THREE.SphereGeometry(39.95,segments,segments,(e.x*e.level.tileSize-overlap)/e.level.width*2*Math.PI,(e.level.tileSize+2*overlap)/e.level.width*2*Math.PI,top/e.level.height*Math.PI,(bottom-top)/e.level.height*Math.PI);g.scale(-1,1,1);
   const uv=g.attributes.uv,full=e.level.tileSize+2*e.level.gutter;
   for(let iy=0;iy<=segments;iy++)for(let ix=0;ix<=segments;ix++)uv.setXY(iy*(segments+1)+ix,(e.level.gutter-overlap+ix/segments*(e.level.tileSize+2*overlap))/full,(e.level.gutter+e.level.tileSize-(top+iy/segments*(bottom-top)-e.y*e.level.tileSize))/full);
   uv.needsUpdate=true;
   const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,transparent:true,opacity:0,depthWrite:false});
   material.color.setScalar(this.exposure);e.mesh=new THREE.Mesh(g,material);e.mesh.renderOrder=-1;e.loadedAt=performance.now();this.group.add(e.mesh);this.invalidate();
  }catch(error){if(!this.disposed&&(error.name!=='AbortError'||timedOut)){
   e.failures=(e.failures||0)+1;e.retryAfter=e.failures<=2?performance.now()+5000:Infinity;
   this.state.failures.push({tile:e.key,message:timedOut?'Tile request timed out':error.message});this.state.failures=this.state.failures.slice(-20);
   if(e.failures<=2&&!this.retryTimer)this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.invalidate();},5050);
  }}
  finally{clearTimeout(timeout);if(url)URL.revokeObjectURL(url);e.loading=false;e.controller=null;this.pending--;this.pump();this.invalidate();}
 }
 snapshot(){return {...this.state};}
 dispose(){if(this.disposed)return;this.disposed=true;clearTimeout(this.retryTimer);this.signal?.removeEventListener('abort',this.abort);this.queue=[];for(const e of this.entries.values())this.release(e);this.entries.clear();this.scene.remove(this.group);}
}
