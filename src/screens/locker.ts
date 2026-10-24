// The golfer builder: option tabs plus a 3D turntable. Used by the welcome locker room and the Member Card.
import * as THREE from 'three';
import { CLOTH, DEFAULT_SPEC, Golfer, HAIR_COLOURS, LOCKED_BOTTOMS, LOCKED_TOPS, PRESTIGE, SKIN_TONES, type GolferSpec } from '../golf3d/golfer';
import { esc } from '../ui';

type Opt<T> = { v: T; label: string; lock?: number };
type Field = { key: keyof GolferSpec; label: string; kind: 'swatch' | 'chips' | 'range' | 'toggle'; options?: Opt<string>[]; colors?: string[] };

const tabs: { id: string; label: string; fields: Field[] }[] = [
  {
    id: 'body',
    label: 'Body',
    fields: [
      { key: 'skin', label: 'Skin', kind: 'swatch', colors: SKIN_TONES },
      { key: 'build', label: 'Build', kind: 'chips', options: [{ v: 'slim', label: 'Slim' }, { v: 'regular', label: 'Regular' }, { v: 'broad', label: 'Broad' }] },
      { key: 'height', label: 'Height', kind: 'range' },
    ],
  },
  {
    id: 'hair',
    label: 'Hair',
    fields: [
      { key: 'hair', label: 'Style', kind: 'chips', options: ['short', 'side', 'curly', 'long', 'bun', 'bald'].map((v) => ({ v, label: v === 'side' ? 'Side part' : v[0].toUpperCase() + v.slice(1) })) },
      { key: 'hairColor', label: 'Colour', kind: 'swatch', colors: HAIR_COLOURS },
      { key: 'face', label: 'Facial hair', kind: 'chips', options: [{ v: 'none', label: 'None' }, { v: 'stubble', label: 'Stubble' }, { v: 'moustache', label: 'Moustache' }, { v: 'beard', label: 'Beard' }] },
    ],
  },
  {
    id: 'top',
    label: 'Top',
    fields: [
      {
        key: 'top',
        label: 'Style',
        kind: 'chips',
        options: [
          { v: 'polo', label: 'Polo' },
          { v: 'quarterzip', label: 'Quarter-zip' },
          { v: 'vest', label: 'Sweater vest' },
          { v: 'cardigan', label: 'Cardigan' },
          { v: 'cashmere', label: 'Cashmere', lock: LOCKED_TOPS.cashmere },
          { v: 'blazer', label: 'Club blazer', lock: LOCKED_TOPS.blazer },
          { v: 'goldblazer', label: 'Gold-trim blazer', lock: LOCKED_TOPS.goldblazer },
        ],
      },
      { key: 'topColor', label: 'Colour', kind: 'swatch', colors: CLOTH },
      { key: 'accent', label: 'Collar / vest', kind: 'swatch', colors: CLOTH },
    ],
  },
  {
    id: 'bottoms',
    label: 'Bottoms',
    fields: [
      {
        key: 'bottoms',
        label: 'Style',
        kind: 'chips',
        options: [
          { v: 'trousers', label: 'Trousers' },
          { v: 'shorts', label: 'Shorts' },
          { v: 'plusfours', label: 'Plus-fours' },
          { v: 'skirt', label: 'Skort' },
          { v: 'tartan', label: 'Tartan plus-fours', lock: LOCKED_BOTTOMS.tartan },
        ],
      },
      { key: 'bottomsColor', label: 'Colour', kind: 'swatch', colors: CLOTH },
      { key: 'shoes', label: 'Shoes', kind: 'chips', options: [{ v: 'white', label: 'White' }, { v: 'saddle', label: 'Saddle' }, { v: 'black', label: 'Black' }] },
    ],
  },
  {
    id: 'hat',
    label: 'Hat',
    fields: [
      { key: 'hat', label: 'Hat', kind: 'chips', options: [{ v: 'none', label: 'None' }, { v: 'cap', label: 'Cap' }, { v: 'visor', label: 'Visor' }, { v: 'flatcap', label: 'Flat cap' }, { v: 'bucket', label: 'Bucket' }] },
      { key: 'hatColor', label: 'Colour', kind: 'swatch', colors: CLOTH },
    ],
  },
  {
    id: 'gear',
    label: 'Gear',
    fields: [
      { key: 'bag', label: 'Bag', kind: 'swatch', colors: CLOTH },
      { key: 'glove', label: 'Glove', kind: 'toggle' },
      { key: 'hand', label: 'Plays', kind: 'chips', options: [{ v: 'right', label: 'Righty · meter on the left' }, { v: 'left', label: 'Lefty · meter on the right' }] },
    ],
  },
];

