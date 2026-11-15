// Lincoln Park Zoo's animals (the Windy City's Lincoln Park hole): simple low-poly figures that wander their
// enclosures beside the fairway. They're movers: the hole gives each a path and a post, so a ball that hits one bounces
// off it. Each faces -z (up the hole) by default, as the other props do.
import * as THREE from 'three';
import { mat, mesh } from './props';

const leg = (g: THREE.Group, m: THREE.Material, x: number, z: number, len: number, r: number) =>
  g.add(mesh(new THREE.CylinderGeometry(r, r * 0.8, len, 6), m).translateX(x).translateY(len / 2).translateZ(z));

export function giraffe() {
  const g = new THREE.Group();
  const coat = mat('#d9a441');
  const patch = mat('#7a4a22');
  for (const [x, z] of [[-0.5, -1.1], [0.5, -1.1], [-0.5, 1.1], [0.5, 1.1]]) leg(g, coat, x, z, 6, 0.22);
  const body = mesh(new THREE.SphereGeometry(1, 12, 8), coat);
  body.scale.set(0.9, 0.9, 1.7);
  body.position.y = 6.6;
  g.add(body);
  // the neck, leaning forward and up, and the head
  const neck = mesh(new THREE.CylinderGeometry(0.3, 0.45, 6, 8), coat);
  neck.position.set(0, 9.4, -1.6);
  neck.rotation.x = -0.35;
  g.add(neck);
  const head = mesh(new THREE.BoxGeometry(0.6, 0.6, 1.4), coat);
  head.position.set(0, 12.3, -2.9);
  g.add(head);
  for (const x of [-0.2, 0.2]) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 4), patch).translateX(x).translateY(12.8).translateZ(-2.6));
  // the patches
  for (let i = 0; i < 9; i++) {
    const s = mesh(new THREE.SphereGeometry(0.28, 5, 4), patch, false);
    const a = (i / 9) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.85, 6.6 + Math.sin(i * 1.7) * 0.5, Math.sin(a) * 1.5);
    s.scale.set(1, 0.3, 1);
    g.add(s);
  }
  return g;
}

export function elephant() {
  const g = new THREE.Group();
  const hide = mat('#8a8a8c', { rough: 0.95 });
  for (const [x, z] of [[-1.1, -1.6], [1.1, -1.6], [-1.1, 1.6], [1.1, 1.6]]) leg(g, hide, x, z, 3.6, 0.7);
  const body = mesh(new THREE.SphereGeometry(1, 14, 10), hide);
  body.scale.set(2, 2.1, 3);
  body.position.y = 5.2;
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(1.4, 12, 8), hide);
  head.position.set(0, 6.2, -3.1);
  g.add(head);
  // ears and the trunk
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.CircleGeometry(1.4, 10), mat('#7c7c7f'));
    ear.position.set(s * 1.3, 6.3, -2.7);
    ear.rotation.y = s * 1.1;
    g.add(ear);
  }
  const trunk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 5.8, -4.2), new THREE.Vector3(0, 4.2, -4.8), new THREE.Vector3(0, 2.2, -4.6), new THREE.Vector3(0, 1.2, -4.9)]), 10, 0.35, 6);
  g.add(mesh(trunk, hide));
  for (const s of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.15, 1.4, 5), mat('#efe8d6')).rotateX(-Math.PI / 2.4).translateX(s * 0.6).translateY(5.2).translateZ(-4.2));
  return g;
}

export function zebra() {
  const g = new THREE.Group();
  const white = mat('#f1f0ec');
  const black = mat('#1d1d1f');
  for (const [x, z] of [[-0.35, -0.9], [0.35, -0.9], [-0.35, 0.9], [0.35, 0.9]]) leg(g, white, x, z, 2.6, 0.16);
  const body = mesh(new THREE.SphereGeometry(1, 12, 8), white);
  body.scale.set(0.7, 0.75, 1.5);
  body.position.y = 3.2;
  g.add(body);
  for (let i = 0; i < 6; i++) {
    const s = mesh(new THREE.TorusGeometry(0.74, 0.07, 4, 14), black, false);
    s.position.set(0, 3.2, -1 + i * 0.4);
    s.scale.set(0.95, 1, 1);
    g.add(s);
  }
  const neck = mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.8, 7), white);
  neck.position.set(0, 4.2, -1.4);
  neck.rotation.x = -0.6;
  g.add(neck);
  const head = mesh(new THREE.BoxGeometry(0.5, 0.55, 1.2), white);
  head.position.set(0, 4.9, -2.1);
  g.add(head);
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.5, 1.4), black).translateY(4.7).translateZ(-1.4));
  return g;
}

export function flamingo() {
  const g = new THREE.Group();
  const pink = mat('#f08aa0');
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 4), mat('#d46b84')).translateY(1.2));
  const body = mesh(new THREE.SphereGeometry(0.5, 10, 8), pink);
  body.scale.set(0.8, 0.7, 1.3);
  body.position.y = 2.6;
  g.add(body);
  const neck = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.8, -0.5), new THREE.Vector3(0, 3.6, -0.3), new THREE.Vector3(0, 4.1, -0.7)]), 8, 0.08, 5);
  g.add(mesh(neck, pink));
  g.add(mesh(new THREE.ConeGeometry(0.09, 0.4, 5), mat('#222')).rotateX(-Math.PI / 1.6).translateY(4).translateZ(-0.9));
  return g;
}

export type ZooLook = 'giraffe' | 'elephant' | 'zebra' | 'flamingo';
export const zooAnimal = (look: string): THREE.Object3D | null =>
  look === 'giraffe' ? giraffe() : look === 'elephant' ? elephant() : look === 'zebra' ? zebra() : look === 'flamingo' ? flamingo() : null;
