import * as THREE from 'three';

// UV coordinates are measured on the delivered equirectangular image. This
// keeps painted objects clickable without drawing a second prop on top of them.
export function panoramaPoint(u,v,radius=8){
 const longitude=(u-.5)*Math.PI*2,latitude=(.5-v)*Math.PI;
 return new THREE.Vector3(Math.sin(longitude)*Math.cos(latitude),Math.sin(latitude),-Math.cos(longitude)*Math.cos(latitude)).multiplyScalar(radius);
}
export function createPanoramaHotspot(definition){
 const points=definition?.polygon;
 const valid=p=>Array.isArray(p)&&p.length===2&&p.every(x=>Number.isFinite(x)&&x>=0&&x<=1);
 if(!Array.isArray(points)||points.length<3||!points.every(valid)||!valid(definition.anchor))throw new Error('Invalid panorama interaction coordinates');
 const contour=points.map(p=>new THREE.Vector2(...p));
 const triangles=THREE.ShapeUtils.triangulateShape(contour,[]);
 const vertices=points.flatMap(p=>panoramaPoint(...p).toArray());
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(triangles.flat());geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));
 mesh.userData.panoramaAnchor=panoramaPoint(...definition.anchor);
 return mesh;
}