// Builds the option panel. Calls onChange with a fresh spec on every tap.
export function lockerPanel(start: GolferSpec, wins: number, onChange: (s: GolferSpec) => void): HTMLElement {
  const spec: GolferSpec = { ...DEFAULT_SPEC, ...start };
  const el = document.createElement('div');
  el.className = 'locker-panel';
  let tab = 'body';
  const draw = () => {
    const t = tabs.find((x) => x.id === tab)!;
    const prestige =
      tab === 'gear'
        ? `<div class="pick"><span>Pro shop</span><div class="chips-row">${PRESTIGE.filter((p) => ['goldputter', 'crestbag'].includes(p.key))
            .map((p) => `<button class="chip-btn ${p.has(spec) ? 'on' : ''}" data-prestige="${p.key}" ${wins >= p.wins ? '' : 'disabled'}>${wins >= p.wins ? '' : '🔒 '}${p.name}${wins >= p.wins ? '' : ` · ${p.wins} ${p.wins === 1 ? 'title' : 'titles'}`}</button>`)
            .join('')}</div></div>`
        : '';
    el.innerHTML = `
      <div class="locker-tabs" role="tablist">${tabs.map((x) => `<button role="tab" class="${x.id === tab ? 'on' : ''}" data-tab="${x.id}">${x.label}</button>`).join('')}</div>
      <div class="locker-fields">
        ${t.fields
          .map((f) => {
            const val = spec[f.key];
            let body = '';
            if (f.kind === 'swatch') body = `<div class="swatches">${f.colors!.map((c) => `<button class="swatch ${c === val ? 'on' : ''}" data-key="${f.key}" data-val="${c}" style="background:${c}" aria-label="${f.label} ${c}"></button>`).join('')}</div>`;
            else if (f.kind === 'chips')
              body = `<div class="chips-row">${f
                .options!.map((o) => {
                  const locked = (o.lock ?? 0) > wins;
                  return `<button class="chip-btn ${o.v === val ? 'on' : ''}" data-key="${f.key}" data-val="${o.v}" ${locked ? 'disabled' : ''}>${locked ? '🔒 ' : ''}${esc(o.label)}${locked ? ` · ${o.lock} ${o.lock === 1 ? 'title' : 'titles'}` : ''}</button>`;
                })
                .join('')}</div>`;
            else if (f.kind === 'range') body = `<input type="range" min="0.92" max="1.08" step="0.02" value="${val}" data-key="${f.key}" aria-label="${f.label}">`;
            else body = `<div class="chips-row"><button class="chip-btn ${val ? 'on' : ''}" data-key="${f.key}" data-val="${!val}">${val ? 'On' : 'Off'}</button></div>`;
            return `<div class="pick"><span>${f.label}</span>${body}</div>`;
          })
          .join('')}
        ${prestige}
      </div>`;
  };
  draw();
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.tab) tab = b.dataset.tab;
    else if (b.dataset.prestige) PRESTIGE.find((p) => p.key === b.dataset.prestige)!.apply(spec);
    else if (b.dataset.key) {
      const key = b.dataset.key as keyof GolferSpec;
      const raw = b.dataset.val!;
      (spec as Record<string, unknown>)[key] = raw === 'true' ? true : raw === 'false' ? false : raw;
      onChange({ ...spec });
    }
    draw();
    if (b.dataset.prestige) onChange({ ...spec });
  });
  el.addEventListener('input', (e) => {
    const i = e.target as HTMLInputElement;
    if (i.dataset.key === 'height') {
      spec.height = Number(i.value);
      onChange({ ...spec });
    }
  });
  return el;
}

// A small 3D stage with the golfer on a slowly turning plinth. Drag to spin.
export class GolferStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private golfer: Golfer | null = null;
  private turn = new THREE.Group();
  private raf = 0;
  private last = performance.now();
  private spin = 0.35;
  private drag: number | null = null;

  constructor(private host: HTMLElement, spec: GolferSpec) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#4a3a2a', 1.8));
    const key = new THREE.DirectionalLight('#fff1d6', 2.2);
    key.position.set(3, 8, 6);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#cfe0ff', 1);
    rim.position.set(-5, 4, -4);
    this.scene.add(rim);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 40), new THREE.MeshStandardMaterial({ color: '#163b2c', roughness: 0.6 }));
    plinth.position.y = -0.15;
    plinth.receiveShadow = true;
    this.turn.add(plinth);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.04, 6, 60), new THREE.MeshStandardMaterial({ color: '#b8955a', metalness: 0.7, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    this.turn.add(ring);
    this.scene.add(this.turn);
    this.set(spec);
    const el = this.renderer.domElement;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', (e) => (this.drag = e.clientX));
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

  set(spec: GolferSpec) {
    if (this.golfer) {
      this.turn.remove(this.golfer.group);
      this.golfer.dispose();
    }
    this.golfer = new Golfer(spec);
    this.golfer.holdClub('driver');
    this.golfer.setPose('idle');
    this.golfer.group.position.y = 0;
    this.turn.add(this.golfer.group);
  }

  wave() {
    this.golfer?.setPose('wave');
    window.setTimeout(() => this.golfer?.setPose('idle'), 1600);
  }

  private resize = () => {
    const w = this.host.clientWidth || 300;
    const h = this.host.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.set(0, 4.2, 15.5);
    this.camera.lookAt(0, 3.1, 0);
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.drag === null) this.turn.rotation.y += dt * this.spin;
    this.golfer?.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.golfer?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
