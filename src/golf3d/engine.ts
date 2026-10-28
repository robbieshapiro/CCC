// The 3D course: one renderer for the whole round, a fresh world per hole.
// Pick a club, drag sideways to aim, pick a strike point for spin and shape, pull down to plan your power,
// then the three-tap swing: tap to start, tap to set power on your plan, tap in the gold for accuracy.
import * as THREE from 'three';
import type { Avatar } from '../api/types';
import { specOf } from '../avatar';
import { sfx } from '../fx/sound';
import { todayInGameTz } from '../day';
import { CartGirl } from './cartgirl';
import { conditionsFor, withPin, type Conditions } from './conditions';
import { bagFor, carryOf, CLUBS, DRINKS, SCALE, type ClubId, type Drink } from './clubs';
import { Golfer } from './golfer';
import { BALL_R, dropPoint, G, launch, lieFactor, simulate, TOUR_GREEN, type Result } from './physics';
import * as stands from './stands';
import * as props from './props';
import { buildWorld, w3, type World } from './scene';
import { gradAt, heightAt, inPoly, surfaceAt, wetIn } from './terrain';
import { accuracyError, goldHalf, OVERSWING, PURE, powerSpeed, returnSpeed, type MeterStyle } from './swing';
import type { Hole, Shot, V2 } from './types';

export const MAX_OVER = 3; // pick up at par + 3
const TRAIL = 60;

// A practice area: the stations you can hit from (the short game), and the flags out on the range.
export type Drill = { title: string; stations: { name: string; at: V2 }[]; targets?: { label: string; at: V2 }[]; at: number };
export type HoleResult = { strokes: number; feats: string[]; spot: V2 | null }; // spot: where the tee shot came to rest
// A member who played today, standing where their tee shot finished on each hole.
export type Ghost = { name: string; avatar: Avatar; spots: (V2 | null)[]; holes: number[] };
// someone in the stands on a hole that has them: a member who has played it, with their score on it
export type Spectator = { name: string; avatar: Avatar; label: string };
type Mode = 'fly' | 'aim' | 'meter' | 'swing' | 'roll' | 'done' | 'cart';

// A floating name card over another member: their name, and what they made on this hole.
function nameTag(name: string, score: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 84;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(22,59,44,0.88)';
  x.beginPath();
  x.roundRect(4, 4, 248, 76, 18);
  x.fill();
  x.strokeStyle = '#e6cf9f';
  x.lineWidth = 3;
  x.stroke();
  x.fillStyle = '#f3ecdc';
  x.textAlign = 'center';
  x.font = '700 30px Georgia, serif';
  x.fillText(name.length > 12 ? `${name.slice(0, 11)}…` : name, 128, 40);
  x.fillStyle = '#e6cf9f';
  x.font = '600 22px system-ui, sans-serif';
  x.fillText(score, 128, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false, sizeAttenuation: false }));
  // the same size on screen near or far, so you can read who's down the fairway
  s.scale.set(0.15, 0.05, 1);
  s.renderOrder = 10;
  return s;
}

const html = (s: string) => {
  const t = document.createElement('template');
  t.innerHTML = s.trim();
  return t.content.firstElementChild as HTMLElement;
};

export function scoreName(strokes: number, par: number) {
  if (strokes === 1) return 'Hole in one';
  const d = strokes - par;
  return d <= -3 ? 'Albatross' : d === -2 ? 'Eagle' : d === -1 ? 'Birdie' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : 'Triple bogey';
}

// Distances on screen: real-world yards (the course is a scale model, see SCALE), except a putt, which is feet.
// a bomb (full-power driver, dead centre) carries this much further: about 300 yd instead of 250
const BOMB = 1.2;
const yd = (ft: number) => `${Math.round((ft * SCALE) / 3)} yd`;
const away = (ft: number, putt: boolean) => (putt ? `${Math.round(ft * SCALE)} ft` : yd(ft));

const LABEL: Record<ClubId, string> = { driver: 'Driver', wood: 'Wood', iron: 'Iron', wedge: 'Wedge', chip: 'Chip', putter: 'Putter' };

// The swing bar: the impact point sits near the left end; power runs from there to the right, overswing last.
const IMPACT = 0.12;
const barX = (p: number) => IMPACT + 0.04 + (p / OVERSWING) * (1 - IMPACT - 0.04);

function targetMarker() {
  const g = new THREE.Group();
  const flat = (geo: THREE.BufferGeometry, color: string, opacity: number) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    g.add(m);
    return m;
  };
  // spread ring at radius 1 (scaled to the club), a dark edge so it reads on any grass, and a solid centre
  flat(new THREE.RingGeometry(0.9, 1.08, 48), '#13261c', 0.55);
  flat(new THREE.RingGeometry(0.93, 1.03, 48), '#ffd23f', 1);
  flat(new THREE.RingGeometry(0.44, 0.5, 40), '#ffd23f', 0.8);
  flat(new THREE.CircleGeometry(0.16, 24), '#ffd23f', 1);
  // a thin beam of light straight up, so the spot shows from the tee
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.55, depthWrite: false, fog: false }),
  );
  beam.name = 'beam';
  g.add(beam);
  return g;
}

// When the ball has as good as stopped: the first moment after which it moves less than half a foot.
// A holed or lost ball plays out in full.
function settleTime(r: Result) {
  const f = r.frames;
  if (r.holed || r.penalty || f.length < 2) return r.duration;
  const end = f[f.length - 1];
  let i = f.length - 1;
  while (i > 0 && Math.hypot(f[i - 1].x - end.x, f[i - 1].y - end.y) < 0.5) i--;
  return Math.min(r.duration, f[i].t);
}

