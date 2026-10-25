// The locker room, open to every member at any hour: the whole club stands at their lockers.
// Drag to walk along the row; tap a member (or their locker) to see their card.
import * as THREE from 'three';
import type { Snapshot } from '../api/types';
import { portrait, specOf } from '../avatar';
import { Golfer } from '../golf3d/golfer';
import { hostChip } from '../host';
import { lockerRoom } from '../intro/welcome';
import { esc, header, navigate, render } from '../ui';

let closeLockers: () => void = () => {};
export const leaveLockers = () => {
  closeLockers();
  closeLockers = () => {};
};

const OX = 2000; // where lockerRoom() builds the room

const profile = (snap: Snapshot, id: string) => (id === snap.me ? '#/card' : `#/member/${id}`);

export function lockers(snap: Snapshot) {
  leaveLockers();
  // oldest first, the same order as member numbers
  const members = [...snap.players].sort((a, b) => (a.joined ?? '').localeCompare(b.joined ?? ''));
  render(`
    ${header(snap.groupName, 'lockers')}
    <main>
      ${hostChip('The locker room. Do knock before opening anything; some members keep their scorecards in there.', 'dry')}
      <section class="locker-room" id="room"><p class="room-hint">Drag to look along the row · tap a member</p></section>
      <section class="panel roster">
        <h2>The members</h2>
        <ul>${members
          .map((p) => `<li><a href="${profile(snap, p.id)}">${portrait(p.avatar, 46)}<span><b>${esc(p.name)}</b><small>${p.id === snap.me ? 'You' : p.wins ? `${p.wins} ${p.wins === 1 ? 'title' : 'titles'}` : 'Member'}</small></span></a></li>`)
          .join('')}</ul>
      </section>
    </main>`);

  const host = document.getElementById('room')!;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    host.remove(); // the roster below still works
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1d14');
  scene.add(new THREE.HemisphereLight('#ffe6c0', '#3a2a1a', 1.5));
  const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 400);

  const { lockers: row } = lockerRoom(scene, members.map((p) => p.name), false);
  const actors: Golfer[] = [];
  const hits: THREE.Mesh[] = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  members.forEach((p, i) => {
    const x = OX + row[i].x;
    const g = new Golfer(specOf(p.avatar));
    g.holdClub(i % 3 === 0 ? 'driver' : i % 3 === 1 ? 'putter' : null);
    g.setPose('idle');
    // in front of the bench, facing the room
    g.group.position.set(x, 0, -1.5);
    g.group.rotation.y = 0.18 * (i % 2 ? 1 : -1);
    g.showBag(false);
    scene.add(g.group);
    actors.push(g);
    // one tap target covering the member and their locker
    const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3, 52 / row.length - 0.4), 13, 18), hitMat);
    hit.position.set(x, 6.5, -9);
    hit.userData = { id: p.id, golfer: g };
    scene.add(hit);
    hits.push(hit);
  });

  // the camera slides along the row; it starts in front of your own locker
  // measured from the members themselves: a small club stands at the first few lockers, off to one side
  const xs = row.slice(0, members.length).map((l) => OX + l.x);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const mid = (lo + hi) / 2;
  const mine = members.findIndex((p) => p.id === snap.me);
  let camX = mine >= 0 ? xs[mine] : mid;
  let want = camX;
  let wide = false; // set by resize(), which centres the view when the whole row fits
  // you can always drag along the row; when it all fits, the view starts in the middle of it
  const clamp = (x: number) => Math.max(lo, Math.min(hi, x));
  const resize = () => {
    const w = host.clientWidth || innerWidth;
    const h = host.clientHeight || 360;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 60 : 46;
    camera.updateProjectionMatrix();
    // wide screens see the whole row at once; narrow ones walk along it. Measured where the members stand
    // (21.5 ft from the wide camera), not at the lockers behind them, or the end members get cut off
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 21.5;
    const fits = halfW * 2 > hi - lo + 8;
    if (fits && !wide) camX = want = mid;
    wide = fits;
    want = clamp(want);
  };
  resize();
  window.addEventListener('resize', resize);

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; cam: number; moved: boolean } | null = null;
  let leaving = false;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, cam: want, moved: false };
  });
  el.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 6) down.moved = true;
    if (down.moved) want = clamp(down.cam - (dx / el.clientWidth) * 30);
  });
  el.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    if (!d || d.moved || leaving) return;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits)[0];
    if (!hit) return;
    // they turn and wave, then you're at their card
    const { id, golfer } = hit.object.userData as { id: string; golfer: Golfer };
    leaving = true;
    golfer.setPose('wave');
    want = clamp(hit.object.position.x);
    window.setTimeout(() => navigate(profile(snap, id)), 650);
  });
  el.addEventListener('pointercancel', () => (down = null));

  let raf = 0;
  let last = performance.now();
  const look = new THREE.Vector3();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    camX += (want - camX) * Math.min(1, dt * 8);
    camera.position.set(camX, 6.5, wide ? 20 : 15);
    look.set(camX, 5, -14);
    camera.lookAt(look);
    actors.forEach((a) => a.update(dt));
    renderer.render(scene, camera);
  };
  loop();
  closeLockers = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    actors.forEach((a) => a.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
