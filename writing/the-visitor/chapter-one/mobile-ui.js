// Phone controls reuse the same room actions; desktop navigation is left intact.
export const MOBILE_QUERY='(max-width:700px), (pointer:coarse) and (max-width:1100px)';

export function initMobileUI(){
 const media=matchMedia(MOBILE_QUERY),nav=document.getElementById('room-nav');
 const toggle=document.createElement('button');
 toggle.id='mobile-menu-toggle';toggle.type='button';toggle.hidden=true;
 toggle.setAttribute('aria-controls','room-nav');toggle.setAttribute('aria-expanded','false');
 toggle.setAttribute('aria-label','Open room menu');
 toggle.innerHTML='<span aria-hidden="true"><i></i><i></i><i></i></span>';
 nav.before(toggle);
 const options=document.getElementById('menu-open');
 const optionsLabel=document.createElement('span');optionsLabel.className='mobile-menu-option-label';optionsLabel.textContent='Room options';options.append(optionsLabel);
 let open=false;
 function exploring(){return document.body.dataset.phase==='exploring';}
 function closeMenu({restoreFocus=false}={}){
  const wasOpen=open;open=false;refresh();
  if(restoreFocus&&wasOpen&&!toggle.hidden)toggle.focus({preventScroll:true});
 }
 function refresh(){
  const mobile=media.matches,active=mobile&&exploring();
  if(!active)open=false;
  toggle.hidden=!active;
  document.body.dataset.mobileMenu=open?'open':'closed';
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Close room menu':'Open room menu');
  nav.inert=mobile&&!open;
  if(mobile)nav.setAttribute('aria-hidden',String(!open));else nav.removeAttribute('aria-hidden');
  if(active&&!open&&nav.contains(document.activeElement))toggle.focus({preventScroll:true});
 }
 function toggleMenu(){
  if(!media.matches||!exploring())return;
  open=!open;refresh();
 }
 function outside(e){if(open&&!nav.contains(e.target)&&!toggle.contains(e.target))closeMenu();}
 function escape(e){if(open&&e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu({restoreFocus:true});}}
 function action(e){if(e.target.closest('button')&&!e.target.closest('.tilt-controls'))closeMenu();}
 toggle.addEventListener('click',toggleMenu);
 nav.addEventListener('click',action);
 document.addEventListener('pointerdown',outside);
 document.addEventListener('keydown',escape,true);
 media.addEventListener('change',refresh);
 const observer=new MutationObserver(refresh);
 observer.observe(document.body,{attributes:true,attributeFilter:['data-phase']});
 refresh();
 return {media,closeMenu,refresh,dispose(){observer.disconnect();media.removeEventListener('change',refresh);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);nav.removeEventListener('click',action);toggle.remove();optionsLabel.remove();nav.inert=false;nav.removeAttribute('aria-hidden');delete document.body.dataset.mobileMenu;}};
}
