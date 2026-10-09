(() => {
const $=id=>document.getElementById(id),canvas=$("game"),engine=new BABYLON.Engine(canvas,true),scene=new BABYLON.Scene(engine);
scene.clearColor=new BABYLON.Color4(.60,.76,.89,1);
const ui={score:$("score"),hits:$("hits"),ammo:$("ammo"),streak:$("streak"),state:$("state"),scope:$("scope"),scopeCursor:$("scopeCursor"),cross:$("cross"),zoom:$("zoom"),hit:$("hit"),msg:$("msg"),start:$("start"),startBtn:$("startBtn"),reload:$("reload"),reloadFill:$("reload").firstElementChild,mission:$("missionText"),missionTime:$("missionTime")};

function mat(name,hex){const m=new BABYLON.StandardMaterial(name,scene);m.diffuseColor=BABYLON.Color3.FromHexString(hex);m.specularColor=new BABYLON.Color3(.07,.07,.07);return m}
const mats={
ground:mat("ground","#6d745c"),road:mat("road","#3d4146"),sidewalk:mat("sidewalk","#a6a9aa"),wall1:mat("wall1","#c8b79e"),wall2:mat("wall2","#9ba8b2"),wall3:mat("wall3","#b48f79"),
dark:mat("dark","#28313a"),glass:mat("glass","#477389"),white:mat("white","#f3f3f3"),black:mat("black","#111111"),red:mat("red","#d92f2f"),blue:mat("blue","#2474d8"),yellow:mat("yellow","#f2d231"),skin:mat("skin","#d0a17f")
};

const camera=new BABYLON.FreeCamera("camera",new BABYLON.Vector3(0,15.5,27),scene);camera.inputs.clear();camera.fov=.78;camera.minZ=.1;camera.maxZ=500;scene.activeCamera=camera;
let yaw=0,pitch=-.10,zoom=4,scoped=false,reloading=false,lastShot=0,score=0,hits=0,ammo=5,streak=0,mission=null;
let freeAimX=0,freeAimY=0;
const movers=[],targets=[],hitFx=[],bullets=[],debris=[],destructions=[],staticRespawns=[];
const colorNames={red:"赤",blue:"青",yellow:"黄",black:"黒",white:"白"};
const typeNames={person:"人物",car:"車",sign:"看板"};
const missionOptions=[];
for(const type of Object.keys(typeNames))for(const color of Object.keys(colorNames))missionOptions.push({type,color,label:`${typeNames[type]}【${colorNames[color]}】`});

function registerTarget(mesh,type,points,attrs={}){mesh.metadata={targetType:type,points,...attrs};targets.push(mesh);return mesh}
window.StreetScopeWorld.build(scene,mats,registerTarget,movers);

function applyCamera(){camera.rotation.x=pitch;camera.rotation.y=yaw}
function clampPitch(){pitch=Math.max(-.95,Math.min(.62,pitch))}
function freeAimRadius(){return Math.min(window.innerWidth,window.innerHeight)*.17}
function updateFreeAimCursor(){ui.cross.style.marginLeft=freeAimX+"px";ui.cross.style.marginTop=freeAimY+"px"}
function resetFreeAim(){freeAimX=0;freeAimY=0;updateFreeAimCursor()}
function hud(){ui.score.textContent=score;ui.hits.textContent=hits;ui.ammo.textContent=`${ammo} / 5`;ui.streak.textContent=streak}
function message(t){ui.msg.textContent=t;ui.msg.style.opacity=1;clearTimeout(message.timer);message.timer=setTimeout(()=>ui.msg.style.opacity=0,650)}
function newMission(){
  let next;do{next=missionOptions[Math.floor(Math.random()*missionOptions.length)]}while(mission&&next.type===mission.type&&next.color===mission.color);
  mission={...next,timeLeft:22};ui.mission.textContent=mission.label+" を撃て";ui.missionTime.textContent=mission.timeLeft.toFixed(1);
}
function correct(meta){return mission&&meta.targetType===mission.type&&meta.color===mission.color}
function setScope(v){
  scoped=v;ui.scope.style.display=v?"block":"none";ui.cross.style.display=v?"none":"block";camera.fov=v?.78/zoom:.78;ui.zoom.textContent=zoom.toFixed(1)+"x";
  ui.scopeCursor.style.marginLeft="0px";ui.scopeCursor.style.marginTop="0px";
  resetFreeAim();
}
function getAimRay(){
  if(scoped)return camera.getForwardRay(300);
  const rect=canvas.getBoundingClientRect();
  const sx=engine.getRenderWidth()/Math.max(1,rect.width),sy=engine.getRenderHeight()/Math.max(1,rect.height);
  const x=(rect.width*.5+freeAimX)*sx,y=(rect.height*.5+freeAimY)*sy;
  return scene.createPickingRay(x,y,BABYLON.Matrix.Identity(),camera,false);
}
function showHitMarker(){
  ui.hit.style.marginLeft=(scoped?0:freeAimX)+"px";ui.hit.style.marginTop=(scoped?0:freeAimY)+"px";ui.hit.style.display="block";
  clearTimeout(showHitMarker.timer);showHitMarker.timer=setTimeout(()=>ui.hit.style.display="none",120);
}
function impact(point,ok){
  const s=BABYLON.MeshBuilder.CreateSphere("fx",{diameter:ok?.23:.14,segments:6},scene),m=new BABYLON.StandardMaterial("fxm",scene);
  s.isPickable=false;s.position.copyFrom(point);m.emissiveColor=ok?new BABYLON.Color3(1,.72,.2):new BABYLON.Color3(.8,.8,.8);m.diffuseColor=m.emissiveColor;s.material=m;hitFx.push({s,m,life:.18});
}
function surfaceImpact(point){
  impact(point,false);
  for(let i=0;i<7;i++){
    const s=BABYLON.MeshBuilder.CreateSphere("dust",{diameter:.07+(i%3)*.025,segments:4},scene),m=new BABYLON.StandardMaterial("dustMat",scene);
    s.isPickable=false;s.position.copyFrom(point);
    const warm=i<3;m.diffuseColor=warm?new BABYLON.Color3(.9,.68,.34):new BABYLON.Color3(.35,.35,.35);m.emissiveColor=warm?new BABYLON.Color3(.35,.18,.04):new BABYLON.Color3(.05,.05,.05);s.material=m;
    const a=(i/7)*Math.PI*2,spread=.9+Math.random()*.9;
    debris.push({mesh:s,mat:m,vel:new BABYLON.Vector3(Math.cos(a)*spread,.7+Math.random()*1.6,Math.sin(a)*spread),life:.35+.18*Math.random(),gravity:4.2,fade:true});
  }
}
function targetBurst(point,meta){
  impact(point,true);
  const c=meta&&meta.color==="blue"?new BABYLON.Color3(.2,.5,1):meta&&meta.color==="yellow"?new BABYLON.Color3(1,.85,.2):meta&&meta.color==="red"?new BABYLON.Color3(1,.2,.15):new BABYLON.Color3(.9,.9,.9);
  for(let i=0;i<8;i++){
    const p=BABYLON.MeshBuilder.CreateBox("fragment",{size:.12+Math.random()*.1},scene),m=new BABYLON.StandardMaterial("fragmentMat",scene);
    p.isPickable=false;p.position.copyFrom(point);m.diffuseColor=c;m.emissiveColor=c.scale(.28);p.material=m;
    const a=Math.random()*Math.PI*2,spread=1.2+Math.random()*2.2;
    debris.push({mesh:p,mat:m,vel:new BABYLON.Vector3(Math.cos(a)*spread,.8+Math.random()*2.4,Math.sin(a)*spread),life:.45+.35*Math.random(),gravity:5.4,fade:true,spin:new BABYLON.Vector3(Math.random()*8,Math.random()*8,Math.random()*8)});
  }
}
function spawnBullet(ray,end,onArrive){
  const dir=end.subtract(ray.origin).normalize();
  const right=camera.getDirection(BABYLON.Axis.X).normalize(),up=camera.getDirection(BABYLON.Axis.Y).normalize();
  const start=ray.origin.add(ray.direction.normalize().scale(1.1)).add(right.scale(.30)).add(up.scale(-.22));
  const mesh=BABYLON.MeshBuilder.CreateSphere("bullet",{diameter:.18,segments:6},scene),material=new BABYLON.StandardMaterial("bulletMat",scene);
  mesh.isPickable=false;material.emissiveColor=new BABYLON.Color3(1,.82,.3);material.diffuseColor=new BABYLON.Color3(1,.9,.55);mesh.material=material;mesh.position.copyFrom(start);
  const tail=start.subtract(dir.scale(.9));
  const trail=BABYLON.MeshBuilder.CreateLines("bulletTrail",{points:[tail,start],updatable:true},scene);trail.isPickable=false;trail.color=new BABYLON.Color3(1,.82,.3);
  bullets.push({mesh,material,trail,start,end:end.clone(),dir,t:0,duration:.18,onArrive});
}
function findMover(mesh){return movers.find(v=>v.parts.includes(mesh))}
function beginDestroy(mesh,point){
  if(!mesh||mesh.isPickable===false)return;
  const meta=mesh.metadata||{};
  targetBurst(point,meta);
  const mover=findMover(mesh);
  if(mover){
    if(!mover.alive||mover.destroying)return;
    mover.destroying=true;
    mover.parts.forEach(p=>p.isPickable=false);
    destructions.push({kind:"mover",mover,root:mover.root,time:0,duration:.42,baseScale:mover.root.scaling.clone(),baseRotation:mover.root.rotation.clone()});
    return;
  }
  if(!meta.targetType||meta.destroying)return;
  meta.destroying=true;mesh.isPickable=false;
  destructions.push({kind:"static",mesh,time:0,duration:.38,baseScale:mesh.scaling.clone(),baseRotation:mesh.rotation.clone(),basePosition:mesh.position.clone()});
}
async function reload(){
  if(reloading||ammo===5)return;reloading=true;ui.state.textContent="RELOADING";ui.reload.style.display="block";
  const st=performance.now(),dur=1150;await new Promise(done=>{function f(n){const p=Math.min(1,(n-st)/dur);ui.reloadFill.style.width=p*100+"%";p<1?requestAnimationFrame(f):done()}requestAnimationFrame(f)});
  ammo=5;reloading=false;ui.reload.style.display="none";ui.reloadFill.style.width=0;ui.state.textContent="READY";hud();
}
function shoot(){
  if(document.pointerLockElement!==canvas||reloading)return;const now=performance.now();if(now-lastShot<320)return;if(ammo<=0){reload();return}
  lastShot=now;ammo--;hud();pitch-=scoped?.006:.012;clampPitch();applyCamera();
  const ray=getAimRay();
  const pick=scene.pickWithRay(ray,m=>m&&m.isPickable!==false);
  const end=pick&&pick.hit&&pick.pickedPoint?pick.pickedPoint.clone():ray.origin.add(ray.direction.scale(180));
  let arrival=null;
  if(pick&&pick.hit){
    const mesh=pick.pickedMesh,point=pick.pickedPoint.clone(),meta=mesh.metadata;
    if(meta&&meta.targetType){
      const dist=BABYLON.Vector3.Distance(camera.position,point),wasCorrect=correct(meta);
      arrival=()=>{
        if(!mesh||mesh.isDisposed&&mesh.isDisposed())return;
        if(wasCorrect){
          streak++;hits++;const pts=180+Math.floor(dist/25)*10+Math.min(200,Math.max(0,streak-1)*20);score+=pts;
          showHitMarker();message(`MISSION CLEAR +${pts}`);beginDestroy(mesh,point);newMission();
        }else{
          score-=50;streak=0;message("WRONG TARGET -50");beginDestroy(mesh,point);
        }
        hud();
      };
    }else{
      arrival=()=>surfaceImpact(point);
    }
  }
  spawnBullet(ray,end,arrival);
  if(ammo<=0)setTimeout(reload,350);
}

ui.startBtn.onclick=()=>canvas.requestPointerLock();canvas.onclick=()=>{if(document.pointerLockElement!==canvas)canvas.requestPointerLock()};
document.addEventListener("pointerlockchange",()=>{const on=document.pointerLockElement===canvas;ui.start.style.display=on?"none":"flex";if(!on)setScope(false)});
document.addEventListener("mousemove",e=>{
  if(document.pointerLockElement!==canvas)return;
  if(scoped){
    const s=.00165*(4/zoom);
    yaw-=e.movementX*s;pitch-=e.movementY*s;clampPitch();applyCamera();return;
  }
  const speed=.92,nx=freeAimX+e.movementX*speed,ny=freeAimY+e.movementY*speed,r=freeAimRadius(),len=Math.hypot(nx,ny);
  if(len<=r){freeAimX=nx;freeAimY=ny;updateFreeAimCursor();return}
  const scale=r/Math.max(.001,len),cx=nx*scale,cy=ny*scale,overflowX=nx-cx,overflowY=ny-cy;
  freeAimX=cx;freeAimY=cy;updateFreeAimCursor();
  const pan=.00145;yaw-=overflowX*pan;pitch-=overflowY*pan;clampPitch();applyCamera();
});
document.addEventListener("mousedown",e=>{if(document.pointerLockElement!==canvas)return;if(e.button===0)shoot();if(e.button===2)setScope(true)});
document.addEventListener("mouseup",e=>{if(e.button===2)setScope(false)});document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("wheel",e=>{if(document.pointerLockElement!==canvas)return;zoom=Math.max(2,Math.min(8,zoom+(e.deltaY<0?.5:-.5)));ui.zoom.textContent=zoom.toFixed(1)+"x";if(scoped)camera.fov=.78/zoom;e.preventDefault()},{passive:false});
document.addEventListener("keydown",e=>{if(e.code==="KeyR")reload()});

let last=performance.now();scene.onBeforeRenderObservable.add(()=>{
  const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
  if(mission&&document.pointerLockElement===canvas){mission.timeLeft-=dt;ui.missionTime.textContent=Math.max(0,mission.timeLeft).toFixed(1);if(mission.timeLeft<=0){score-=100;streak=0;hud();message("TIME UP -100");newMission()}}
  for(const m of movers){
    if(m.destroying)continue;
    if(!m.alive){
      m.respawn-=dt;
      if(m.respawn<=0){m.alive=true;m.parts.forEach(p=>{p.setEnabled(true);p.isPickable=true});m.root.position.z=m.dir>0?-82:82}
      continue;
    }
    m.root.position.z+=m.speed*m.dir*dt;if(m.root.position.z>86)m.root.position.z=-86;if(m.root.position.z<-86)m.root.position.z=86;
    if(m.kind==="person"){m.t+=dt*7;m.parts[2].rotation.x=Math.sin(m.t)*.45;m.parts[3].rotation.x=-Math.sin(m.t)*.45}
  }
  for(let i=destructions.length-1;i>=0;i--){
    const d=destructions[i];d.time+=dt;const t=Math.min(1,d.time/d.duration),ease=1-t;
    if(d.kind==="mover"){
      d.root.scaling.set(d.baseScale.x*ease,d.baseScale.y*ease,d.baseScale.z*ease);
      d.root.rotation.z=d.baseRotation.z+t*1.3;d.root.position.y-=dt*.35;
      if(t>=1){
        d.mover.parts.forEach(p=>p.setEnabled(false));d.mover.alive=false;d.mover.destroying=false;d.mover.respawn=3.2;
        d.root.scaling.copyFrom(d.baseScale);d.root.rotation.copyFrom(d.baseRotation);d.root.position.y=d.mover.kind==="person"?.15:0;
        destructions.splice(i,1);
      }
    }else{
      d.mesh.scaling.set(d.baseScale.x*ease,d.baseScale.y*ease,d.baseScale.z*ease);d.mesh.rotation.z=d.baseRotation.z+t*1.5;
      if(t>=1){
        d.mesh.setEnabled(false);d.mesh.scaling.copyFrom(d.baseScale);d.mesh.rotation.copyFrom(d.baseRotation);d.mesh.position.copyFrom(d.basePosition);
        d.mesh.metadata.destroying=false;staticRespawns.push({mesh:d.mesh,time:4.0});destructions.splice(i,1);
      }
    }
  }
  for(let i=staticRespawns.length-1;i>=0;i--){const r=staticRespawns[i];r.time-=dt;if(r.time<=0){r.mesh.setEnabled(true);r.mesh.isPickable=true;staticRespawns.splice(i,1)}}
  for(let i=hitFx.length-1;i>=0;i--){const f=hitFx[i];f.life-=dt;f.s.scaling.scaleInPlace(1+dt*7);f.m.alpha=Math.max(0,f.life/.18);if(f.life<=0){f.s.dispose();f.m.dispose();hitFx.splice(i,1)}}
  for(let i=debris.length-1;i>=0;i--){
    const d=debris[i];d.life-=dt;d.vel.y-=d.gravity*dt;d.mesh.position.addInPlace(d.vel.scale(dt));
    if(d.spin){d.mesh.rotation.x+=d.spin.x*dt;d.mesh.rotation.y+=d.spin.y*dt;d.mesh.rotation.z+=d.spin.z*dt}
    if(d.fade)d.mat.alpha=Math.max(0,Math.min(1,d.life/.28));
    if(d.life<=0){d.mesh.dispose();d.mat.dispose();debris.splice(i,1)}
  }
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.t+=dt/b.duration;const t=Math.min(1,b.t),pos=BABYLON.Vector3.Lerp(b.start,b.end,t);b.mesh.position.copyFrom(pos);
    const tail=pos.subtract(b.dir.scale(.9));BABYLON.MeshBuilder.CreateLines("bulletTrail",{points:[tail,pos],instance:b.trail});
    if(t>=1){if(b.onArrive)b.onArrive();b.mesh.dispose();b.material.dispose();b.trail.dispose();bullets.splice(i,1)}
  }
});
hud();newMission();resetFreeAim();engine.runRenderLoop(()=>scene.render());addEventListener("resize",()=>{engine.resize();if(!scoped){const r=freeAimRadius(),len=Math.hypot(freeAimX,freeAimY);if(len>r){freeAimX*=r/len;freeAimY*=r/len;updateFreeAimCursor()}}});
})();