import * as THREE from 'three';

// Screen-space focus veil. The same rendered camera supplies both blurred and clear pixels.
// White mask = blurred, black = revealed; no scene/image is replaced at the handoff.
export class ClarityVeil {
 constructor(renderer){
  this.renderer=renderer;this.active=false;this.progress=1;this.strength=0;
  this.mask=document.createElement('canvas');this.mask.width=640;this.mask.height=400;
  this.context=this.mask.getContext('2d',{willReadFrequently:true});
  this.texture=new THREE.CanvasTexture(this.mask);this.texture.minFilter=THREE.LinearFilter;this.texture.magFilter=THREE.LinearFilter;this.texture.generateMipmaps=false;
  this.target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false});
  this.blurTarget=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
  this.verticalTarget=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
  this.material=new THREE.ShaderMaterial({
   uniforms:{image:{value:this.target.texture},blurredImage:{value:this.verticalTarget.texture},mask:{value:this.texture},strength:{value:1}},
   depthTest:false,depthWrite:false,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`uniform sampler2D image,blurredImage,mask;uniform float strength;varying vec2 vUv;
    void main(){
     vec4 sharp=texture2D(image,vUv);float veil=texture2D(mask,vUv).r*strength;
     gl_FragColor=vec4(mix(sharp.rgb,texture2D(blurredImage,vUv).rgb,veil),1.);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`
  });
  this.blurMaterial=new THREE.ShaderMaterial({
   uniforms:{image:{value:this.target.texture},direction:{value:new THREE.Vector2(1,0)}},depthTest:false,depthWrite:false,toneMapped:false,
   vertexShader:this.material.vertexShader,
   fragmentShader:`uniform sampler2D image;uniform vec2 direction;varying vec2 vUv;
    void main(){
     vec3 blurred=vec3(0.);float sum=0.;
     for(int i=-12;i<=12;i++){
      float offset=float(i),weight=exp(-offset*offset/50.);
      blurred+=texture2D(image,vUv+direction*offset).rgb*weight;sum+=weight;
     }
     gl_FragColor=vec4(blurred/sum,1.);
    }`
  });
  this.scene=new THREE.Scene();this.camera=new THREE.Camera();this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.scene.add(this.quad);
  this.clear();this.resize();
 }
 resize(){
  const size=this.active?this.renderer.getDrawingBufferSize(new THREE.Vector2()):new THREE.Vector2(1,1);this.target.setSize(size.x,size.y);
  const blurScale=Math.min(640/size.x,640/size.y,1);this.blurTarget.setSize(Math.max(1,Math.round(size.x*blurScale)),Math.max(1,Math.round(size.y*blurScale)));
  this.verticalTarget.setSize(this.blurTarget.width,this.blurTarget.height);
  const old=document.createElement('canvas');old.width=this.mask.width;old.height=this.mask.height;old.getContext('2d').drawImage(this.mask,0,0);
  const scale=Math.min(640/innerWidth,640/innerHeight,1);this.mask.width=Math.max(1,Math.round(innerWidth*scale));this.mask.height=Math.max(1,Math.round(innerHeight*scale));this.context.drawImage(old,0,0,this.mask.width,this.mask.height);this.texture.needsUpdate=true;
 }
 setFocus(value){this.strength=Math.max(0,Math.min(1,value));this.material.uniforms.strength.value=this.strength;}
 reset(){this.setFocus(1);this.active=true;this.resize();this.progress=0;this.context.fillStyle='#fff';this.context.fillRect(0,0,this.mask.width,this.mask.height);this.texture.needsUpdate=true;}
 clear(){this.setFocus(0);this.active=false;this.progress=1;this.context.fillStyle='#000';this.context.fillRect(0,0,this.mask.width,this.mask.height);this.texture.needsUpdate=true;this.target.setSize(1,1);this.blurTarget.setSize(1,1);this.verticalTarget.setSize(1,1);}
 at(x,y){if(!this.active)return 1;const px=THREE.MathUtils.clamp(Math.round(x/innerWidth*(this.mask.width-1)),0,this.mask.width-1),py=THREE.MathUtils.clamp(Math.round(y/innerHeight*(this.mask.height-1)),0,this.mask.height-1);return 1-this.context.getImageData(px,py,1,1).data[0]/255*this.strength;}
 brush(from,to){
  if(!this.active)return;
  const scale=this.mask.width/innerWidth,radius=Math.max(65,Math.min(innerWidth,innerHeight)*.125)*scale;
  const dx=(to.x-from.x)*scale,dy=(to.y-from.y)*scale,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/(radius*.2)));
  for(let i=0;i<=steps;i++){
   const x=(from.x+(to.x-from.x)*i/steps)*scale,y=(from.y+(to.y-from.y)*i/steps)*scale;
   const gradient=this.context.createRadialGradient(x,y,radius*.12,x,y,radius);gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(.55,'rgba(0,0,0,.97)');gradient.addColorStop(1,'rgba(0,0,0,0)');
   this.context.fillStyle=gradient;this.context.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  this.texture.needsUpdate=true;
 }
 measure(){
  if(!this.active)return 1;
  const data=this.context.getImageData(0,0,this.mask.width,this.mask.height).data;let total=0,samples=0;
  for(let i=0;i<data.length;i+=64){total+=1-data[i]/255;samples++;}
  this.progress=total/samples;
  if(this.progress>.96)this.clear();return this.progress;
 }
 render(scene,camera){
  if(!this.active){this.renderer.setRenderTarget(null);this.renderer.render(scene,camera);return;}
  this.renderer.setRenderTarget(this.target);this.renderer.render(scene,camera);
  this.quad.material=this.blurMaterial;this.blurMaterial.uniforms.image.value=this.target.texture;this.blurMaterial.uniforms.direction.value.set(1/this.blurTarget.width,0);this.renderer.setRenderTarget(this.blurTarget);this.renderer.render(this.scene,this.camera);
  this.blurMaterial.uniforms.image.value=this.blurTarget.texture;this.blurMaterial.uniforms.direction.value.set(0,1/this.blurTarget.height);this.renderer.setRenderTarget(this.verticalTarget);this.renderer.render(this.scene,this.camera);
  this.quad.material=this.material;this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);
 }
 dispose(){this.target.dispose();this.blurTarget.dispose();this.verticalTarget.dispose();this.texture.dispose();this.material.dispose();this.blurMaterial.dispose();this.quad.geometry.dispose();}
}
