(() => {
const $=id=>document.getElementById(id),canvas=$("game"),engine=new BABYLON.Engine(canvas,true),scene=new BABYLON.Scene(engine);
scene.clearColor=new BABYLON.Color4(.60,.76,.89,1);
const ui={score:$("score"),hits:$("hits"),ammo:$("ammo"),streak:$("streak"),state:$("state"),scope:$("scope"),cross:$("cross"),zoom:$("zoom"),hit:$("hit"),msg:$("msg"),start:$("start"),startBtn:$("startBtn"),reload:$("reload"),reloadFill:$("reload").firstElementChild,mission:$("missionText"),missionTime:$("missionTime")};

function mat(name,hex){const m=new BABYLON.StandardMaterial(name,scene);m.diffuseColor=BABYLON.Color3.FromHexString(hex);m.specularColor=new BABYLON.Color3(.07,.07,.07);return m}
const mats={
ground:mat("ground","#6d745c"),road:mat("road","#3d4146"),sidewalk:mat("sidewalk","#a6a9aa"),wall1:mat("wall1","#c8b79e"),wall2:mat("wall2","#9aa8b2"),wall3:mat("wall3","#b48f79"),
dark:mat("dark","#28313a"),glass:mat("glass","#477389"),white:mat("white","#e7e4de"),red:mat("red","#b64037"),blue:mat("blue","#345f9b"),yellow:mat("yellow","#d8ad3d"),green:mat("green","#50785b"),skin:mat("skin","#d0a17f"),orange:mat("orange","#bf6c31")
};

const camera=new BABYLON.FreeCamera("camera",new BABYLON.Vector3(0,15.5,27),scene);camera.inputs.clear();camera.fov=.78;camera.minZ=.1;camera.maxZ=500;scene.activeCamera=camera;
let yaw=0,pitch=-.10,zoom=4,scoped=false,reloading=false,lastShot=0,score=0,hits=0,ammo=5,streak=0,mission=null;
const movers=[],targets=[],hitFx=[];
const missionOptions=[
{type:"person",color:"red",label:"赤い服の人物"},{type:"person",color:"blue",label:"青い服の人物"},{type:"person",color:"green",label:"緑の服の人物"},{type:"person",color:"yellow",label:"黄色い服の人物"},
{type:"car",color:"red",label:"赤い車"},{type:"car",color:"blue",label:"青い車"},{type:"car",color:"green",label:"緑の車"},{type:"car",color:"yellow",label:"黄色い車"},
{type:"sign",color:"red",label:"赤い看板"},{type:"sign",color:"blue",label:"青い看板"},{type:"sign",color:"yellow",label:"黄色い看板"},{type:"crate",color:"orange",label:"オレンジ色の箱"}
];

function registerTarget(mesh,type,points,attrs={}){mesh.metadata={targetType:type,points,...attrs};targets.push(mesh);return mesh}
window.StreetScopeWorld.build(scene,mats,registerTarget,movers);

function applyCamera(){camera.rotation.x=pitch;camera.rotation.y=yaw} applyCamera();
function hud(){ui.score.textContent=score;ui.hits.textContent=hits;ui.ammo.textContent=`${ammo} / 5`;ui.streak.textContent=streak}
function message(t){ui.msg.textContent=t;ui.msg.style.opacity=1;clearTimeout(message.timer);message.timer=setTimeout(()=>ui.msg.style.opacity=0,650)}
function newMission(){
  let next;do{next=missionOptions[Math.floor(Math.random()*missionOptions.length)]}while(mission&&next.type===mission.type&&next.color===mission.color);
  mission={...next,timeLeft:22};ui.mission.textContent=mission.label+" を撃て";ui.missionTime.textContent=mission.timeLeft.toFixed(1);
}
function correct(meta){return mission&&meta.targetType===mission.type&&meta.color===mission.color}
function setScope(v){scoped=v;ui.scope.style.display=v?"block":"none";ui.cross.style.display=v?"none":"block";camera.fov=v?.78/zoom:.78;ui.zoom.textContent=zoom.toFixed(1)+"x"}
function impact(point,ok){
  const s=BABYLON.MeshBuilder.CreateSphere("fx",{diameter:ok?.23:.14,segments:6},scene),m=new BABYLON.StandardMaterial("fxm",scene);
  s.position.copyFrom(point);m.emissiveColor=ok?new BABYLON.Color3(1,.72,.2):new BABYLON.Color3(.8,.8,.8);m.diffuseColor=m.emissiveColor;s.material=m;hitFx.push({s,m,life:.18});
}
function knockOut(mesh){const m=movers.find(v=>v.parts.includes(mesh));if(!m||!m.alive)return;m.alive=false;m.respawn=2.6;m.parts.forEach(p=>p.setEnabled(false))}
async function reload(){
  if(reloading||ammo===5)return;reloading=true;ui.state.textContent="RELOADING";ui.reload.style.display="block";
  const st=performance.now(),dur=1150;await new Promise(done=>{function f(n){const p=Math.min(1,(n-st)/dur);ui.reloadFill.style.width=p*100+"%";p<1?requestAnimationFrame(f):done()}requestAnimationFrame(f)});
  ammo=5;reloading=false;ui.reload.style.display="none";ui.reloadFill.style.width=0;ui.state.textContent="READY";hud();
}
function shoot(){
  if(document.pointerLockElement!==canvas||reloading)return;const now=performance.now();if(now-lastShot<320)return;if(ammo<=0){reload();return}
  lastShot=now;ammo--;hud();pitch=Math.max(-.95,Math.min(.62,pitch-(scoped?.009:.016)));applyCamera();
  const pick=scene.pickWithRay(camera.getForwardRay(300),m=>m&&m.metadata&&m.metadata.targetType);
  if(pick&&pick.hit){
    const mesh=pick.pickedMesh,meta=mesh.metadata,type=meta.targetType,dist=BABYLON.Vector3.Distance(camera.position,pick.pickedPoint);
    if(correct(meta)){
      streak++;hits++;const pts=180+Math.floor(dist/25)*10+Math.min(200,Math.max(0,streak-1)*20);score+=pts;impact(pick.pickedPoint,true);
      ui.hit.style.display="block";setTimeout(()=>ui.hit.style.display="none",120);message(`MISSION CLEAR +${pts}`);if(type==="person"||type==="car")knockOut(mesh);newMission();
    }else{
      score-=50;streak=0;impact(pick.pickedPoint,false);message("WRONG TARGET -50");if(type==="person"||type==="car")knockOut(mesh);
    }hud();
  }
  if(ammo<=0)setTimeout(reload,350);
}

ui.startBtn.onclick=()=>canvas.requestPointerLock();canvas.onclick=()=>{if(document.pointerLockElement!==canvas)canvas.requestPointerLock()};
document.addEventListener("pointerlockchange",()=>{const on=document.pointerLockElement===canvas;ui.start.style.display=on?"none":"flex";if(!on)setScope(false)});
document.addEventListener("mousemove",e=>{if(document.pointerLockElement!==canvas)return;const s=scoped?.00065*(4/zoom):.00165;yaw-=e.movementX*s;pitch-=e.movementY*s;pitch=Math.max(-.95,Math.min(.62,pitch));applyCamera()});
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
});
hud();newMission();engine.runRenderLoop(()=>scene.render());addEventListener("resize",()=>engine.resize());
})();