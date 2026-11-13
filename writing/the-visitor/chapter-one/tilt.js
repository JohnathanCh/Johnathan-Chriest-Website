import {Euler,Quaternion,Vector3} from 'three';
import {MOTION} from './motion-config.js?v=16';
export const MOBILE_QUERY='(max-width:700px), (pointer:coarse) and (max-width:1100px)';
const D=Math.PI/180,clamp=(v,n)=>Math.max(-n,Math.min(n,v));
// Device Z-X-Y rotations mapped to a camera looking through the phone's back.
export function orientationQuaternion(event,screenDegrees=0){
 if(![event.alpha,event.beta,event.gamma].every(Number.isFinite))return null;
 return new Quaternion().setFromEuler(new Euler(event.beta*D,event.alpha*D,-event.gamma*D,'YXZ'))
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2))
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-screenDegrees*D));
}
export function relativeLook(reference,current){
 const forward=new Vector3(0,0,-1).applyQuaternion(reference.clone().invert().multiply(current));
 return {yaw:Math.atan2(-forward.x,-forward.z)/D,pitch:Math.atan2(forward.y,Math.hypot(forward.x,forward.z))/D};
}
export function initTilt({getRoom,isExploring=()=>true,isReduced=()=>false,onStatus=()=>{},onNavigate=()=>{},onModeChange=()=>{}}){
 const media=matchMedia(MOBILE_QUERY),controls=document.createElement('div');controls.className='tilt-controls';
 controls.innerHTML='<button type="button" id="tilt-enable" aria-pressed="false">Enable motion</button><button type="button" id="tilt-recenter">Recenter view</button><button type="button" id="tilt-use-arrows" aria-pressed="true">Use arrows</button><div class="tilt-directions"><button type="button" id="look-left">← Look left</button><button type="button" id="look-right">Look right →</button><button type="button" id="look-up">↑ Look up</button><button type="button" id="look-down">Look down ↓</button></div><p id="tilt-status" role="status"></p><a id="motion-setup-link" href="./motion-setup.html" hidden>Set up phone motion ↗</a>';
 document.getElementById('room-nav').append(controls);
 const button=controls.querySelector('#tilt-enable'),status=controls.querySelector('#tilt-status');
 let enabled=false,pending=false,disposed=false,received=false,reference=null,filtered=null,lastRaw=null,lastTime=0,lastAngle=null,revision=null,needsRebase=true,base={yaw:0,pitch:0},timer,permissionTimer,requestId=0,reason='';
 const isPhone=()=>media.matches&&(matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0);
 const angle=()=>Number(screen.orientation?.angle??window.orientation??0)||0;
 const blocked=()=>document.hidden||!isPhone()||!isExploring()||isReduced()||Boolean(document.querySelector('dialog[open]'))||document.body.dataset.mobileMenu==='open'||getRoom()?.snapshot().dragging;
 function say(message){reason=message;if(status.textContent!==message){status.textContent=message;onStatus(message);}}
 function refresh(){
  if(blocked())needsRebase=true;
  controls.hidden=!isPhone();controls.querySelector('#motion-setup-link').hidden=isSecureContext;button.disabled=pending||isReduced()||!getRoom();controls.querySelector('#tilt-use-arrows').setAttribute('aria-pressed',String(!enabled));
  button.textContent=pending?'Requesting motion…':enabled?'Disable motion':'Enable motion';button.setAttribute('aria-pressed',String(enabled));
  if(isReduced())say('Motion is paused with reduced motion. Drag the room or use the arrows.');
  else if(!isSecureContext)say('Motion needs trusted HTTPS. Swipe to look around, or use the arrows.');
  else if(typeof DeviceOrientationEvent==='undefined')say('Motion sensors are unavailable. Swipe to look around, or use the arrows.');
  else if(!reason)say('Enable motion while holding your phone comfortably. You can also drag to look.');
 }
 function stop(message='Motion off. Swipe to look around, or use the arrows. Tap Centre to return.'){
  requestId++;enabled=false;pending=false;received=false;reference=null;filtered=null;lastRaw=null;lastTime=0;needsRebase=true;clearTimeout(timer);clearTimeout(permissionTimer);
  removeEventListener('deviceorientation',orientation);getRoom()?.holdView();onModeChange('arrows');say(message);refresh();
 }
 function armTimeout(){clearTimeout(timer);timer=setTimeout(()=>{if(enabled&&!received)stop('No usable motion readings arrived. Drag to look, or try Enable motion again.');},MOTION.noEventMs);}
 function orientation(event){
  if(!enabled||disposed)return;
  const screenDegrees=angle(),q=orientationQuaternion(event,screenDegrees);if(!q)return;
  const now=performance.now(),gap=lastTime?(now-lastTime)/1000:0;
  received=true;clearTimeout(timer);
  if(blocked()){needsRebase=true;lastRaw=q;lastTime=now;return;}
  const view=getRoom()?.snapshot();if(!view)return;
  if(!reference||needsRebase||lastAngle!==screenDegrees||revision!==view.controlRevision||gap>MOTION.staleSeconds){
   reference=q.clone();filtered=q.clone();base={yaw:view.targetYaw/D,pitch:(view.targetPitch-view.neutralPitch)/D};needsRebase=false;lastAngle=screenDegrees;revision=view.controlRevision;
  }else{
   // Reject an isolated implausible heading jump; sustained discontinuity rebases
   // at the existing view instead of yanking it toward a new compass heading.
   if(lastRaw&&q.angleTo(lastRaw)>Math.PI/2&&gap<.2){needsRebase=true;lastRaw=q;lastTime=now;return;}
   filtered.slerp(q,1-Math.exp(-Math.max(.001,gap)/MOTION.filterSeconds));
  }
  lastRaw=q;lastTime=now;
  const delta=relativeLook(reference,filtered),soft=v=>Math.sign(v)*Math.max(0,Math.abs(v)-MOTION.deadZone)*MOTION.sensitivity;
  getRoom().setMobileLook(clamp(base.yaw+soft(delta.yaw),MOTION.yawLimit),clamp(base.pitch+soft(delta.pitch),MOTION.pitchLimit),{automatic:true});
  say('Turn or tilt your phone to look around. You can also swipe.');
 }
 async function enable(){
  if(disposed||!isPhone())return false;
  if(enabled){stop();return false;}if(pending||isReduced())return false;
  if(!isSecureContext){say('Use the trusted HTTPS preview for motion. Drag viewing works on this address.');return false;}
  const Orientation=window.DeviceOrientationEvent;if(!Orientation){say('Motion sensors are unavailable. Drag to look around.');return false;}
  pending=true;reason='';refresh();const id=++requestId;
  try{
   // The permission call is synchronous with the explicit button tap.
   const request=typeof Orientation.requestPermission==='function'?Orientation.requestPermission():'granted';
   const permission=await Promise.race([Promise.resolve(request),new Promise((_,reject)=>{permissionTimer=setTimeout(()=>reject(Error('Permission request timed out')),MOTION.permissionTimeoutMs);})]);
   clearTimeout(permissionTimer);if(disposed||id!==requestId)return false;
   if(permission!=='granted'){pending=false;say('Motion permission was denied. Drag to look, or allow motion for this site in your browser settings and retry.');refresh();return false;}
   pending=false;enabled=true;onModeChange('motion');received=false;reference=null;filtered=null;lastTime=0;lastRaw=null;needsRebase=true;
   removeEventListener('deviceorientation',orientation);addEventListener('deviceorientation',orientation,{passive:true});
   say('Hold this comfortable angle as forward. Turn or tilt after closing the menu.');refresh();onNavigate();armTimeout();return true;
  }catch(error){clearTimeout(permissionTimer);if(id!==requestId||disposed)return false;pending=false;say('Motion access could not start. Drag to look, or retry Enable motion.');refresh();return false;}
 }
 function rebase(){needsRebase=true;lastTime=0;lastAngle=null;getRoom()?.holdView();}
 function recenter(){reference=null;filtered=null;needsRebase=true;getRoom()?.setMobileLook(0,0,{immediate:isReduced()});say('View recentered. Hold this angle as your forward view.');onNavigate();}
 function nudge(y,p){const room=getRoom();if(!room)return;const view=room.snapshot();room.setMobileLook(view.targetYaw/D+y,(view.targetPitch-view.neutralPitch)/D+p,{immediate:isReduced()});needsRebase=true;onNavigate();}
 const changed=()=>{if(!media.matches)stop();refresh();};
 const pageHide=()=>{rebase();clearTimeout(timer);},pageShow=()=>{rebase();if(enabled&&!received)armTimeout();};
 button.addEventListener('click',enable);controls.querySelector('#tilt-use-arrows').addEventListener('click',()=>{stop();onNavigate();});controls.querySelector('#tilt-recenter').addEventListener('click',recenter);
 for(const [id,y,p] of [['look-left',12,0],['look-right',-12,0],['look-up',0,10],['look-down',0,-10]])controls.querySelector('#'+id).addEventListener('click',()=>nudge(y,p));
 document.addEventListener('visibilitychange',rebase);addEventListener('orientationchange',rebase);screen.orientation?.addEventListener('change',rebase);addEventListener('pagehide',pageHide);addEventListener('pageshow',pageShow);media.addEventListener('change',changed);refresh();
 return {enable,disable:stop,recenter,nudge,refresh,snapshot:()=>({enabled,pending,received,neutral:reference?.toArray()||null,screenAngle:angle(),status:status.textContent}),dispose(){disposed=true;stop();document.removeEventListener('visibilitychange',rebase);removeEventListener('orientationchange',rebase);screen.orientation?.removeEventListener('change',rebase);removeEventListener('pagehide',pageHide);removeEventListener('pageshow',pageShow);media.removeEventListener('change',changed);controls.remove();}};
}
