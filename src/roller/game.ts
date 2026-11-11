// High Roller, the part you see: one stage in 3D with your golfer inside the ball, a level camera that never turns, the
// table tipping under the ball, the thumb stick, and the clock. The physics is sim.ts; this draws it and feeds it the stick.
import * as THREE from 'three';
import { Golfer, type GolferSpec } from '../golf3d/golfer';
import { sfx } from '../fx/sound';
import { advance, floorOf, MAX_TILT, newBall, poseOf, R, type Ball, type Solid, type Stage } from './sim';

export type Result = { state: 'goal' | 'fell' | 'timeout'; ms: number; chips: number };
export type Game = { restart(): void; pause(on: boolean): void; dispose(): void };

// ---------- textures, drawn once ----------

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const feltTex = (base: string) =>
  canvasTex(
    128,
    128,
    (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 128, 128);
      // fine random flecks (a regular pattern shows up as stripes at a distance)
      for (let i = 0; i < 2200; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + Math.random() * 0.05})`;
        g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
      }
    },
    true,
  );
// a roulette wheel from above: red and black pockets round a gold hub
const wheelTex = () =>
  canvasTex(512, 512, (g) => {
    g.translate(256, 256);
    const n = 24;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 256, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      g.fillStyle = i % 2 ? '#8e1b1b' : '#17171a';
      g.fill();
    }
    g.lineWidth = 10;
    g.strokeStyle = '#d6a940';
    for (const r of [250, 170]) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, 165, 0, Math.PI * 2);
    g.fillStyle = '#0f5a3c';
    g.fill();
  });
// a stack of chips from the side
const stackTex = () =>
  canvasTex(
    64,
    64,
    (g) => {
      const cols = ['#b3202a', '#f4f1e8', '#1c3f8f', '#f4f1e8'];
      for (let y = 0; y < 8; y++) {
        g.fillStyle = cols[y % 4];
        g.fillRect(0, y * 8, 64, 7);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(0, y * 8 + 7, 64, 1);
        g.fillStyle = y % 2 ? '#b3202a' : '#f4f1e8';
        for (let x = 0; x < 64; x += 16) g.fillRect(x + ((y * 5) % 16), y * 8 + 1, 6, 5);
      }
    },
    true,
  );
// dusk over the city: indigo down to a warm horizon
const skyTex = () =>
  canvasTex(16, 512, (g) => {
    const k = g.createLinearGradient(0, 0, 0, 512);
    k.addColorStop(0, '#0b0a24');
    k.addColorStop(0.35, '#2a1648');
    k.addColorStop(0.62, '#8a2f5c');
    k.addColorStop(0.8, '#e8743a');
    k.addColorStop(1, '#f6c56a');
    g.fillStyle = k;
    g.fillRect(0, 0, 16, 512);
  });

const WOOD = () => new THREE.MeshStandardMaterial({ color: '#4a2416', roughness: 0.55 });
const GOLD = () => new THREE.MeshStandardMaterial({ color: '#d6a940', roughness: 0.3, metalness: 0.85 });

// ---------- the stage, built from its solids ----------

function buildSolid(s: Solid, tex: { felt: THREE.Texture; blue: THREE.Texture; wheel: THREE.Texture; stack: THREE.Texture }): THREE.Object3D {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const wood = WOOD();
  const gold = GOLD();
  if (s.kind === 'disc') {
    if (s.look === 'bumper') {
      const t = tex.stack.clone();
      t.repeat.set(6, s.h[1] / 0.42);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(s.h[0], s.h[0], s.h[1] * 2, 28), [new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: '#b3202a', roughness: 0.5 }), wood]);
      g.add(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s.h[0] * 0.6, 0.05, 8, 24), gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = s.h[1] + 0.01;
      g.add(ring);
    } else {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(s.h[0], s.h[0] * 0.94, s.h[1] * 2, 56), [wood, new THREE.MeshStandardMaterial({ map: tex.wheel, roughness: 0.6 }), wood]));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(s.h[0], 0.07, 8, 56), gold);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = s.h[1];
      g.add(rim);
    }
  } else if (s.look === 'rail') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s.h[0] * 2, s.h[1] * 2, s.h[2] * 2), [wood, wood, gold, wood, wood, wood]));
  } else {
    // a table: a wooden body with a gold lip, and felt set into the top (blue felt on anything that moves)
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s.h[0] * 2, s.h[1] * 2, s.h[2] * 2), [wood, wood, gold, wood, wood, wood]));
    const t = (s.move ? tex.blue : tex.felt).clone();
    t.repeat.set(s.h[0] / 1.2, s.h[2] / 1.2);
    t.needsUpdate = true;
    const felt = new THREE.Mesh(new THREE.BoxGeometry(s.h[0] * 2 - 0.22, 0.04, s.h[2] * 2 - 0.22), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    felt.position.y = s.h[1];
    g.add(felt);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function buildGate(): THREE.Group {
  const g = new THREE.Group();
  const gold = GOLD();
  for (const x of [-1.15, 1.15]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 12), gold);
    post.position.set(x, 1.1, 0);
    g.add(post);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 10, 28, Math.PI), gold);
  arch.position.y = 2.2;
  g.add(arch);
  // a ribbon across: gold and green checks
  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.42),
    new THREE.MeshBasicMaterial({
      map: canvasTex(256, 48, (c) => {
        for (let i = 0; i < 16; i++)
          for (let j = 0; j < 3; j++) {
            c.fillStyle = (i + j) % 2 ? '#f1d58f' : '#163b2c';
            c.fillRect(i * 16, j * 16, 16, 16);
          }
      }),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    }),
  );
  ribbon.position.y = 2.05;
  g.add(ribbon);
  const glow = new THREE.PointLight('#ffd98a', 6, 9);
  glow.position.y = 1.4;
  g.add(glow);
  g.traverse((o) => o instanceof THREE.Mesh && o !== ribbon && (o.castShadow = true));
  return g;
}

// the city far below and around: dark towers with lit windows
function buildCity(): THREE.Object3D {
  const win = canvasTex(
    32,
    64,
    (g) => {
      g.fillStyle = '#0d0b1c';
      g.fillRect(0, 0, 32, 64);
      for (let y = 2; y < 64; y += 6) for (let x = 2; x < 32; x += 6) if ((x * 7 + y * 13) % 5 < 2) (g.fillStyle = (x + y) % 4 ? '#ffd27a' : '#9fd0ff'), g.fillRect(x, y, 3, 3);
    },
    true,
  );
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: win }), 90);
  const o = new THREE.Object3D();
  for (let i = 0; i < 90; i++) {
    const a = i * 2.39996;
    const r = 80 + ((i * 53) % 90);
    const h = 30 + ((i * 29) % 70);
    o.position.set(Math.cos(a) * r, -70 + h / 2 + ((i * 7) % 14), -20 + Math.sin(a) * r);
    o.scale.set(8 + (i % 5) * 3, h, 8 + ((i * 3) % 5) * 3);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  }
  return m;
}

// ---------- the game ----------

export function play(host: HTMLElement, stage: Stage, spec: GolferSpec, label: string, onEnd: (r: Result) => void): Game {
  host.innerHTML = `
    <canvas class="rl-canvas"></canvas>
    <div class="rl-hud">
      <div class="rl-stage"><small>${label}</small><b>${stage.name}</b></div>
      <div class="rl-clock" data-clock>${stage.time.toFixed(1)}</div>
      <div class="rl-chips"><i></i><b data-chips>0</b><small>/ ${stage.chips.length}</small></div>
    </div>
    <div class="rl-level" aria-hidden="true"><i data-level></i></div>
    <div class="rl-call" data-call></div>
    <p class="rl-tip" data-tip>${stage.tip ?? ''}</p>
    <div class="rl-stick" data-stick><i></i><small data-start>Drag to start</small></div>`;
  const canvas = host.querySelector('canvas')!;
  const q = <T extends HTMLElement>(s: string) => host.querySelector(s) as T;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = skyTex();
  scene.fog = new THREE.Fog('#b85a4a', 60, 190);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight('#ffd9b0', '#3a2350', 1.25));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);
  scene.add(buildCity());

  const tex = { felt: feltTex('#0f5a3c'), blue: feltTex('#1f4a8a'), wheel: wheelTex(), stack: stackTex() };
  // the whole stage in one group: it tips under the ball while the horizon and the camera stay level
  const table = new THREE.Group();
  scene.add(table);
  const solids = stage.solids.map((s) => {
    const o = buildSolid(s, tex);
    table.add(o);
    return o;
  });
  const place = (t: number) =>
    stage.solids.forEach((s, i) => {
      const p = poseOf(s, t);
      solids[i].position.set(p.c[0], p.c[1], p.c[2]);
      solids[i].rotation.set(s.pitch ?? 0, p.yaw, s.roll ?? 0);
    });
  const gate = buildGate();
  gate.position.set(stage.goal.p[0], stage.goal.p[1], stage.goal.p[2]);
  gate.rotation.y = stage.goal.yaw ?? 0;
  table.add(gate);

  // chips to pick up, standing on edge and turning
  const chipGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 24);
  chipGeo.rotateX(Math.PI / 2);
  const chipFace = canvasTex(128, 128, (g) => {
    g.translate(64, 64);
    g.fillStyle = '#c8202c';
    g.beginPath();
    g.arc(0, 0, 64, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fbf7ea';
    for (let i = 0; i < 8; i++) {
      g.rotate(Math.PI / 4);
      g.fillRect(-9, -64, 18, 16);
    }
    g.beginPath();
    g.arc(0, 0, 36, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d6a940';
    g.beginPath();
    g.arc(0, 0, 28, 0, Math.PI * 2);
    g.fill();
  });
  const face = new THREE.MeshStandardMaterial({ map: chipFace, roughness: 0.35, emissive: '#ffffff', emissiveMap: chipFace, emissiveIntensity: 0.35 });
  const chipMats = [new THREE.MeshStandardMaterial({ color: '#fbf7ea', roughness: 0.4 }), face, face];
  const chips = stage.chips.map((c) => {
    const m = new THREE.Mesh(chipGeo, chipMats);
    m.position.set(c[0], c[1], c[2]);
    m.castShadow = true;
    table.add(m);
    return m;
  });

  // the ball: a clear shell, half tinted so you can see it roll, with your golfer standing inside
  const shell = new THREE.Group();
  const half = (from: number, color: string, opacity: number) => new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, from, Math.PI / 2), new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.08, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
  shell.add(half(0, '#2f8f63', 0.42), half(Math.PI / 2, '#ffffff', 0.16));
  const band = new THREE.Mesh(new THREE.TorusGeometry(R, 0.016, 8, 40), GOLD());
  band.rotation.x = Math.PI / 2;
  shell.add(band);
  const rider = new THREE.Group();
  const golfer = new Golfer(spec);
  golfer.showBag(false);
  golfer.group.scale.setScalar(0.146);
  golfer.group.position.y = -R + 0.03;
  rider.add(golfer.group);
  const ballShadow = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  ballShadow.castShadow = true;
  scene.add(shell, rider, ballShadow);

  // confetti for the gate
  const N = 140;
  const conf = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true }));
  const cpos = new Float32Array(N * 3), cvel = new Float32Array(N * 3), ccol = new Float32Array(N * 3);
  conf.geometry.setAttribute('position', new THREE.BufferAttribute(cpos, 3));
  conf.geometry.setAttribute('color', new THREE.BufferAttribute(ccol, 3));
  conf.visible = false;
  scene.add(conf);

  // ---------- the stick ----------
  const stick = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
  const stickEl = q<HTMLElement>('[data-stick]');
  const knob = stickEl.querySelector('i') as HTMLElement;
  const REACH = 64;
  // the first touch (or key) of a run starts the clock
  const begin = () => {
    if (phase !== 'ready' || paused) return;
    phase = 'go';
    q('[data-tip]').classList.add('gone');
    q('[data-start]').hidden = true;
    call('Go!', 'go');
    window.setTimeout(() => phase === 'go' && call(''), 500);
  };
  const down = (e: PointerEvent) => {
    if (stick.id !== -1 || (e.target as HTMLElement).closest('button, .rl-sheet')) return;
    stick.id = e.pointerId;
    stick.ox = e.clientX;
    stick.oy = e.clientY;
    stickEl.classList.add('held');
    begin();
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== stick.id) return;
    let dx = (e.clientX - stick.ox) / REACH, dy = (e.clientY - stick.oy) / REACH;
    const m = Math.hypot(dx, dy);
    if (m > 1) (dx /= m), (dy /= m);
    stick.x = dx;
    stick.y = -dy;
    knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
  };
  const letGo = () => {
    stick.id = -1;
    stick.x = stick.y = 0;
    knob.style.transform = '';
    stickEl.classList.remove('held');
  };
  const up = (e: PointerEvent) => e.pointerId === stick.id && letGo();
  host.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  const keys = new Set<string>();
  const key = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) return;
    e.preventDefault();
    if (e.type === 'keydown') keys.add(k), begin();
    else keys.delete(k);
  };
  window.addEventListener('keydown', key);
  window.addEventListener('keyup', key);

  // ---------- the run ----------
  const floor = floorOf(stage);
  const first = stage.path[0] ?? { x: stage.goal.p[0], z: stage.goal.p[2] };
  const yaw0 = Math.atan2(-(first.x - stage.start[0]), -(first.z - stage.start[2]));
  let ball: Ball = newBall(stage);
  let acc = { t: 0 };
  const yaw = yaw0; // the camera never turns: up on the stick is always away from you
  let tilt = { x: 0, z: 0 };
  let seen = { x: 0, z: 0 }; // the lean as drawn: it settles more slowly than the real one
  let camY = stage.start[1];
  let phase: 'ready' | 'go' | 'over' = 'ready';
  let wait = 0; // the count-in, then the pause before the result
  let paused = false;
  let done: Result | null = null;
  let taken = 0;
  const spinQ = new THREE.Quaternion();
  let heading = yaw0 + Math.PI; // the golfer faces +z as built, so this looks down the stage
  const call = (text: string, cls = '') => {
    const el = q('[data-call]');
    el.textContent = text;
    el.className = `rl-call ${cls} ${text ? 'on' : ''}`;
  };
  function reset() {
    ball = newBall(stage);
    acc = { t: 0 };
    tilt = { x: 0, z: 0 };
    phase = 'ready';
    wait = 0;
    letGo(); // a new touch starts the next go
    keys.clear();
    done = null;
    taken = 0;
    spinQ.identity();
    heading = yaw0 + Math.PI;
    chips.forEach((c) => (c.visible = true));
    conf.visible = false;
    golfer.setPose('idle');
    q('[data-chips]').textContent = '0';
    call('');
    q('[data-tip]').classList.remove('gone');
    q('[data-start]').hidden = false;
  }
  reset();

  const up3 = new THREE.Vector3(), back = new THREE.Vector3(), pivot = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), look = new THREE.Vector3(), axis = new THREE.Vector3(), dq = new THREE.Quaternion();
  let last = performance.now();
  let raf = 0;
  let dead = false;

  function frame(now: number) {
    if (dead) return;
    if (!canvas.isConnected) return dispose(); // the page moved on
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const w = host.clientWidth, h = host.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // a tall phone sees less to the sides: widen the view a little
      camera.fov = w < h ? 62 : 52;
      camera.updateProjectionMatrix();
    }
    if (!paused) {
      // the stick, in the camera's frame, becomes a lean of the table
      let ix = stick.x, iy = stick.y;
      if (keys.size) {
        ix = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
        iy = (keys.has('arrowup') || keys.has('w') ? 1 : 0) - (keys.has('arrowdown') || keys.has('s') ? 1 : 0);
        const m = Math.hypot(ix, iy) || 1;
        (ix /= m), (iy /= m);
      }
      const live = phase === 'go';
      const wx = live ? Math.cos(yaw) * ix - Math.sin(yaw) * iy : 0;
      const wz = live ? -Math.sin(yaw) * ix - Math.cos(yaw) * iy : 0;
      const ease = Math.min(1, dt * 11);
      tilt.x += (wx - tilt.x) * ease;
      tilt.z += (wz - tilt.z) * ease;

      if (phase === 'ready') {
        // waiting for the first touch (see begin)
      } else if (phase === 'go') {
        const before = ball.p.slice();
        advance(ball, stage, tilt.x, tilt.z, dt, acc, floor);
        // roll the shell by how far it went
        const dx = ball.p[0] - before[0], dz = ball.p[2] - before[2];
        const dist = Math.hypot(dx, dz);
        if (dist > 1e-5) {
          axis.set(dz, 0, -dx).normalize();
          spinQ.premultiply(dq.setFromAxisAngle(axis, dist / R));
        }
        if (ball.hit > 5) sfx('thump');
        const n = ball.chips.filter(Boolean).length;
        if (n !== taken) {
          taken = n;
          sfx('pop');
          q('[data-chips]').textContent = String(n);
          ball.chips.forEach((got, i) => got && (chips[i].visible = false));
        }
        const left = stage.time - ball.t;
        const clock = q('[data-clock]');
        clock.textContent = Math.max(0, left).toFixed(1);
        clock.classList.toggle('low', left < 10);
        if (ball.state === 'goal' || ball.state === 'fell' || left <= 0) {
          phase = 'over';
          done = { state: ball.state === 'rolling' ? 'timeout' : ball.state, ms: Math.round(ball.t * 1000), chips: taken };
          wait = done.state === 'goal' ? 1.9 : 1.1;
          if (done.state === 'goal') {
            call('Goal!', 'goal');
            sfx('cheer');
            golfer.setPose('cheer');
            for (let i = 0; i < N; i++) {
              cpos.set([ball.p[0], ball.p[1] + 0.4, ball.p[2]], i * 3);
              const a = i * 2.4, s = 2 + (i % 7) * 0.7;
              cvel.set([Math.cos(a) * s, 4 + (i % 5) * 1.3, Math.sin(a) * s], i * 3);
              new THREE.Color().setHSL((i * 0.13) % 1, 0.8, 0.6).toArray(ccol, i * 3);
            }
            conf.geometry.attributes.color.needsUpdate = true;
            conf.visible = true;
          } else {
            call(done.state === 'fell' ? 'Fall out!' : 'Time up!', 'out');
            sfx('whoosh');
          }
        }
      } else {
        // the ball carries on for a moment: over the edge, or slowing through the gate
        if (done?.state === 'goal') {
          ball.v[0] *= 0.9;
          ball.v[2] *= 0.9;
          for (let i = 0; i < N; i++) {
            cvel[i * 3 + 1] -= 9 * dt;
            for (let k = 0; k < 3; k++) cpos[i * 3 + k] += cvel[i * 3 + k] * dt;
          }
          conf.geometry.attributes.position.needsUpdate = true;
        } else if (done?.state === 'fell') {
          ball.v[1] -= 30 * dt;
          for (let k = 0; k < 3; k++) ball.p[k] += ball.v[k] * dt;
        }
        wait -= dt;
        if (wait <= 0 && done) {
          const r = done;
          done = null;
          onEnd(r);
        }
      }
      golfer.update(dt);
    }

    // draw
    place(ball.t);
    const [bx, by, bz] = ball.p;
    shell.position.set(bx, by, bz);
    shell.quaternion.copy(spinQ);
    ballShadow.position.set(bx, by, bz);
    const speed = Math.hypot(ball.v[0], ball.v[2]);
    if (speed > 0.6) {
      const want = Math.atan2(ball.v[0], ball.v[2]);
      let d = want - heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      heading += d * Math.min(1, dt * 9);
    }
    rider.position.set(bx, by, bz);
    chips.forEach((c, i) => c.visible && (c.rotation.y = now / 500 + i));
    sun.position.set(bx + 9, by + 22, bz + 7);
    sun.target.position.set(bx, by, bz);

    // the lean as drawn eases in and out, so letting go doesn't snap the picture flat
    const soft = Math.min(1, dt * 5);
    seen.x += (tilt.x - seen.x) * soft;
    seen.z += (tilt.z - seen.z) * soft;
    const m = Math.min(1, Math.hypot(seen.x, seen.z));
    const sx = m > 1e-4 ? seen.x / Math.hypot(seen.x, seen.z) : 0, sz = m > 1e-4 ? seen.z / Math.hypot(seen.x, seen.z) : 0;
    // the table tips under the ball, a little over half the real lean: enough to read, not enough to swim
    const show = m * MAX_TILT * 0.6;
    // (it dips the way you lean, so its upright leans that way too)
    up3.set(Math.sin(show) * sx, Math.cos(show), Math.sin(show) * sz);
    table.quaternion.setFromUnitVectors(Y, up3);
    pivot.set(bx, by - R, bz);
    table.position.copy(pivot).sub(look.copy(pivot).applyQuaternion(table.quaternion));
    // your golfer leans the way the ball is being sent
    up3.set(Math.sin(show * 0.7) * sx, Math.cos(show * 0.7), Math.sin(show * 0.7) * sz);
    rider.quaternion.setFromUnitVectors(Y, up3).multiply(dq.setFromAxisAngle(Y, heading));
    // the dial under the clock: the dot sits the way you're leaning
    const dot = q('[data-level]');
    dot.style.transform = `translate(${(Math.cos(yaw) * seen.x - Math.sin(yaw) * seen.z) * 15}px, ${(Math.sin(yaw) * seen.x + Math.cos(yaw) * seen.z) * 15}px)`;

    // the camera: level, high and behind, always looking the same way down the stage. It only slides with the ball.
    const tall = w < h;
    camY += (Math.max(by, floor + 6) - camY) * Math.min(1, dt * 6); // smooth over bounces; don't follow a fall all the way
    back.set(Math.sin(yaw), 0, Math.cos(yaw));
    camera.position.set(bx, camY, bz).addScaledVector(back, tall ? 8.2 : 7.6).addScaledVector(Y, tall ? 7.4 : 6.2);
    camera.up.copy(Y);
    look.set(bx, camY, bz).addScaledVector(back, -2.6);
    camera.lookAt(look);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  function dispose() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('keydown', key);
    window.removeEventListener('keyup', key);
    golfer.dispose();
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          m.dispose();
        }
      }
    });
    renderer.dispose();
  }

  return {
    restart: reset,
    pause: (on) => {
      paused = on;
      last = performance.now();
    },
    dispose,
  };
}
