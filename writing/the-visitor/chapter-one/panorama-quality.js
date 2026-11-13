export function renderPixelRatio({dpr=1,width,height,mobile=false,light=false}){
 return Math.max(.5,Math.min(dpr,light?1.5:mobile?3:2,Math.sqrt((light?3000000:8000000)/Math.max(1,width*height))));
}
export function selectPanoramaLevel({levels,bufferWidth,bufferHeight,horizontalFov,verticalFov,light=false,maxTextureSize=4096}){
 const valid=levels.filter(l=>l.tileSize+2*l.gutter<=maxTextureSize).sort((a,b)=>a.width-b.width);
 if(!valid.length)return null;
 // Avoid doubling the whole pyramid level for a sub-5% sampling shortfall.
 const required=Math.max(bufferWidth*360/horizontalFov,bufferHeight*180/verticalFov);
 const allowed=light?valid.filter(l=>l.width<=8192):valid;
 return allowed.find(l=>l.width>=required*.95)||allowed.at(-1)||valid[0];
}
