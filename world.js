window.StreetScopeWorld = (() => {
function build(scene, mats, registerTarget, movers) {
  const hemi=new BABYLON.HemisphericLight("hemi",new BABYLON.Vector3(.25,1,.15),scene); hemi.intensity=.82;
  const sun=new BABYLON.DirectionalLight("sun",new BABYLON.Vector3(-.35,-1,-.25),scene); sun.position=new BABYLON.Vector3(30,55,30); sun.intensity=.65;

  const ground=BABYLON.MeshBuilder.CreateGround("ground",{width:100,height:180},scene); ground.position.y=-.02; ground.material=mats.ground;
  const road=BABYLON.MeshBuilder.CreateGround("road",{width:18,height:180},scene); road.position.y=.01; road.material=mats.road;
  for(const x of[-11.5,11.5]){const s=BABYLON.MeshBuilder.CreateBox("sidewalk",{width:5,height:.25,depth:180},scene);s.position.set(x,.125,0);s.material=mats.sidewalk}
  for(let z=-80;z<90;z+=9){const d=BABYLON.MeshBuilder.CreateBox("dash",{width:.25,height:.04,depth:4.4},scene);d.position.set(0,.05,z);d.material=mats.white}

  const bm=[mats.wall1,mats.wall2,mats.wall3];
  for(const side of[-1,1])for(let i=0;i<9;i++){
    const w=8+(i%3)*1.8,d=14+(i%2)*3,h=11+(i%4)*3.2,z=-72+i*19,x=side*(17+w*.5);
    const b=BABYLON.MeshBuilder.CreateBox("building",{width:w,height:h,depth:d},scene);b.position.set(x,h/2,z);b.material=bm[(i+(side>0?1:0))%3];
    for(let f=1;f<Math.floor(h/3);f++)for(let c=-1;c<=1;c++){
      const win=BABYLON.MeshBuilder.CreateBox("window",{width:1.25,height:1.25,depth:.05},scene);
      win.position.set(x-side*(w/2+.03),1.6+f*2.8,z+c*3);win.rotation.y=Math.PI/2;win.material=mats.glass;
    }
  }

  const ledge=BABYLON.MeshBuilder.CreateBox("ledge",{width:12,height:1,depth:1.1},scene);ledge.position.set(0,12.5,23.5);ledge.material=mats.wall2;
  for(const sx of[-8.8,8.8])for(let z=-72;z<80;z+=24){
    const p=BABYLON.MeshBuilder.CreateCylinder("lampPole",{diameter:.18,height:4.8},scene);p.position.set(sx,2.4,z);p.material=mats.dark;
    const l=BABYLON.MeshBuilder.CreateBox("lamp",{width:.6,height:.25,depth:.35},scene);l.position.set(sx,4.7,z);l.material=mats.white;
  }

  for(let i=0;i<16;i++){
    const side=i%2===0?-1:1, orange=i%3===0;
    const box=BABYLON.MeshBuilder.CreateBox("crate",{size:1.4},scene);box.position.set(side*(8.8+(i%3)*.8),.82,-66+i*8.8);box.material=orange?mats.orange:mats.wall1;
    registerTarget(box,orange?"crate":"object",25,{color:orange?"orange":"tan"});
  }

  const signColors=["red","blue","yellow"];
  for(let i=0;i<7;i++){
    const side=i%2===0?-1:1,color=signColors[i%3];
    const s=BABYLON.MeshBuilder.CreateBox("sign",{width:1.8,height:1.2,depth:.15},scene);s.position.set(side*9.6,2.6,-55+i*18);s.material=mats[color];
    const p=BABYLON.MeshBuilder.CreateCylinder("signPole",{diameter:.1,height:2.2},scene);p.position.set(side*9.6,1.1,-55+i*18);p.material=mats.dark;
    registerTarget(s,"sign",40,{color});
  }

  const personColors=["red","blue","green","yellow"];
  function person(id,x,z,dir){
    const root=new BABYLON.TransformNode("person"+id,scene),color=personColors[id%4];
    const body=BABYLON.MeshBuilder.CreateCylinder("body",{diameterTop:.55,diameterBottom:.7,height:1.25,tessellation:8},scene);
    const head=BABYLON.MeshBuilder.CreateSphere("head",{diameter:.55,segments:8},scene);
    const ll=BABYLON.MeshBuilder.CreateBox("leg",{width:.22,height:.85,depth:.25},scene),lr=ll.clone("leg2");
    body.parent=head.parent=ll.parent=lr.parent=root;body.position.y=1.25;head.position.y=2.12;ll.position.set(-.18,.43,0);lr.position.set(.18,.43,0);
    body.material=mats[color];head.material=mats.skin;ll.material=lr.material=mats.dark;root.position.set(x,.15,z);
    const parts=[body,head,ll,lr];parts.forEach(p=>registerTarget(p,"person",100,{color}));
    movers.push({kind:"person",root,parts,speed:2.1+(id%3)*.35,dir,t:id*.7,alive:true,respawn:0});
  }
  for(let i=0;i<12;i++){const side=i%2===0?-1:1;person(i,side*(10.4+(i%3)*.45),-70+i*12,i%4<2?1:-1)}

  const carColors=["red","blue","yellow","green"];
  function car(id,x,z,dir){
    const root=new BABYLON.TransformNode("car"+id,scene),color=carColors[id%4];
    const body=BABYLON.MeshBuilder.CreateBox("carBody",{width:2.2,height:.75,depth:4.2},scene);
    const cab=BABYLON.MeshBuilder.CreateBox("carCabin",{width:1.75,height:.75,depth:1.9},scene);
    body.parent=cab.parent=root;body.position.y=.75;cab.position.set(0,1.35,-.15*dir);body.material=mats[color];cab.material=mats.glass;root.position.set(x,0,z);if(dir<0)root.rotation.y=Math.PI;
    const parts=[body,cab];parts.forEach(p=>registerTarget(p,"car",60,{color}));
    movers.push({kind:"car",root,parts,speed:5+(id%3)*1.1,dir,alive:true,respawn:0});
  }
  for(let i=0;i<8;i++){const dir=i%2===0?1:-1;car(i,dir>0?-3.5:3.5,-78+i*21,dir)}

  scene.fogMode=BABYLON.Scene.FOGMODE_LINEAR;scene.fogStart=100;scene.fogEnd=190;scene.fogColor=new BABYLON.Color3(.60,.76,.89);
}
return {build};
})();