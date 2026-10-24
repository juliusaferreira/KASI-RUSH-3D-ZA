import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createCharacterModel } from '../game/models';
import { CharacterInfo } from '../types/game';
import { Move3d } from 'lucide-react';

interface CharacterPreviewProps {
  character: CharacterInfo;
}

/**
 * Live 3D character preview: renders the selected character on a glowing
 * turntable platform inside a mini three.js scene. Drag to rotate manually;
 * auto-rotates slowly otherwise.
 */
export const CharacterPreview: React.FC<CharacterPreviewProps> = ({ character }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    turntable: THREE.Group;
    modelHolder: THREE.Group | null;
    frameId: number;
    dragVel: number;
    dragging: boolean;
    disposed: boolean;
  } | null>(null);

  // ── Init scene once ────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 1.7, 4.6);
    camera.lookAt(0, 1.0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = 'grab';

    // Lights: key + rim + fill for a snappy arcade look
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x60a5fa, 1.4);
    rim.position.set(-4, 3, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x94a3b8, 0.9));

    // ── Turntable platform ──
    const turntable = new THREE.Group();
    scene.add(turntable);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.2, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 })
    );
    platform.position.y = -0.08;
    platform.receiveShadow = true;
    turntable.add(platform);

    // Glowing accent ring around the platform edge
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.035, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;
    turntable.add(ring);

    const sceneRefObj = sceneRef;
    sceneRefObj.current = {
      renderer, scene, camera, turntable,
      modelHolder: null, frameId: 0,
      dragVel: 0, dragging: false, disposed: false,
    };

    // ── Resize handling ──
    const resize = () => {
      if (!sceneRef.current) return;
      const w = mount.clientWidth || 300;
      const h = mount.clientHeight || 220;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    // ── Drag-to-rotate ──
    let lastX = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (!sceneRef.current) return;
      sceneRef.current.dragging = true;
      lastX = e.clientX;
      renderer.domElement.style.cursor = 'grabbing';
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const ref = sceneRef.current;
      if (!ref || !ref.dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      ref.turntable.rotation.y += dx * 0.01;
      ref.dragVel = dx * 0.01;
    };
    const onPointerUp = () => {
      if (!sceneRef.current) return;
      sceneRef.current.dragging = false;
      renderer.domElement.style.cursor = 'grab';
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerUp);

    // ── Animation loop ──
    const animate = () => {
      const ref = sceneRef.current;
      if (!ref || ref.disposed) return;
      ref.frameId = requestAnimationFrame(animate);
      // Idle auto-spin; inertia decays after a drag
      if (!ref.dragging) {
        ref.dragVel *= 0.94;
        ref.turntable.rotation.y += ref.dragVel + 0.006;
      }
      // Subtle hoverboard/character idle bob on the platform ring glow
      ring.material.color.setHSL(0.09, 0.95, 0.5 + Math.sin(performance.now() * 0.003) * 0.08);
      renderer.render(ref.scene, ref.camera);
    };
    animate();

    return () => {
      const ref = sceneRef.current;
      if (ref) {
        ref.disposed = true;
        cancelAnimationFrame(ref.frameId);
      }
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerUp);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── Swap character model when selection changes ────────────────────
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;

    // Remove previous model
    if (ref.modelHolder) {
      ref.turntable.remove(ref.modelHolder);
      ref.modelHolder.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
    }

    const rig = createCharacterModel(character.id, character.outfitColor);
    rig.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
      }
    });
    ref.modelHolder = rig.group;
    ref.turntable.add(rig.group);
  }, [character.id, character.outfitColor]);

  return (
    <div className="relative rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-slate-800/80 to-slate-950/90 overflow-hidden">
      <div
        ref={mountRef}
        className="w-full h-52 sm:h-60 touch-none select-none"
        style={{ touchAction: 'none' }}
      />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-950/70 border border-slate-700 text-[10px] font-arcade text-amber-300">
        <Move3d className="w-3.5 h-3.5" />
        <span>DRAG TO ROTATE</span>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/70 border border-slate-700 font-arcade text-xs text-white stroke-arcade-sm">
        {character.name}
      </div>
    </div>
  );
};
