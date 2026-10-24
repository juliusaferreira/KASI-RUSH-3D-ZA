import * as THREE from 'three';
import { WeaponId } from '../types/game';

export interface WeaponModelRig {
  group: THREE.Group;
  /** Pivot group the swing animation rotates (held at player's hand). */
  swingPivot: THREE.Group;
  /** Rotating blade part for chainsaw idle spin; null otherwise. */
  blade?: THREE.Mesh;
}

/**
 * Low-poly weapon models in the Kasi Rush comic style: chunky boxes,
 * bright toy-like colors, flat shading. Each returns a rig with a swing
 * pivot positioned so the tool is held at the player's right hand.
 */
export function createWeaponModel(weaponId: WeaponId): WeaponModelRig {
  const group = new THREE.Group();
  const swingPivot = new THREE.Group();
  group.add(swingPivot);

  const metal = (c: number) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.7, roughness: 0.3 });
  const wood = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const plastic = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 });

  if (weaponId === 'small_hammer') {
    // Chunky red-head mallet with taped wooden handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), wood(0xb45309));
    handle.position.y = -0.2;
    // Grip tape band
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.16, 0.085), plastic(0x1e293b));
    tape.position.y = -0.32;
    // Head: red box with steel striking faces
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.14), plastic(0xdc2626));
    head.position.y = 0.1;
    const faceL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.16), metal(0xcbd5e1));
    faceL.position.set(-0.16, 0.1, 0);
    const faceR = faceL.clone();
    faceR.position.x = 0.16;
    swingPivot.add(handle, tape, head, faceL, faceR);
  } else if (weaponId === 'baseball_bat') {
    // Tapered wooden bat with grip rings
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.75, 8), wood(0xd97706));
    body.position.y = 0.05;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), wood(0x92400e));
    knob.position.y = -0.33;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 8), plastic(0x1e293b));
    grip.position.y = -0.2;
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), wood(0xb45309));
    tip.position.y = 0.4;
    swingPivot.add(body, knob, grip, tip);
  } else if (weaponId === 'crowbar') {
    // Dark steel crowbar with hooked end and red grip
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.72, 0.055), metal(0x475569));
    shaft.position.y = 0.02;
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.055), metal(0x475569));
    hook.position.set(0, 0.42, 0.03);
    hook.rotation.x = -0.7;
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.04), metal(0x64748b));
    claw.position.set(0, 0.44, -0.06);
    claw.rotation.x = 0.9;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), plastic(0xdc2626));
    grip.position.y = -0.24;
    swingPivot.add(shaft, hook, claw, grip);
  } else {
    // Chainsaw — matched to reference art: red body, black top handle loop,
    // long pale guide bar with dark chain, round side clutch cover, grey exhaust cylinder.
    const RED = 0xe23b32;
    const RED_DARK = 0xb72a24;
    const BLACK = 0x1e2126;

    // Main red body block (rounded box, rear-heavy like the reference)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.42), plastic(RED));
    body.position.set(0, 0.02, -0.06);
    // Body taper (front nose section slightly slimmer)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.16), plastic(RED));
    nose.position.set(0, 0.0, 0.16);

    // Black engine/top housing strip
    const engineHousing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.3), plastic(BLACK));
    engineHousing.position.set(0, 0.14, -0.06);

    // Top handle: black loop (three segments forming an arch above the body)
    const handleBarTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), plastic(BLACK));
    handleBarTop.position.set(0, 0.32, -0.1);
    const handleFront = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), plastic(BLACK));
    handleFront.position.set(0, 0.22, 0.04);
    const handleRear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), plastic(BLACK));
    handleRear.position.set(0, 0.22, -0.24);

    // Rear pull handle: black ring (torus) at the back
    const rearHandle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12), plastic(BLACK));
    rearHandle.position.set(0, 0.1, -0.3);

    // Round side clutch cover (dark circle on the side of the body)
    const clutch = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), plastic(BLACK));
    clutch.rotation.z = Math.PI / 2;
    clutch.position.set(0.14, 0.02, -0.1);
    const clutchCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), plastic(0x3a3f47));
    clutchCap.rotation.z = Math.PI / 2;
    clutchCap.position.set(0.16, 0.02, -0.1);

    // Grey exhaust cylinder (side, near the front)
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10), plastic(0x9aa2ad));
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(0.13, -0.02, 0.08);

    // Long pale guide bar extending forward
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.85), plastic(0xc9ced4));
    bar.position.set(0, 0.0, 0.6);
    // Dark chain wrapped along the bar edge
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.9), plastic(0x2b2f36));
    chain.position.set(0, 0.02, 0.6);
    // Chain teeth: small notches along the bar edge
    const toothGeo = new THREE.BoxGeometry(0.02, 0.03, 0.05);
    for (let t = 0; t < 8; t++) {
      const tooth = new THREE.Mesh(toothGeo, plastic(0x565c66));
      tooth.position.set(0, 0.06, 0.25 + t * 0.1);
      swingPivot.add(tooth);
    }

    // Front hand guard: black arc over the bar mount
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 10, Math.PI), plastic(BLACK));
    guard.position.set(0, 0.14, 0.22);

    swingPivot.add(
      body, nose, engineHousing,
      handleBarTop, handleFront, handleRear, rearHandle,
      clutch, clutchCap, exhaust,
      bar, chain, guard
    );

    // The chain spins: animate the tooth ring + chain subtle jitter
    return { group, swingPivot, blade: chain };
  }

  return { group, swingPivot };
}

/** One-shot swing animation state; call tick each frame with delta seconds. */
export class WeaponSwingAnimator {
  private t = -1; // -1 = idle
  private pivot: THREE.Group;

  constructor(pivot: THREE.Group) {
    this.pivot = pivot;
  }

  public trigger() {
    this.t = 0;
  }

  public get playing() {
    return this.t >= 0;
  }

  /** 0.35s swing: windup back, whip forward past obstacle, recover. */
  public tick(dt: number) {
    if (this.t < 0) return;
    this.t += dt;
    const D = 0.35;
    const p = this.t / D;
    if (p >= 1) {
      this.t = -1;
      this.pivot.rotation.x = 0;
      this.pivot.rotation.z = 0;
      return;
    }
    // ease-in windup then fast whip
    if (p < 0.35) {
      const k = p / 0.35;
      this.pivot.rotation.x = 0.6 * k;
      this.pivot.rotation.z = -0.3 * k;
    } else if (p < 0.7) {
      const k = (p - 0.35) / 0.35;
      this.pivot.rotation.x = 0.6 - 2.1 * k;
      this.pivot.rotation.z = -0.3 + 0.9 * k;
    } else {
      const k = (p - 0.7) / 0.3;
      this.pivot.rotation.x = -1.5 + 1.5 * k;
      this.pivot.rotation.z = 0.6 - 0.6 * k;
    }
  }
}
