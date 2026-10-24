import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createWeaponModel } from '../game/weaponModels';
import { WeaponInfo } from '../types/game';
import { Move3d, Lock } from 'lucide-react';

interface WeaponPreviewProps {
  weapon: WeaponInfo;
  dimmed?: boolean;
}

/** 3D turntable preview for a single weapon — drag to rotate, idle auto-spin. */
export const WeaponPreview: React.FC<WeaponPreviewProps> = ({ weapon, dimmed }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    turntable: THREE.Group;
    holder: THREE.Group | null;
    ring: THREE.Mesh | null;
    frameId: number;
    dragVel: number;
    dragging: boolean;
    disposed: boolean;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 1.7, 4.6);
    camera.lookAt(0, 0.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = 'grab';

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x60a5fa, 1.4);
    rim.position.set(-4, 3, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x94a3b8, 0.9));

    const turntable = new THREE.Group();
    scene.add(turntable);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.2, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 })
    );
    platform.position.y = -0.08;
    platform.receiveShadow = true;
    turntable.add(platform);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.035, 10, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(weapon.color) })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;
    turntable.add(ring);

    const ref = stateRef;
    ref.current = {
      renderer, scene, camera, turntable,
      holder: null, ring, frameId: 0,
      dragVel: 0, dragging: false, disposed: false,
    };

    const resize = () => {
      if (!stateRef.current) return;
      const w = mount.clientWidth || 260;
      const h = mount.clientHeight || 180;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      if (!stateRef.current) return;
      stateRef.current.dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s || !s.dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      s.turntable.rotation.y += dx * 0.01;
      s.dragVel = dx * 0.01;
    };
    const onUp = () => {
      if (stateRef.current) stateRef.current.dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointerleave', onUp);

    const animate = () => {
      const s = stateRef.current;
      if (!s || s.disposed) return;
      s.frameId = requestAnimationFrame(animate);
      if (!s.dragging) {
        s.dragVel *= 0.94;
        s.turntable.rotation.y += s.dragVel + 0.006;
      }
      // Pulsing pedestal ring glow, same as the character preview
      ring.material.color.setHSL(0.09, 0.95, 0.5 + Math.sin(performance.now() * 0.003) * 0.08);
      renderer.render(s.scene, s.camera);
    };
    animate();

    return () => {
      const s = stateRef.current;
      if (s) {
        s.disposed = true;
        cancelAnimationFrame(s.frameId);
      }
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointerleave', onUp);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Swap weapon model on selection change
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    // Recolor the pedestal ring to match the viewed weapon
    if (s.ring) {
      (s.ring.material as THREE.MeshBasicMaterial).color.set(weapon.color);
    }
    if (s.holder) {
      s.turntable.remove(s.holder);
      s.holder.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
    }
    if (weapon.id === 'none') {
      // Empty pedestal for the "no weapon" option
      s.holder = null;
      return;
    }
    const rig = createWeaponModel(weapon.id);
    rig.group.scale.setScalar(1.35); // weapons are small; scale up for display
    rig.group.position.y = 0.55; // weapons pivot at the hand; lift so handles clear the platform
    rig.group.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        // Locked weapons render as dark silhouettes
        if (dimmed) {
          const mesh = c as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && !Array.isArray(mat)) {
            mesh.material = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.9 });
          }
        }
      }
    });
    s.holder = rig.group;
    s.turntable.add(rig.group);
  }, [weapon.id, dimmed]);

  return (
    <div className="relative shrink-0 rounded-2xl border-2 bg-gradient-to-b from-slate-800/80 to-slate-950/90 overflow-hidden"
      style={{ borderColor: weapon.color + '80' }}>
      <div ref={mountRef} className="w-full h-52 sm:h-60 touch-none select-none" style={{ touchAction: 'none' }} />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-950/70 border border-slate-700 text-[10px] font-arcade text-amber-300">
        <Move3d className="w-3.5 h-3.5" />
        <span>DRAG TO ROTATE</span>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/70 border border-slate-700 font-arcade text-xs text-white flex items-center gap-1.5">
        {dimmed && <Lock className="w-3 h-3 text-slate-400" />}
        {dimmed ? '???' : `${weapon.emoji} ${weapon.name}`}
      </div>
    </div>
  );
};
