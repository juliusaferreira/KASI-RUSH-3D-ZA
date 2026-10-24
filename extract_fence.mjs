// Extract Fence_Straight panels from the fence pack into a lean GLB.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('chain_link_fence_pack_low_poly_game_ready.glb');
const root = doc.getRoot();

// Keep only nodes whose names start with Fence_Straight (panels + bases).
// The pack nests meshes under per-variant parent nodes, so prune recursively:
// dispose branches containing no fence nodes.
let keptFirst = false;
function keepFence(node) {
  const name = node.getName() || '';
  if (name.startsWith('Fence_Straight')) {
    // Keep ONLY the first panel — the pack lays variants out side by side,
    // and a huge spread bbox breaks auto-scaling downstream.
    if (keptFirst) { node.dispose(); return false; }
    keptFirst = true;
    return true;
  }
  const kids = node.listChildren();
  const keepers = kids.filter((k) => keepFence(k));
  if (keepers.length === 0) {
    node.dispose();
    return false;
  }
  for (const k of kids) {
    if (!keepers.includes(k)) k.dispose();
  }
  return true;
}
for (const scene of root.listScenes()) {
  for (const node of [...scene.listChildren()]) {
    if (!keepFence(node)) node.dispose();
  }
}

await doc.transform(
  prune({ keepLeaves: false }),
  dedup()
);

// Convert KHR_materials_pbrSpecularGlossiness → standard PBR (three.js GLTFLoader
// doesn't support the specular-glossiness extension). The extension exposes
// getter methods, not raw properties.
const specExt = doc.getRoot().listExtensionsUsed()
  .find((ext) => ext.extensionName === 'KHR_materials_pbrSpecularGlossiness');
if (specExt) {
  for (const mat of doc.getRoot().listMaterials()) {
    const spec = mat.getExtension('KHR_materials_pbrSpecularGlossiness');
    if (!spec) continue;
    const diffuseTex = spec.getDiffuseTexture?.() ?? null;
    const diffuseFac = spec.getDiffuseFactor?.() ?? [1, 1, 1, 1];
    const glossFac = spec.getGlossinessFactor?.() ?? 1;
    const specFac = spec.getSpecularFactor?.() ?? [1, 1, 1];
    mat.setExtension('KHR_materials_pbrSpecularGlossiness', null);
    mat.setBaseColorFactor(diffuseFac);
    if (diffuseTex) mat.setBaseColorTexture(diffuseTex);
    mat.setRoughnessFactor(Math.max(0.05, 1 - glossFac));
    const specAvg = (specFac[0] + specFac[1] + specFac[2]) / 3;
    mat.setMetallicFactor(Math.min(1, specAvg * glossFac));
  }
  specExt.dispose();
}

await io.write('chain_link_fence_only.glb', doc);
console.log('written chain_link_fence_only.glb');
