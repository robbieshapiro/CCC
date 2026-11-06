// The Pro Shop's fitting room: your golfer on a plinth under warm lights, Reginald behind the counter, rails of
// clothes along the wall. Drag to turn round. The camera moves to what you're trying on: the full look, the face,
// the hands and wrist, or round the back for a bag check.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Golfer, REGINALD_SPEC, type GolferSpec } from '../golf3d/golfer';

export type Focus = 'full' | 'head' | 'chest' | 'hands' | 'club' | 'bag';

// where the camera sits and what it looks at, for each view (world units; the golfer stands at the origin facing +z)
const VIEWS: Record<Focus, { at: THREE.Vector3; look: THREE.Vector3; spin: boolean }> = {
  full: { at: new THREE.Vector3(-2.9, 4.4, 17.5), look: new THREE.Vector3(-2.7, 3.1, 0), spin: true },
  head: { at: new THREE.Vector3(0.4, 6.2, 6.2), look: new THREE.Vector3(0, 5.95, 0), spin: false },
  chest: { at: new THREE.Vector3(0.5, 5.1, 8), look: new THREE.Vector3(0, 4.6, 0), spin: false },
  hands: { at: new THREE.Vector3(1.6, 3.9, 6.2), look: new THREE.Vector3(0.1, 3.0, 0.6), spin: false },
  // low and to the side, to see the club head at the ball
  club: { at: new THREE.Vector3(2.2, 2.4, 8.6), look: new THREE.Vector3(-0.1, 0.6, 2.7), spin: false },
  bag: { at: new THREE.Vector3(4.8, 4.6, -10), look: new THREE.Vector3(0.7, 2.2, -2.4), spin: false },
};

function woodTex() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    const tone = 92 + ((i * 37) % 26);
    x.fillStyle = `rgb(${tone + 40}, ${tone}, ${tone - 34})`;
    x.fillRect(0, i * 32, 256, 32);
    for (let k = 0; k < 18; k++) {
      x.strokeStyle = `rgba(40, 24, 10, ${0.06 + ((k * 13) % 7) / 100})`;
      x.beginPath();
      const y = i * 32 + ((k * 7) % 30);
      x.moveTo(0, y);
      x.bezierCurveTo(80, y + 3, 170, y - 3, 256, y + 1);
      x.stroke();
    }
    x.fillStyle = 'rgba(20, 10, 4, 0.5)';
    x.fillRect(0, i * 32, 256, 1.5);
    x.fillRect(((i * 97) % 200) + 20, i * 32, 1.5, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.anisotropy = 4;
  return t;
}

