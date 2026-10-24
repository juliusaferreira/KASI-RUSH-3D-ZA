// Print the bounding box of an extracted car GLB (scaled in scene units).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync } from 'fs';

const file = process.argv[2] || 'car_compact.glb';
const loader = new GLTFLoader();
const buf = readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

loader.parse(ab, '', (gltf) => {
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  console.log(file, 'size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
  const names = [];
  gltf.scene.traverse((o) => { if (o.isMesh && o.name) names.push(o.name); });
  console.log('meshes:', names.slice(0, 8).join(', '));
}, (e) => console.error('fail', e?.message || e));
