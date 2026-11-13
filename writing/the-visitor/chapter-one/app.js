import {initMobileUI,MOBILE_QUERY} from './mobile-ui.js?v=8';
import {initTilt} from './tilt.js?v=21';
if(!window.visitorStartupTimedOut){
// The story shell stays independent of WebGL so text and audio survive renderer failures.
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const restoredURL=new URL(location.href);restoredURL.searchParams.set('visual','blender');restoredURL.searchParams.set('v','21');history.replaceState(null,'',restoredURL);
const state={phase:'arrival',muted:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,quality:'auto',mode:'rendered',fallback:false,ready:false,clarity:1};
const music=$('music');music.volume=.45;music.muted=true;
const openingFilm=$('opening-film');openingFilm.muted=true;

const ROOM_LOADING_LIMIT_MS=30000;
let room,openingFrame,openingStarted,returnFocus,localAudioURL,loadController;
let playerActivated=false;
let audioPlaying=false,audioWaiting=false,audioFailed=false,hasPlayed=false;
let filmReady=false,filmMode='idle',filmWatchdog;
const mobileUI=initMobileUI();
let tilt,viewControl='arrows';
function syncViewChoice(){const mobile=mobileUI.media.matches;$('mobile-view-choice').hidden=!mobile;$('mobile-look').hidden=!mobile||viewControl!=='arrows'||state.phase!=='exploring'||state.fallback;$('arrival-motion').disabled=!state.ready||!room||state.reduced||Boolean(tilt?.snapshot().pending);$('arrival-motion').textContent=viewControl==='motion'?'Disable motion':'Enable motion';$('arrival-motion').setAttribute('aria-pressed',String(viewControl==='motion'));$('arrival-arrows').setAttribute('aria-pressed',String(viewControl==='arrows'));$('arrival-motion-setup').hidden=isSecureContext;refreshPlayerDisplay();}
function compactMobile(){return mobileUI.media.matches&&viewControl==='arrows';}
function refreshPlayerDisplay(){$('music-player').hidden=state.phase!=='exploring'||(!playerActivated&&!compactMobile());$('player-toggle').setAttribute('aria-label',`${music.paused||music.ended?'Play':'Pause'} ${$('track-title').textContent}${compactMobile()?' and open music details':''}`);}
function chooseView(mode){viewControl=mode;document.body.dataset.viewControl=mode;syncViewChoice();}
mobileUI.media.addEventListener('change',syncViewChoice);
$('arrival-motion').onclick=async()=>{const request=tilt.enable();syncViewChoice();await request;syncViewChoice();};
$('arrival-arrows').onclick=()=>tilt.disable('Motion off. Swipe to look around, or use the arrows. Tap Centre to return.');
$('view-left').onclick=()=>tilt.nudge(12,0);$('view-right').onclick=()=>tilt.nudge(-12,0);$('view-center').onclick=()=>tilt.recenter();
tilt=initTilt({getRoom:()=>room,isExploring:()=>state.phase==='exploring',isReduced:()=>state.reduced,onNavigate:()=>mobileUI.closeMenu(),onModeChange:chooseView,onStatus:message=>{$('arrival-motion-status').textContent=message;if(state.phase==='exploring')clarityChanged(state.clarity);}});
const stats={started:performance.now(),essentialBytes:0,essentialMs:null,errors:[]};
window.visitorDebug={state,stats,get room(){return room;},get tilt(){return tilt;},get openingFilm(){return {ready:filmReady,mode:filmMode,time:openingFilm.currentTime,duration:openingFilm.duration,paused:openingFilm.paused};},snapshot:()=>room?.snapshot()};
addEventListener('visitor-startup-timeout',()=>{loadController?.abort();stopOpeningFilm();room?.dispose();room=undefined;state.ready=false;});

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5500);}
function reduced(value){state.reduced=value;$('reduced-motion').checked=value;document.body.classList.toggle('reduce-motion',value);room?.setReducedMotion(value);tilt?.refresh();syncViewChoice();}
function clarityChanged(progress){state.clarity=progress;if(state.phase!=='exploring')return;$('clear-view').hidden=progress>=1||state.fallback;$('orientation-hint').hidden=state.fallback;$('orientation-hint').style.opacity='1';const mobile=matchMedia(MOBILE_QUERY).matches;$('orientation-hint').textContent=progress<1?'Let your eyes adjust…':mobile?(tilt?.snapshot().enabled?'Turn or tilt your phone to look around':viewControl==='arrows'?'Swipe or use the arrows to look around · Tap Centre to return':'Enable motion in the menu, or drag to look around'):'Move toward either edge for a small glance';if(progress>=1){clearTimeout(clarityChanged.timer);clarityChanged.timer=setTimeout(()=>$('orientation-hint').style.opacity='0',6500);}}
reduced(state.reduced);chooseView('arrows');
function enterFallback(message){state.fallback=true;syncViewChoice();$('fallback-note').hidden=state.phase!=='exploring';$('canvas-host').hidden=true;$('poster').hidden=false;$('markers').hidden=true;$('quality').disabled=true;if(message)stats.errors.push(message);}
function renderChapter(data){const article=$('chapter-text');article.replaceChildren();for(const [i,text] of data.paragraphs.entries()){const p=document.createElement('p');p.textContent=text;article.append(p);if(i<data.paragraphs.length-1){const d=document.createElement('div');d.className='scene-break';d.textContent='#';d.setAttribute('aria-hidden','true');article.append(d);}}}
async function loadChapter(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch('./assets/chapter.json',{signal:controller.signal});if(!response.ok)throw new Error('Chapter file not found');renderChapter(await response.json());}catch(e){stats.errors.push(e.message);$('chapter-text').replaceChildren();const p=document.createElement('p');p.textContent='The chapter text could not load. The original PDF is available above.';const retry=document.createElement('button');retry.textContent='Retry chapter';retry.onclick=loadChapter;$('chapter-text').append(p,retry);}finally{clearTimeout(timer);}}
function withinRoomDeadline(work,deadline,signal,stage){
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(callback,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);callback(value);};
  const abort=()=>finish(reject,new DOMException('Loading cancelled','AbortError'));
  const timer=setTimeout(()=>{const error=new Error(`The room took too long to load (${stage()}). The simple view is ready.`);error.name='TimeoutError';finish(reject,error);},Math.max(1,deadline-performance.now()));
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  Promise.resolve(work).then(value=>finish(resolve,value),error=>finish(reject,error));
 });
}
function stopOpeningFilm(){filmMode='idle';clearTimeout(filmWatchdog);openingFilm.pause();$('opening-film-layer').hidden=true;}
function waitForPreviewSize(signal){
 if(innerWidth>0&&innerHeight>0)return Promise.resolve();
 $('load-detail').textContent='Waiting for the preview window…';
 window.visitorPreviewReport?.('waiting-for-viewport',{stage:'viewport',message:'The preview has not received a visible size yet.'});
 return new Promise((resolve,reject)=>{
  let timer;
  function cleanup(){clearTimeout(timer);removeEventListener('resize',check);document.removeEventListener('visibilitychange',check);signal.removeEventListener('abort',abort);}
  function abort(){cleanup();reject(new DOMException('Loading cancelled','AbortError'));}
  function check(){clearTimeout(timer);if(signal.aborted){abort();return;}if(innerWidth>0&&innerHeight>0){cleanup();resolve();}else timer=setTimeout(check,200);}
  addEventListener('resize',check);document.addEventListener('visibilitychange',check);signal.addEventListener('abort',abort,{once:true});check();
 });
}
async function prepare(){
 let acceptingProgress=true,stage='chapter',roomFailed=false,disposedCandidate;
 const retireCandidate=candidate=>{if(candidate&&candidate!==disposedCandidate){disposedCandidate=candidate;candidate.dispose();}};
 
 loadController?.abort();const controller=new AbortController();loadController=controller;state.ready=false;$('load-error').hidden=true;$('awaken').disabled=true;$('load-progress').removeAttribute('value');$('load-detail').textContent='Loading room viewer…';
 const deadline=performance.now()+ROOM_LOADING_LIMIT_MS;
 const bounded=work=>withinRoomDeadline(work,deadline,controller.signal,()=>stage);
 // Chapter text and its PDF escape remain independent of the graphics loader.
 loadChapter();
 try{
  if(controller.signal.aborted)return;
  if(params.has('fallback'))throw new Error('Simple view requested');
  stage='viewer';const module=await bounded(import('./room.js?v=21'));
  if(controller.signal.aborted)return;
  stage='viewport';await bounded(waitForPreviewSize(controller.signal));
  if(controller.signal.aborted)return;
  room?.dispose();room=undefined;stage='room';
  const roomCreation=module.createRoom({host:$('canvas-host'),markers:$('markers'),quality:state.quality,signal:controller.signal,onStage:value=>{stage=value;},onProgress:(loaded,total)=>{if(!acceptingProgress||controller.signal.aborted)return;stats.essentialBytes=loaded;$('load-progress').value=total?loaded/total*100:0;$('load-detail').textContent=total?`Preparing room · ${Math.round(loaded/total*100)}%`:'Preparing room…';},onSelect:selectObject,onClarityChange:clarityChanged,onFailure:message=>{if(controller.signal.aborted)return;window.visitorPreviewReport?.('room-failed',{stage:'graphics',message});enterFallback(message);toast('The still room is available. You can continue reading and listening.');}});
  // An image decoder or model parser may finish after its deadline; retire that
  // late renderer rather than letting it replace the already available fallback.
  roomCreation.then(candidate=>{if(controller.signal.aborted)retireCandidate(candidate);},()=>{});
  const loadedRoom=await bounded(roomCreation);
  if(controller.signal.aborted){retireCandidate(loadedRoom);return;}
  room=loadedRoom;stage='controls';
  room.setReducedMotion(state.reduced);
  tilt.refresh();
  state.fallback=false;state.mode='rendered';$('canvas-host').hidden=false;$('poster').hidden=true;$('markers').hidden=false;$('fallback-note').hidden=true;$('quality').disabled=false;
  stats.essentialMs=Math.round(performance.now()-stats.started);
  window.visitorPreviewReport?.('room-ready',{stage:'complete',message:`Room loaded in ${stats.essentialMs} ms.`});
 }catch(e){acceptingProgress=false;if(controller.signal.aborted)return;roomFailed=true;controller.abort();retireCandidate(room);room=undefined;stats.lastRoomError={stage,name:e.name,message:e.message};window.visitorPreviewReport?.('room-failed',{...stats.lastRoomError,stack:e.stack});enterFallback(e.message);if(!params.has('fallback')){$('room-error-detail').textContent=`${stage}: ${e.name}: ${e.message}`;$('load-error').hidden=false;$('load-detail').textContent='Room unavailable · simple view ready';if(params.get('diagnostics')==='1')$('room-error-detail').parentElement.open=true;}}
 acceptingProgress=false;

 if(loadController!==controller||controller.signal.aborted&&!roomFailed)return;
 state.ready=true;$('awaken').disabled=false;$('awaken').firstElementChild.textContent='Awaken';$('load-progress').value=100;$('load-detail').textContent=state.fallback?(params.has('fallback')?'Simple view ready':'Room unavailable · simple view ready'):'The room is ready';
 document.documentElement.dataset.visitorReady='true';syncViewChoice();
}
function setSound(on){state.muted=!on;music.muted=!on;$('sound-toggle').textContent=on?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(on));$('mute').textContent=on?'Mute':'Muted';$('mute').setAttribute('aria-pressed',String(!on));syncPlay();}
function activatePlayer(){playerActivated=true;document.body.dataset.playerActive='true';refreshPlayerDisplay();}
async function playMusic(){activatePlayer();audioFailed=false;setSound(true);try{await music.play();$('audio-status').textContent='Playing · '+$('track-title').textContent;}catch(e){audioWaiting=false;audioFailed=true;syncPlay();$('audio-status').textContent='Audio could not play. Retry, or choose a local audio file below.';toast('Audio could not play. Tap the song title for audio options.');stats.errors.push(e.message);}}
function syncPlay(){
 const active=!music.paused&&!music.ended;
 const audible=active&&audioPlaying&&!audioWaiting&&!audioFailed&&!music.muted&&music.volume>0;
 const title=$('track-title').textContent;
 const status=audioFailed?'Unable to play':music.ended?'Finished':active&&audioWaiting?'Loading…':active&&(music.muted||music.volume===0)?'Muted':audible?'Playing':active?'Loading…':hasPlayed?'Paused':'Ready to play';
 $('play').innerHTML=active?'Pause <span aria-hidden="true">Ⅱ</span>':'Play <span aria-hidden="true">▶</span>';
 $('play').setAttribute('aria-label',active?'Pause music':'Play music');
 $('player-toggle').setAttribute('aria-label',`${active?'Pause':'Play'} ${title}${compactMobile()?' and open music details':''}`);
 $('player-toggle').querySelector('.player-play').toggleAttribute('hidden',active);
 $('player-toggle').querySelector('.player-pause').toggleAttribute('hidden',!active);
 $('player-title').textContent=title;
 $('player-details').setAttribute('aria-label',`${title} — open music options`);
 $('player-status').textContent=status;
 $('music-player').dataset.status=audible?'playing':audioFailed?'error':active&&audioWaiting?'loading':'paused';
 document.body.classList.toggle('music-playing',audible);
}
function formatTime(n){return `${Math.floor((n||0)/60)}:${String(Math.floor((n||0)%60)).padStart(2,'0')}`;}
music.addEventListener('play',()=>{hasPlayed=true;audioFailed=false;audioWaiting=music.readyState<3;syncPlay();});
music.addEventListener('playing',()=>{audioPlaying=true;audioWaiting=false;syncPlay();});
music.addEventListener('waiting',()=>{audioWaiting=true;syncPlay();});
music.addEventListener('pause',()=>{audioPlaying=false;audioWaiting=false;syncPlay();});
music.addEventListener('volumechange',syncPlay);
music.addEventListener('emptied',()=>{audioPlaying=false;audioWaiting=false;audioFailed=false;hasPlayed=false;syncPlay();});
music.addEventListener('ended',()=>{audioPlaying=false;audioWaiting=false;$('audio-status').textContent='The track has finished.';syncPlay();});
function syncPosition(){
 const duration=Number.isFinite(music.duration)?music.duration:0;
 const time=music.currentTime||0,label=`${formatTime(time)} / ${formatTime(duration)}`;
 for(const id of ['seek','player-seek']){const input=$(id);input.disabled=duration<=0;input.max=duration||1;input.value=time;input.setAttribute('aria-valuetext',label);}
 $('track-time').textContent=label;$('player-time').textContent=label;
}
for(const event of ['loadedmetadata','durationchange','timeupdate','seeked','emptied'])music.addEventListener(event,syncPosition);
music.addEventListener('error',()=>{audioPlaying=false;audioWaiting=false;audioFailed=true;syncPlay();$('audio-status').textContent='The audio file is unavailable. Retry Play, or choose a file below.';stats.errors.push('Audio unavailable');});
$('play').onclick=()=>music.paused?playMusic():music.pause();
function toggleMusic(){activatePlayer();if(music.paused)playMusic();else music.pause();}
$('player-toggle').onclick=()=>{toggleMusic();if(compactMobile())openPanel('listen');};
$('player-details').onclick=()=>openPanel('listen');
function showPlayer(){if(state.phase!=='exploring')return;activatePlayer();$('player-toggle').focus({preventScroll:true});$('music-player').classList.add('player-attention');clearTimeout(showPlayer.timer);showPlayer.timer=setTimeout(()=>$('music-player').classList.remove('player-attention'),2200);}
$('show-player').onclick=()=>{if(music.paused)playMusic();activatePlayer();openPanel('listen');};
for(const id of ['seek','player-seek'])$(id).oninput=e=>{if(Number.isFinite(music.duration)){music.currentTime=Number(e.target.value);syncPosition();}};
syncPosition();
$('volume').oninput=e=>{music.volume=Number(e.target.value);setSound(music.volume>0);};
$('mute').onclick=() =>setSound(state.muted);
$('sound-toggle').onclick=()=>{setSound(state.muted);if(!state.muted&&music.paused)playMusic();};
$('local-audio').onchange=e=>{const file=e.target.files[0];if(!file)return;music.pause();if(localAudioURL)URL.revokeObjectURL(localAudioURL);localAudioURL=URL.createObjectURL(file);music.src=localAudioURL;$('track-title').textContent=file.name;$('track-credit').textContent='Local audio · only on this device';$('track-description').textContent='Your selected audio plays only on this device. Listen alongside the room or Chapter One, and use the controls below to find your place.';syncPlay();playMusic();};
syncPlay();

