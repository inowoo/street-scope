window.StreetScopeWorld = (() => {
  function build(scene, mats, registerTarget, movers) {
    // Gameplay movers live in this range, while the visual city continues far beyond it.
    const WORLD_MIN = -360;
    const WORLD_MAX = 520;
    const VISUAL_MIN = -1000;
    const VISUAL_MAX = 1100;

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(.25, 1, .15), scene);
    hemi.intensity = .84;
    const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-.35, -1, -.25), scene);
    sun.position = new BABYLON.Vector3(110, 150, 80);
    sun.intensity = .69;

    // Huge ground and roads: road ends are intentionally placed beyond the camera's useful view.
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 1800, height: 2200 }, scene);
    ground.position.y = -.03;
    ground.material = mats.ground;

    const road = BABYLON.MeshBuilder.CreateGround('road', { width: 32, height: 2100 }, scene);
    road.position.set(0, .01, 50);
    road.material = mats.road;

    // Repeating cross streets make the main road read as a real city rather than one endless strip.
    const crossStreetZ = [];
    for (let z = -860; z <= 980; z += 140) crossStreetZ.push(z);
    for (const z of crossStreetZ) {
      const crossRoad = BABYLON.MeshBuilder.CreateGround('crossRoad', { width: 1500, height: 18 }, scene);
      crossRoad.position.set(0, .012, z);
      crossRoad.material = mats.road;

      // Sidewalk strips on both sides of each cross street.
      for (const dz of [-12.0, 12.0]) {
        const walk = BABYLON.MeshBuilder.CreateBox('crossWalk', { width: 1500, height: .24, depth: 5.5 }, scene);
        walk.position.set(0, .12, z + dz);
        walk.material = mats.sidewalk;
      }
    }

    for (const x of [-20, 20]) {
      const sidewalk = BABYLON.MeshBuilder.CreateBox('sidewalk', { width: 8.5, height: .26, depth: 2100 }, scene);
      sidewalk.position.set(x, .13, 50);
      sidewalk.material = mats.sidewalk;
    }

    for (let z = VISUAL_MIN; z <= VISUAL_MAX; z += 10) {
      const dash = BABYLON.MeshBuilder.CreateBox('dash', { width: .28, height: .04, depth: 4.6 }, scene);
      dash.position.set(0, .05, z);
      dash.material = mats.white;
    }
    for (const x of [-8, 8]) {
      for (let z = VISUAL_MIN; z <= VISUAL_MAX; z += 13) {
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

    function addDetailedBuilding(side, band, i, z) {
      const w = 11 + ((i + band) % 4) * 2.5;
      const d = 17 + ((i + band * 2) % 5) * 2.4;
      const h = 18 + ((i * 2 + band) % 7) * 4.4 + band * 4;
      const centerX = [34, 66, 104][band];
      const x = side * (centerX + w * .5);
      const building = BABYLON.MeshBuilder.CreateBox('building', { width: w, height: h, depth: d }, scene);
      building.position.set(x, h / 2, z);
      building.material = buildingMats[(i + band + (side > 0 ? 1 : 0)) % buildingMats.length];

      // Only the nearest row gets windows/targets to keep mesh count reasonable.
      if (band !== 0) return;

      const facadeX = x - side * (w / 2 + .035);
      const floorCount = Math.max(3, Math.floor(h / 3.1));
      for (let f = 1; f < floorCount; f++) {
        for (let c = -1; c <= 1; c++) {
          const wz = z + c * 3.5;
          const wy = 1.55 + f * 2.9;
          const win = BABYLON.MeshBuilder.CreateBox('window', { width: 1.45, height: 1.45, depth: .055 }, scene);
          win.position.set(facadeX, wy, wz);
          win.rotation.y = Math.PI / 2;
          win.material = mats.glass;

          if ((i + f + c + (side > 0 ? 2 : 0)) % 10 === 0 && windowTargetId < 28) {
            const color = windowTargetColors[windowTargetId % windowTargetColors.length];
            win.isVisible = false;
            addWindowTarget(side, facadeX, wy, wz, color);
          }
        }
      }
    }

    // Detailed city around the playable corridor.
    for (const side of [-1, 1]) {
      for (let band = 0; band < 3; band++) {
        let i = 0;
        for (let z = -390 + band * 9; z <= 610; z += 34) addDetailedBuilding(side, band, i++, z);
      }
    }

    // Continue the city far beyond the active gameplay area with cheaper blocks.
    function addFarCityRow(side, xBase, zStart, zEnd, step, seed) {
      let i = 0;
      for (let z = zStart; z <= zEnd; z += step, i++) {
        const w = 18 + ((i + seed) % 4) * 5;
        const d = 22 + ((i + seed * 2) % 3) * 8;
        const h = 28 + ((i * 3 + seed) % 8) * 8;
        const b = BABYLON.MeshBuilder.CreateBox('farBuilding', { width: w, height: h, depth: d }, scene);
        b.position.set(side * (xBase + w * .5), h / 2, z);
        b.material = buildingMats[(i + seed) % buildingMats.length];
        b.isPickable = false;
      }
    }

    for (const side of [-1, 1]) {
      addFarCityRow(side, 38, -930, -430, 48, 1);
      addFarCityRow(side, 38, 650, 1040, 48, 2);
      addFarCityRow(side, 88, -940, 1040, 62, 3);
      addFarCityRow(side, 145, -940, 1040, 76, 4);
    }

    // City blocks along several major cross streets, so looking left/right also stays urban.
    for (let zi = 0; zi < crossStreetZ.length; zi++) {
      const z = crossStreetZ[zi];
      for (const sideX of [-1, 1]) {
        for (let n = 0; n < 9; n++) {
          const xAbs = 185 + n * 54;
          const w = 28 + ((n + zi) % 3) * 7;
          const d = 27 + ((n + zi * 2) % 3) * 6;
          const h = 32 + ((n * 2 + zi) % 7) * 9;
          const b = BABYLON.MeshBuilder.CreateBox('crossCity', { width: w, height: h, depth: d }, scene);
          b.position.set(sideX * xAbs, h / 2, z + ((n % 2) ? 30 : -30));
          b.material = buildingMats[(n + zi) % buildingMats.length];
          b.isPickable = false;
        }
      }
    }

    // Circular backdrop / kakIwari: a sky cylinder and a ring of distant skyline blocks.
    const skyMat = new BABYLON.StandardMaterial('skyBackdropMat', scene);
    skyMat.diffuseColor = new BABYLON.Color3(.57, .72, .82);
    skyMat.emissiveColor = new BABYLON.Color3(.14, .19, .22);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    const sky = BABYLON.MeshBuilder.CreateCylinder('skyBackdrop', { diameter: 1660, height: 300, tessellation: 64, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    sky.position.y = 125;
    sky.material = skyMat;
    sky.isPickable = false;

    const skylineRadius = 700;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const w = 25 + (i % 4) * 8;
      const d = 24 + (i % 3) * 7;
      const h = 45 + (i % 9) * 10;
      const b = BABYLON.MeshBuilder.CreateBox('backdropBuilding', { width: w, height: h, depth: d }, scene);
      b.position.set(Math.cos(a) * skylineRadius, h / 2 - 2, Math.sin(a) * skylineRadius + 60);
      b.rotation.y = -a;
      b.material = buildingMats[i % buildingMats.length];
      b.isPickable = false;
    }

    const ledge = BABYLON.MeshBuilder.CreateBox('ledge', { width: 17, height: 1.15, depth: 1.2 }, scene);
    ledge.position.set(0, 18.2, 56);
    ledge.material = mats.wall2;

    for (const sx of [-15.0, 15.0]) {
      for (let z = -410; z <= 610; z += 27) {
        const pole = BABYLON.MeshBuilder.CreateCylinder('lampPole', { diameter: .18, height: 5.0 }, scene);
        pole.position.set(sx, 2.5, z);
        pole.material = mats.dark;
        const lamp = BABYLON.MeshBuilder.CreateBox('lamp', { width: .7, height: .28, depth: .38 }, scene);
        lamp.position.set(sx, 4.85, z);
        lamp.material = mats.white;
      }
    }

    for (let i = 0; i < 34; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const box = BABYLON.MeshBuilder.CreateBox('crate', { size: 1.45 }, scene);
      box.position.set(side * (15.8 + (i % 3) * 1.25), .85, -330 + i * 25.0);
      box.material = i % 4 === 0 ? mats.white : mats.wall1;
      registerTarget(box, 'object', 25, { color: i % 4 === 0 ? 'white' : 'neutral' });
    }

    const signColors = ['red', 'blue', 'yellow', 'black', 'white'];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const color = signColors[i % signColors.length];
      const root = new BABYLON.TransformNode('signRoot' + i, scene);
      root.position.set(side * 15.4, 0, -320 + i * 32);
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
    function person(id, laneX, z, dir, laneId, phase) {
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
      movers.push({ kind: 'person', root, parts, baseSpeed, speed: baseSpeed, dir, laneId, minGap: 3.2, t: id * .7, alive: true, destroying: false, respawn: 0, worldMin: WORLD_MIN + phase, worldMax: WORLD_MAX + phase, spawnY: .15 });
    }

    const pedLanes = [
      { x: -17.3, dir: 1, id: 'ped-l-up', phase: 0 },
      { x: -20.7, dir: -1, id: 'ped-l-down', phase: 19 },
      { x: 17.3, dir: -1, id: 'ped-r-down', phase: 38 },
      { x: 20.7, dir: 1, id: 'ped-r-up', phase: 57 },
    ];
    let personId = 0;
    for (let laneIndex = 0; laneIndex < pedLanes.length; laneIndex++) {
      const lane = pedLanes[laneIndex];
      const count = 9;
      const span = WORLD_MAX - WORLD_MIN - 80;
      for (let i = 0; i < count; i++) {
        const z = WORLD_MIN + 40 + (i / count) * span + laneIndex * 21;
        person(personId++, lane.x, z, lane.dir, lane.id, lane.phase);
      }
    }

    const carColors = ['red', 'blue', 'yellow', 'black', 'white'];
    function car(id, laneX, z, dir, laneId, phase) {
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
      movers.push({ kind: 'car', root, parts, baseSpeed, speed: baseSpeed, dir, laneId, minGap: 10.0, alive: true, destroying: false, respawn: 0, worldMin: WORLD_MIN + phase, worldMax: WORLD_MAX + phase, spawnY: 0 });
    }

    const carLanes = [
      { x: -11.0, dir: 1, id: 'car-a', phase: 0 },
      { x: -5.5, dir: 1, id: 'car-b', phase: 27 },
      { x: 5.5, dir: -1, id: 'car-c', phase: 54 },
      { x: 11.0, dir: -1, id: 'car-d', phase: 81 },
    ];
    let carId = 0;
    for (let laneIndex = 0; laneIndex < carLanes.length; laneIndex++) {
      const lane = carLanes[laneIndex];
      const count = 7;
      const span = WORLD_MAX - WORLD_MIN - 120;
      for (let i = 0; i < count; i++) {
        const z = WORLD_MIN + 60 + (i / count) * span + laneIndex * 31;
        car(carId++, lane.x, z, lane.dir, lane.id, lane.phase);
      }
    }

    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogStart = 430;
    scene.fogEnd = 790;
    scene.fogColor = new BABYLON.Color3(.60, .76, .89);

    return { worldMin: WORLD_MIN, worldMax: WORLD_MAX };
  }

  return { build };
})();
