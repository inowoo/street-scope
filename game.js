(() => {
const $=id=>document.getElementById(id),canvas=$("game"),engine=new BABYLON.Engine(canvas,true),scene=new BABYLON.Scene(engine);
scene.clearColor=new BABYLON.Color4(.60,.76,.89,1);
const ui={score:$("score"),hits:$("hits"),ammo:$("ammo"),streak:$("streak"),state:$("state"),scope:$("scope"),scopeCursor:$("scopeCursor"),cross:$("cross"),zoom:$("zoom"),hit:$("hit"),msg:$("msg"),start:$("start"),startBtn:$("startBtn"),reload:$("reload"),reloadFill:$("reload").firstElementChild,mission:$("missionText"),missionTime:$("missionTime")};

function mat(name,hex){const m=new BABYLON.StandardMaterial(name,scene);m.diffuseColor=BABYLON.Color3.FromHexString(hex);m.specularColor=new BABYLON.Color3(.07,.07,.07);return m}
const mats={
ground:mat("ground","#6d745c"),road:mat("road","#3d4146"),sidewalk:mat("sidewalk","#a6a9aa"),wall1:mat("wall1","#c8b79e"),wall2:mat("wall2","#9aa8b2"),wall3:mat("wall3","#b48f79"),
dark:mat("dark","#28313a"),glass:mat("glass","#477389"),white:mat("white","#f3f3f3"),black:mat("black","#111111"),red:mat("red","#d92f2f"),blue:mat("blue","#2474d8"),yellow:mat("yellow","#f2d231"),skin:mat("skin","#d0a17f")
};

const camera=new BABYLON.FreeCamera("camera",new BABYLON.Vector3(0,15.5,27),scene);camera.inputs.clear();camera.fov=.78;camera.minZ=.1;camera.maxZ=500;scene.activeCamera=camera;
let yaw=0,pitch=-.10,zoom=4,scoped=false,reloading=false,lastShot=0,score=0,hits=0,ammo=5,streak=0,mission=null;
let scopeAimX=0,scopeAimY=0;
const movers=[],targets=[],hitFx=[],bullets=[];
const colorNames={red:"赤",blue:"青",yellow:"黄",black:"黒",white:"白"};
const typeNames={person:"人物",car:"車",sign:"看板"};
const missionOptions=[];
for(const type of Object.keys(typeNames))for(const color of Object.keys(colorNames))missionOptions.push({type,color,label:`${typeNames[type]}【${colorNames[color]}】`});

function registerTarget(mesh,type,points,attrs={}){mesh.metadata={targetType:type,points,...attrs};targets.push(mesh);return mesh}
window.StreetScopeWorld.build(scene,mats,registerTarget,movers);

function applyCamera(){camera.rotation.x=pitch;camera.rotation.y=yaw}
function clampPitch(){pitch=Math.max(-.95,Math.min(.62,pitch))}
function scopeRadius(){return Math.min(window.innerWidth,window.innerHeight)*.235}
function updateScopeCursor(){ui.scopeCursor.style.marginLeft=scopeAimX+"px";ui.scopeCursor.style.marginTop=scopeAimY+"px"}
function hud(){ui.score.textContent=score;ui.hits.textContent=hits;ui.ammo.textContent=`${ammo} / 5`;ui.streak.textContent=streak}
function message(t){ui.msg.textContent=t;ui.msg.style.opacity=1;clearTimeout(message.timer);message.timer=setTimeout(()=>ui.msg.style.opacity=0,650)}
function newMission(){
  let next;do{next=missionOptions[Math.floor(Math.random()*missionOptions.length)]}while(mission&&next.type===mission.type&&next.color===mission.color);
  mission={...next,timeLeft:22};ui.mission.textContent=mission.label+" を撃て";ui.missionTime.textContent=mission.timeLeft.toFixed(1);
}
function correct(meta){return mission&&meta.targetType===mission.type&&meta.color===mission.color}
function setScope(v){
  scoped=v;ui.scope.style.display=v?"block":"none";ui.cross.style.display=v?"none":"block";camera.fov=v?.78/zoom:.78;ui.zoom.textContent=zoom.toFixed(1)+"x";
  if(v){scopeAimX=0;scopeAimY=0;updateScopeCursor()}
}
function getAimRay(){
  if(!scoped)return camera.getForwardRay(300);
  const rect=canvas.getBoundingClientRect();
  const sx=engine.getRenderWidth()/Math.max(1,rect.width),sy=engine.getRenderHeight()/Math.max(1,rect.height);
  const x=(rect.width*.5+scopeAimX)*sx,y=(rect.height*.5+scopeAimY)*sy;
  return scene.createPickingRay(x,y,BABYLON.Matrix.Identity(),camera,false);
}
function showHitMarker(){
  ui.hit.style.marginLeft=(scoped?scopeAimX:0)+"px";ui.hit.style.marginTop=(scoped?scopeAimY:0)+"px";ui.hit.style.display="block";
  clearTimeout(showHitMarker.timer);showHitMarker.timer=setTimeout(()=>ui.hit.style.display="none",120);
}
function impact(point,ok){
  const s=BABYLON.MeshBuilder.CreateSphere("fx",{diameter:ok?.23:.14,segments:6},scene),m=new BABYLON.StandardMaterial("fxm",scene);
  s.isPickable=false;s.position.copyFrom(point);m.emissiveColor=ok?new BABYLON.Color3(1,.72,.2):new BABYLON.Color3(.8,.8,.8);m.diffuseColor=m.emissiveColor;s.material=m;hitFx.push({s,m,life:.18});
}
function spawnBullet(ray,end){
  const dir=end.subtract(ray.origin).normalize();
  const right=camera.getDirection(BABYLON.Axis.X).normalize(),up=camera.getDirection(BABYLON.Axis.Y).normalize();
  const start=ray.origin.add(ray.direction.normalize().scale(1.1)).add(right.scale(.30)).add(up.scale(-.22));
  const mesh=BABYLON.MeshBuilder.CreateSphere("bullet",{diameter:.18,segments:6},scene),material=new BABYLON.StandardMaterial("bulletMat",scene);
  mesh.isPickable=false;material.emissiveColor=new BABYLON.Color3(1,.82,.3);material.diffuseColor=new BABYLON.Color3(1,.9,.55);mesh.material=material;mesh.position.copyFrom(start);
  const tail=start.subtract(dir.scale(.9));
  const trail=BABYLON.MeshBuilder.CreateLines("bulletTrail",{points:[tail,start],updatable:true},scene);trail.isPickable=false;trail.color=new BABYLON.Color3(1,.82,.3);
  bullets.push({mesh,material,trail,start,end:end.clone(),dir,t:0,duration:.18});
}
function knockOut(mesh){const m=movers.find(v=>v.parts.includes(mesh));if(!m||!m.alive)return;m.alive=false;m.respawn=2.6;m.parts.forEach(p=>p.setEnabled(false))}
async function reload(){
  if(reloading||ammo===5)return;reloading=true;ui.state.textContent="RELOADING";ui.reload.style.display="block";
  const st=performance.now(),dur=1150;await new Promise(done=>{function f(n){const p=Math.min(1,(n-st)/dur);ui.reloadFill.style.width=p*100+"%";p<1?requestAnimationFrame(f):done()}requestAnimationFrame(f)});
  ammo=5;reloading=false;ui.reload.style.display="none";ui.reloadFill.style.width=0;ui.state.textContent="READY";hud();
}
function shoot(){
  if(document.pointerLockElement!==canvas||reloading)return;const now=performance.now();if(now-lastShot<320)return;if(ammo<=0){reload();return}
  lastShot=now;ammo--;hud();pitch-=scoped?.006:.016;clampPitch();applyCamera();
  const ray=getAimRay();
  const pick=scene.pickWithRay(ray,m=>m&&m.isPickable!==false);
  const end=pick&&pick.hit&&pick.pickedPoint?pick.pickedPoint:ray.origin.add(ray.direction.scale(180));
  spawnBullet(ray,end);
  if(pick&&pick.hit){
    const mesh=pick.pickedMesh,meta=mesh.metadata;
    if(meta&&meta.targetType){
      const type=meta.targetType,dist=BABYLON.Vector3.Distance(camera.position,pick.pickedPoint);
      if(correct(meta)){
        streak++;hits++;const pts=180+Math.floor(dist/25)*10+Math.min(200,Math.max(0,streak-1)*20);score+=pts;impact(pick.pickedPoint,true);
        showHitMarker();message(`MISSION CLEAR +${pts}`);if(type==="person"||type==="car")knockOut(mesh);newMission();
      }else{
        score-=50;streak=0;impact(pick.pickedPoint,false);message("WRONG TARGET -50");if(type==="person"||type==="car")knockOut(mesh);
      }
      hud();
    }else impact(pick.pickedPoint,false);
  }
  if(ammo<=0)setTimeout(reload,350);
}

ui.startBtn.onclick=()=>canvas.requestPointerLock();canvas.onclick=()=>{if(document.pointerLockElement!==canvas)canvas.requestPointerLock()};
document.addEventListener("pointerlockchange",()=>{const on=document.pointerLockElement===canvas;ui.start.style.display=on?"none":"flex";if(!on)setScope(false)});
document.addEventListener("mousemove",e=>{
  if(document.pointerLockElement!==canvas)return;
  if(!scoped){
    yaw-=e.movementX*.00165;pitch-=e.movementY*.00165;clampPitch();applyCamera();return;
  }
  const speed=.92,nx=scopeAimX+e.movementX*speed,ny=scopeAimY+e.movementY*speed,r=scopeRadius(),len=Math.hypot(nx,ny);
  if(len<=r){scopeAimX=nx;scopeAimY=ny;updateScopeCursor();return}
  const scale=r/Math.max(.001,len),cx=nx*scale,cy=ny*scale,overflowX=nx-cx,overflowY=ny-cy;
  scopeAimX=cx;scopeAimY=cy;updateScopeCursor();
  const pan=.00145*(4/zoom);yaw-=overflowX*pan;pitch-=overflowY*pan;clampPitch();applyCamera();
});
document.addEventListener("mousedown",e=>{if(document.pointerLockElement!==canvas)return;if(e.button===0)shoot();if(e.button===2)setScope(true)});
document.addEventListener("mouseup",e=>{if(e.button===2)setScope(false)});document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("wheel",e=>{if(document.pointerLockElement!==canvas)return;zoom=Math.max(2,Math.min(8,zoom+(e.deltaY<0?.5:-.5)));ui.zoom.textContent=zoom.toFixed(1)+"x";if(scoped)camera.fov=.78/zoom;e.preventDefault()},{passive:false});
document.addEventListener("keydown",e=>{if(e.code==="KeyR")reload()});

let last=performance.now();scene.onBeforeRenderObservable.add(()=>{
  const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
  if(mission&&document.pointerLockElement===canvas){mission.timeLeft-=dt;ui.missionTime.textContent=Math.max(0,mission.timeLeft).toFixed(1);if(mission.timeLeft<=0){score-=100;streak=0;hud();message("TIME UP -100");newMission()}}
  for(const m of movers){
    if(!m.alive){m.respawn-=dt;if(m.respawn<=0){m.alive=true;m.parts.forEach(p=>p.setEnabled(true));m.root.position.z=m.dir>0?-82:82}continue}
    m.root.position.z+=m.speed*m.dir*dt;if(m.root.position.z>86)m.root.position.z=-86;if(m.root.position.z<-86)m.root.position.z=86;
    if(m.kind==="person"){m.t+=dt*7;m.parts[2].rotation.x=Math.sin(m.t)*.45;m.parts[3].rotation.x=-Math.sin(m.t)*.45}
  }
  for(let i=hitFx.length-1;i>=0;i--){const f=hitFx[i];f.life-=dt;f.s.scaling.scaleInPlace(1+dt*7);f.m.alpha=Math.max(0,f.life/.18);if(f.life<=0){f.s.dispose();f.m.dispose();hitFx.splice(i,1)}}
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.t+=dt/b.duration;const t=Math.min(1,b.t),pos=BABYLON.Vector3.Lerp(b.start,b.end,t);b.mesh.position.copyFrom(pos);
    const tail=pos.subtract(b.dir.scale(.9));BABYLON.MeshBuilder.CreateLines("bulletTrail",{points:[tail,pos],instance:b.trail});
    if(t>=1){b.mesh.dispose();b.material.dispose();b.trail.dispose();bullets.splice(i,1)}
  }
});
hud();newMission();engine.runRenderLoop(()=>scene.render());addEventListener("resize",()=>{engine.resize();if(scoped){const r=scopeRadius(),len=Math.hypot(scopeAimX,scopeAimY);if(len>r){scopeAimX*=r/len;scopeAimY*=r/len;updateScopeCursor()}}});
})();