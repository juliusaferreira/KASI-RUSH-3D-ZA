import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Optional CC0 Kenney buildings. Missing files always retain local Kasi scenery. */
const loader = new GLTFLoader();
const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
const choices = {
  suburban: ['building-type-a.glb', 'building-type-b.glb'],
  commercial: ['building-a.glb', 'building-b.glb'],
} as const;

export function createOptionalKenneyBuilding(
  kind: keyof typeof choices,
  fallback: THREE.Group,
  variant: number,
): THREE.Group {
  const holder = new THREE.Group();
  holder.add(fallback);
  const filenames = choices[kind];
  const url = `${base}assets/thirdparty/${kind}/${filenames[variant % filenames.length]}`;
  loader.load(url, (gltf) => {
    const scene = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(scene);
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = Math.min(7 / Math.max(size.x, 0.01), 8 / Math.max(size.y, 0.01), 7 / Math.max(size.z, 0.01));
    scene.scale.setScalar(scale);
    scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    holder.clear();
    holder.add(scene);
  }, undefined, () => {
    // User has not installed this optional model. Original model remains.
  });
  return holder;
}
