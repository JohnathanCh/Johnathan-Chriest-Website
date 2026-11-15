// Fetch streams contain decoded bytes; compressed Content-Length does not.
const positive=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
export class ResourceProgress {
 constructor(){this.resources=new Map();}
 register(url,total=0){this.resources.set(url,{loaded:0,total:positive(total),done:false});}
 begin(url,contentLength,encoding){
  if(!this.resources.has(url))this.register(url);
  const resource=this.resources.get(url);
  // Manifest sizes describe the decoded files, so keep them for compressed responses.
  if(!encoding||encoding.trim().toLowerCase()==='identity')resource.total=positive(contentLength)||resource.total;
 }
 update(url,loaded,done=false){
  if(!this.resources.has(url))this.register(url);
  const resource=this.resources.get(url);resource.loaded=Math.max(resource.loaded,positive(loaded));resource.done=done;
  if(done)resource.total=resource.loaded;
  else if(resource.loaded>resource.total)resource.total=0; // Unknown size: show indeterminate progress until complete.
  return this.snapshot();
 }
 snapshot(){
  const all=[...this.resources.values()];
  return {loaded:all.reduce((sum,r)=>sum+r.loaded,0),total:all.length&&all.every(r=>r.total>0)?all.reduce((sum,r)=>sum+r.total,0):0,complete:all.length>0&&all.every(r=>r.done)};
 }
}
export function loadingPercent(loaded,total){
 if(!Number.isFinite(loaded)||!Number.isFinite(total)||total<=0||loaded<0)return null;
 return Math.max(0,Math.min(99,Math.floor(loaded/total*100)));
}
