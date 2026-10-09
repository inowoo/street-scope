window.StreetScopeWorld = (() => {
  function build(scene, mats, registerTarget, movers) {
    const WORLD_MIN = -420;
    const WORLD_MAX = 640;
    const ROAD_MIN = -900;
    const ROAD_MAX = 900;
    const CITY_RADIUS = 1150;

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(.25, 1, .15), scene);
    hemi.intensity = .9;
    const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-.35, -1, -.25), scene);
    sun.position = new BABYLON.Vector3(120, 170, 70);
    sun.intensity = .72;

    BABYLON.Effect.ShadersStore.streetSkyVertexShader = `
      precision highp float;
      attribute vec3 position;
      uniform mat4 worldViewProjection;
      varying vec3 vPosition;
      void main(void) {
        vPosition = position;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;
    BABYLON.Effect.ShadersStore.streetSkyFragmentShader = `
      precision highp float;
      varying vec3 vPosition;
      void main(void) {
        float h = normalize(vPosition).y * 0.5 + 0.5;
        vec3 horizon = vec3(0.76, 0.88, 0.97);
        vec3 middle = vec3(0.43, 0.68, 0.89);
        vec3 zenith = vec3(0.19, 0.43, 0.74);
        vec3 c = mix(horizon, middle, smoothstep(0.30, 0.62, h));
        c = mix(c, zenith, smoothstep(0.62, 1.00, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `;
    const skyMat = new BABYLON.ShaderMaterial('streetSkyMaterial', scene, { vertex: 'streetSky', fragment: 'streetSky' }, { attributes: ['position'], uniforms: ['worldViewProjection'] });
    skyMat.backFaceCulling = false;
    skyMat.disableDepthWrite = true;
    const skyBox = BABYLON.MeshBuilder.CreateBox('skyBox', { size: 2200 }, scene);
    skyBox.material = skyMat;
    skyBox.infiniteDistance = true;
    skyBox.isPickable = false;
    skyBox.applyFog = false;

    const cityBase = BABYLON.MeshBuilder.CreateGround('cityBase', { width: 1800, height: 2100 }, scene);
    cityBase.position.y = -.04;
    cityBase.material = mats.sidewalk;

    const mainRoad = BABYLON.MeshBuilder.CreateGround('mainRoad', { width: 32, height: ROAD_MAX - ROAD_MIN }, scene);
    mainRoad.position.set(0, .01, (ROAD_MIN + ROAD_MAX) * .5);
    mainRoad.material = mats.road;

    const internalCrossings = [];
    for (let z = -760; z <= 760; z += 140) internalCrossings.push(z);
    const terminalCrossings = [ROAD_MIN, ROAD_MAX];
    for (const z of [...internalCrossings, ...terminalCrossings]) {
      const cross = BABYLON.MeshBuilder.CreateGround(z === ROAD_MIN || z === ROAD_MAX ? 'terminalRoad' : 'crossRoad', { width: 1500, height: 20 }, scene);
      cross.position.set(0, .012, z);
      cross.material = mats.road;

      for (const dz of [-13, 13]) {
        const walk = BABYLON.MeshBuilder.CreateBox('crossSidewalk', { width: 1500, height: .22, depth: 5 }, scene);
        walk.position.set(0, .11, z + dz);
        walk.material = mats.sidewalk;
      }
    }

    for (const x of [-20, 20]) {
      const sidewalk = BABYLON.MeshBuilder.CreateBox('mainSidewalk', { width: 8.5, height: .26, depth: ROAD_MAX - ROAD_MIN }, scene);
      sidewalk.position.set(x, .13, (ROAD_MIN + ROAD_MAX) * .5);
      sidewalk.material = mats.sidewalk;
    }

    for (let z = ROAD_MIN + 10; z < ROAD_MAX - 10; z += 10) {
      const dash = BABYLON.MeshBuilder.CreateBox('dash', { width: .28, height: .04, depth: 4.6 }, scene);
      dash.position.set(0, .05, z);
      dash.material = mats.white;
    }
    for (const x of [-8, 8]) {
      for (let z = ROAD_MIN + 12; z < ROAD_MAX - 12; z += 13) {
        const lane = BABYLON.MeshBuilder.CreateBox('laneDash', { width: .18, height: .035, depth: 5.5 }, scene);
        lane.position.set(x, .045, z);
        lane.material = mats.white;
      }
    }

    for (const z of [ROAD_MIN + 18, ROAD_MAX - 18]) {
      const stopBar = BABYLON.MeshBuilder.CreateBox('terminalStopBar', { width: 28, height: .045, depth: .55 }, scene);
      stopBar.position.set(0, .055, z);
      stopBar.material = mats.white;
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
      const w = 11 + ((i + band) % 4) * 2.5;
      const d = 17 + ((i + band * 2) % 5) * 2.4;
      const h = 18 + ((i * 2 + band) % 7) * 4.4 + band * 5;
      const centerX = [35, 68, 108][band];
      const x = side * (centerX + w * .5);
      const building = BABYLON.MeshBuilder.CreateBox('building', { width: w, height: h, depth: d }, scene);
      building.position.set(x, h / 2, z);
      building.material = buildingMats[(i + band + (side > 0 ? 1 : 0)) % buildingMats.length];

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
          if ((i + f + c + (side > 0 ? 2 : 0)) % 10 === 0 && windowTargetId < 30) {
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
        for (let z = ROAD_MIN + 42 + band * 9; z <= ROAD_MAX - 42; z += 34) addBuilding(side, band, i++, z);
      }
    }

    for (let zi = 0; zi < internalCrossings.length; zi++) {
      const z = internalCrossings[zi];
      for (const sideX of [-1, 1]) {
        for (let n = 0; n < 11; n++) {
          const xAbs = 175 + n * 52;
          const w = 26 + ((n + zi) % 3) * 7;
          const d = 28 + ((n + zi * 2) % 3) * 6;
          const h = 30 + ((n * 2 + zi) % 7) * 9;
          const b = BABYLON.MeshBuilder.CreateBox('crossCity', { width: w, height: h, depth: d }, scene);
          b.position.set(sideX * xAbs, h / 2, z + ((n % 2) ? 32 : -32));
          b.material = buildingMats[(n + zi) % buildingMats.length];
          b.isPickable = false;
        }
      }
    }

    for (const endZ of [ROAD_MIN, ROAD_MAX]) {
      const beyondZ = endZ + (endZ > 0 ? 55 : -55);
      let i = 0;
      for (let x = -360; x <= 360; x += 42, i++) {
        const w = 30 + (i % 3) * 5;
        const d = 30 + (i % 2) * 7;
        const h = 32 + (i % 7) * 8;
        const b = BABYLON.MeshBuilder.CreateBox('terminalBlock', { width: w, height: h, depth: d }, scene);
        b.position.set(x, h / 2, beyondZ);
        b.material = buildingMats[i % buildingMats.length];
        b.isPickable = false;
      }
    }

    const skylineRadius = 980;
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const x = Math.cos(a) * skylineRadius;
      const z = Math.sin(a) * skylineRadius;
      if (Math.abs(x) < 95) continue;
      const w = 26 + (i % 4) * 8;
      const d = 24 + (i % 3) * 7;
      const h = 42 + (i % 9) * 10;
      const b = BABYLON.MeshBuilder.CreateBox('backdropBuilding', { width: w, height: h, depth: d }, scene);
      b.position.set(x, h / 2 - 2, z);
      b.rotation.y = -a;
      b.material = buildingMats[i % buildingMats.length];
      b.isPickable = false;
    }

    const ledge = BABYLON.MeshBuilder.CreateBox('ledge', { width: 17, height: 1.15, depth: 1.2 }, scene);
    ledge.position.set(0, 18.2, 56);
    ledge.material = mats.wall2;

    for (const sx of [-15, 15]) {
      for (let z = WORLD_MIN - 30; z <= WORLD_MAX + 30; z += 27) {
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
      box.position.set(side * (15.8 + (i % 3) * 1.25), .85, WORLD_MIN + 45 + i * 28.0);
      box.material = i % 4 === 0 ? mats.white : mats.wall1;
      registerTarget(box, 'object', 25, { color: i % 4 === 0 ? 'white' : 'neutral' });
    }

    const signColors = ['red', 'blue', 'yellow', 'black', 'white'];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const color = signColors[i % signColors.length];
      const root = new BABYLON.TransformNode('signRoot' + i, scene);
      root.position.set(side * 15.4, 0, WORLD_MIN + 60 + i * 38);
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

    const spawnRegistry = { person: [], car: [] };
    function reserveSpawn(kind, desiredZ, globalGap) {
      let z = desiredZ;
      for (let tries = 0; tries < 80; tries++) {
        if (!spawnRegistry[kind].some(v => Math.abs(v - z) < globalGap)) {
          spawnRegistry[kind].push(z);
          return z;
        }
        z += globalGap * 1.45;
        if (z > WORLD_MAX - 25) z = WORLD_MIN + 25 + (tries % 3) * globalGap * .7;
      }
      spawnRegistry[kind].push(z);
      return z;
    }

    const personColors = ['red', 'blue', 'yellow', 'black', 'white'];
    function person(id, laneX, desiredZ, dir, laneId) {
      const z = reserveSpawn('person', desiredZ, 4.5);
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
      const baseSpeed = 1.5 + (id % 4) * .17;
      movers.push({ kind: 'person', root, parts, baseSpeed, speed: baseSpeed, dir, laneId, minGap: 3.2, globalGap: 4.5, t: id * .7, alive: true, destroying: false, respawn: 0, worldMin: WORLD_MIN, worldMax: WORLD_MAX, spawnY: .15 });
    }

    const pedLanes = [
      { x: -17.3, dir: 1, id: 'ped-l-up', phase: 0 },
      { x: -20.4, dir: -1, id: 'ped-l-down', phase: 17 },
      { x: 17.3, dir: -1, id: 'ped-r-down', phase: 34 },
      { x: 20.4, dir: 1, id: 'ped-r-up', phase: 51 },
    ];
    let personId = 0;
    for (const lane of pedLanes) {
      for (let i = 0; i < 8; i++) person(personId++, lane.x, WORLD_MIN + 70 + lane.phase + i * 125, lane.dir, lane.id);
    }

    const carColors = ['red', 'blue', 'yellow', 'black', 'white'];
    function car(id, laneX, desiredZ, dir, laneId) {
      const z = reserveSpawn('car', desiredZ, 12.5);
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
      const baseSpeed = 5.8 + (id % 4) * .7;
      movers.push({ kind: 'car', root, parts, baseSpeed, speed: baseSpeed, dir, laneId, minGap: 8.6, globalGap: 12.5, alive: true, destroying: false, respawn: 0, worldMin: WORLD_MIN, worldMax: WORLD_MAX, spawnY: 0 });
    }

    const carLanes = [
      { x: -10.5, dir: 1, id: 'car-a', phase: 0 },
      { x: -5.2, dir: 1, id: 'car-b', phase: 23 },
      { x: 5.2, dir: -1, id: 'car-c', phase: 47 },
      { x: 10.5, dir: -1, id: 'car-d', phase: 71 },
    ];
    let carId = 0;
    for (const lane of carLanes) {
      for (let i = 0; i < 7; i++) car(carId++, lane.x, WORLD_MIN + 80 + lane.phase + i * 145, lane.dir, lane.id);
    }

    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogStart = 520;
    scene.fogEnd = 1080;
    scene.fogColor = new BABYLON.Color3(.69, .82, .92);

    return { worldMin: WORLD_MIN, worldMax: WORLD_MAX, roadMin: ROAD_MIN, roadMax: ROAD_MAX, cityRadius: CITY_RADIUS };
  }

  return { build };
})();
