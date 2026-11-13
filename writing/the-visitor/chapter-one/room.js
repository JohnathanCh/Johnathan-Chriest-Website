import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.mjs';
import {ClarityVeil} from './clarity.js?v=21';
import {renderPixelRatio} from './panorama-quality.js?v=18';
import {PanoramaTiles} from './panorama-tiles.js?v=18';
import {MOTION} from './motion-config.js?v=16';
import {createPanoramaHotspot} from './panorama-hotspots.js?v=21';

const DEG=Math.PI/180;
// V15's exact panorama eye position, converted from Blender Z-up to glTF Y-up.
const eye=new THREE.Vector3(3.68828988,1.88,-7.0800004);
const pointAt=(yaw,pitch,r=8)=>new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(r);
export async function createRoom({host,markers,quality,signal,onProgress,onSelect,onFailure,onClarityChange=()=>{},onStage=()=>{}}){
 function checkCancelled(){if(signal?.aborted)throw new DOMException('Loading cancelled','AbortError');}
 checkCancelled();
 onStage('graphics');
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.02,200);
 let clarity,tiles,focusStart=0,focusDuration=0,loadedAsset=null,qualityRevision=0,committedQuality=quality,envTarget,disposed=false,frame,clarityReportTimer,removeResize=()=>{};const ownedMarkers=[];
 function disposeTree(root){root.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}}});}
 function cleanup(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);clearTimeout(clarityReportTimer);removeResize();signal?.removeEventListener('abort',cleanup);tiles?.dispose();disposeTree(scene);clarity?.dispose();envTarget?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();for(const element of ownedMarkers)element.remove();}
 signal?.addEventListener('abort',cleanup,{once:true});
 function cancellable(work,releaseLate){return new Promise((resolve,reject)=>{let settled=false;const abort=()=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);reject(new DOMException('Loading cancelled','AbortError'));};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();Promise.resolve(work).then(value=>{if(settled){releaseLate?.(value);return;}settled=true;signal?.removeEventListener('abort',abort);resolve(value);},error=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);reject(error);});});}
 try{
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0x12231e);
 const mobileView=matchMedia('(max-width:700px), (pointer:coarse) and (max-width:1100px)');
 const memorySaving=()=>quality==='mobile'||navigator.connection?.saveData||navigator.deviceMemory&&navigator.deviceMemory<4;
 const pixelRatio=()=>renderPixelRatio({dpr:devicePixelRatio||1,width:innerWidth,height:innerHeight,mobile:mobileView.matches,light:memorySaving()});
 renderer.setPixelRatio(pixelRatio());renderer.setSize(innerWidth,innerHeight);host.replaceChildren(renderer.domElement);
 const canvas=renderer.domElement;canvas.tabIndex=-1;canvas.setAttribute('aria-label','View from the bed. Your view comes into focus automatically. Move toward either side for a small glance, use left and right arrows, or drag on touchscreens.');
 const DESKTOP_LIMIT=10*DEG,MOBILE_LIMIT=MOTION.yawLimit*DEG;
 const lookLimit=()=>mobileView.matches?MOBILE_LIMIT:DESKTOP_LIMIT;
 let neutralPitch=-6*DEG,controlRevision=0,targetPitch=-6*DEG,yaw=0,targetYaw=0,pitch=-6*DEG,interactive=false,dirty=true,transition,down,hoverID,reducedMotion=false,lastFrame=0,mouseTrail=null;
 onStage('focus effect');clarity=new ClarityVeil(renderer);
 let pano,notebook,guitar,notebookShadow;const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const stats={renderedFrames:0,drawCalls:0,triangles:0,renderMs:[],textureCount:0,mode:'rendered',failures:[],started:performance.now()};
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const hemisphere=new THREE.HemisphereLight(0xf6f4e8,0x8e8c72,2.0);scene.add(hemisphere);
 const sun=new THREE.DirectionalLight(0xffebc9,2);sun.position.set(-2,5,-5);scene.add(sun);
 onStage('room lighting');const pmrem=new THREE.PMREMGenerator(renderer),roomEnv=new RoomEnvironment();envTarget=pmrem.fromScene(roomEnv,.04);scene.environment=envTarget.texture;roomEnv.dispose();pmrem.dispose();
 const targets=[];const defs=[{id:'notebook',label:'Read the notebook',anchor:new THREE.Vector3(-.193,-.524,-1.114)},{id:'guitar',label:'Listen · the guitar',anchor:pointAt(52.4*DEG,-10*DEG,6)}];
 markers.replaceChildren();for(const d of defs){const b=document.createElement('button');b.className='marker';b.setAttribute('aria-label',d.label);b.innerHTML='<span class="label"></span>';b.firstChild.textContent=d.label;b.hidden=true;b.onclick=()=>onSelect(d.id);b.addEventListener('pointerenter',()=>{hoverID=d.id;mouseTrail=null;holdCamera();});b.addEventListener('pointerdown',holdCamera);b.addEventListener('focus',holdCamera);b.addEventListener('pointerleave',()=>{hoverID=null;mouseTrail=null;});markers.append(b);ownedMarkers.push(b);d.element=b;}
 const resourceProgress=new Map();
 async function bytes(url,progress=true){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000),cancel=()=>controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  function report(loaded,total){resourceProgress.set(url,{loaded,total});if(progress){const all=[...resourceProgress.values()];onProgress(all.reduce((n,r)=>n+r.loaded,0),all.reduce((n,r)=>n+r.total,0));}}
  try{
   const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error(`${url}: ${response.status}`);
   const total=Number(response.headers.get('Content-Length'))||0;resourceProgress.set(url,{loaded:0,total});
   // Some embedded/mobile fetch implementations expose arrayBuffer without a
   // readable response body. The outer room deadline still covers this branch.
   if(!response.body?.getReader){const buffer=await response.arrayBuffer();report(buffer.byteLength,total||buffer.byteLength);return buffer;}
   const reader=response.body.getReader(),chunks=[];let loaded=0;
   while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;report(loaded,total);}
   const joined=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}return joined.buffer;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 async function textureFrom(buffer){const blob=new Blob([buffer],{type:'image/webp'}),url=URL.createObjectURL(blob);try{const texture=await cancellable(new THREE.TextureLoader().loadAsync(url),texture=>texture.dispose());checkCancelled();texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return texture;}finally{URL.revokeObjectURL(url);}}
 // Restore the last approved native Blender panorama for every existing link.
 const metadataFile='room-info.json';
 onStage('room metadata');const panoramaInfo=JSON.parse(new TextDecoder().decode(await bytes(`./assets/${metadataFile}?v=21`,false)));
 checkCancelled();
 neutralPitch=pitch=targetPitch=(Number.isFinite(panoramaInfo.bedPitchDegrees)?panoramaInfo.bedPitchDegrees:-6)*DEG;
 const panoVariant=()=>{const desired=panoramaInfo.variants[quality==='desktop'?'desktop':memorySaving()&&panoramaInfo.variants.light?'light':mobileView.matches||memorySaving()?'mobile':'desktop'];return desired.width<=renderer.capabilities.maxTextureSize?desired:[...Object.values(panoramaInfo.variants)].filter(v=>v.width<=renderer.capabilities.maxTextureSize).sort((a,b)=>b.width-a.width)[0]||panoramaInfo.variants.mobile;};
 const panoURL=()=>`./assets/${panoVariant().file}?v=${panoramaInfo.version||4}`;
 const angularNotebook=panoramaInfo.hotspots?.notebook,angularGuitar=panoramaInfo.hotspots?.guitar;
 const bakedNotebook=Boolean(angularNotebook)||(panoramaInfo.bakedNotebook===true&&Array.isArray(panoramaInfo.notebookBoundsBlender));
 const expectedSizes=[[panoURL(),panoVariant().bytes],...(bakedNotebook?[]:[['./assets/notebook.glb',43768]]),...(angularGuitar?[]:[['./assets/guitar.glb',256488]])];
 for(const [url,total] of expectedSizes)resourceProgress.set(url,{loaded:0,total});
 onStage('room assets');const [panoBytes,notebookBytes,guitarBytes]=await Promise.all([bytes(panoURL()),bakedNotebook?Promise.resolve(null):bytes('./assets/notebook.glb'),angularGuitar?Promise.resolve(null):bytes('./assets/guitar.glb')]);
 checkCancelled();
 onStage('room image');const texture=await textureFrom(panoBytes),geometry=new THREE.SphereGeometry(40,80,40);geometry.scale(-1,1,1);
 // The low-detail sphere must not occlude the more finely tessellated detail
 // patches at their edges. Foreground props still write their own depth.
 pano=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,toneMapped:false,depthWrite:false}));pano.rotation.y=Math.PI*1.5;scene.add(pano);loadedAsset=panoURL();
 if(panoramaInfo.tiles)tiles=new PanoramaTiles({scene,camera,renderer,manifest:panoramaInfo.tiles,signal,invalidate,mobile:()=>mobileView.matches,light:memorySaving});
 function normalizeProp(gltf){const wrapper=new THREE.Group();wrapper.rotation.y=Math.PI;gltf.scene.position.sub(eye);wrapper.add(gltf.scene);scene.add(wrapper);return wrapper;}
 onStage('notebook');
 if(angularNotebook){
  notebook=createPanoramaHotspot(angularNotebook);scene.add(notebook);
  defs.find(d=>d.id==='notebook').anchor.copy(notebook.userData.panoramaAnchor);
 }else if(bakedNotebook){
  const bounds=panoramaInfo.notebookBoundsBlender,center=bounds.map(b=>(b[0]+b[1])/2),size=bounds.map(b=>b[1]-b[0]);
  notebook=new THREE.Mesh(new THREE.BoxGeometry(size[0]+.025,size[2]+.025,size[1]+.025),new THREE.MeshBasicMaterial({visible:false}));
  notebook.position.set(eye.x-center[0],center[2]-eye.y,center[1]+eye.z);scene.add(notebook);
  defs.find(d=>d.id==='notebook').anchor.copy(notebook.position).add(new THREE.Vector3(0,.065,0));
 }else{
 const ng=await cancellable(loader.parseAsync(notebookBytes,''),gltf=>disposeTree(gltf.scene));checkCancelled();
 // Attach each completed model before awaiting the next one so cancellation
 // also releases a prop that has already decoded.
 notebook=normalizeProp(ng);
 }
 onStage('guitar');
 notebook.userData.interaction='notebook';notebook.traverse(o=>{if(o.isMesh){o.userData.interaction='notebook';o.material.envMapIntensity=.65;}});targets.push(notebook);
 if(!bakedNotebook){
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,5,64,64,62);gradient.addColorStop(0,'rgba(20,34,24,.25)');gradient.addColorStop(.55,'rgba(20,34,24,.12)');gradient.addColorStop(1,'rgba(20,34,24,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 notebookShadow=new THREE.Mesh(new THREE.PlaneGeometry(.43,.44),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,toneMapped:false}));notebookShadow.rotation.x=-Math.PI/2;notebookShadow.position.set(-.193,-.63,-1.114);scene.add(notebookShadow);
 }
 if(angularGuitar){
  guitar=createPanoramaHotspot(angularGuitar);scene.add(guitar);
  defs.find(d=>d.id==='guitar').anchor.copy(guitar.userData.panoramaAnchor);
 }else{
  const gg=await cancellable(loader.parseAsync(guitarBytes,''),gltf=>disposeTree(gltf.scene));checkCancelled();guitar=normalizeProp(gg);
 }
 guitar.userData.interaction='guitar';guitar.traverse(o=>{if(o.isMesh){o.userData.interaction='guitar';const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m.visible=false;}});targets.push(guitar);
 // Only the notebook and guitar navigate. The window is part of the view, with no zoom/focus target.
 function look(){camera.position.set(0,0,0);camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld();}
 function markerPositions(){camera.updateMatrixWorld();for(const d of defs){const p=d.anchor.clone().project(camera),x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;const visible=interactive&&p.z>-1&&p.z<1&&Math.abs(p.x)<.96&&p.y>-.82&&p.y<.8&&clarity.at(x,y)>.65;d.element.hidden=!visible;if(visible){d.element.style.left=`${(p.x+1)*50}%`;d.element.style.top=`${(1-p.y)*50}%`;}}}
 function render(now){frame=null;if(disposed)return;const dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):1/60;lastFrame=now;
  if(transition){const f=Math.min(1,(now-transition.start)/transition.duration),s=f*f*(3-2*f);yaw=THREE.MathUtils.lerp(transition.fromYaw,transition.toYaw,s);if(mobileView.matches)pitch=THREE.MathUtils.lerp(transition.fromPitch??pitch,neutralPitch,s);camera.fov=THREE.MathUtils.lerp(transition.fromFov,transition.toFov,s);camera.updateProjectionMatrix();look();if(f===1)transition=null;dirty=true;}
  let easing=false;if(interactive&&!down&&!transition&&Math.abs(targetYaw-yaw)>.0001){yaw=THREE.MathUtils.lerp(yaw,targetYaw,1-Math.exp(-dt*6));if(Math.abs(targetYaw-yaw)<.0001)yaw=targetYaw;else easing=true;look();dirty=true;}
  if(interactive&&!down&&!transition&&Math.abs(targetPitch-pitch)>.0001){pitch=THREE.MathUtils.lerp(pitch,targetPitch,1-Math.exp(-dt*6));if(Math.abs(targetPitch-pitch)<.0001)pitch=targetPitch;else easing=true;look();dirty=true;}
  const tileAnimating=tiles?.update(now)===true;let focusing=false;if(focusStart&&clarity.active){const f=Math.min(1,(now-focusStart)/focusDuration);clarity.setFocus(1-f*f*(3-2*f));if(f>=1){focusStart=0;clarity.clear();onClarityChange(1);}else focusing=true;dirty=true;}if(tileAnimating)dirty=true;
  if(dirty){const t=performance.now();renderer.info.autoReset=false;renderer.info.reset();clarity.render(scene,camera);stats.renderMs.push(performance.now()-t);if(stats.renderMs.length>300)stats.renderMs.shift();stats.renderedFrames++;stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;stats.textureCount=renderer.info.memory.textures;markerPositions();dirty=false;}if(transition||easing||tileAnimating||focusing)invalidate();}
 function invalidate(){dirty=true;if(!frame&&!disposed)frame=requestAnimationFrame(render);}
 function setYaw(value){yaw=targetYaw=THREE.MathUtils.clamp(value,-lookLimit(),lookLimit());transition=null;look();invalidate();}
 function setMobileLook(y,p,{immediate=false,automatic=false}={}){if(!mobileView.matches||![y,p].every(Number.isFinite)||automatic&&(!interactive||reducedMotion||down))return false;transition=null;targetYaw=THREE.MathUtils.clamp(y*DEG,-MOBILE_LIMIT,MOBILE_LIMIT);targetPitch=neutralPitch+THREE.MathUtils.clamp(p,-MOTION.pitchLimit,MOTION.pitchLimit)*DEG;if(!automatic)controlRevision++;if(immediate){yaw=targetYaw;pitch=targetPitch;look();}invalidate();return true;}
 function setLookOffset(value,options={}){return setMobileLook(value,(targetPitch-neutralPitch)/DEG,options);}
 function holdCamera(){targetYaw=yaw;targetPitch=pitch;transition=null;}
 function reportClaritySoon(){if(clarityReportTimer)return;clarityReportTimer=setTimeout(()=>{clarityReportTimer=null;if(disposed)return;onClarityChange(clarity.measure());invalidate();},120);}
 function pointerParallax(x){if(reducedMotion||mobileView.matches)return;const normalized=THREE.MathUtils.clamp(x/innerWidth*2-1,-1,1),edge=Math.max(0,Math.abs(normalized)-.28)/.72;targetYaw=-Math.sign(normalized)*edge*DESKTOP_LIMIT;invalidate();}
 function hit(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(targets,true);for(const hit of hits){let o=hit.object;while(o){const id=o.userData.interaction;if(id)return {id:id==='music'?'guitar':id==='chapter'?'notebook':id,object:hit.object};o=o.parent;}}return null;}
 function pointerDown(e){if(!interactive||e.button>0)return;canvas.focus({preventScroll:true});holdCamera();const selection=clarity.at(e.clientX,e.clientY)>.65?hit(e)?.id:null;down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,touch:e.pointerType==='touch',moved:false,selection};canvas.setPointerCapture(e.pointerId);}
 function pointerMove(e){
  if(!interactive)return;
  if(down){const from={x:down.lastX,y:down.lastY};if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)down.moved=true;if(down.moved){if(down.touch&&mobileView.matches){setMobileLook(targetYaw/DEG+(e.clientX-down.lastX)*.12,(targetPitch-neutralPitch)/DEG-(e.clientY-down.lastY)*.10);down.selection=null;}clarity.brush(from,{x:e.clientX,y:e.clientY});reportClaritySoon();invalidate();}down.lastX=e.clientX;down.lastY=e.clientY;mouseTrail=null;return;}
  if(e.pointerType==='mouse'&&e.buttons===0){
   const current={x:e.clientX,y:e.clientY};
   if(clarity.active){clarity.brush(mouseTrail||current,current);reportClaritySoon();invalidate();}
   mouseTrail=current;
  }
  const result=clarity.at(e.clientX,e.clientY)>.65?hit(e):null;hoverID=result?.id;
  if(hoverID)holdCamera();else if(e.pointerType==='mouse')pointerParallax(e.clientX);
  canvas.style.cursor=hoverID?'pointer':clarity.active?'crosshair':'default';for(const d of defs)d.element.classList.toggle('reveal',d.id===hoverID);
 }
 function pointerUp(e){
  if(down&&!down.moved&&interactive&&clarity.at(e.clientX,e.clientY)>.65){const selection=down.selection||hit(e)?.id;if(selection)onSelect(selection);}
  if(down?.moved){onClarityChange(clarity.measure());invalidate();}down=null;mouseTrail=null;
  if(interactive){const result=clarity.at(e.clientX,e.clientY)>.65?hit(e):null;hoverID=result?.id;if(hoverID)holdCamera();else if(e.pointerType==='mouse')pointerParallax(e.clientX);}
 }
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',()=>down=null);canvas.addEventListener('lostpointercapture',()=>down=null);
 // The overlay labels share this scene. Leaving the canvas for one must not recenter it.
 canvas.addEventListener('pointerleave',()=>{mouseTrail=null;});
 canvas.addEventListener('keydown',e=>{if(!interactive)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setYaw(yaw+(e.key==='ArrowLeft'?1:-1)*2*DEG);}if(e.key==='Home'){e.preventDefault();api.reset(true);}if(e.code==='Space'&&clarity.active){e.preventDefault();api.clearView();}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(disposed)return;stats.failures.push('WebGL context lost');onFailure('WebGL context lost');});
 function resize(){if(innerWidth<1||innerHeight<1)return;renderer.setPixelRatio(pixelRatio());renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;if(!mobileView.matches)pitch=targetPitch=neutralPitch;camera.updateProjectionMatrix();yaw=THREE.MathUtils.clamp(yaw,-lookLimit(),lookLimit());targetYaw=THREE.MathUtils.clamp(targetYaw,-lookLimit(),lookLimit());look();clarity.resize();invalidate();}
 addEventListener('resize',resize);removeResize=()=>removeEventListener('resize',resize);look();invalidate();
 const api={stats,setYaw,setLookOffset,setMobileLook,holdView:holdCamera,snapshot:()=>({yaw,targetYaw,hoverTarget:hoverID||null,pitch,targetPitch,neutralPitch,controlRevision,dragging:Boolean(down),mode:'rendered',bakedNotebook,notebookProxy:bakedNotebook&&notebook?.isMesh===true,fov:camera.fov,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),blurred:clarity.active,revealProgress:clarity.progress,parallaxLimitDegrees:mobileView.matches?MOTION.yawLimit:10}),
  displayInfo:()=>({viewport:[innerWidth,innerHeight],devicePixelRatio,renderPixelRatio:renderer.getPixelRatio(),buffer:renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(),image:[pano.material.map.image.width,pano.material.map.image.height],asset:loadedAsset,visual:panoramaInfo.visual||'blender',tiles:tiles?.snapshot()||null,blurStrength:clarity.active?clarity.strength:0,maxTextureSize:renderer.capabilities.maxTextureSize,verticalFov:camera.fov,horizontalFov:2*Math.atan(Math.tan(camera.fov*DEG/2)*camera.aspect)/DEG}),
  setInteractive(value){interactive=value;holdCamera();mouseTrail=null;canvas.tabIndex=value?0:-1;markerPositions();},
  setReducedMotion(value){reducedMotion=value;targetYaw=yaw;},
  recoverFocus(duration=3200){focusStart=performance.now();focusDuration=duration;invalidate();},
  resetClarity(){focusStart=0;mouseTrail=null;clarity.reset();onClarityChange(0);invalidate();},
  clearView(){focusStart=0;clarity.clear();onClarityChange(1);invalidate();},
  setExposure(value){if(pano)pano.material.color.setScalar(value);tiles?.setExposure(value);invalidate();},
  reset(immediate=false){targetYaw=0;targetPitch=neutralPitch;controlRevision++;if(immediate)pitch=neutralPitch;if(immediate){camera.fov=67;camera.updateProjectionMatrix();setYaw(0);}else{transition={fromYaw:yaw,fromPitch:pitch,toYaw:0,fromFov:camera.fov,toFov:67,start:performance.now(),duration:650};invalidate();}},
  revealObjects(ms=5000){for(const d of defs)d.element.classList.add('reveal');setTimeout(()=>{for(const d of defs)d.element.classList.remove('reveal');},ms);},
  async setQuality(value){
   const revision=++qualityRevision;quality=value;const url=panoURL();
   try{
    const b=await bytes(url,false),t=await textureFrom(b);
    if(disposed||revision!==qualityRevision){t.dispose();return;}
    const old=pano.material.map;pano.material.map=t;loadedAsset=url;committedQuality=value;old.dispose();tiles?.setQuality();resize();
   }catch(error){if(!disposed&&revision===qualityRevision){quality=committedQuality;tiles?.setQuality();resize();}throw error;}
  },
  dispose:cleanup
 };return api;
 }catch(error){cleanup();throw error;}
}
