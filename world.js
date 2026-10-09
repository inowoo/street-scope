window.StreetScopeWorld = (() => {
  function build(scene, mats, registerTarget, movers) {
    const WORLD_MIN = -240;
    const WORLD_MAX = 240;

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(.25, 1, .15), scene);
    hemi.intensity = .82;
    const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-.35, -1, -.25), scene);
    sun.position = new BABYLON.Vector3(70, 100, 55);
    sun.intensity = .68;

    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 340, height: 540 }, scene);
    ground.position.y = -.03;
    ground.material = mats.ground;

    const road = BABYLON.MeshBuilder.CreateGround('road', { width: 30, height: 520 }, scene);
    road.position.y = .01;
    road.material = mats.road;

    for (const z of [-180, -120, -60, 0, 60, 120, 180]) {
      const crossRoad = BABYLON.MeshBuilder.CreateGround('crossRoad', { width: 330, height: 14 }, scene);
      crossRoad.position.set(0, .012, z);
      crossRoad.material = mats.road;
    }

    for (const x of [-19, 19]) {
      const sidewalk = BABYLON.MeshBuilder.CreateBox('sidewalk', { width: 8, height: .26, depth: 520 }, scene);
      sidewalk.position.set(x, .13, 0);
      sidewalk.material = mats.sidewalk;
    }

    for (let z = WORLD_MIN; z <= WORLD_MAX; z += 10) {
      const dash = BABYLON.MeshBuilder.CreateBox('dash', { width: .28, height: .04, depth: 4.6 }, scene);
      dash.position.set(0, .05, z);
      dash.material = mats.white;
    }
    for (const x of [-7.5, 7.5]) {
      for (let z = WORLD_MIN; z <= WORLD_MAX; z += 13) {
        const lane = BABYLON.MeshBuilder.CreateBox('laneDash', { width: .18, height: .035, depth: 5.5 }, scene);
        lane.position.set(x, .045, z);
        lane.material = mats.white;
      }
    }

    function emphasize(mesh, color) {
      mesh.renderOutline = true;
      mesh.outlineWidth = .035;
      mesh.outlineColor = color === 'black' ? new BABYLON.Color3(1, 1, 1) : new BABYLON.Color3(.04, .04, .04);
    }

    function makeDestroyGroup(kind, root, parts) {
      return { kind, root, parts, alive: true };
    }

    const buildingMats = [mats.wall1, mats.wall2, mats.wall3];
    const windowTargetColors = ['red', 'blue', 'yellow', 'black', 'white'];
    let windowTargetId = 0;

    function addWindowTarget(side, facadeX, y, z, color) {
      const root = new BABYLON.TransformNode('windowPersonRoot' + windowTargetId++, scene);
      root.position.set(facadeX - side * .12, y, z);

      const recess = BABYLON.MeshBuilder.CreateBox('windowTargetRecess', { width: .08, height: 1.7, depth: 1.25 }, scene);
      recess.parent = root;
      recess.position.x = side * .05;
      recess.material = mats.dark;
      recess.isPickable = false;

      const body = BABYLON.MeshBuilder.CreateCylinder('windowPersonBody', { diameterTop: .5, diameterBottom: .62, height: .86, tessellation: 8 }, scene);
      const head = BABYLON.MeshBuilder.CreateSphere('windowPersonHead', { diameter: .4, segments: 8 }, scene);
      body.parent = head.parent = root;
      body.position.y = -.18;
      head.position.y = .45;
      body.material = mats[color];
      head.material = mats.skin;
      emphasize(body, color);

      const group = makeDestroyGroup('windowPerson', root, [body, head]);
      registerTarget(body, 'windowPerson', 140, { color, destroyGroup: group });
      registerTarget(head, 'windowPerson', 140, { color, destroyGroup: group });
    }

    function addBuilding(side, band, i, z) {
      const w = 10 + ((i + band) % 4) * 2.4;
      const d = 15 + ((i + band * 2) % 5) * 2.2;
      const h = 17 + ((i * 2 + band) % 7) * 4.2 + band * 4;
      const centerX = [32, 58, 88][band];
      const x = side * (centerX + w * .5);
      const building = BABYLON.MeshBuilder.CreateBox('building', { width: w, height: h, depth: d }, scene);
      building.position.set(x, h / 2, z);
      building.material = buildingMats[(i + band + (side > 0 ? 1 : 0)) % buildingMats.length];

      if (band !== 0) return;

      const facadeX = x - side * (w / 2 + .035);
      const floorCount = Math.max(3, Math.floor(h / 3.0));
      for (let f = 1; f < floorCount; f++) {
        for (let c = -1; c <= 1; c++) {
          const wz = z + c * 3.4;
          const wy = 1.55 + f * 2.85;
          const win = BABYLON.MeshBuilder.CreateBox('window', { width: 1.42, height: 1.42, depth: .055 }, scene);
          win.position.set(facadeX, wy, wz);
          win.rotation.y = Math.PI / 2;
          win.material = mats.glass;

          if ((i + f + c + (side > 0 ? 2 : 0)) % 9 === 0 && windowTargetId < 24) {
            const color = windowTargetColors[windowTargetId % windowTargetColors.length];
            win.isVisible = false;
            addWindowTarget(side, facadeX, wy, wz, color);
          }
        }
      }
    }

    for (const side of [-1, 1]) {
      for (let band = 0; band < 3; band++) {
        let i = 0;
        for (let z = -225 + band * 7; z <= 225; z += 28) {
          addBuilding(side, band, i++, z);
        }
      }
    }

    // Far skyline to keep the horizon filled on wide displays.
    for (const backZ of [-255, 255]) {
      for (let x = -150, i = 0; x <= 150; x += 22, i++) {
        const w = 17 + (i % 3) * 3;
        const h = 28 + (i % 6) * 7;
        const b = BABYLON.MeshBuilder.CreateBox('skyline', { width: w, height: h, depth: 16 }, scene);
        b.position.set(x, h / 2, backZ);
        b.material = buildingMats[i % buildingMats.length];
        b.isPickable = false;
      }
    }

    const ledge = BABYLON.MeshBuilder.CreateBox('ledge', { width: 16, height: 1.15, depth: 1.2 }, scene);
    ledge.position.set(0, 18.2, 56);
    ledge.material = mats.wall2;

    for (const sx of [-14.5, 14.5]) {
      for (let z = -225; z <= 225; z += 26) {
        const pole = BABYLON.MeshBuilder.CreateCylinder('lampPole', { diameter: .18, height: 5.0 }, scene);
        pole.position.set(sx, 2.5, z);
        pole.material = mats.dark;
        const lamp = BABYLON.MeshBuilder.CreateBox('lamp', { width: .7, height: .28, depth: .38 }, scene);
        lamp.position.set(sx, 4.85, z);
        lamp.material = mats.white;
      }
    }

    for (let i = 0; i < 30; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const box = BABYLON.MeshBuilder.CreateBox('crate', { size: 1.45 }, scene);
      box.position.set(side * (15.2 + (i % 3) * 1.25), .85, -215 + i * 14.5);
      box.material = i % 4 === 0 ? mats.white : mats.wall1;
      registerTarget(box, 'object', 25, { color: i % 4 === 0 ? 'white' : 'neutral' });
    }

    const signColors = ['red', 'blue', 'yellow', 'black', 'white'];
    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const color = signColors[i % signColors.length];
      const root = new BABYLON.TransformNode('signRoot' + i, scene);
      root.position.set(side * 14.8, 0, -210 + i * 20);
      const sign = BABYLON.MeshBuilder.CreateBox('sign', { width: 2.0, height: 1.3, depth: .16 }, scene);
      const pole = BABYLON.MeshBuilder.CreateCylinder('signPole', { diameter: .11, height: 2.3 }, scene);
      sign.parent = pole.parent = root;
      sign.position.y = 2.8;
      pole.position.y = 1.15;
      sign.material = mats[color];
      pole.material = mats.dark;
      emphasize(sign, color);
      const group = makeDestroyGroup('sign', root, [sign, pole]);
      registerTarget(sign, 'sign', 40, { color, destroyGroup: group });
    }

    const personColors = ['red', 'blue', 'yellow', 'black', 'white'];
    function person(id, laneX, z, dir, laneId) {
      const root = new BABYLON.TransformNode('person' + id, scene);
      const color = personColors[id % personColors.length];
      const body = BABYLON.MeshBuilder.CreateCylinder('body', { diameterTop: .58, diameterBottom: .72, height: 1.3, tessellation: 8 }, scene);
      const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: .55, segments: 8 }, scene);
      const ll = BABYLON.MeshBuilder.CreateBox('leg', { width: .22, height: .85, depth: .25 }, scene);
      const lr = ll.clone('leg2');
      body.parent = head.parent = ll.parent = lr.parent = root;
      body.position.y = 1.25;
      head.position.y = 2.12;
      ll.position.set(-.18, .43, 0);
      lr.position.set(.18, .43, 0);
      body.material = mats[color];
      head.material = mats.skin;
      ll.material = lr.material = mats.dark;
      emphasize(body, color);
      root.position.set(laneX, .15, z);
      const parts = [body, head, ll, lr];
      parts.forEach(p => registerTarget(p, 'person', 100, { color }));
      const baseSpeed = 1.55 + (id % 4) * .18;
      movers.push({ kind: 'person', root, parts, baseSpeed, speed: baseSpeed, dir, laneId, minGap: 2.5, t: id * .7, alive: true, destroying: false, respawn: 0, worldMin: WORLD_MIN, worldMax: WORLD_MAX, spawnY: .15 });
    }

    const pedLanes = [
      { x: -17.0, dir: 1, id: 'ped-l-up' },
      { x: -20.2, dir: -1, id: 'ped-l-down' },
      { x: 17.0, dir: -1, id: 'ped-r-down' },
      { x: 20.2, dir: 1, id: 'ped-r-up' },
    ];
    let personId = 0;
    for (const lane of pedLanes) {
      for (let i = 0; i < 8; i++) person(personId++, lane.x, -215 + i * 60 + (lane.dir < 0 ? 24 : 0), lane.dir, lane.id);
    }

    const carColors = ['red', 'blue', 'yellow', 'black', 'white'];
    function car(id, laneX, z, dir, laneId) {
      const root = new BABYLON.TransformNode('car' + id, scene);
      const color = carColors[id % carColors.length];
      const body = BABYLON.MeshBuilder.CreateBox('carBody', { width: 2.25, height: .78, depth: 4.25 }, scene);
      const cabin = BABYLON.MeshBuilder.CreateBox('carCabin', { width: 1.78, height: .76, depth: 1.95 }, scene);
      body.parent = cabin.parent = root;
      body.position.y = .78;
      cabin.position.set(0, 1.4, -.15 * dir);
      body.material = mats[color];
      cabin.material = mats.glass;
      emphasize(body, color);
      root.position.set(laneX, 0, z);
      if (dir < 0) root.rotation.y = Math.PI;
      const parts = [body, cabin];
      parts.forEach(p => registerTarget(p, 'car', 60, { color }));
      const baseSpeed = 6.0 + (id % 4) * .75;
      movers.push({ kind: 'car', root, parts, baseSpeed, speed: baseSpeed, dir, laneId, minGap: 7.2, alive: true, destroying: false, respawn: 0, worldMin: WORLD_MIN, worldMax: WORLD_MAX, spawnY: 0 });
    }

    const carLanes = [
      { x: -10.5, dir: 1, id: 'car-a' },
      { x: -5.2, dir: 1, id: 'car-b' },
      { x: 5.2, dir: -1, id: 'car-c' },
      { x: 10.5, dir: -1, id: 'car-d' },
    ];
    let carId = 0;
    for (const lane of carLanes) {
      for (let i = 0; i < 7; i++) car(carId++, lane.x, -215 + i * 73 + (lane.dir < 0 ? 28 : 0), lane.dir, lane.id);
    }

    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogStart = 280;
    scene.fogEnd = 560;
    scene.fogColor = new BABYLON.Color3(.60, .76, .89);

    return { worldMin: WORLD_MIN, worldMax: WORLD_MAX };
  }

  return { build };
})();
