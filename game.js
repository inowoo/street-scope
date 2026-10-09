(() => {
  const VERSION = 'v0.8';
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(.60, .76, .89, 1);

  const ui = {
    score: $('score'), hits: $('hits'), ammo: $('ammo'), streak: $('streak'), state: $('state'),
    scope: $('scope'), scopeCursor: $('scopeCursor'), cross: $('cross'), zoom: $('zoom'), hit: $('hit'),
    msg: $('msg'), start: $('start'), startBtn: $('startBtn'), reload: $('reload'),
    reloadFill: $('reload').firstElementChild, mission: $('missionText'), missionTime: $('missionTime')
  };

  function mat(name, hex) {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = BABYLON.Color3.FromHexString(hex);
    m.specularColor = new BABYLON.Color3(.07, .07, .07);
    return m;
  }

  const mats = {
    ground: mat('ground', '#6d745c'), road: mat('road', '#3d4146'), sidewalk: mat('sidewalk', '#a6a9aa'),
    wall1: mat('wall1', '#c8b79e'), wall2: mat('wall2', '#9ba8b2'), wall3: mat('wall3', '#b48f79'),
    dark: mat('dark', '#28313a'), glass: mat('glass', '#477389'), white: mat('white', '#f3f3f3'),
    black: mat('black', '#111111'), red: mat('red', '#d92f2f'), blue: mat('blue', '#2474d8'),
    yellow: mat('yellow', '#f2d231'), skin: mat('skin', '#d0a17f')
  };

  const NORMAL_FOV = .93;
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 24.0, 72), scene);
  camera.inputs.clear();
  camera.fov = NORMAL_FOV;
  camera.minZ = .1;
  camera.maxZ = 1000;
  scene.activeCamera = camera;

  let yaw = 0, pitch = -.14, zoom = 4, scoped = false, middlePan = false;
  let reloading = false, lastShot = 0, score = 0, hits = 0, ammo = 5, streak = 0, mission = null;
  let freeAimX = 0, freeAimY = 0;
  const movers = [], targets = [], hitFx = [], bullets = [], debris = [], staticRespawns = [], bonusFlyers = [];
  let bonusSpawnTimer = 8.0;

  const colorNames = { red: '赤', blue: '青', yellow: '黄', black: '黒', white: '白' };
  const typeNames = { person: '人物', car: '車', sign: '看板', windowPerson: '窓の人物' };
  const missionOptions = [];
  for (const type of Object.keys(typeNames)) {
    for (const color of Object.keys(colorNames)) missionOptions.push({ type, color, label: `${typeNames[type]}【${colorNames[color]}】` });
  }

  function registerTarget(mesh, type, points, attrs = {}) {
    mesh.metadata = { targetType: type, points, ...attrs };
    targets.push(mesh);
    return mesh;
  }

  window.StreetScopeWorld.build(scene, mats, registerTarget, movers);

  function applyCamera() { camera.rotation.x = pitch; camera.rotation.y = yaw; }
  function clampPitch() { pitch = Math.max(-.98, Math.min(.60, pitch)); }
  function aimBounds() {
    return {
      x: Math.max(80, window.innerWidth * .47 - 24),
      y: Math.max(80, window.innerHeight * .45 - 24)
    };
  }
  function updateFreeAimCursor() {
    ui.cross.style.marginLeft = freeAimX + 'px';
    ui.cross.style.marginTop = freeAimY + 'px';
  }
  function clampFreeAim() {
    const b = aimBounds();
    freeAimX = Math.max(-b.x, Math.min(b.x, freeAimX));
    freeAimY = Math.max(-b.y, Math.min(b.y, freeAimY));
    updateFreeAimCursor();
  }
  function resetFreeAim() { freeAimX = 0; freeAimY = 0; updateFreeAimCursor(); }
  function hud() {
    ui.score.textContent = score;
    ui.hits.textContent = hits;
    ui.ammo.textContent = `${ammo} / 5`;
    ui.streak.textContent = streak;
  }
  function message(text) {
    ui.msg.textContent = text;
    ui.msg.style.opacity = 1;
    clearTimeout(message.timer);
    message.timer = setTimeout(() => ui.msg.style.opacity = 0, 650);
  }

  function newMission() {
    let next;
    do next = missionOptions[Math.floor(Math.random() * missionOptions.length)];
    while (mission && next.type === mission.type && next.color === mission.color);
    mission = { ...next, timeLeft: 22 };
    ui.mission.textContent = mission.label + ' を撃て';
    ui.missionTime.textContent = mission.timeLeft.toFixed(1);
  }
  function correct(meta) { return mission && meta.targetType === mission.type && meta.color === mission.color; }

  function setScope(value) {
    scoped = value;
    ui.scope.style.display = value ? 'block' : 'none';
    ui.cross.style.display = value ? 'none' : 'block';
    camera.fov = value ? NORMAL_FOV / zoom : NORMAL_FOV;
    ui.zoom.textContent = zoom.toFixed(1) + 'x';
    ui.scopeCursor.style.marginLeft = '0px';
    ui.scopeCursor.style.marginTop = '0px';
    if (value) resetFreeAim();
  }

  function getAimRay() {
    if (scoped) return camera.getForwardRay(650);
    const rect = canvas.getBoundingClientRect();
    const sx = engine.getRenderWidth() / Math.max(1, rect.width);
    const sy = engine.getRenderHeight() / Math.max(1, rect.height);
    const x = (rect.width * .5 + freeAimX) * sx;
    const y = (rect.height * .5 + freeAimY) * sy;
    return scene.createPickingRay(x, y, BABYLON.Matrix.Identity(), camera, false);
  }

  function showHitMarker() {
    ui.hit.style.marginLeft = (scoped ? 0 : freeAimX) + 'px';
    ui.hit.style.marginTop = (scoped ? 0 : freeAimY) + 'px';
    ui.hit.style.display = 'block';
    clearTimeout(showHitMarker.timer);
    showHitMarker.timer = setTimeout(() => ui.hit.style.display = 'none', 120);
  }

  function impact(point, ok) {
    const s = BABYLON.MeshBuilder.CreateSphere('fx', { diameter: ok ? .24 : .15, segments: 6 }, scene);
    const m = new BABYLON.StandardMaterial('fxm', scene);
    s.isPickable = false;
    s.position.copyFrom(point);
    m.emissiveColor = ok ? new BABYLON.Color3(1, .72, .2) : new BABYLON.Color3(.8, .8, .8);
    m.diffuseColor = m.emissiveColor;
    s.material = m;
    hitFx.push({ s, m, life: .18 });
  }

  function surfaceImpact(point) {
    impact(point, false);
    for (let i = 0; i < 8; i++) {
      const s = BABYLON.MeshBuilder.CreateSphere('dust', { diameter: .07 + (i % 3) * .025, segments: 4 }, scene);
      const m = new BABYLON.StandardMaterial('dustMat', scene);
      s.isPickable = false;
      s.position.copyFrom(point);
      const warm = i < 3;
      m.diffuseColor = warm ? new BABYLON.Color3(.9, .68, .34) : new BABYLON.Color3(.36, .36, .36);
      m.emissiveColor = warm ? new BABYLON.Color3(.35, .18, .04) : new BABYLON.Color3(.05, .05, .05);
      s.material = m;
      const a = (i / 8) * Math.PI * 2;
      const spread = .9 + Math.random();
      debris.push({ mesh: s, mat: m, vel: new BABYLON.Vector3(Math.cos(a) * spread, .7 + Math.random() * 1.7, Math.sin(a) * spread), life: .38 + .18 * Math.random(), gravity: 4.2, fade: true });
    }
  }

  function colorFromMeta(meta) {
    if (!meta) return new BABYLON.Color3(.8, .8, .8);
    if (meta.color === 'red') return new BABYLON.Color3(.85, .16, .13);
    if (meta.color === 'blue') return new BABYLON.Color3(.15, .43, .84);
    if (meta.color === 'yellow') return new BABYLON.Color3(.95, .78, .12);
    if (meta.color === 'black') return new BABYLON.Color3(.08, .08, .08);
    return new BABYLON.Color3(.88, .88, .88);
  }

  function addFragment(position, size, color, force = 1) {
    const mesh = BABYLON.MeshBuilder.CreateBox('shard', { size }, scene);
    const material = new BABYLON.StandardMaterial('shardMat', scene);
    mesh.isPickable = false;
    mesh.position.copyFrom(position);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(.15);
    mesh.material = material;
    const a = Math.random() * Math.PI * 2;
    const spread = (.9 + Math.random() * 2.6) * force;
    debris.push({
      mesh, mat: material,
      vel: new BABYLON.Vector3(Math.cos(a) * spread, .8 + Math.random() * 3.1 * force, Math.sin(a) * spread),
      life: .75 + Math.random() * .75, gravity: 5.8, fade: true,
      spin: new BABYLON.Vector3(Math.random() * 11, Math.random() * 11, Math.random() * 11)
    });
  }

  function shatterParts(parts, meta, hitPoint, strength = 1) {
    const fallback = colorFromMeta(meta);
    for (const part of parts) {
      if (!part || !part.isEnabled()) continue;
      part.computeWorldMatrix(true);
      const center = part.getAbsolutePosition().clone();
      let color = fallback;
      if (part.material && part.material.diffuseColor) color = part.material.diffuseColor.clone();
      const count = Math.max(2, Math.min(7, Math.round(3 * strength)));
      for (let i = 0; i < count; i++) {
        const pos = center.add(new BABYLON.Vector3((Math.random() - .5) * .55, (Math.random() - .5) * .55, (Math.random() - .5) * .55));
        addFragment(pos, .12 + Math.random() * .18, color, strength);
      }
    }
    impact(hitPoint, true);
  }

  function findMover(mesh) { return movers.find(v => v.parts.includes(mesh)); }

  function disableTarget(mesh, point) {
    if (!mesh || mesh.isPickable === false) return;
    const meta = mesh.metadata || {};
    const mover = findMover(mesh);
    if (mover) {
      if (!mover.alive || mover.destroying) return;
      mover.destroying = true;
      shatterParts(mover.parts, meta, point, mover.kind === 'car' ? 1.45 : 1.0);
      mover.parts.forEach(p => { p.setEnabled(false); p.isPickable = false; });
      mover.alive = false;
      mover.destroying = false;
      mover.respawn = 3.2;
      return;
    }

    const group = meta.destroyGroup;
    if (group) {
      if (!group.alive) return;
      group.alive = false;
      shatterParts(group.parts, meta, point, group.kind === 'sign' ? 1.25 : 1.0);
      group.parts.forEach(p => { p.setEnabled(false); p.isPickable = false; });
      staticRespawns.push({ group, time: group.kind === 'windowPerson' ? 5.0 : 4.0 });
      return;
    }

    if (meta.targetType) {
      shatterParts([mesh], meta, point, 1.0);
      mesh.setEnabled(false);
      mesh.isPickable = false;
      staticRespawns.push({ mesh, time: 4.0 });
    }
  }

  function disposeBonusFlyer(flyer, explodePoint = null) {
    if (!flyer || !flyer.alive) return;
    flyer.alive = false;
    if (explodePoint) {
      const meta = { color: 'white' };
      shatterParts(flyer.parts, meta, explodePoint, flyer.kind === 'helicopter' ? 1.35 : 1.55);
    }
    for (const p of flyer.parts) {
      p.isPickable = false;
      if (!p.isDisposed()) p.dispose();
    }
    if (flyer.root && !flyer.root.isDisposed()) flyer.root.dispose();
  }

  function addBonusTargetMeta(parts, flyer) {
    for (const p of parts) {
      p.metadata = {
        targetType: 'bonusAircraft',
        bonusTarget: true,
        bonusPoints: flyer.bonusPoints,
        bonusLabel: flyer.kind === 'helicopter' ? 'HELICOPTER' : 'AIRPLANE',
        bonusFlyer: flyer
      };
      p.isPickable = true;
      p.renderOutline = true;
      p.outlineWidth = .035;
      p.outlineColor = new BABYLON.Color3(1, .88, .15);
    }
  }

  function spawnBonusFlyer() {
    const kind = Math.random() < .72 ? 'airplane' : 'helicopter';
    const dir = Math.random() < .5 ? 1 : -1;
    const root = new BABYLON.TransformNode('bonusFlyerRoot', scene);
    const parts = [];

    if (kind === 'airplane') {
      const fuselage = BABYLON.MeshBuilder.CreateBox('bonusPlaneBody', { width: .95, height: .72, depth: 6.2 }, scene);
      const wing = BABYLON.MeshBuilder.CreateBox('bonusPlaneWing', { width: 8.2, height: .16, depth: 1.25 }, scene);
      const tail = BABYLON.MeshBuilder.CreateBox('bonusPlaneTail', { width: 3.0, height: .16, depth: .8 }, scene);
      const fin = BABYLON.MeshBuilder.CreateBox('bonusPlaneFin', { width: .18, height: 1.35, depth: .9 }, scene);
      fuselage.parent = wing.parent = tail.parent = fin.parent = root;
      tail.position.z = -2.45;
      fin.position.set(0, .72, -2.45);
      fuselage.material = mats.white;
      wing.material = mats.white;
      tail.material = mats.red;
      fin.material = mats.red;
      parts.push(fuselage, wing, tail, fin);
    } else {
      const cabin = BABYLON.MeshBuilder.CreateBox('bonusHeliCabin', { width: 2.0, height: 1.35, depth: 2.5 }, scene);
      const boom = BABYLON.MeshBuilder.CreateBox('bonusHeliBoom', { width: .38, height: .38, depth: 4.3 }, scene);
      const tail = BABYLON.MeshBuilder.CreateBox('bonusHeliTail', { width: 1.7, height: .14, depth: .7 }, scene);
      const rotor = BABYLON.MeshBuilder.CreateBox('bonusHeliRotor', { width: 7.4, height: .08, depth: .20 }, scene);
      cabin.parent = boom.parent = tail.parent = rotor.parent = root;
      boom.position.z = -3.0;
      tail.position.z = -5.0;
      rotor.position.y = 1.05;
      cabin.material = mats.yellow;
      boom.material = mats.dark;
      tail.material = mats.yellow;
      rotor.material = mats.black;
      parts.push(cabin, boom, tail, rotor);
      root.metadata = { rotor };
    }

    const flyer = {
      root, parts, kind, dir,
      speed: kind === 'helicopter' ? 18 + Math.random() * 5 : 27 + Math.random() * 8,
      bonusPoints: kind === 'helicopter' ? 900 : 700,
      alive: true,
      rotor: root.metadata && root.metadata.rotor ? root.metadata.rotor : null
    };
    addBonusTargetMeta(parts, flyer);

    root.position.set(dir > 0 ? -340 : 340, 54 + Math.random() * 34, 160 + Math.random() * 380);
    root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    bonusFlyers.push(flyer);
  }

  function awardBonusFlyer(mesh, point) {
    const meta = mesh && mesh.metadata;
    const flyer = meta && meta.bonusFlyer;
    if (!flyer || !flyer.alive) return;
    const pts = meta.bonusPoints || 700;
    score += pts;
    hits++;
    showHitMarker();
    message(`BONUS ${meta.bonusLabel || 'AIRCRAFT'} +${pts}`);
    disposeBonusFlyer(flyer, point);
    hud();
  }

  function spawnBullet(ray, end, onArrive) {
    const dir = end.subtract(ray.origin).normalize();
    const right = camera.getDirection(BABYLON.Axis.X).normalize();
    const up = camera.getDirection(BABYLON.Axis.Y).normalize();
    const start = ray.origin.add(ray.direction.normalize().scale(1.1)).add(right.scale(.30)).add(up.scale(-.22));
    const mesh = BABYLON.MeshBuilder.CreateSphere('bullet', { diameter: .18, segments: 6 }, scene);
    const material = new BABYLON.StandardMaterial('bulletMat', scene);
    mesh.isPickable = false;
    material.emissiveColor = new BABYLON.Color3(1, .82, .3);
    material.diffuseColor = new BABYLON.Color3(1, .9, .55);
    mesh.material = material;
    mesh.position.copyFrom(start);
    const tail = start.subtract(dir.scale(.9));
    const trail = BABYLON.MeshBuilder.CreateLines('bulletTrail', { points: [tail, start], updatable: true }, scene);
    trail.isPickable = false;
    trail.color = new BABYLON.Color3(1, .82, .3);
    bullets.push({ mesh, material, trail, start, end: end.clone(), dir, t: 0, duration: .18, onArrive });
  }

  async function reload() {
    if (reloading || ammo === 5) return;
    reloading = true;
    ui.state.textContent = 'RELOADING';
    ui.reload.style.display = 'block';
    const st = performance.now(), dur = 1150;
    await new Promise(done => {
      function f(now) {
        const p = Math.min(1, (now - st) / dur);
        ui.reloadFill.style.width = p * 100 + '%';
        p < 1 ? requestAnimationFrame(f) : done();
      }
      requestAnimationFrame(f);
    });
    ammo = 5;
    reloading = false;
    ui.reload.style.display = 'none';
    ui.reloadFill.style.width = 0;
    ui.state.textContent = 'READY';
    hud();
  }

  function shoot() {
    if (document.pointerLockElement !== canvas || reloading) return;
    const now = performance.now();
    if (now - lastShot < 320) return;
    if (ammo <= 0) { reload(); return; }

    lastShot = now;
    ammo--;
    hud();
    pitch -= scoped ? .006 : .010;
    clampPitch();
    applyCamera();

    const ray = getAimRay();
    const pick = scene.pickWithRay(ray, m => m && m.isPickable !== false);
    const end = pick && pick.hit && pick.pickedPoint ? pick.pickedPoint.clone() : ray.origin.add(ray.direction.scale(360));
    let arrival = null;

    if (pick && pick.hit) {
      const mesh = pick.pickedMesh;
      const point = pick.pickedPoint.clone();
      const meta = mesh.metadata;
      if (meta && meta.bonusTarget) {
        arrival = () => {
          if (!mesh || (mesh.isDisposed && mesh.isDisposed()) || !mesh.isEnabled()) return;
          awardBonusFlyer(mesh, point);
        };
      } else if (meta && meta.targetType) {
        const dist = BABYLON.Vector3.Distance(camera.position, point);
        const wasCorrect = correct(meta);
        arrival = () => {
          if (!mesh || (mesh.isDisposed && mesh.isDisposed()) || !mesh.isEnabled()) return;
          if (wasCorrect) {
            streak++;
            hits++;
            const pts = 180 + Math.floor(dist / 25) * 10 + Math.min(200, Math.max(0, streak - 1) * 20);
            score += pts;
            showHitMarker();
            message(`MISSION CLEAR +${pts}`);
            disableTarget(mesh, point);
            newMission();
          } else {
            score -= 50;
            streak = 0;
            message('WRONG TARGET -50');
            disableTarget(mesh, point);
          }
          hud();
        };
      } else {
        arrival = () => surfaceImpact(point);
      }
    }

    spawnBullet(ray, end, arrival);
    if (ammo <= 0) setTimeout(reload, 350);
  }

  function safeRespawnZ(m) {
    let z = m.dir > 0 ? m.worldMin + 5 : m.worldMax - 5;
    const others = movers.filter(o => o !== m && o.alive && !o.destroying);
    for (let tries = 0; tries < 80; tries++) {
      const conflict = others.some(o => {
        const gap = Math.abs(o.root.position.z - z);
        if (o.laneId === m.laneId && gap < m.minGap * 1.5) return true;
        if (o.kind === m.kind && gap < (m.globalGap || 0)) return true;
        return false;
      });
      if (!conflict) return z;
      z += m.dir * Math.max(m.minGap * 1.6, (m.globalGap || 0) * 1.15);
      if (z > m.worldMax - 5) z = m.worldMin + 5 + (tries % 3) * 7;
      if (z < m.worldMin + 5) z = m.worldMax - 5 - (tries % 3) * 7;
    }
    return z;
  }

  function allowedSpeed(m) {
    let nearest = Infinity;
    for (const o of movers) {
      if (o === m || !o.alive || o.destroying || o.laneId !== m.laneId) continue;
      const gap = m.dir > 0 ? o.root.position.z - m.root.position.z : m.root.position.z - o.root.position.z;
      if (gap > 0 && gap < nearest) nearest = gap;
    }
    if (!Number.isFinite(nearest)) return m.baseSpeed;
    if (nearest <= m.minGap) return 0;
    if (nearest < m.minGap * 2.0) return m.baseSpeed * Math.max(.12, (nearest - m.minGap) / m.minGap);
    return m.baseSpeed;
  }

  ui.startBtn.onclick = () => canvas.requestPointerLock();
  canvas.onclick = () => { if (document.pointerLockElement !== canvas) canvas.requestPointerLock(); };

  document.addEventListener('pointerlockchange', () => {
    const on = document.pointerLockElement === canvas;
    ui.start.style.display = on ? 'none' : 'flex';
    middlePan = false;
    if (!on) setScope(false);
  });

  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas) return;

    if (scoped) {
      const sensitivity = .0017 * (4 / zoom);
      yaw -= e.movementX * sensitivity;
      pitch -= e.movementY * sensitivity;
      clampPitch();
      applyCamera();
      return;
    }

    if (middlePan) {
      const sensitivity = .00165;
      yaw -= e.movementX * sensitivity;
      pitch -= e.movementY * sensitivity;
      clampPitch();
      applyCamera();
      return;
    }

    freeAimX += e.movementX * .95;
    freeAimY += e.movementY * .95;
    clampFreeAim();
  });

  document.addEventListener('mousedown', e => {
    if (document.pointerLockElement !== canvas) return;
    if (e.button === 0) shoot();
    if (e.button === 1 && !scoped) middlePan = true;
    if (e.button === 2) setScope(true);
  });

  document.addEventListener('mouseup', e => {
    if (e.button === 1) middlePan = false;
    if (e.button === 2) setScope(false);
  });

  document.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('wheel', e => {
    if (document.pointerLockElement !== canvas) return;
    zoom = Math.max(2, Math.min(8, zoom + (e.deltaY < 0 ? .5 : -.5)));
    ui.zoom.textContent = zoom.toFixed(1) + 'x';
    if (scoped) camera.fov = NORMAL_FOV / zoom;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('keydown', e => { if (e.code === 'KeyR') reload(); });

  let last = performance.now();
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;

    if (mission && document.pointerLockElement === canvas) {
      mission.timeLeft -= dt;
      ui.missionTime.textContent = Math.max(0, mission.timeLeft).toFixed(1);
      if (mission.timeLeft <= 0) {
        score -= 100;
        streak = 0;
        hud();
        message('TIME UP -100');
        newMission();
      }
    }

    if (document.pointerLockElement === canvas) {
      bonusSpawnTimer -= dt;
      if (bonusSpawnTimer <= 0) {
        if (bonusFlyers.filter(f => f.alive).length < 2) spawnBonusFlyer();
        bonusSpawnTimer = 15 + Math.random() * 16;
      }
    }

    for (let i = bonusFlyers.length - 1; i >= 0; i--) {
      const f = bonusFlyers[i];
      if (!f.alive) {
        bonusFlyers.splice(i, 1);
        continue;
      }
      f.root.position.x += f.dir * f.speed * dt;
      if (f.rotor && !f.rotor.isDisposed()) f.rotor.rotation.y += dt * 20;
      if (Math.abs(f.root.position.x) > 380) {
        disposeBonusFlyer(f, null);
        bonusFlyers.splice(i, 1);
      }
    }

    for (const m of movers) {
      if (!m.alive) {
        m.respawn -= dt;
        if (m.respawn <= 0) {
          m.root.position.z = safeRespawnZ(m);
          m.root.position.y = m.spawnY;
          m.parts.forEach(p => { p.setEnabled(true); p.isPickable = true; });
          m.alive = true;
        }
        continue;
      }

      m.speed = allowedSpeed(m);
      m.root.position.z += m.speed * m.dir * dt;
      if (m.root.position.z > m.worldMax || m.root.position.z < m.worldMin) m.root.position.z = safeRespawnZ(m);

      if (m.kind === 'person') {
        m.t += dt * 7;
        m.parts[2].rotation.x = Math.sin(m.t) * .45;
        m.parts[3].rotation.x = -Math.sin(m.t) * .45;
      }
    }

    for (let i = staticRespawns.length - 1; i >= 0; i--) {
      const r = staticRespawns[i];
      r.time -= dt;
      if (r.time > 0) continue;
      if (r.group) {
        r.group.parts.forEach(p => { p.setEnabled(true); p.isPickable = !!(p.metadata && p.metadata.targetType); });
        r.group.alive = true;
      } else if (r.mesh) {
        r.mesh.setEnabled(true);
        r.mesh.isPickable = true;
      }
      staticRespawns.splice(i, 1);
    }

    for (let i = hitFx.length - 1; i >= 0; i--) {
      const f = hitFx[i];
      f.life -= dt;
      f.s.scaling.scaleInPlace(1 + dt * 7);
      f.m.alpha = Math.max(0, f.life / .18);
      if (f.life <= 0) {
        f.s.dispose(); f.m.dispose(); hitFx.splice(i, 1);
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.t += dt / b.duration;
      const t = Math.min(1, b.t);
      const pos = BABYLON.Vector3.Lerp(b.start, b.end, t);
      b.mesh.position.copyFrom(pos);
      const tail = pos.subtract(b.dir.scale(.9));
      BABYLON.MeshBuilder.CreateLines('bulletTrail', { points: [tail, pos], instance: b.trail });
      if (t >= 1) {
        if (b.onArrive) b.onArrive();
        b.mesh.dispose(); b.material.dispose(); b.trail.dispose(); bullets.splice(i, 1);
      }
    }

    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life -= dt;
      d.vel.y -= d.gravity * dt;
      d.mesh.position.addInPlace(d.vel.scale(dt));
      if (d.spin) {
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.y += d.spin.y * dt;
        d.mesh.rotation.z += d.spin.z * dt;
      }
      if (d.fade && d.life < .3) d.mat.alpha = Math.max(0, d.life / .3);
      if (d.life <= 0 || d.mesh.position.y < -.5) {
        d.mesh.dispose(); d.mat.dispose(); debris.splice(i, 1);
      }
    }
  });

  applyCamera();
  hud();
  newMission();
  engine.runRenderLoop(() => scene.render());
  addEventListener('resize', () => { engine.resize(); clampFreeAim(); });

  window.STREET_SCOPE_VERSION = VERSION;
})();