export class Course3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2600);
  private sun = new THREE.DirectionalLight('#ffeccc', 2.6);
  private world: World | null = null;
  private hole!: Hole;
  private number = 1;
  private overlay: HTMLElement;
  private raf = 0;
  private last = performance.now();
  private clock = 0; // hole clock: drives movers, matches the physics
  private slow = 0; // seconds of slow frames, for the automatic quality drop

  private ballSink = 0; // how far the drawn ball is lowered to sit a smaller ball on the ground
  // the green read on a tour green while you putt: dots streaming downhill, quicker where it's steeper
  // the green read on a tour green, Golden Tee style: how much it climbs or falls and breaks between the ball and cup
  private read: { slope: number; brk: number } | null = null;
  private holesInRound = 3;
  private ball = props.mesh(new THREE.SphereGeometry(BALL_R, 18, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
  private golfer: Golfer;
  private dots: THREE.InstancedMesh;
  private ring = targetMarker(); // where the shot comes down: a bullseye with a beam you can see from the tee
  private trail: THREE.Line;
  private trailPts: THREE.Vector3[] = [];
  // a bomb: a full-power driver struck dead centre. The downswing goes to slow motion, then the strike flashes, the
  // camera shakes and the ball goes off in gold, and about 20% further (BOMB).
  private bombSwing = false;
  private bombShake = 0;
  private clouds: THREE.Object3D[] = [];
  private birds: THREE.Object3D[] = [];
  private petals: THREE.Points | null = null;
  private puffs: { m: THREE.Mesh; t: number }[] = [];
  private cart: CartGirl | null = null;
  private visits = 0; // beverage cart stops this round
  private lastDrink: Drink | null = null;
  private total = { strokes: 0, par: 0 };
  private ghosts: Ghost[] = [];
  private onCourse: { golfer: Golfer; objs: THREE.Object3D[]; at: THREE.Vector3 }[] = [];
  // the rest of a full stadium: simple figures, two instanced meshes for the lot
  private crowd: THREE.InstancedMesh[] = [];
  private spot: V2 | null | undefined; // the tee shot's resting place, once it has one

  private mode: Mode = 'fly';
  private pos: V2 = { x: 0, y: 0 };
  private aim = 0;
  private power = 0;
  private club: ClubId = 'driver';
  // the swing in progress: the power bar fills, then the needle comes back for the accuracy tap
  private meter = { phase: 'power' as 'power' | 'accuracy', p: 0, x: 0, speed: 0, half: 0 };
  private wind: Conditions | null = null;
  private spin = 0; // -1 topspin .. 1 backspin, from where you strike the ball
  private shape = 0; // -1 draw .. 1 fade
  private strokes = 0;
  private zones = new Set<string>();
  private drink: { kind: Drink; shots: number } | null = null;
  // settle: when the ball has as good as stopped (the last creep down a slope isn't worth waiting for)
  // slow: the slow-motion window on a pure strike, in shot time
  private shot: {
    r: Result;
    t: number;
    from: V2;
    club: ClubId;
    next: number;
    practice: boolean;
    clock: number;
    settle: number;
    slow: { from: number; to: number } | null;
  } | null = null;
  private practice = false; // warm-up swings on the first tee: they don't count
  private fly: { curve: THREE.CatmullRomCurve3; t: number } | null = null;
  private follow = new THREE.Vector3(0, 0, -1);
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private view: 'play' | 'target' = 'play'; // one tap flips to a look at where the shot lands
  private landing = new THREE.Vector3();
  private orbit = 0;
  private resolve: ((r: HoleResult) => void) | null = null;
  // the admin's list of holes, for jumping about a preview round
  private menu: { names: string[]; pick: (i: number) => void } | null = null;
  // the practice facility: no score, the ball comes back after every shot, to the station you're working from
  private drill: Drill | null = null;
  // practice of any kind: the Leave button says so and doesn't ask
  leaveText = '';
  // told after every swing, for the practice log
  onShot: (() => void) | null = null;
  private drag: { x: number; y: number; aim: number; power: number; kind: '' | 'aim' | 'power' } | null = null;
  private miniBase: HTMLCanvasElement | null = null;
  private faded = new Map<THREE.Object3D, number>();
  private onResize = () => this.resize();
  private onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private host: HTMLElement, avatar: Avatar, private onQuit: () => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    host.appendChild(this.renderer.domElement);
    this.overlay = html(`<div class="g3-ui"></div>`);
    host.appendChild(this.overlay);
    // If the device drops the graphics (low memory, often on iPad), say so rather than sit on a blank screen.
    // three.js redraws on its own when they come back; if they don't, a reload brings the club back.
    const dark = html(`<div class="g3-dark" hidden><p>The course went dark.</p><button class="btn">Reload</button></div>`);
    dark.querySelector('button')!.addEventListener('click', () => location.reload());
    host.appendChild(dark);
    let darkTimer = 0;
    this.renderer.domElement.addEventListener('webglcontextlost', () => {
      darkTimer = window.setTimeout(() => (dark.hidden = false), 2500);
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      clearTimeout(darkTimer);
      dark.hidden = true;
    });

    this.sky();
    this.scene.add(new THREE.HemisphereLight('#d6e8f5', '#46612f', 1.25));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.5;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog('#e3ebe2', 420, 1300);
    // soft reflections from the sky
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    env.add(this.skyMesh(0.6));
    this.scene.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();

    this.ball.castShadow = true;
    this.scene.add(this.ball);
    this.golfer = new Golfer(specOf(avatar));
    this.golfer.holdClub('driver');
    this.scene.add(this.golfer.group);

    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: '#f3ecdc', transparent: true, opacity: 0.9 }), 80);
    this.dots.frustumCulled = false;
    this.scene.add(this.dots);
    this.scene.add(this.ring);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    tg.setDrawRange(0, 0);
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);

    for (let i = 0; i < 8; i++) {
      const c = props.cloud();
      c.position.set(-700 + i * 190, 190 + (i % 3) * 40, -300 - (i % 4) * 160);
      this.clouds.push(c);
      this.scene.add(c);
    }
    for (let i = 0; i < 5; i++) {
      const b = props.bird();
      this.birds.push(b);
      this.scene.add(b);
    }

    this.bindInput();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    this.resize();
    this.loop();
    if (import.meta.env.DEV) Object.assign(window, { __g3: this }); // for browser tests
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.world?.dispose();
    this.cart?.dispose();
    this.clearGhosts();
    this.clearRead();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.host.innerHTML = '';
  }

  // The range or the short game area. Plays like a hole that never ends: leave when you're done.
  practiceArea(hole: Hole, drill: Omit<Drill, 'at'>) {
    this.drill = { ...drill, at: 0 };
    void this.play(hole, 1, { strokes: 0, par: 0 }, { of: 1 });
  }

  setHoleMenu(names: string[], pick: (i: number) => void) {
    this.menu = { names, pick };
  }

  // Plays one hole to completion. The beverage cart may stop by on the tee.
  play(hole: Hole, number: number, total: { strokes: number; par: number }, opts: { cart?: 'daisy' | 'reginald'; of?: number } = {}): Promise<HoleResult> {
    this.holesInRound = opts.of ?? this.holesInRound;
    this.clearRead();
    if (this.world) {
      this.scene.remove(this.world.root);
      this.world.dispose();
    }
    this.cart?.dispose();
    this.cart = null;
    // today's pin and wind, the same for every member
    this.wind = this.drill ? { pin: hole.cup, mph: 0, toward: 0, accel: { x: 0, y: 0 } } : conditionsFor(hole, todayInGameTz());
    hole = withPin(hole, this.wind);
    this.hole = hole;
    this.number = number;
    this.total = total;
    this.world = buildWorld(hole, number);
    this.scene.add(this.world.root);
    // the flag streams the way the wind blows
    const pin = this.world.root.getObjectByName('pin');
    if (pin && this.wind.mph) pin.rotation.y = Math.PI / 2 - this.wind.toward;
    this.faded.clear();
    this.clock = 0;
    this.strokes = 0;
    this.spot = undefined;
    this.practice = !!this.drill;
    this.zones = new Set();
    this.pos = this.drill ? { ...this.drill.stations[this.drill.at].at } : { ...hole.tee };
    this.aim = this.drill && this.drill.at ? Math.atan2(hole.cup.x - this.pos.x, hole.cup.y - this.pos.y) : hole.aim;
    this.power = 0;
    this.shot = null;
    this.setView('play');
    this.trailPts = [];
    this.drawTrail();
    this.placeBall();
    this.sharpen(!!hole.tour);
    this.fitShadows();
    this.petalsFor(hole);
    this.hud(total);
    this.miniBase = null;
    this.placeGhosts();
    if (opts.cart && !hole.noCart) this.cart = new CartGirl(this.scene, hole, (k) => this.order(k), opts.cart);
    this.startFlyover();
    // the practice areas skip the flyover and get straight to it
    if (this.drill) this.endFlyover();
    return new Promise((res) => (this.resolve = res));
  }

  // ---------- setup ----------

  private skyMesh(scale = 1) {
    const geo = new THREE.SphereGeometry(2000 * scale, 32, 16);
    const col: number[] = [];
    const top = new THREE.Color('#6fa3d0');
    const mid = new THREE.Color('#bcd5e8');
    const low = new THREE.Color('#f1ecdc');
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = p.getY(i) / (2000 * scale);
      const c = k > 0.2 ? mid.clone().lerp(top, Math.min(1, (k - 0.2) / 0.6)) : low.clone().lerp(mid, Math.max(0, k / 0.2));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  }

  private sky() {
    this.scene.add(this.skyMesh());
    const sun = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 10), new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false }));
    sun.position.set(-900, 700, 1200);
    this.scene.add(sun);
  }

  // Tour courses draw at the phone's full resolution, with finer shadows. The frame-rate guard in the loop still
  // steps the resolution down on a phone that can't keep up.
  private sharp: boolean | null = null;
  private sharpen(on: boolean) {
    if (this.sharp === on) return;
    this.sharp = on;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, on ? 3 : 2));
    const size = on ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  private fitShadows() {
    const { x0, y0, x1, y1 } = this.hole.bounds;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const r = Math.hypot(x1 - x0, y1 - y0) / 2 + 20;
    this.sun.position.set(cx - 170, 260, -cy + 220);
    this.sun.target.position.set(cx, 0, -cy);
    const c = this.sun.shadow.camera;
    c.left = -r;
    c.right = r;
    c.top = r;
    c.bottom = -r;
    c.near = 10;
    c.far = 900;
    c.updateProjectionMatrix();
  }

  private petalsFor(h: Hole) {
    if (this.petals) {
      this.scene.remove(this.petals);
      this.petals.geometry.dispose();
      this.petals = null;
    }
    const blooms = h.decor.filter((d) => d.kind === 'azalea');
    const n = blooms.length ? 260 : 80;
    const arr = new Float32Array(n * 3);
    const { x0, y0, x1, y1 } = h.bounds;
    for (let i = 0; i < n; i++) {
      arr[i * 3] = x0 + Math.random() * (x1 - x0);
      arr[i * 3 + 1] = Math.random() * 24;
      arr[i * 3 + 2] = -(y0 + Math.random() * (y1 - y0));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.petals = new THREE.Points(geo, new THREE.PointsMaterial({ color: blooms.length ? '#f4a7c3' : '#fff6d8', size: blooms.length ? 0.5 : 0.3, transparent: true, opacity: 0.85 }));
    this.scene.add(this.petals);
  }

  private resize() {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 66 : 52;
    this.camera.updateProjectionMatrix();
  }

  // ---------- HUD ----------

  private hud(total: { strokes: number; par: number }) {
    const h = this.hole;
    const diff = total.strokes - total.par;
    // tour courses tuck the strike ball up out of the thumb's way, on the far side from the hand you hit with
    this.overlay.classList.toggle('tour', !!h.tour);
    this.overlay.classList.toggle('lefty', this.golfer.spec.hand === 'left');
    this.overlay.innerHTML = `
      <div class="g3-focus" data-focus aria-hidden="true"></div>
      <div class="g3-flash" data-flash aria-hidden="true"></div>
      <div class="g3-top">
        <div class="g3-left"><button class="g3-pill" data-quit>${this.leaveText || 'Leave'}</button>${this.menu ? '<button class="g3-pill" data-holes>Holes</button>' : ''}</div>
        ${
          this.drill
            ? `<div class="g3-title"><small>Practice facility</small><b>${this.drill.title}</b><span><em data-station-name>${this.drill.stations[this.drill.at].name}</em>${this.drill.stations.length > 1 ? ' · <i data-dist></i>' : ''}</span></div>
        <div class="g3-score"><small>Shots</small><b data-shots>0</b><span></span></div>`
            : `<div class="g3-title"><small>Hole ${this.number} of ${this.holesInRound}</small><b>${h.name}</b><span>Par ${h.par} · <i data-dist></i></span></div>
        <div class="g3-score"><small>Stroke</small><b data-strokes>0</b><span>${total.par ? `Round ${diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}` : ''}</span></div>`
        }
      </div>
      <canvas class="g3-mini" width="132" height="168" aria-hidden="true"></canvas>
      <div class="g3-drink" data-drink hidden></div>
      <div class="g3-power" aria-hidden="true"><i data-power></i></div>
      <div class="g3-strike" data-strike hidden>
        <small class="t">Top</small><small class="l">Draw</small>
        <div class="g3-ball" data-ball role="slider" aria-label="Strike point: spin and shape" tabindex="0"><i data-dot></i></div>
        <small class="r">Fade</small><small class="b">Back</small>
        <b data-strike-label>Stock</b>
      </div>
      <div class="g3-wind" data-wind><i data-wind-arrow aria-hidden="true">↑</i><b data-wind-speed></b></div>
      <div class="g3-swing" data-swing hidden>
        <small class="g3-swing-tag" data-swing-tag hidden></small>
        <div class="g3-swing-track">
          <div class="g3-swing-bar">
            <span class="over"></span><span class="fill" data-fill></span>
            <span class="gold" data-gold></span><span class="pure" data-pure></span>
            <span class="plan" data-plan></span><span class="needle" data-needle></span>
          </div>
        </div>
        <p data-swing-tip></p>
      </div>
      <div class="g3-callout" data-callout></div>
      <div class="g3-hint" data-hint></div>
      <div class="g3-read" data-read hidden></div>
      <div class="g3-cart" data-cart hidden></div>
      <div class="g3-bottom">
        <div class="g3-club" role="group" aria-label="Club">
          ${this.bag.map((c) => `<button data-club="${c}"><b>${LABEL[c]}</b><small>${c === 'putter' ? 'roll' : yd(CLUBS[c].carry[1])}</small></button>`).join('')}
        </div>
        <div class="g3-aim">
          <button data-nudge="-1" aria-label="Aim left">◀</button>
          <button data-nudge="1" aria-label="Aim right">▶</button>
        </div>
        <button class="g3-pill" data-practice aria-pressed="false" hidden>Practice</button>
        ${this.drill && this.drill.stations.length > 1 ? '<button class="g3-pill" data-station>Next spot</button>' : ''}
        <button class="g3-pill" data-view aria-pressed="false">Target</button>
      </div>
      <button class="g3-skip" data-skip>Skip flyover</button>`;
    const q = (s: string) => this.overlay.querySelector(s) as HTMLElement;
    q('[data-quit]').onclick = () => {
      if (this.leaveText || confirm('Leave the round? An unfinished round does not count.')) this.onQuit();
    };
    if (this.drill && this.drill.stations.length > 1) q('[data-station]').onclick = () => this.nextStation();
    if (this.menu) q('[data-holes]').onclick = () => this.holeMenu();
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-club]').forEach((b) => {
      b.onclick = () => {
        if (this.mode !== 'aim' || b.disabled) return;
        this.setClub(b.dataset.club as ClubId);
        sfx('tick');
      };
    });
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach((b) => {
      let timer = 0;
      const step = () => {
        if (this.mode === 'aim') this.aim += Number(b.dataset.nudge) * (this.club === 'putter' ? 0.004 : 0.008);
      };
      b.onpointerdown = (e) => {
        e.preventDefault();
        step();
        timer = window.setInterval(step, 60);
      };
      const stop = () => clearInterval(timer);
      b.onpointerup = stop;
      b.onpointerleave = stop;
      b.onpointercancel = stop;
    });
    const view = q('[data-view]');
    view.onclick = () => this.setView(this.view === 'play' ? 'target' : 'play');
    const practice = q('[data-practice]');
    practice.onclick = () => {
      if (this.mode !== 'aim' || this.strokes > 0) return;
      this.practice = !this.practice;
      practice.textContent = this.practice ? 'Practice: on' : 'Practice';
      practice.setAttribute('aria-pressed', String(this.practice));
      practice.classList.toggle('on', this.practice);
      this.hint(this.practice ? "Practice swings don't count. Switch it off to start your round." : '');
      sfx('tick');
    };
    q('[data-skip]').onclick = () => this.endFlyover();
    const w = this.wind!;
    q('[data-wind-speed]').textContent = w.mph ? `${w.mph} mph` : 'Calm';
    q('[data-wind-arrow]').hidden = !w.mph;
    this.bindStrike(q('[data-ball]'));
    this.showDrink();
  }

  // The strike point: low on the ball for backspin, high for topspin; left bends it left (draw), right for a fade.
  private bindStrike(ball: HTMLElement) {
    let down = false;
    const set = (e: PointerEvent) => {
      const r = ball.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const d = Math.hypot(x, y);
      if (d > 1) {
        x /= d;
        y /= d;
      }
      this.setStrike(y, x);
    };
    ball.onpointerdown = (e) => {
      if (this.mode !== 'aim') return;
      down = true;
      ball.setPointerCapture(e.pointerId);
      set(e);
    };
    ball.onpointermove = (e) => down && this.mode === 'aim' && set(e);
    ball.onpointerup = ball.onpointercancel = () => {
      if (down) sfx('tick');
      down = false;
    };
  }

  private setStrike(spin: number, shape: number) {
    // a dead-centre strike snaps to stock
    const snap = (v: number) => (Math.abs(v) < 0.2 ? 0 : Math.max(-1, Math.min(1, v)));
    this.spin = snap(spin);
    this.shape = snap(shape);
    const dot = this.overlay.querySelector('[data-dot]') as HTMLElement | null;
    if (dot) dot.style.cssText = `left:${50 + this.shape * 34}%;top:${50 + this.spin * 34}%`;
    const label = this.overlay.querySelector('[data-strike-label]');
    if (label) {
      const parts = [this.spin > 0 ? 'Backspin' : this.spin < 0 ? 'Topspin' : '', this.shape < 0 ? 'Draw' : this.shape > 0 ? 'Fade' : ''].filter(Boolean);
      label.textContent = parts.join(' · ') || 'Stock';
    }
  }

  private setView(v: 'play' | 'target') {
    this.view = v;
    const b = this.overlay.querySelector('[data-view]');
    if (!b) return;
    b.textContent = v === 'target' ? 'Back' : 'Target';
    b.setAttribute('aria-pressed', String(v === 'target'));
    b.classList.toggle('on', v === 'target');
  }

  private setClub(c: ClubId) {
    this.club = c;
    this.power = c === 'putter' ? 0 : this.planFor(c);
    this.golfer.holdClub(c);
    if (c === 'putter' && this.hole.tour) this.readGreen();
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-club]').forEach((x) => x.classList.toggle('on', x.dataset.club === c));
  }

  // The planned power that would carry this club about to the pin, before wind and slopes: a starting point.
  private planFor(c: ClubId) {
    const [lo, hi] = CLUBS[c].carry;
    const d = Math.hypot(this.hole.cup.x - this.pos.x, this.hole.cup.y - this.pos.y);
    const reach = d / (this.boost() * lieFactor(this.hole, this.pos, c));
    if (!this.hole.tour) return Math.max(0.15, Math.min(1, (reach - lo) / (hi - lo)));
    // on tour courses the plan is where the ball stops, not where it lands: on quick greens a chip runs out two or
    // three times its carry. The plan goes all the way down, so even a short chip can be aimed at the hole.
    const drop = Math.round((heightAt(this.hole, this.hole.cup.x, this.hole.cup.y) - heightAt(this.hole, this.pos.x, this.pos.y)) / 2) * 2;
    const stops = this.stopTable(c, drop);
    if (reach <= stops[0]) return 0;
    for (let i = 1; i < stops.length; i++)
      if (reach <= stops[i]) return (i - 1 + (reach - stops[i - 1]) / Math.max(1e-6, stops[i] - stops[i - 1])) / (stops.length - 1);
    return 1;
  }

  // How far each club's ball ends up on tour green, at power 0, 0.05 .. 1, when the green sits `rise` ft above (or
  // below) where you're standing: a shot down into a crater flies a long way further than the same swing on the level.
  // Worked out once per club and height (to the nearest 2 ft) and kept.
  private stops = new Map<string, number[]>();
  private stopTable(c: ClubId, rise = 0) {
    const key = `${this.hole.id}:${c}:${rise}`;
    let t = this.stops.get(key);
    if (t) return t;
    // level ground where you stand, then a step up or down to the green's height a few feet out
    const terrain: Hole['terrain'] = rise ? [{ kind: 'box', x0: -2000, y0: 8, x1: 2000, y1: 9000, h: rise, edge: 6, op: 'set' }] : [];
    const flat: Hole = { ...this.hole, terrain, water: [], movers: [], pushes: [], walls: [], posts: [], regions: [], roofs: [], ceilings: [], portals: [], base: 'green', greenFirm: this.hole.greenFirm, cup: { x: 0, y: 5000 }, bounds: { x0: -100, y0: -50, x1: 100, y1: 9000 }, border: [{ x: -100, y: -50 }, { x: 100, y: -50 }, { x: 100, y: 9000 }, { x: -100, y: 9000 }] };
    t = [];
    for (let i = 0; i <= 20; i++) t.push(simulate(flat, { x: 0, y: 0 }, { angle: 0, power: i / 20, club: c, error: 0, clock: 0 }, false).end.y);
    // never shorter than the last: a plan that goes up with the power
    for (let i = 1; i < t.length; i++) t[i] = Math.max(t[i], t[i - 1] + 0.01);
    this.stops.set(key, t);
    return t;
  }

  // Which clubs this lie allows, and a sensible default for the distance.
  private lie() {
    const s = surfaceAt(this.hole, this.pos);
    const allowed: ClubId[] = s === 'sand' ? ['wedge', 'iron'] : s === 'green' ? ['putter', 'chip', 'wedge'] : this.bag;
    const d = Math.hypot(this.hole.cup.x - this.pos.x, this.hole.cup.y - this.pos.y);
    const want: ClubId = s === 'green' ? 'putter' : this.hole.tour && s !== 'sand' && d >= 26 ? this.reachFor(d, s, allowed) : s === 'sand' ? (d > 110 ? 'iron' : 'wedge') : d < 26 && s !== 'rough' ? 'putter' : d < 40 && s !== 'rough' ? 'chip' : d < 95 ? 'wedge' : d < 215 || s === 'rough' ? 'iron' : 'driver';
    return { allowed, want, d };
  }

  // On tour courses: the shortest club that gets there, going by how far each one really goes from here with the
  // climb or drop to the pin (the same table the power plan uses). Out of the rough, never the chip.
  private reachFor(d: number, s: string, allowed: ClubId[]): ClubId {
    const drop = Math.round((heightAt(this.hole, this.hole.cup.x, this.hole.cup.y) - heightAt(this.hole, this.pos.x, this.pos.y)) / 2) * 2;
    for (const c of ['chip', 'wedge', 'iron', 'wood', 'driver'] as ClubId[]) {
      if (!allowed.includes(c) || (c === 'chip' && (s === 'rough' || d > 60))) continue;
      const t = this.stopTable(c, drop);
      if (t[t.length - 1] * this.boost() >= d * 1.02) return c;
    }
    return allowed.includes('driver') ? 'driver' : 'iron';
  }

  private setStrokes() {
    const el = this.overlay.querySelector('[data-strokes]');
    if (el) el.textContent = String(this.strokes);
  }

  private hint(text: string) {
    const el = this.overlay.querySelector('[data-hint]') as HTMLElement | null;
    if (el) el.textContent = text;
  }

  callout(text: string, sub = '', ms = 1800) {
    const el = this.overlay.querySelector('[data-callout]') as HTMLElement | null;
    if (!el) return;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show', 'bomb');
    void el.offsetWidth;
    el.classList.add('show');
    // only the latest callout's timer may hide it, or an old one cuts a new one short
    window.clearTimeout(this.calloutTimer);
    this.calloutTimer = window.setTimeout(() => el.classList.remove('show'), ms);
  }
  private calloutTimer = 0;

  private showDrink() {
    const el = this.overlay.querySelector('[data-drink]') as HTMLElement | null;
    if (!el) return;
    el.hidden = !this.drink || this.drink.kind === 'water';
    if (this.drink) el.innerHTML = `<b>${DRINKS[this.drink.kind].name}</b><span>${this.drink.shots} ${this.drink.shots === 1 ? 'swing' : 'swings'} left</span>`;
  }

  // ---------- the beverage cart ----------

  private order(kind: Drink | null) {
    this.overlay.classList.remove('carting');
    if (kind) {
      this.lastDrink = kind;
      // Reginald's fireball is good for one swing; Daisy's drinks for two
      this.drink = { kind, shots: kind === 'fireball' ? 1 : 2 };
      try {
        const k = 'ccc-drinks';
        const had = new Set<string>(JSON.parse(localStorage.getItem(k) || '[]'));
        // the Nineteenth Hole is Daisy's three; the fireball doesn't count toward it
        if (kind !== 'fireball') had.add(kind);
        localStorage.setItem(k, JSON.stringify([...had]));
        if (had.size === 3) this.zones.add('nineteenth');
      } catch {
        /* private mode: no trophy tracking */
      }
      sfx('pop');
    }
    this.showDrink();
    this.toAim();
  }

  private mini() {
    const c = this.overlay.querySelector('.g3-mini') as HTMLCanvasElement | null;
    if (!c) return;
    const x = c.getContext('2d')!;
    const { x0, y0, x1, y1 } = this.hole.bounds;
    const s = Math.min((c.width - 12) / (x1 - x0), (c.height - 12) / (y1 - y0));
    const ox = (c.width - (x1 - x0) * s) / 2;
    const oy = (c.height - (y1 - y0) * s) / 2;
    const px = (p: V2) => [ox + (p.x - x0) * s, c.height - oy - (p.y - y0) * s] as const;
    if (!this.miniBase) {
      const b = document.createElement('canvas');
      b.width = c.width;
      b.height = c.height;
      const g = b.getContext('2d')!;
      const step = 1 / s;
      for (let yy = y0; yy < y1; yy += step * 2)
        for (let xx = x0; xx < x1; xx += step * 2) {
          const p = { x: xx, y: yy };
          if (!inPoly(p, this.hole.border)) continue;
          const surf = surfaceAt(this.hole, p);
          const wet = wetIn(this.hole, p);
          g.fillStyle = wet
            ? wet.look === 'lava'
              ? Math.sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453 % 1 > 0.7 ? '#a8381a' : '#2e1510'
              : '#4d8193'
            : ({ green: '#86c977', fairway: '#62a957', fringe: '#4f8f47', rough: '#3a6533', path: '#cbb88f', wood: '#a77a4e', stone: '#d8cfbd', sand: '#e8d8a8', rock: '#3b3633', cinder: '#6a4436' } as Record<string, string>)[surf];
          const [a, bb] = px(p);
          g.fillRect(a, bb - 2, 2.2, 2.2);
        }
      g.strokeStyle = '#1e3a26';
      g.lineWidth = 1.2;
      for (const w of this.hole.walls) {
        g.beginPath();
        g.moveTo(...px(w.a));
        g.lineTo(...px(w.b));
        g.stroke();
      }
      g.fillStyle = '#20402a';
      for (const p of this.hole.posts) {
        if (p.r < 1) continue;
        const [a, bb] = px(p);
        g.beginPath();
        g.arc(a, bb, 1.6, 0, Math.PI * 2);
        g.fill();
      }
      this.miniBase = b;
    }
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(this.miniBase, 0, 0);
    const [cx, cy] = px(this.hole.cup);
    x.fillStyle = '#b8955a';
    x.beginPath();
    x.arc(cx, cy, 3, 0, Math.PI * 2);
    x.fill();
    const b = this.shot ? { x: this.ball.position.x, y: -this.ball.position.z } : this.pos;
    const [bx, by] = px(b);
    if (this.mode === 'aim' || this.mode === 'meter') {
      const reach = this.club === 'putter' ? 30 : carryOf(this.club, Math.max(this.power, 0.6), this.boost());
      x.strokeStyle = 'rgba(255,255,255,.85)';
      x.setLineDash([3, 3]);
      x.beginPath();
      x.moveTo(bx, by);
      x.lineTo(bx + Math.sin(this.aim) * reach * s, by - Math.cos(this.aim) * reach * s);
      x.stroke();
      x.setLineDash([]);
    }
    x.fillStyle = '#fff';
    x.strokeStyle = '#163b2c';
    x.beginPath();
    x.arc(bx, by, 3.2, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }

  // ---------- flyover ----------

  private startFlyover() {
    const pts = this.hole.flyover.map((p, i, a) => {
      const k = i / (a.length - 1);
      return w3(p.x, p.y, heightAt(this.hole, p.x, p.y) + 70 - k * 34);
    });
    this.fly = { curve: new THREE.CatmullRomCurve3(pts), t: 0 };
    this.mode = 'fly';
    this.overlay.querySelector('[data-skip]')?.classList.add('show');
    this.callout(this.hole.name, this.drill ? 'Practice facility' : `Hole ${this.number} · Par ${this.hole.par}`, 3200);
    this.hint('');
    this.golfer.setPose('idle');
    sfx('whoosh');
  }

  private endFlyover() {
    if (this.mode !== 'fly') return;
    this.fly = null;
    this.overlay.querySelector('[data-skip]')?.classList.remove('show');
    if (this.cart && !this.cart.visited) {
      this.mode = 'cart';
      this.overlay.classList.add('carting');
      this.cart.arrive(this.pos, this.aim, this.overlay.querySelector('[data-cart]') as HTMLElement, {
        visit: ++this.visits,
        diff: this.total.strokes - this.total.par,
        last: this.lastDrink,
      });
    } else this.toAim();
    this.snapCamera();
  }

  private toAim() {
    // the tide (or the lava) has come up over the ball: a free drop uphill, somewhere it stays dry
    const over = wetIn(this.hole, this.pos, this.clock);
    if (over) {
      const flooded = (p: V2) => this.hole.water.some((w) => inPoly(p, w.poly) && heightAt(this.hole, p.x, p.y) < w.level + (w.tide?.amp ?? 0));
      let p = { ...this.pos };
      for (let i = 0; i < 120 && flooded(p); i++) {
        const g = gradAt(this.hole, p.x, p.y);
        const m = Math.hypot(g.x, g.y) || 1;
        p = { x: p.x + g.x / m, y: p.y + g.y / m };
      }
      this.pos = p;
      this.placeBall();
      this.callout(over.look === 'lava' ? "The lava's come up" : "The tide's in", 'Free drop, uphill', 1800);
    }
    // practice is only on offer before the first counted stroke of the round
    const practice = this.overlay.querySelector('[data-practice]') as HTMLElement | null;
    if (practice) practice.hidden = !!this.drill || !(this.number === 1 && this.strokes === 0);
    this.mode = 'aim';
    this.power = 0;
    // after the tee shot, every shot starts lined up on the pin
    if (this.strokes > 0) this.aim = Math.atan2(this.hole.cup.x - this.pos.x, this.hole.cup.y - this.pos.y);
    const { allowed, want, d } = this.lie();
    this.overlay.querySelectorAll<HTMLButtonElement>('[data-club]').forEach((b) => (b.disabled = !allowed.includes(b.dataset.club as ClubId)));
    this.setClub(want);
    const dist = this.overlay.querySelector('[data-dist]');
    const putt = surfaceAt(this.hole, this.pos) === 'green';
    // the climb or drop to the pin, when it's enough to matter: it changes how far a shot has to fly
    const rise = (heightAt(this.hole, this.hole.cup.x, this.hole.cup.y) - heightAt(this.hole, this.pos.x, this.pos.y)) * SCALE;
    const slope = !putt && Math.abs(rise) >= 6 ? ` · ${Math.round(Math.abs(rise))} ft ${rise < 0 ? 'down' : 'up'}` : '';
    if (dist) dist.textContent = this.drill ? `${away(d, putt)}${slope}` : `${away(d, putt)} to the pin${slope}`;
    const first = this.number === 1 && this.strokes === 0 && !this.drill;
    const tip = this.number === 1 && this.strokes === 1 && want !== 'putter';
    this.hint(
      first
        ? 'Drag sideways to aim, down to plan your power. Then tap to swing.'
        : tip
          ? 'Drag the dot on the ball for spin, or to bend the shot. Mind the wind.'
          : '',
    );
    this.golfer.setPose('address');
  }

  // ---------- input ----------

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (this.mode === 'fly') return this.endFlyover();
      if (this.mode === 'meter') return this.tapSwing();
      if (this.mode !== 'aim') return;
      el.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, aim: this.aim, power: this.power, kind: '' };
    });
    el.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || this.mode !== 'aim') return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.kind && Math.hypot(dx, dy) > 10) d.kind = Math.abs(dx) > Math.abs(dy) ? 'aim' : 'power';
      if (d.kind === 'aim') this.aim = d.aim + dx * (this.club === 'putter' ? 0.0025 : 0.004);
      if (d.kind === 'power') {
        const full = Math.min(window.innerHeight * 0.42, 340);
        // putts pull back from nothing; full swings nudge the plan up (pull down) or down (push up)
        this.power = Math.max(0, Math.min(1, (this.club === 'putter' ? 0 : d.power) + dy / full));
        // the putter goes back as far as you pull
        if (this.club === 'putter') this.golfer.takeBack('putter', this.power);
      }
    });
    const up = () => {
      const d = this.drag;
      this.drag = null;
      if (!d || this.mode !== 'aim') return;
      // putts go on release; full swings keep the plan and start with a tap
      if (this.club === 'putter') {
        if (d.kind === 'power' && this.power > 0.03) this.putt();
        else {
          this.power = 0;
          this.golfer.setPose('address');
        }
      } else if (!d.kind) this.startSwing();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => {
      this.drag = null;
      if (this.club === 'putter' && this.mode === 'aim') {
        this.power = 0;
        this.golfer.setPose('address');
      }
    });
  }

  private key(e: KeyboardEvent) {
    if (this.mode === 'fly' && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) return this.endFlyover();
    if (this.mode === 'meter' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      return this.tapSwing();
    }
    if (this.mode !== 'aim') return;
    const bag = this.bag;
    const idx = bag.indexOf(this.club);
    if (e.key === 'ArrowLeft') this.aim -= e.shiftKey ? 0.003 : 0.012;
    else if (e.key === 'ArrowRight') this.aim += e.shiftKey ? 0.003 : 0.012;
    else if (e.key === 'ArrowUp') this.power = Math.min(1, this.power + 0.02);
    else if (e.key === 'ArrowDown') this.power = Math.max(0, this.power - 0.02);
    else if ('wasdx'.includes(e.key) && this.club !== 'putter')
      this.setStrike(
        e.key === 'x' ? 0 : this.spin + (e.key === 's' ? 0.5 : e.key === 'w' ? -0.5 : 0),
        e.key === 'x' ? 0 : this.shape + (e.key === 'd' ? 0.5 : e.key === 'a' ? -0.5 : 0),
      );
    else if (e.key === 'c') this.overlay.querySelector<HTMLButtonElement>(`[data-club="${bag[(idx + 1) % bag.length]}"]:not(:disabled)`)?.click();
    else if (e.key === ' ' && this.club !== 'putter') this.startSwing();
    else if (e.key === ' ' && this.power > 0.03) this.putt();
    else return;
    e.preventDefault();
  }

  private boost() {
    return this.drink ? DRINKS[this.drink.kind].boost : 1;
  }

  // ---------- the swing ----------

  // The vertical meter (tour courses) stands beside the golfer: power fills
  // upward and the club goes back with it, then the needle and the club come down together to the strike.
  // the clubs in the bag: tour courses and the practice facility carry the wood as well
  private get bag() {
    return bagFor(!!this.hole.tour || !!this.drill);
  }

  private style(): MeterStyle {
    return this.hole.tour ? 'vertical' : 'classic';
  }

  // a stretch of the bar (from, size as shares of it), across or up depending on the meter
  private span(el: HTMLElement, from: number, size: number) {
    el.style.cssText = this.style() === 'vertical' ? `bottom:${from * 100}%;height:${size * 100}%` : `left:${from * 100}%;width:${size * 100}%`;
  }

  // one point on the bar
  private mark(el: HTMLElement, at: number) {
    el.style.cssText = this.style() === 'vertical' ? `bottom:${at * 100}%` : `left:${at * 100}%`;
  }

  // Tap 1: the power bar starts to fill. Your plan is the gold line on it.
  private startSwing() {
    if (this.mode !== 'aim' || this.club === 'putter') return;
    const drink = this.drink ? DRINKS[this.drink.kind] : null;
    this.mode = 'meter';
    this.meter = { phase: 'power', p: 0, x: barX(0), speed: drink?.needle ?? 1, half: 0 };
    const m = this.overlay.querySelector('[data-swing]') as HTMLElement;
    m.hidden = false;
    m.classList.remove('accuracy');
    m.classList.toggle('vertical', this.style() === 'vertical');
    // what you're drinking shows on the meter: for the lager or Reginald's fireball the
    // overswing at the top of the bar turned to fire (swing into it: that's the extra distance), and a tag saying which
    const kind = this.drink?.kind;
    m.classList.toggle('boost', kind === 'lager' || kind === 'fireball');
    m.classList.toggle('fireball', kind === 'fireball');
    const tag = this.overlay.querySelector('[data-swing-tag]') as HTMLElement;
    tag.hidden = !drink || kind === 'water';
    if (drink) tag.textContent = kind === 'palmer' ? 'Arnold Palmer · a touch slower' : kind === 'lager' ? 'Lager · +10% · swing into the fire' : kind === 'fireball' ? 'Fireball · +15% · swing into the fire' : '';
    // righties have the meter on the left, out of the way of the golfer; lefties on the right
    m.classList.toggle('lefty', this.golfer.spec.hand === 'left');
    this.mark(this.overlay.querySelector('[data-plan]') as HTMLElement, barX(this.power));
    (this.overlay.querySelector('[data-gold]') as HTMLElement).style.cssText = 'display:none';
    (this.overlay.querySelector('[data-pure]') as HTMLElement).style.cssText = 'display:none';
    (this.overlay.querySelector('[data-swing-tip]') as HTMLElement).textContent = 'Tap on the gold line';
    this.hint('');
    sfx('tick');
  }

  // Tap 2 sets the power; tap 3 strikes it.
  private tapSwing() {
    if (this.mode !== 'meter') return;
    const m = this.meter;
    if (m.phase === 'power') {
      const drink = this.drink ? DRINKS[this.drink.kind] : null;
      m.phase = 'accuracy';
      const fire = (drink?.boost ?? 1) > 1;
      m.half = goldHalf(this.club, m.p, drink?.sweet ?? 1, this.style(), fire);
      m.speed = returnSpeed(this.club, m.p, drink?.needle ?? 1, this.style(), fire);
      const box = this.overlay.querySelector('[data-swing]') as HTMLElement;
      box.classList.add('accuracy');
      this.span(this.overlay.querySelector('[data-gold]') as HTMLElement, IMPACT - m.half, m.half * 2);
      this.span(this.overlay.querySelector('[data-pure]') as HTMLElement, IMPACT - m.half * PURE, m.half * PURE * 2);
      (this.overlay.querySelector('[data-swing-tip]') as HTMLElement).textContent = m.p > 1 ? (fire ? 'In the fire! Tap in the gold' : 'Overswing! Tap in the gold') : 'Tap in the gold';
      sfx('tick');
      return;
    }
    const miss = m.x - IMPACT;
    const error = accuracyError(miss, m.half);
    (this.overlay.querySelector('[data-swing]') as HTMLElement).hidden = true;
    const off = Math.round((m.p - this.power) * 100);
    const power = `${Math.round(m.p * 100)}%${Math.abs(off) >= 4 ? (off > 0 ? ' · long' : ' · short') : ''}`;
    // a bomb: full power, and the inner part of the bright heart (the vertical meter's gold is wider, the heart isn't)
    const bomb = this.club === 'driver' && Math.abs(miss) <= m.half * PURE * 0.7 && m.p >= 0.97;
    if (bomb) this.bombSwing = true;
    else if (error === 0) this.callout('Pure', power, 900);
    else if (Math.abs(error) <= 0.12) this.callout('Good', power, 800);
    else this.callout(Math.abs(error) > 0.5 ? (error > 0 ? 'Slice' : 'Hook') : error > 0 ? 'Push' : 'Pull', power, 900);
    this.power = m.p;
    // on the vertical meter the club is already back down at the ball: straight into the strike
    // a bomb starts from the top so you see the whole downswing in slow motion
    this.swing(error, this.bombSwing ? 'top' : this.style() === 'vertical' ? 'impact' : 'start');
  }

  // A putt goes where you aim it, as hard as you pulled it back.
  // The putter is already back where you pulled it to: let go and it comes through.
  private putt() {
    this.swing(0, 'top');
  }

  private swing(error: number, from: 'start' | 'top' | 'impact' = 'start') {
    this.mode = 'swing';
    this.setView('play');
    const power = this.power;
    const club = this.club;
    this.golfer.swingClub(club, Math.min(1, power), () => this.hit(club, power, error), undefined, from);
    if (club !== 'putter') window.setTimeout(() => sfx('whoosh'), from === 'impact' ? 0 : 500);
  }

  private hit(club: ClubId, power: number, error: number) {
    const full = club !== 'putter';
    const shot: Shot = { angle: this.aim, power, club, error, clock: this.clock, boost: full ? this.boost() * (this.bombSwing ? BOMB : 1) : 1, spin: full ? this.spin : 0, shape: full ? this.shape : 0, wind: this.wind?.accel };
    const r = simulate(this.hole, this.pos, shot);
    // every shot starts from a stock strike
    this.setStrike(0, 0);
    const practice = this.practice;
    if (this.drill) {
      const el = this.overlay.querySelector('[data-shots]');
      if (el) el.textContent = String(Number(el.textContent) + 1);
    }
    this.onShot?.();
    if (this.drink && club !== 'putter' && !practice) {
      this.drink.shots--;
      if (this.drink.shots <= 0) this.drink = null;
      this.showDrink();
    }
    if (!practice) {
      this.strokes++;
      this.setStrokes();
      r.zones.forEach((z) => this.zones.add(z));
    }
    this.mode = 'roll';
    // on tour courses, an approach that might go in gets the slow-motion treatment as it tracks toward the hole:
    // one that drops, or one that comes within a couple of feet of it
    let slow: { from: number; to: number } | null = null;
    if (full && !r.penalty && this.hole.tour && !this.drill) {
      let near = r.frames[0];
      let gap = Infinity;
      for (const f of r.frames) {
        const d = Math.hypot(f.x - this.hole.cup.x, f.y - this.hole.cup.y);
        if (d < gap) {
          gap = d;
          near = f;
        }
      }
      const at = r.holed ? r.duration : near.t;
      if (r.holed || gap < 2.5) slow = { from: Math.max(0.1, at - 1.6), to: at + 0.3 };
    }
    this.shot = { r, t: 0, from: { ...this.pos }, club, next: 0, practice, clock: shot.clock, settle: settleTime(r), slow };
    this.trailPts = [];
    this.power = 0;
    const trail = this.trail.material as THREE.LineBasicMaterial;
    trail.color.set(this.bombSwing ? '#ffcf4a' : '#ffffff');
    trail.opacity = this.bombSwing ? 0.95 : 0.55;
    if (this.bombSwing) {
      this.bombSwing = false;
      this.bombShake = 0.6;
      sfx('bomb');
      const flash = this.overlay.querySelector('[data-flash]') as HTMLElement | null;
      flash?.classList.remove('go');
      void flash?.offsetWidth;
      flash?.classList.add('go');
      // the first moments off the face in slow motion, then let it fly
      if (!this.shot!.slow) this.shot!.slow = { from: 0, to: 0.9 };
      const land = r.sounds.find((x) => x.s === 'land' || x.s === 'splash');
      const at = land ? r.frames.find((f) => f.t >= land.t) : null;
      const carry = at ? Math.hypot(at.x - this.shot!.from.x, at.y - this.shot!.from.y) : 0;
      this.callout('Absolutely nuked 🚀', carry ? `${yd(carry)} carry` : 'Pure', 3000);
      (this.overlay.querySelector('[data-callout]') as HTMLElement).classList.add('bomb');
    } else sfx(club === 'putter' ? 'tick' : club === 'driver' ? 'crack' : 'thump');
    this.follow.set(Math.sin(this.aim), 0, -Math.cos(this.aim));
  }

  private stepShot(dt: number) {
    const s = this.shot!;
    const slow = !!s.slow && s.t >= s.slow.from && s.t < s.slow.to;
    this.focus(slow);
    s.t += dt * (slow ? 0.4 : 1);
    const f = s.r.frames;
    while (s.next < s.r.sounds.length && s.r.sounds[s.next].t <= s.t) {
      const k = s.r.sounds[s.next++].s;
      if (k === 'wall') sfx('clank');
      else if (k === 'post') sfx('board');
      else if (k === 'land') {
        sfx('bounce');
        this.puff(this.ball.position);
      } else if (k === 'sand') {
        sfx('thump');
        this.puff(this.ball.position, '#e9dcb2');
      } else if (k === 'splash') {
        const lava = wetIn(this.hole, { x: this.ball.position.x, y: -this.ball.position.z }, this.shot!.clock)?.look === 'lava';
        sfx(lava ? 'fire' : 'swish');
        this.splash(this.ball.position, lava);
      } else if (k === 'lip') {
        sfx('doink');
        this.callout('Lipped out', '', 1000);
      } else if (k === 'hop') {
        sfx('doink');
        this.callout('Too firm', 'It hopped the hole', 1100);
      } else if (k === 'vent') {
        sfx('whoosh');
        this.puff(this.ball.position, '#f1efe9');
      } else if (k === 'portal') {
        sfx('thump');
        this.callout('Down the tunnel', '', 1400);
      }
    }
    // down a tunnel: out of sight until it rolls out of the far end
    const tunnel = s.r.sounds.find((x) => x.s === 'portal');
    this.ball.visible = !tunnel || s.t < tunnel.t || s.t >= s.r.duration;
    let i = 0;
    while (i < f.length - 1 && f[i + 1].t < s.t) i++;
    const a = f[i];
    const b = f[Math.min(i + 1, f.length - 1)];
    const k = b.t > a.t ? Math.min(1, (s.t - a.t) / (b.t - a.t)) : 1;
    const x = a.x + (b.x - a.x) * k;
    const y = a.y + (b.y - a.y) * k;
    const z = a.z + (b.z - a.z) * k;
    const prev = this.ball.position.clone();
    this.ball.position.copy(w3(x, y, z + BALL_R));
    this.ballSink = 0;
    const mv = this.ball.position.clone().sub(prev);
    mv.y = 0;
    if (mv.lengthSq() > 1e-4) this.follow.lerp(mv.normalize(), Math.min(1, dt * 2.5)).normalize();
    const dist = Math.hypot(b.x - a.x, b.y - a.y) * (dt / Math.max(1e-3, b.t - a.t));
    this.ball.rotateOnWorldAxis(new THREE.Vector3(this.follow.z, 0, -this.follow.x).normalize(), -dist / BALL_R);
    this.trailPts.push(this.ball.position.clone());
    if (this.trailPts.length > TRAIL) this.trailPts.shift();
    this.drawTrail();
    if (s.t >= s.settle + 0.3) {
      this.focus(false);
      this.endShot();
    }
  }

  // Tiger vision: the edges of the screen fall into shadow
  private focus(on: boolean) {
    this.overlay.querySelector('[data-focus]')?.classList.toggle('on', on);
  }

  private endShot() {
    const s = this.shot!;
    this.shot = null;
    const r = s.r;
    if (s.practice) {
      // tell them how it went, then put the ball back on the tee
      const last = r.frames[r.frames.length - 1];
      const d = Math.round(Math.hypot(last.x - this.hole.cup.x, last.y - this.hole.cup.y));
      const lost = r.penalty ? this.lost(last, s.clock + r.duration) : '';
      if (this.drill?.targets) this.rangeReport(s.from, r, lost);
      else this.callout(r.holed ? 'In the hole!' : lost || `${away(d, surfaceAt(this.hole, last) === 'green')} from the pin`, 'Practice', 1600);
      this.pos = this.drill ? { ...this.drill.stations[this.drill.at].at } : { ...this.hole.tee };
      this.placeBall();
      this.trailPts = [];
      this.drawTrail();
      window.setTimeout(() => this.mode === 'roll' && this.toAim(), 1200);
      return;
    }
    if (this.spot === undefined) this.spot = r.holed ? { ...this.hole.cup } : r.penalty ? null : { ...r.end };
    if (r.holed) {
      sfx('pop');
      window.setTimeout(() => sfx('cheer'), 250);
      const feats = [...this.zones];
      if (this.strokes === 1) feats.push('ace');
      if (s.club === 'wedge' || s.club === 'chip') feats.push('chipin');
      return this.finish(feats);
    }
    if (r.penalty) {
      this.strokes++;
      this.setStrokes();
      const last = r.frames[r.frames.length - 1];
      const roof = this.hole.roofs?.some((rf) => inPoly(last, rf.poly));
      // tour courses: drop beside where it went in, as the real game does; classic courses play it again
      const drop = this.hole.tour && !roof ? dropPoint(this.hole, r.frames, s.from) : null;
      if (drop) this.pos = drop;
      this.callout(roof ? 'On the roof' : this.lost(last, s.clock + r.duration), drop ? 'Penalty stroke. Drop where it went in.' : 'Penalty stroke. Play it again.', 1800);
      sfx('sad');
      this.golfer.setPose('groan');
    } else this.pos = r.end;
    if (this.strokes >= this.hole.par + MAX_OVER) {
      this.callout('Picked up', `Par + ${MAX_OVER} is the limit`, 2200);
      this.strokes = this.hole.par + MAX_OVER;
      this.setStrokes();
      return this.finish([], 2200);
    }
    this.placeBall();
    this.trailPts = [];
    this.drawTrail();
    window.setTimeout(() => this.mode === 'roll' && this.toAim(), r.penalty ? 1000 : 250);
  }

  // where a lost ball went: the drink, the sea, the lava, or just out of bounds
  private lost(at: V2, clock: number) {
    const w = wetIn(this.hole, at, clock);
    return !w ? 'Out of bounds' : w.look === 'lava' ? 'Into the lava' : w.look === 'sea' ? 'In the sea' : 'In the drink';
  }

  private finish(feats: string[], delay = 0) {
    this.mode = 'done';
    const name = scoreName(this.strokes, this.hole.par);
    const d = this.strokes - this.hole.par;
    this.golfer.setPose(d <= 0 ? 'cheer' : 'groan');
    if (this.strokes < this.hole.par + MAX_OVER || delay === 0) this.callout(name, `${this.strokes} ${this.strokes === 1 ? 'stroke' : 'strokes'}`, 2400);
    const pin = this.world?.root.getObjectByName('pin');
    if (pin) pin.position.y += 1.2;
    this.orbit = 0;
    // a hole the admin jumped away from never reports
    const done = this.resolve;
    window.setTimeout(() => this.resolve === done && done?.({ strokes: this.strokes, feats: [...new Set(feats)], spot: this.spot ?? null }), 2800 + delay);
  }

  // On the range: how far it carried, how far it went, and which flag it finished by.
  private rangeReport(from: V2, r: Result, lost: string) {
    const last = r.frames[r.frames.length - 1];
    const land = r.sounds.find((x) => x.s === 'land' || x.s === 'sand' || x.s === 'splash');
    const at = land ? (r.frames.find((f) => f.t >= land.t) ?? last) : last;
    const carry = Math.round(Math.hypot(at.x - from.x, at.y - from.y));
    const total = Math.round(Math.hypot(last.x - from.x, last.y - from.y));
    if (lost) return this.callout(`${yd(carry)} carry`, lost, 2200);
    const near = this.drill!.targets!.map((t) => ({ t, d: Math.hypot(last.x - t.at.x, last.y - t.at.y) })).sort((a, b) => a.d - b.d)[0];
    this.callout(`${yd(carry)} carry`, `${yd(total)} total${near && near.d < 30 ? ` · ${yd(near.d)} from the ${near.t.label}` : ''}`, 2200);
  }

  // The short game: on to the next spot round the practice green.
  private nextStation() {
    const d = this.drill;
    if (!d || this.mode !== 'aim') return;
    d.at = (d.at + 1) % d.stations.length;
    this.pos = { ...d.stations[d.at].at };
    this.aim = Math.atan2(this.hole.cup.x - this.pos.x, this.hole.cup.y - this.pos.y);
    this.placeBall();
    const el = this.overlay.querySelector('[data-station-name]');
    if (el) el.textContent = d.stations[d.at].name;
    this.toAim();
    this.snapCamera();
    sfx('tick');
  }

  // any hole, any time: the one you're on starts over
  private holeMenu() {
    const m = this.menu!;
    const sheet = document.createElement('div');
    sheet.className = 'g3-holes';
    const row = (n: string, i: number) =>
      `<button data-i="${i}"${i + 1 === this.number ? ' class="on"' : ''}><b>${i + 1}</b>${n}${i + 1 === this.number ? '<em>Restart</em>' : ''}</button>`;
    sheet.innerHTML = `<div class="g3-holes-card admin"><small>Go to hole</small>${m.names.map(row).join('')}</div>`;
    sheet.onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-i]');
      sheet.remove();
      if (b) m.pick(Number(b.dataset.i));
    };
    this.overlay.appendChild(sheet);
  }

  private drawTrail() {
    const attr = this.trail.geometry.attributes.position as THREE.BufferAttribute;
    this.trailPts.forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z));
    attr.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, this.trailPts.length);
  }

  // ---------- today's players ----------

  setGhosts(g: Ghost[]) {
    this.ghosts = g;
  }

  private gallery: Spectator[] = [];
  setGallery(g: Spectator[]) {
    this.gallery = g;
  }

  // The stadium: members who have played the hole in the front rows with their score on a card overhead, and patrons
  // in the rest. A few dozen at most, so a phone can keep up.
  private seatCrowd() {
    const banks = this.hole.decor.filter((d) => d.kind === 'stands');
    if (!banks.length) return;
    const all = banks.flatMap((d, b) => stands.seats(d).map((s, j) => ({ ...s, d, row: Math.floor(j / stands.COLS), k: (j % stands.COLS) * banks.length + b })));
    // front rows first, alternating banks, so members sit where the cameras can see them
    all.sort((a, b) => a.row - b.row || a.k - b.k);
    const named = this.gallery.slice(0, 18);
    const filled = Math.min(all.length, 34);
    for (let i = 0; i < filled; i++) {
      const s = all[i];
      const who = named[i];
      const golfer = new Golfer(who ? specOf(who.avatar) : stands.patron(`${this.hole.id}:${i}`));
      golfer.holdClub(null);
      golfer.showBag(false);
      golfer.setPose(i % 4 === 0 ? 'cheer' : 'idle');
      golfer.group.position.copy(w3(s.x, s.y, heightAt(this.hole, s.x, s.y) + s.lift));
      const f = stands.facing(s.d);
      golfer.group.rotation.y = Math.PI / 2 - Math.atan2(f.y, f.x);
      const objs: THREE.Object3D[] = [golfer.group];
      if (who) {
        const tag = nameTag(who.name, who.label);
        tag.position.copy(golfer.group.position).add(new THREE.Vector3(0, 8.5 * golfer.spec.height, 0));
        objs.push(tag);
      }
      this.scene.add(...objs);
      this.onCourse.push({ golfer, objs, at: golfer.group.position.clone() });
    }
    this.crowd = stands.crowd(all.slice(filled).map((s) => ({ x: s.x, y: s.y, z: heightAt(this.hole, s.x, s.y) + s.lift })), this.hole.id);
    this.scene.add(...this.crowd);
  }

  private clearGhosts() {
    for (const m of this.crowd) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.crowd = [];
    for (const o of this.onCourse) {
      o.objs.forEach((x) => this.scene.remove(x));
      o.golfer.dispose();
    }
    this.onCourse = [];
  }

  // Each one stands beside their ball, facing the flag, with their name and score on this hole overhead.
  private placeGhosts() {
    this.clearGhosts();
    this.seatCrowd();
    const i = this.number - 1;
    for (const g of this.ghosts) {
      const s = g.spots[i];
      if (!s) continue;
      const toCup = Math.atan2(this.hole.cup.y - s.y, this.hole.cup.x - s.x);
      const ball = props.mesh(new THREE.SphereGeometry(BALL_R, 12, 10), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.4 }));
      ball.position.copy(w3(s.x, s.y, heightAt(this.hole, s.x, s.y) + BALL_R));
      const golfer = new Golfer(specOf(g.avatar));
      golfer.holdClub(g.holes[i] === 1 ? 'putter' : 'iron');
      golfer.setPose('idle');
      // a pace back and to the side, so they don't stand on the line
      const sx = s.x - Math.cos(toCup) * 2.5 + Math.sin(toCup) * 2.5;
      const sy = s.y - Math.sin(toCup) * 2.5 - Math.cos(toCup) * 2.5;
      golfer.group.position.copy(w3(sx, sy, heightAt(this.hole, sx, sy)));
      golfer.group.rotation.y = Math.PI / 2 - toCup;
      const n = g.holes[i];
      const tag = nameTag(g.name, n === 1 ? 'Hole in one' : `Made ${n} · ${scoreName(n, this.hole.par)}`);
      tag.position.copy(golfer.group.position).add(new THREE.Vector3(0, 8.5 * golfer.spec.height, 0));
      // stack the cards of players who finished close together, so both names read
      const k = this.onCourse.filter((o) => o.at.distanceTo(golfer.group.position) < 30).length;
      tag.center.set(0.5, -k * 1.1);
      this.scene.add(ball, golfer.group, tag);
      this.onCourse.push({ golfer, objs: [ball, golfer.group, tag], at: golfer.group.position.clone() });
    }
  }

  // Step aside when your own ball comes to rest beside theirs.
  private updateGhosts(dt: number) {
    for (const o of this.onCourse) {
      const near = o.at.distanceTo(this.ball.position) < 7 || o.at.distanceTo(this.golfer.group.position) < 5;
      o.objs.forEach((x) => (x.visible = !near));
      if (!near) o.golfer.update(dt);
    }
  }

  private placeBall() {
    const z = heightAt(this.hole, this.pos.x, this.pos.y);
    this.ball.position.copy(w3(this.pos.x, this.pos.y, z + BALL_R));
    this.ballSink = 0;
  }

  // On a tour green the ball is drawn smaller while you putt, so it doesn't look like a beach ball up close.
  // It still sits on the ground: the drop is kept separate from the position the shot sets each frame.
  private sizeBall() {
    const putting = !!this.hole?.tour && (this.shot ? this.shot.club === 'putter' : this.club === 'putter' && (this.mode === 'aim' || this.mode === 'swing'));
    const k = putting ? 0.6 : 1;
    this.ball.scale.setScalar(k);
    const sink = -BALL_R * (1 - k);
    this.ball.position.y += sink - this.ballSink;
    this.ballSink = sink;
  }

  // The golfer stands side-on to the line, ball in front, target to their left.
  private placeGolfer() {
    const a = this.aim;
    const front = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const reach = this.club === 'putter' ? 3 : this.club === 'driver' ? 3.1 : 2.7;
    // the putter's face sits just behind the ball, on the line
    const back = this.club === 'putter' ? 0.42 : 0;
    const along = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
    const at = w3(this.pos.x, this.pos.y, 0)
      .addScaledVector(front, -reach * this.golfer.spec.height)
      .addScaledVector(along, -back * this.golfer.spec.height);
    at.y = heightAt(this.hole, at.x, -at.z);
    this.golfer.group.position.copy(at);
    this.golfer.group.rotation.y = Math.PI / 2 - a;
  }

  // ---------- effects ----------

  private puff(at: THREE.Vector3, color = '#e9f1df') {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.7, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).add(new THREE.Vector3(0, -0.4, 0));
    this.scene.add(m);
    this.puffs.push({ m, t: 0 });
  }

  private splash(at: THREE.Vector3, lava = false) {
    for (let i = 0; i < 4; i++) window.setTimeout(() => this.puff(at.clone().add(new THREE.Vector3(0, -0.2, 0)), lava ? (i % 2 ? '#ff8a3d' : '#59524d') : '#dff0f4'), i * 150);
  }

  // Anything standing between the camera and the golfer or ball turns see-through.
  private fadeOccluders(dt: number) {
    const occ = this.world?.occluders ?? [];
    const cam = this.camera.position;
    const targets = [this.ball.position, this.golfer.group.position.clone().add(new THREE.Vector3(0, 4, 0))];
    const want = new Set<THREE.Object3D>();
    if (this.mode !== 'fly')
      for (const o of occ) {
        for (const t of targets) {
          // closest approach of the camera->target segment to the occluder, in plan view
          const ax = cam.x;
          const az = cam.z;
          const bx = t.x - ax;
          const bz = t.z - az;
          const len2 = bx * bx + bz * bz || 1;
          const k = Math.max(0, Math.min(1, ((o.x - ax) * bx + (o.z - az) * bz) / len2));
          if (k > 0.98) continue;
          const d = Math.hypot(ax + bx * k - o.x, az + bz * k - o.z);
          if (d < o.r) {
            want.add(o.obj);
            break;
          }
        }
      }
    for (const o of occ) {
      const cur = this.faded.get(o.obj) ?? 1;
      const goal = want.has(o.obj) ? 0.22 : 1;
      if (cur === goal) continue;
      const next = cur + (goal - cur) * Math.min(1, dt * 8);
      const v = Math.abs(next - goal) < 0.02 ? goal : next;
      this.faded.set(o.obj, v);
      o.obj.traverse((m) => {
        const mm = (m as THREE.Mesh).material as THREE.Material | undefined;
        if (!mm) return;
        mm.transparent = v < 1;
        mm.opacity = v;
        mm.depthWrite = v >= 1;
      });
    }
  }

  // ---------- aim guide ----------

  // Reading the green, the way Golden Tee does it: along the line from the ball to the cup, how many degrees it climbs
  // or falls, and how many it breaks left or right. The last third counts double: that's where the putt is slowest and
  // the break bites.
  private readGreen() {
    const from = this.pos;
    const cup = this.hole.cup;
    const len = Math.hypot(cup.x - from.x, cup.y - from.y);
    if (len < 1) return this.clearRead();
    const d = { x: (cup.x - from.x) / len, y: (cup.y - from.y) / len };
    let along = 0;
    let across = 0;
    let w = 0;
    const n = Math.max(2, Math.ceil(len));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const g = gradAt(this.hole, from.x + (cup.x - from.x) * t, from.y + (cup.y - from.y) * t);
      const k = t > 2 / 3 ? 2 : 1;
      along += (g.x * d.x + g.y * d.y) * k;
      // positive: the ground is higher on the right of the line, so the putt falls away to the left
      across += (g.x * d.y - g.y * d.x) * k;
      w += k;
    }
    const deg = (v: number) => (Math.atan(v / w) * 180) / Math.PI;
    this.read = { slope: deg(along), brk: deg(across) };
    const el = this.overlay.querySelector('[data-read]') as HTMLElement | null;
    if (!el) return;
    const half = (v: number) => Math.round(Math.abs(v) * 2) / 2;
    const s = half(this.read.slope);
    const b = half(this.read.brk);
    const slope = s < 0.5 ? '<b>Flat</b>' : `<i>${this.read.slope > 0 ? '↑' : '↓'}</i><b>${this.read.slope > 0 ? 'Up' : 'Down'} ${s}°</b>`;
    const brk = b < 0.5 ? '<b>Straight</b>' : `<i>${this.read.brk > 0 ? '←' : '→'}</i><b>Breaks ${b}° ${this.read.brk > 0 ? 'left' : 'right'}</b>`;
    el.innerHTML = `<small>The read</small><span>${slope}</span><span>${brk}</span>`;
  }

  private clearRead() {
    this.read = null;
    const el = this.overlay?.querySelector('[data-read]') as HTMLElement | null;
    if (el) el.hidden = true;
  }

  private guide() {
    const m = new THREE.Matrix4();
    let n = 0;
    const show = this.mode === 'aim' || this.mode === 'meter';
    const read = this.overlay.querySelector('[data-read]') as HTMLElement | null;
    if (read) read.hidden = !(this.read && this.mode === 'aim' && this.club === 'putter');
    this.ring.visible = false;
    if (show) {
      const dx = Math.sin(this.aim);
      const dy = Math.cos(this.aim);
      if (this.club === 'putter') {
        // a dotted line that hugs the ground; longer as you pull back. On tour greens it starts from nothing and runs
        // out as far as the putt would roll on a flat green: the break you read for yourself
        // On tour greens there's no line at all: you judge the pace yourself and play the read.
        const v = carryOf('putter', this.power);
        const len = this.hole.tour ? 0 : 8 + this.power * 30;
        for (let d = 1.5; d < len && n < 80; d += 1.1) {
          const x = this.pos.x + dx * d;
          const y = this.pos.y + dy * d;
          m.setPosition(w3(x, y, heightAt(this.hole, x, y) + 0.2));
          this.dots.setMatrixAt(n++, m);
        }
        const end = this.hole.tour ? Math.max(6, (v * v) / (2 * TOUR_GREEN)) : len;
        this.landing.copy(w3(this.pos.x + dx * end, this.pos.y + dy * end, heightAt(this.hole, this.pos.x + dx * end, this.pos.y + dy * end)));
      } else {
        // the flight arc and a landing ring sized to the club's spread
        // the ring shows where the plan carries: on tour courses that's the real plan, however short
        const power = this.hole.tour ? this.power : Math.max(this.power, 0.6);
        const v = launch({ angle: this.aim, power, club: this.club, error: 0, clock: 0, boost: this.boost() * lieFactor(this.hole, this.pos, this.club), spin: this.spin, shape: this.shape });
        const z0 = heightAt(this.hole, this.pos.x, this.pos.y);
        let landed: V2 | null = null;
        const T = (2 * v.vz) / G + 1;
        for (let i = 1; i < 200 && n < 80; i++) {
          const t = (i / 200) * T;
          const x = this.pos.x + v.vx * t + 0.5 * v.ax * t * t;
          const y = this.pos.y + v.vy * t + 0.5 * v.ay * t * t;
          const z = z0 + v.vz * t - 0.5 * G * t * t;
          if (z < heightAt(this.hole, x, y)) {
            landed = { x, y };
            break;
          }
          if (i % 4 === 0) {
            m.setPosition(w3(x, y, z + BALL_R));
            this.dots.setMatrixAt(n++, m);
          }
        }
        const carry = carryOf(this.club, power, this.boost());
        const p = landed ?? { x: this.pos.x + dx * carry, y: this.pos.y + dy * carry };
        const spread = 2 + CLUBS[this.club].curve * 0.35 * (1 - Math.min(1, CLUBS[this.club].sweet * 4));
        this.landing.copy(w3(p.x, p.y, heightAt(this.hole, p.x, p.y)));
        this.ring.position.copy(this.landing).add(new THREE.Vector3(0, 0.15, 0));
        this.ring.scale.setScalar(spread);
        this.ring.rotation.y = -this.aim;
        this.ring.visible = true;
        const beam = this.ring.getObjectByName('beam')!;
        beam.scale.set(1 / spread, 16 / spread, 1 / spread);
        beam.position.y = 8 / spread;
      }
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
    const bar = this.overlay.querySelector('[data-power]') as HTMLElement | null;
    if (bar) {
      bar.style.height = `${Math.round(this.power * 100)}%`;
      bar.parentElement!.classList.toggle('show', this.mode === 'aim' && this.drag?.kind === 'power');
      // a full-power driver warns you the needle will be wild
      bar.parentElement!.classList.toggle('hot', this.club === 'driver' && this.power > 0.85);
    }
    const arrow = this.overlay.querySelector('[data-wind-arrow]') as HTMLElement | null;
    if (arrow && this.wind) arrow.style.transform = `rotate(${((this.wind.toward - this.aim) * 180) / Math.PI}deg)`;
    const strike = this.overlay.querySelector('[data-strike]') as HTMLElement | null;
    if (strike) strike.hidden = this.mode !== 'aim' || this.club === 'putter';
  }

  // ---------- camera ----------

  private snapCamera() {
    this.cameraTarget();
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private cameraTarget() {
    const ball = this.ball.position;
    if (this.view === 'target' && (this.mode === 'aim' || this.mode === 'meter')) {
      // high over the landing spot, looking down the line at it
      const back = new THREE.Vector3(Math.sin(this.aim), 0, -Math.cos(this.aim));
      const far = this.landing.distanceTo(ball);
      const height = Math.max(26, Math.min(70, far * 0.35)) * (this.camera.aspect < 1 ? 1.3 : 1);
      this.camPos.copy(this.landing).addScaledVector(back, -height * 0.75).add(new THREE.Vector3(0, height, 0));
      this.camLook.copy(this.landing);
      return;
    }
    if (this.mode === 'done') {
      this.orbit += 0.004;
      const c = w3(this.hole.cup.x, this.hole.cup.y, heightAt(this.hole, this.hole.cup.x, this.hole.cup.y));
      this.camPos.set(c.x + Math.cos(this.orbit) * 16, c.y + 8, c.z + Math.sin(this.orbit) * 16);
      this.camLook.copy(c).add(new THREE.Vector3(0, 1.5, 0));
      return;
    }
    if (this.mode === 'cart' && this.cart) {
      const close = this.cart.closeUp(this.camera.aspect);
      if (close) {
        this.camPos.copy(close.pos);
        this.camLook.copy(close.look);
        return;
      }
      const c = this.cart.focus();
      const dir = new THREE.Vector3(Math.sin(this.aim), 0, -Math.cos(this.aim));
      this.camPos.copy(c).addScaledVector(dir, -14).add(new THREE.Vector3(6, 7, 0));
      this.camLook.copy(c).add(new THREE.Vector3(0, 3, 0));
      return;
    }
    const flying = this.mode === 'roll' && this.shot && this.shot.club !== 'putter';
    const dir = this.mode === 'roll' ? this.follow.clone() : new THREE.Vector3(Math.sin(this.aim), 0, -Math.cos(this.aim));
    const long = this.club === 'driver' || this.club === 'wood' || this.club === 'iron';
    const back = this.mode === 'roll' ? (flying ? 34 : 20) : long ? 20 : this.club === 'wedge' ? 17 : 14;
    const up = this.mode === 'roll' ? (flying ? 20 : 12) : long ? 12 : 9.5;
    this.camPos.copy(ball).addScaledVector(dir, -back).add(new THREE.Vector3(0, up + this.power * 2, 0));
    const ground = heightAt(this.hole, this.camPos.x, -this.camPos.z);
    this.camPos.y = Math.max(this.camPos.y, ground + 3.5);
    this.camLook.copy(ball).addScaledVector(dir, long && this.mode !== 'roll' ? 40 : 16).add(new THREE.Vector3(0, -2, 0));
    // on a tour course with the green far below (the summit tee), look down at the pin rather than out at the far wall
    if (this.hole.tour && this.mode !== 'roll') {
      const cupZ = heightAt(this.hole, this.hole.cup.x, this.hole.cup.y);
      if (ball.y - cupZ > 30) {
        // up over the golfer's shoulder, high enough to see over the lip
        this.camPos.copy(ball).addScaledVector(dir, -12).add(new THREE.Vector3(0, 24, 0));
        this.camLook.copy(w3(this.hole.cup.x, this.hole.cup.y, cupZ)).lerp(ball, 0.2);
      }
    }
  }

  // ---------- frame loop ----------

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const raw = (now - this.last) / 1000;
    const dt = Math.min(0.05, raw);
    this.last = now;
    if (!this.hole) return;
    // drop the pixel ratio if the device is struggling
    this.slow = raw > 0.034 ? this.slow + raw : Math.max(0, this.slow - raw);
    // in half steps, so a struggling phone gets a little softer, not suddenly blurry
    if (this.slow > 3 && this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(Math.max(1, this.renderer.getPixelRatio() - 0.5));
      this.resize();
      this.slow = 0;
    }
    this.clock += dt;
    this.world?.update(this.clock, dt);
    this.cart?.update(dt);

    if (this.mode === 'meter') {
      const m = this.meter;
      if (m.phase === 'power') {
        // fills faster toward the top; at the end of the overswing it stops on its own. With a lager or a fireball in
        // you the overswing is the fire, and the bar slows right down in it so you can stop it there
        const fire = !!this.drink && DRINKS[this.drink.kind].boost > 1 && m.p > 1;
        m.p = Math.min(OVERSWING, m.p + powerSpeed(this.club, m.p) * m.speed * (fire ? 0.45 : 1) * dt);
        m.x = barX(m.p);
        if (m.p >= OVERSWING) this.tapSwing();
      } else {
        m.x -= m.speed * dt;
        // gone right past the impact point: a full hook
        if (m.x < IMPACT - m.half - 0.15) {
          m.x = IMPACT - m.half - 0.15;
          this.tapSwing();
        }
      }
      const needle = this.overlay.querySelector('[data-needle]') as HTMLElement | null;
      if (needle) this.mark(needle, Math.max(0, m.x));
      const fill = this.overlay.querySelector('[data-fill]') as HTMLElement | null;
      if (fill) this.span(fill, barX(0), barX(m.p) - barX(0));
      // the club rides the vertical meter: back as the power fills, down as the needle drops
      if (this.style() === 'vertical' && this.mode === 'meter') {
        const p = Math.min(1, m.p);
        if (m.phase === 'power') this.golfer.takeBack(this.club, p, Math.min(1, m.p * 1.6));
        else this.golfer.takeBack(this.club, p, (m.x - IMPACT) / Math.max(0.01, barX(m.p) - IMPACT));
      }
    }

    if (this.mode === 'fly' && this.fly) {
      this.fly.t += dt / 6;
      const k = Math.min(1, this.fly.t);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const p = this.fly.curve.getPoint(e);
      const ahead = this.fly.curve.getPoint(Math.min(1, e + 0.12));
      this.camera.position.copy(p);
      this.camera.lookAt(ahead.x, ahead.y - 34, ahead.z);
      if (k >= 1) this.endFlyover();
    } else {
      if (this.mode === 'roll' && this.shot) this.stepShot(dt);
      this.cameraTarget();
      const k = 1 - Math.exp(-dt * (this.mode === 'roll' ? 3 : 6));
      this.camera.position.lerp(this.camPos, k);
      const look = new THREE.Vector3();
      this.camera.getWorldDirection(look);
      const want = this.camLook.clone().sub(this.camera.position).normalize();
      look.lerp(want, Math.min(1, k * 1.4));
      this.camera.lookAt(this.camera.position.clone().add(look));
      // the bomb's shockwave: a short, sharp shake that dies away
      if (this.bombShake > 0) {
        const a = this.bombShake * this.bombShake * 0.5;
        this.camera.position.x += (Math.random() - 0.5) * a;
        this.camera.position.y += (Math.random() - 0.5) * a;
        this.bombShake = Math.max(0, this.bombShake - dt);
      }
    }

    if (this.mode === 'aim' || this.mode === 'meter' || this.mode === 'cart' || this.mode === 'fly') this.placeGolfer();
    // you're the one talking to Daisy, so you step out of her close-up
    this.golfer.group.visible = !(this.mode === 'cart' && this.cart?.closeUp(this.camera.aspect));
    this.golfer.update(this.bombSwing ? dt * 0.3 : dt);
    if (this.bombSwing) this.focus(true);
    this.updateGhosts(dt);

    this.sizeBall();
    this.guide();
    this.fadeOccluders(dt);
    this.effects(dt);
    this.mini();
    this.renderer.render(this.scene, this.camera);
  };

  private effects(dt: number) {
    for (const c of this.clouds) {
      c.position.x += dt * 4;
      if (c.position.x > 900) c.position.x = -900;
    }
    const cx = (this.hole.bounds.x0 + this.hole.bounds.x1) / 2;
    const cy = (this.hole.bounds.y0 + this.hole.bounds.y1) / 2;
    this.birds.forEach((b, i) => {
      const a = this.clock * (0.1 + i * 0.012) + i * 1.3;
      const r = 110 + i * 24;
      b.position.set(cx + Math.cos(a) * r, 70 + i * 7 + Math.sin(this.clock + i) * 3, -(cy + Math.sin(a) * r));
      b.rotation.y = -a;
      const flap = Math.sin(this.clock * 9 + i) * 0.6;
      (b.getObjectByName('l') as THREE.Object3D).rotation.z = flap;
      (b.getObjectByName('r') as THREE.Object3D).rotation.z = -flap;
    });
    if (this.petals) {
      const a = this.petals.geometry.attributes.position as THREE.BufferAttribute;
      const arr = a.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += dt * (1.2 + Math.sin(this.clock + i) * 0.8);
        arr[i + 1] -= dt * 0.9;
        if (arr[i + 1] < heightAt(this.hole, arr[i], -arr[i + 2])) {
          arr[i + 1] = 16 + (i % 9);
          arr[i] -= 30;
        }
      }
      a.needsUpdate = true;
    }
    for (const p of this.puffs) {
      p.t += dt;
      p.m.scale.setScalar(1 + p.t * 6);
      (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - p.t * 1.6);
    }
    this.puffs = this.puffs.filter((p) => {
      if (p.t < 0.6) return true;
      this.scene.remove(p.m);
      p.m.geometry.dispose();
      return false;
    });
  }
}