// club-green panelling below a dado rail, cream above, with a few framed prints
function wallTex() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#efe6d2';
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#1d4634';
  x.fillRect(0, 150, 512, 106);
  x.fillStyle = '#b8955a';
  x.fillRect(0, 146, 512, 6);
  for (let i = 0; i < 8; i++) {
    x.strokeStyle = 'rgba(0,0,0,0.25)';
    x.lineWidth = 2;
    x.strokeRect(i * 64 + 8, 166, 48, 78);
  }
  for (const [px, w] of [[60, 70], [210, 90], [380, 64]] as const) {
    x.fillStyle = '#6b4a2a';
    x.fillRect(px - 4, 34, w + 8, 72);
    x.fillStyle = ['#9fb7a2', '#cdb98f', '#8fa9c2'][px % 3];
    x.fillRect(px, 38, w, 64);
    x.fillStyle = 'rgba(22,59,44,0.55)';
    x.beginPath();
    x.moveTo(px, 102);
    x.quadraticCurveTo(px + w / 2, 60, px + w, 92);
    x.lineTo(px + w, 102);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

export class FittingRoom {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  private golfer: Golfer | null = null;
  private reginald: Golfer;
  private turn = new THREE.Group();
  private raf = 0;
  private last = performance.now();
  private drag: number | null = null;
  private view: Focus = 'full';
  private camAt = VIEWS.full.at.clone();
  private camLook = VIEWS.full.look.clone();
  private turnTo: number | null = null;

  constructor(private host: HTMLElement, spec: GolferSpec) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#2a2118');
    this.scene.fog = new THREE.Fog('#2a2118', 30, 60);
    // soft reflections from a lit room, so the gold, the brass and the chrome read as metal
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.9;
    pm.dispose();
    this.build();
    this.reginald = new Golfer(REGINALD_SPEC);
    this.reginald.holdClub(null);
    this.reginald.showBag(false);
    this.reginald.setPose('clasp');
    this.reginald.group.position.set(-6.2, 0, -4.6);
    this.reginald.group.rotation.y = 0.55;
    this.scene.add(this.reginald.group);
    this.scene.add(this.turn);
    this.set(spec);
    const el = this.renderer.domElement;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', (e) => {
      this.drag = e.clientX;
      this.turnTo = null;
    });
    el.addEventListener('pointermove', (e) => {
      if (this.drag === null) return;
      this.turn.rotation.y += (e.clientX - this.drag) * 0.012;
      this.drag = e.clientX;
    });
    const stop = () => (this.drag = null);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.loop();
  }

  private build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#ffe9c8', '#3a2a1a', 1.1));
    // the key light over the plinth, warm and soft
    const key = new THREE.SpotLight('#ffe2b8', 260, 40, 0.5, 0.6, 1.6);
    key.position.set(3, 16, 9);
    key.target.position.set(0, 2.5, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    s.add(key, key.target);
    // a cool rim from behind, so the outline reads against the wall
    const rim = new THREE.DirectionalLight('#bcd4ff', 0.9);
    rim.position.set(-6, 9, -8);
    s.add(rim);
    // a lamp over the counter
    const lamp = new THREE.PointLight('#ffcf8a', 30, 14, 1.8);
    lamp.position.set(-6, 8, -3);
    s.add(lamp);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), wallMat);
    back.position.set(0, 7, -9);
    back.receiveShadow = true;
    s.add(back);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), wallMat);
    side.position.set(12, 7, 4);
    side.rotation.y = -Math.PI / 2;
    s.add(side);

    // the plinth: club green with a brass ring
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.7, 0.34, 56), new THREE.MeshStandardMaterial({ color: '#163b2c', roughness: 0.45 }));
    plinth.position.y = 0.17;
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    this.turn.add(plinth);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.05, 8, 72), new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.25 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.34;
    this.turn.add(ring);

    // the counter: dark wood, a brass edge and a glass top with a few things under it
    const wood = new THREE.MeshStandardMaterial({ color: '#4a2f1c', roughness: 0.5 });
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8, roughness: 0.3 });
    const counter = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.9, 1.8), wood);
    body.position.y = 1.45;
    body.castShadow = body.receiveShadow = true;
    counter.add(body);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 2), brass);
    edge.position.y = 2.96;
    counter.add(edge);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 1.8), new THREE.MeshStandardMaterial({ color: '#dfeee8', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 }));
    glass.position.y = 3.05;
    counter.add(glass);
    // a ball sleeve and a little brass bell on the counter
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshStandardMaterial({ color: '#f6f3ea', roughness: 0.35 }));
      ball.position.set(1.2 + i * 0.3, 3.2, 0.2);
      counter.add(ball);
    }
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass);
    bell.position.set(-1.6, 3.08, 0.3);
    counter.add(bell);
    counter.position.set(-6.2, 0, -2.6);
    counter.rotation.y = 0.55;
    s.add(counter);

    // rails of clothes along the side wall, and a shelf of caps
    const shirtColours = ['#163b2c', '#f4f1e8', '#7a1f2b', '#1f2d4a', '#b8955a', '#8fb3d9', '#e9b9c2', '#2b2b2b'];
    for (let r = 0; r < 2; r++) {
      const rail = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.4, 10), brass);
      bar.rotation.x = Math.PI / 2;
      bar.position.y = 6.2;
      rail.add(bar);
      for (const z of [-3.1, 3.1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.2, 8), brass);
        post.position.set(0, 3.1, z);
        rail.add(post);
      }
      for (let i = 0; i < 8; i++) {
        const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 1.5), new THREE.MeshStandardMaterial({ color: shirtColours[(i + r * 3) % shirtColours.length], roughness: 0.85 }));
        shirt.position.set(0, 4.85, -2.6 + i * 0.74);
        shirt.rotation.x = 0.05 * ((i % 3) - 1);
        shirt.castShadow = true;
        rail.add(shirt);
      }
      rail.position.set(10.4 - r * 1.6, 0, -1 + r * 7.5);
      s.add(rail);
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 1.2), wood);
    shelf.position.set(3.5, 5.6, -8.4);
    s.add(shelf);
    for (let i = 0; i < 6; i++) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: shirtColours[(i + 2) % shirtColours.length], roughness: 0.8 }));
      cap.position.set(0.9 + i * 1.05, 5.68, -8.3);
      s.add(cap);
    }
  }

  set(spec: GolferSpec, club: 'driver' | 'putter' = 'driver') {
    if (this.golfer) {
      this.turn.remove(this.golfer.group);
      this.golfer.dispose();
    }
    this.golfer = new Golfer(spec);
    this.golfer.holdClub(club);
    // with a putter, stand over the ball at address so the head sits on the floor where it can be seen
    this.golfer.setPose(club === 'putter' ? 'address' : 'idle');
    // a putter's head sits on the floor: lift a touch so it isn't half sunk into the plinth
    this.golfer.group.position.set(0, 0.34, 0);
    if (club === 'putter') this.golfer.shiftClub(0.15);
    // a caddie stands beside the plinth
    this.golfer.group.position.x = spec.caddie ? -1.2 * spec.height : 0;
    this.golfer.group.traverse((o) => (o.castShadow = true));
    this.turn.add(this.golfer.group);
  }

  // move the camera to what's being tried on; the golfer turns to face it
  focus(v: Focus) {
    this.view = v;
    this.turnTo = VIEWS[v].spin ? null : 0;
  }

  // Reginald approves of a purchase
  nod() {
    this.reginald.setPose('wave');
    window.setTimeout(() => this.reginald.setPose('clasp'), 1500);
  }

  private resize = () => {
    const w = this.host.clientWidth || 360;
    const h = this.host.clientHeight || 420;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // on a narrow phone, step back a little so the whole look fits
    this.camera.fov = w / h < 0.8 ? 36 : 30;
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const v = VIEWS[this.view];
    const k = 1 - Math.exp(-dt * 3.2);
    this.camAt.lerp(v.at, k);
    this.camLook.lerp(v.look, k);
    this.camera.position.copy(this.camAt);
    this.camera.lookAt(this.camLook);
    if (this.drag === null) {
      if (this.turnTo !== null) {
        // the shortest way round to face the camera
        const d = Math.atan2(Math.sin(this.turnTo - this.turn.rotation.y), Math.cos(this.turnTo - this.turn.rotation.y));
        this.turn.rotation.y += d * k;
      } else if (v.spin) this.turn.rotation.y += dt * 0.3;
    }
    this.golfer?.update(dt);
    this.reginald.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.golfer?.dispose();
    this.reginald.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