function setEyelidOpening(value){const open=Math.max(0,Math.min(1,value));$('eyelids').style.setProperty('--open',open);for(const [i,lid] of [...$('eyelids').children].entries())lid.style.transform=`translate3d(0,${(i===0?-1:1)*open*100}%,0)`;}
function finishOpening({clear=false}={}){cancelAnimationFrame(openingFrame);stopOpeningFilm();state.phase='exploring';document.body.dataset.phase='exploring';setEyelidOpening(1);$('eyelids').style.opacity=0;$('canvas-host').style.filter='none';$('skip-intro').hidden=true;$('room-header').hidden=false;$('room-nav').hidden=false;refreshPlayerDisplay();$('fallback-note').hidden=!state.fallback;mobileUI.refresh();tilt.refresh();syncViewChoice();room?.setInteractive(true);room?.setExposure(1);if(clear||state.fallback)room?.clearView();else room?.recoverFocus(3200);clarityChanged(clear||state.fallback?1:state.clarity);$('title-home').focus({preventScroll:true});}
function beginOpening(replay=false){
 if(!state.ready)return;
 cancelAnimationFrame(openingFrame);stopOpeningFilm();
 state.phase='awakening';mobileUI.closeMenu();tilt.refresh();syncViewChoice();
 for(const d of document.querySelectorAll('dialog[open]'))d.close();
 $('startup-black').hidden=true;$('arrival').hidden=true;
 for(const id of ['room-header','room-nav','music-player','fallback-note','orientation-hint','clear-view'])$(id).hidden=true;
 clearTimeout(clarityChanged.timer);room?.reset(true);room?.setInteractive(false);room?.resetClarity();
 if(state.reduced||state.fallback){finishOpening({clear:true});return;}
 document.body.dataset.phase=state.phase;$('skip-intro').hidden=false;$('eyelids').style.opacity=1;setEyelidOpening(0);openingStarted=performance.now();
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 const blinks=[[0,0],[.9,.18],[1.6,0],[3,.5],[3.6,0],[6.2,1]];
 function frame(now){const t=Math.max(0,(now-openingStarted)/1000-1);let open=1;
  for(let i=1;i<blinks.length;i++){const [end,value]=blinks[i],[start,from]=blinks[i-1];if(t<=end){open=from+(value-from)*smooth((t-start)/(end-start));break;}}
  setEyelidOpening(open);room?.setExposure(.85+.15*smooth(t/6.2));
  if(t>=6.2){finishOpening();return;}openingFrame=requestAnimationFrame(frame);
 }openingFrame=requestAnimationFrame(frame);
}
$('awaken').onclick=()=>beginOpening();$('skip-intro').onclick=()=>finishOpening({clear:true});$('clear-view').onclick=()=>{room?.clearView();room?.revealObjects(3000);};$('retry').onclick=prepare;$('use-fallback').onclick=()=>{enterFallback();$('load-error').hidden=true;$('load-detail').textContent='Simple view ready';};$('retry-3d').onclick=async()=>{await prepare();if(state.phase==='exploring'){room?.setInteractive(true);clarityChanged(1);}};
$('reload-preview').onclick=()=>location.reload();
function openPanel(id){const panel=$(id);if(!panel)return;const active=document.activeElement;if(!active?.closest('dialog'))returnFocus=active;mobileUI.closeMenu();for(const d of document.querySelectorAll('dialog[open]'))if(d!==panel)d.close();room?.setInteractive(false);panel.showModal();tilt.refresh();}
function closePanel(dialog){dialog.close();room?.setInteractive(state.phase==='exploring');tilt.refresh();if(returnFocus?.isConnected&&returnFocus.getClientRects().length&&!returnFocus.closest('[inert]'))returnFocus.focus({preventScroll:true});else (mobileUI.media.matches?$('mobile-menu-toggle'):$('menu-open')).focus({preventScroll:true});}
for(const b of document.querySelectorAll('[data-open]'))b.onclick=()=>openPanel(b.dataset.open);
for(const d of document.querySelectorAll('dialog')){d.querySelectorAll('.close-panel').forEach(b=>b.onclick=()=>closePanel(d));d.addEventListener('cancel',()=>{room?.setInteractive(true);});d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel(d);});}
function selectObject(id){if(state.phase!=='exploring')return;if(id==='notebook')openPanel('reader');if(id==='guitar'){toggleMusic();showPlayer();}if(id==='door')openPanel('door-panel');}
$('menu-open').onclick=()=>openPanel('options');
$('reset-view').onclick=()=>{closePanel($('options'));if(mobileUI.media.matches)tilt.recenter();else room?.reset(state.reduced);};
$('title-home').onclick=e=>{e.preventDefault();if(mobileUI.media.matches)tilt.recenter();else room?.reset(state.reduced);};
$('replay').onclick=()=>{closePanel($('options'));beginOpening(true);};
$('show-objects').onclick=()=>{closePanel($('options'));room?.revealObjects(6500);toast('Look for the small rings in the room. Read and Listen are always in the menu.');};
$('reduced-motion').onchange=e=>{reduced(e.target.checked);if(state.reduced&&state.phase==='awakening')finishOpening({clear:true});};
$('quality').onchange=async e=>{state.quality=e.target.value;try{await room?.setQuality(state.quality);toast('Room quality updated.');}catch(e){toast('The quality could not change. Your current view is retained.');}};
addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='awakening')finishOpening();});
await prepare();

}
