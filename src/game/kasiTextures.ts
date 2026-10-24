import * as THREE from 'three';

/**
 * Kasi Rush style fabric/metal textures for character dressing.
 * Canvas-generated (no external files needed), all drawn in the game's
 * "stylized realism" township palette — weathered, saturated, story-telling.
 */

/** Striped sports jersey fabric with heather noise and pop color bands. */
export function createJerseyStripeTexture(
  base: string,
  stripe: string,
  darkStripe: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  // Diagonal athletic stripes
  ctx.strokeStyle = stripe;
  ctx.lineWidth = 26;
  for (let x = -256; x < 512; x += 88) {
    ctx.beginPath();
    ctx.moveTo(x, 256);
    ctx.lineTo(x + 256, 0);
    ctx.stroke();
  }

  // Thin contrasting pinstripes between bands
  ctx.strokeStyle = darkStripe;
  ctx.lineWidth = 5;
  for (let x = -256; x < 512; x += 88) {
    ctx.beginPath();
    ctx.moveTo(x + 44, 256);
    ctx.lineTo(x + 300, 0);
    ctx.stroke();
  }

  // Heather fabric noise
  for (let i = 0; i < 900; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 256;
    const size = 0.6 + Math.random() * 1.6;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.arc(rx, ry, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Corrugated metal texture — rust streaks, panel seams, painted patches. */
export function createCorrugatedTexture(base: string, rust: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  // Corrugation ridges (vertical)
  for (let x = 0; x < 256; x += 18) {
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(x, 0, 6, 256);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 9, 0, 6, 256);
  }

  // Rust bleed streaks running down
  for (let i = 0; i < 26; i++) {
    const rx = Math.random() * 256;
    const w = 2 + Math.random() * 6;
    const h = 20 + Math.random() * 90;
    const y = Math.random() * (256 - h);
    ctx.fillStyle = rust;
    ctx.globalAlpha = 0.25 + Math.random() * 0.4;
    ctx.fillRect(rx, y, w, h);
    ctx.globalAlpha = 1;
  }

  // Paint patches / sun-faded spots
  for (let i = 0; i < 12; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 256;
    const r = 8 + Math.random() * 26;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Denim texture with weave, fading and stitched panel seams. */
export function createDenimTexture(base: string, fade: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  // Twill weave diagonals
  for (let i = -256; i < 512; i += 4) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }

  // Stone-washed fading patches
  for (let i = 0; i < 18; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 256;
    const r = 12 + Math.random() * 34;
    ctx.fillStyle = fade;
    ctx.globalAlpha = 0.16 + Math.random() * 0.2;
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Double-stitched seam lines
  ctx.strokeStyle = 'rgba(255,200,90,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  [64, 192].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Rubber sole texture — treads, scuffs, and a pop-color midline. */
export function createSoleTexture(base: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  // Tread grooves
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 20; y < 256; y += 32) {
    ctx.fillRect(12, y, 232, 9);
  }

  // Pop accent midline
  ctx.fillStyle = accent;
  ctx.fillRect(0, 116, 256, 22);

  // Street scuffs
  for (let i = 0; i < 40; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 256;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(rx, ry, 1 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Township dirt / veld terrain texture — dry earth tones with pebbles,
 * grass tufts, tire tracks and dust patches. Used for the ground skirts
 * that fill the space beyond the ballast bed out to the horizon.
 */
export function createDirtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dry earth base — warm ochre with subtle vertical banding
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#8a6f4d');
  grad.addColorStop(0.5, '#9c7d55');
  grad.addColorStop(1, '#7a6142');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Large soft dust patches
  for (let i = 0; i < 22; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const r = 40 + Math.random() * 90;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(178,152,108,0.30)' : 'rgba(112,88,58,0.30)';
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pebbles & stones
  for (let i = 0; i < 320; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const size = 0.8 + Math.random() * 3.2;
    const shade = Math.random();
    ctx.fillStyle = shade > 0.6 ? 'rgba(60,48,34,0.5)' : shade > 0.3 ? 'rgba(190,170,135,0.5)' : 'rgba(140,120,90,0.5)';
    ctx.beginPath();
    ctx.arc(rx, ry, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sparse dry grass tufts (short strokes fanning out)
  for (let i = 0; i < 130; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const blades = 3 + Math.floor(Math.random() * 4);
    for (let b = 0; b < blades; b++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const len = 4 + Math.random() * 8;
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(148,124,66,0.6)' : 'rgba(172,148,86,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.sin(a) * len, ry - Math.cos(a) * len);
      ctx.stroke();
    }
  }

  // Tire track ruts (two faint parallel bands)
  ctx.strokeStyle = 'rgba(70,55,38,0.28)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(80, 0);
  ctx.bezierCurveTo(120, 170, 60, 340, 100, 512);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(140, 0);
  ctx.bezierCurveTo(180, 170, 120, 340, 160, 512);
  ctx.stroke();

  // Fine grain noise
  for (let i = 0; i < 1600; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(rx, ry, 1.2, 1.2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 12);
  return tex;
}

/**
 * Green Highveld veld-grass texture — dry grass-green base with dense tufts,
 * bare dirt patches, pebbles and subtle mowing stripes. Used for the track
 * shoulders and the far ground planes so the horizon blends into one surface.
 */
export function createVeldTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dry grass-green base with subtle banding
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#5d7a3a');
  grad.addColorStop(0.5, '#6b8844');
  grad.addColorStop(1, '#55703a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Soft dry / lush patches
  for (let i = 0; i < 26; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const r = 40 + Math.random() * 90;
    ctx.fillStyle = Math.random() > 0.45 ? 'rgba(134,158,84,0.30)' : 'rgba(96,72,46,0.26)';
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bare dirt patches (highveld dry season look)
  for (let i = 0; i < 14; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const r = 16 + Math.random() * 44;
    ctx.fillStyle = 'rgba(146,118,78,0.4)';
    ctx.beginPath();
    ctx.ellipse(rx, ry, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grass tufts — denser and greener than the dirt texture
  for (let i = 0; i < 420; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const blades = 3 + Math.floor(Math.random() * 4);
    for (let b = 0; b < blades; b++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const len = 4 + Math.random() * 9;
      const green = Math.random();
      ctx.strokeStyle = green > 0.6 ? 'rgba(126,158,80,0.7)'
        : green > 0.3 ? 'rgba(108,134,66,0.7)' : 'rgba(150,158,92,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.sin(a) * len, ry - Math.cos(a) * len);
      ctx.stroke();
    }
  }

  // Pebbles & stones
  for (let i = 0; i < 160; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const size = 0.8 + Math.random() * 2.6;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(70,66,58,0.45)' : 'rgba(170,162,140,0.4)';
    ctx.beginPath();
    ctx.arc(rx, ry, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine grain noise
  for (let i = 0; i < 1400; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(rx, ry, 1.2, 1.2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 12);
  return tex;
}

/**
 * Cyberpunk neon-grid ground — near-black wet asphalt with glowing circuit
 * lines, neon speckles and reflective puddle streaks. Used for the Neon City
 * shoulders, skirts and far plane.
 */
export function createNeonGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Wet dark asphalt base
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0b1026');
  grad.addColorStop(0.5, '#10162e');
  grad.addColorStop(1, '#0a0e22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Glowing circuit grid lines (cyan + magenta)
  const neon = ['rgba(34,211,238,0.55)', 'rgba(168,85,247,0.45)', 'rgba(244,114,182,0.4)'];
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = neon[i % neon.length];
    ctx.lineWidth = 1.6 + Math.random() * 1.4;
    ctx.beginPath();
    const y = Math.random() * 512;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + (Math.random() - 0.5) * 60, 340, y + (Math.random() - 0.5) * 60, 512, y + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = neon[(i + 1) % neon.length];
    ctx.lineWidth = 1.2 + Math.random();
    ctx.beginPath();
    const x = Math.random() * 512;
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (Math.random() - 0.5) * 60, 170, x + (Math.random() - 0.5) * 60, 340, x, 512);
    ctx.stroke();
  }

  // Bright circuit nodes where lines "connect"
  for (let i = 0; i < 40; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillStyle = neon[i % neon.length];
    ctx.beginPath();
    ctx.arc(rx, ry, 2 + Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Reflective puddle streaks (catch the neon light)
  for (let i = 0; i < 14; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const w = 30 + Math.random() * 70;
    ctx.fillStyle = 'rgba(120,150,220,0.10)';
    ctx.beginPath();
    ctx.ellipse(rx, ry, w, 6 + Math.random() * 10, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine grain noise
  for (let i = 0; i < 1200; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rx, ry, 1.2, 1.2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 12);
  return tex;
}

/**
 * Neon City asphalt road texture — dark wet tarmac with 4 neon lane-divider
 * lines (dashed) dividing 5 lanes, plus edge lines. Lines run along V so the
 * texture repeats along the road length. Designed for a road plane spanning
 * x = ±8 with repeat(1, N) along the road.
 */
export function createNeonRoadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Wet dark asphalt — dark base so the neon lines carry all the contrast
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#0d1122');
  grad.addColorStop(0.5, '#151b30');
  grad.addColorStop(1, '#0d1122');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Asphalt speckle
  for (let i = 0; i < 900; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.10)';
    ctx.fillRect(rx, ry, 1.6, 1.6);
  }

  // 5 lanes across 512px: dividers at x = 102.4, 204.8, 307.2, 409.6.
  // Thick dashed lines so they stay visible at distance and speed.
  const dividers = [102.4, 204.8, 307.2, 409.6];
  for (const dx of dividers) {
    // Dark gap so the neon pops against the tarmac
    ctx.strokeStyle = 'rgba(10,14,30,0.9)';
    ctx.lineWidth = 22;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(dx, 0);
    ctx.lineTo(dx, 512);
    ctx.stroke();
    // Dashed cyan-white lane line
    ctx.strokeStyle = 'rgba(190,250,255,0.98)';
    ctx.lineWidth = 11;
    ctx.setLineDash([42, 30]);
    ctx.beginPath();
    ctx.moveTo(dx, 0);
    ctx.lineTo(dx, 512);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Glowing magenta edge lines (solid, wide)
  ctx.strokeStyle = 'rgba(255,140,200,0.95)';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.lineTo(14, 512);
  ctx.moveTo(498, 0); ctx.lineTo(498, 512);
  ctx.stroke();

  // Wet reflection streaks
  for (let i = 0; i < 10; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillStyle = 'rgba(160,190,255,0.09)';
    ctx.beginPath();
    ctx.ellipse(rx, ry, 6 + Math.random() * 14, 26 + Math.random() * 40, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Neon road markings — pure black background with ONLY the bright lane
 * divider lines and edge lines. Used as the emissiveMap on the road material
 * so the asphalt stays dark while the lines glow through the night.
 * Line layout matches createNeonRoadTexture exactly.
 */
export function createNeonRoadMarkingsTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 512, 512);

  // 4 dashed cyan-white lane dividers (thick for mip survival at distance)
  const dividers = [102.4, 204.8, 307.2, 409.6];
  for (const dx of dividers) {
    ctx.strokeStyle = 'rgb(190,250,255)';
    ctx.lineWidth = 16;
    ctx.setLineDash([42, 30]);
    ctx.beginPath();
    ctx.moveTo(dx, 0);
    ctx.lineTo(dx, 512);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Solid magenta edge lines
  ctx.strokeStyle = 'rgb(255,140,200)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.lineTo(14, 512);
  ctx.moveTo(498, 0); ctx.lineTo(498, 512);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
