// Trim the projected ray as well as the 3D ray: a foreshortened attachment
// must not draw a gold line across its own atom in the software/SVG views.
export function attachmentProjection(center, end, radius) {
  const dx=end.x-center.x,dy=end.y-center.y,length=Math.hypot(dx,dy);
  if(length<=radius+1)return null;
  return {start:{x:center.x+dx*radius/length,y:center.y+dy*radius/length},end};
}

export function createAttachmentMarker(THREE,port,own=value=>value) {
  const group=new THREE.Group();
  const geometry=own(new THREE.BufferGeometry().setFromPoints([port.start,port.point]));
  const line=new THREE.Line(geometry,own(new THREE.LineDashedMaterial({color:0xfbbf24,dashSize:.1,gapSize:.065,depthTest:true,depthWrite:false})));
  line.computeLineDistances();group.add(line);
  const ring=new THREE.Mesh(own(new THREE.TorusGeometry(.15,.026,6,24)),own(new THREE.MeshBasicMaterial({color:0xfbbf24,depthTest:true})));
  ring.position.copy(port.point);ring.userData.portRing=true;group.add(ring);
  return group;
}
