import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SouthAfricanCity, PowerupState, PowerupType, RunStats, CharacterId, ComicSplashStyle, WeaponId } from '../types/game';
import {
  LANE_WIDTH,
  LANES,
  BASE_SPEED,
  MAX_SPEED,
  SPEED_ACCELERATION,
  JUMP_VELOCITY,
  SNEAKER_JUMP_VELOCITY,
  GRAVITY,
  ROLL_DURATION,
  HOVERBOARD_DURATION,
  JETPACK_DURATION,
  MAGNET_DURATION,
  SNEAKERS_DURATION,
  MULTIPLIER_DURATION,
  JETPACK_HEIGHT,
  TRAIN_HEIGHT,
  TRAIN_LENGTH,
  CITIES,
  CHARACTERS,
} from './constants';
import { createBallastTexture, createGraffitiTexture } from './textures';
import { createDirtTexture, createVeldTexture, createNeonGroundTexture, createNeonRoadTexture, createNeonRoadMarkingsTexture } from './kasiTextures';
import {
  createCharacterModel,
  createCustomGltfCharacter,
  createInspectorModel,
  createTrainMesh,
  createBarrierLow,
  createBarrierHigh,
  createCoinMesh,
  createPowerupMesh,
  createLandmarkMesh,
  createMinibusTaxi,
  createSpazaShop,
  createSowetoShack,
  createShippingContainer,
  createTownshipPowerPole,
  createBeachUmbrella,
  createSurfboard,
  createStreetLamp,
  createAcaciaTree,
  createAloePlant,
  createComicBillboardSign,
  createBoKaapHouse,
  createThatchedRondavel,
  createTelephonePole,
  createPalmTree,
} from './models';
import { assetManager } from './assetLoader';
import { createWeaponModel, WeaponModelRig, WeaponSwingAnimator } from './weaponModels';
import { getWeaponById } from './weaponData';
import { createOptionalKenneyBuilding } from './thirdPartyBuildings';

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export interface SideSceneryItem {
  group: THREE.Group;
  z: number;
  sideOffset: number; // perpendicular distance from curved track centerline
  localRotY: number;
}

/**
 * Low-poly comic veld prop: a grey boulder or a dry shrub.
 * Used to scatter variety across the grass shoulders.
 */
function createVeldProp(kind: 'rock' | 'shrub'): THREE.Group {
  const group = new THREE.Group();
  if (kind === 'rock') {
    const geo = new THREE.DodecahedronGeometry(0.55, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.9 });
    const rock = new THREE.Mesh(geo, mat);
    rock.scale.set(1 + Math.random() * 0.6, 0.6 + Math.random() * 0.5, 0.9 + Math.random() * 0.5);
    rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    rock.position.y = 0.22;
    rock.castShadow = true;
    group.add(rock);
  } else {
    const mat = new THREE.MeshStandardMaterial({ color: 0x5f7a3c, roughness: 0.85 });
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x6e5233, roughness: 0.9 });
    const shrub = new THREE.Group();
    const puffs = 4 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.2, 0), mat);
      puff.position.set((Math.random() - 0.5) * 0.5, 0.28 + Math.random() * 0.22, (Math.random() - 0.5) * 0.5);
      puff.scale.y = 0.7;
      shrub.add(puff);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.35, 5), twigMat);
    stem.position.y = 0.16;
    shrub.add(stem);
    shrub.position.y = 0.05;
    shrub.scale.setScalar(0.8 + Math.random() * 0.7);
    for (const m of shrub.children) (m as THREE.Mesh).castShadow = true;
    group.add(shrub);
  }
  return group;
}
import { getLaneX, clampLane, getLaneCount, calculateRunScore, tickPowerupTimers, getTrackCurveX, getTrackCurveAngle } from './rules';
import { sound } from '../audio/soundManager';

export interface GameEngineCallbacks {
  onScoreUpdate: (stats: RunStats) => void;
  onPowerupUpdate: (powerups: PowerupState, hoverboardActive: boolean, hoverboardTime: number) => void;
  onGameOver: (finalStats: RunStats) => void;
  onSplashText?: (text: string, style: ComicSplashStyle, x?: number, y?: number) => void;
}

interface ActiveObstacle {
  id: number;
  type: 'train' | 'barrier_low' | 'barrier_high';
  lane: number;
  group: THREE.Group;
  z: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  hasRamp?: boolean;
  speed?: number; // for moving oncoming train
  extraRotationY?: number; // per-obstacle orientation offset (e.g. flipped bus)
}

interface ActiveCoin {
  id: number;
  lane: number;
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

interface ActivePowerupItem {
  id: number;
  type: PowerupType;
  lane: number;
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;

  // Running State
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private city: SouthAfricanCity = 'soweto';
  private characterId: CharacterId = 'skeleton';
  private characterOutfit: string = '#f8fafc';

  // Game Stats
  private distance: number = 0;
  private coins: number = 0;
  private score: number = 0;
  private multiplier: number = 10;
  private highScore: number = 0;
  private totalCoins: number = 0;
  private currentSpeed: number = BASE_SPEED;

  // Player Physics
  private currentLane: number = 0; // -1, 0, 1
  private targetLane: number = 0;
  private playerX: number = 0;
  private playerY: number = 0;
  private playerZ: number = 0;
  private playerVy: number = 0;
  private isJumping: boolean = false;
  private isRolling: boolean = false;
  private rollTimer: number = 0;
  private groundY: number = 0; // 0 on track, roof height while riding a train/car/bus
  private standingRoofY: number = 0; // roof height currently being stood on (for clean drop-off)

  // Hoverboard & Powerups
  private hasHoverboard: boolean = false;
  private hoverboardTimer: number = 0;
  private powerups: PowerupState = { sneakers: 0, magnet: 0, jetpack: 0, multiplier: 0 };

  // Inspector Chase Stumble Mechanic
  private inspectorOffsetZ: number = 10.0; // distance behind player (normal = 10, stumbled = 3.5)
  private stumbleTimer: number = 0;

  // 3D Meshes & Scene Objects
  private playerModel!: ReturnType<typeof createCharacterModel>;
  private inspectorModel!: ReturnType<typeof createInspectorModel>;
  private landmarkGroup!: THREE.Group;
  private landmarkZ: number = -420;

  // ── Weapon system: selected tool with uses + cooldown, replaces hoverboards ──
  private weaponId: WeaponId = 'baseball_bat';
  private weaponUsesLeft: number = 0;
  private weaponCooldownLeft: number = 0;
  private characterPowers = { extraLives: 0, sneakerDurationMult: 1, weaponExtraUses: 0 };
  private weaponDrawn: boolean = false; // hidden until the player double-taps
  private weaponSwingAnimator: WeaponSwingAnimator | null = null;
  private weaponRig: WeaponModelRig | null = null;
  private chainSpin: number = 0;
  private sideSceneryGroup: THREE.Group = new THREE.Group();
  private sideScenery: SideSceneryItem[] = [];
  private veldPropsGroup: THREE.Group = new THREE.Group();
  private veldProps: SideSceneryItem[] = [];
  private catenaryInstances!: THREE.Group;
  private groundMesh!: THREE.Mesh;
  private ballastTexture!: THREE.CanvasTexture;
  private shoulderMeshL!: THREE.Mesh;
  private shoulderMeshR!: THREE.Mesh;
  private roadTexture?: THREE.CanvasTexture;
  private roadBasicMat?: THREE.MeshBasicMaterial; // unlit road material
  private ballastMaterial?: THREE.MeshStandardMaterial; // original lit bed material
  private roadDividerMesh?: THREE.Mesh; // 6 glowing lane-divider strips
  private shoulderTexture!: THREE.CanvasTexture;
  private shoulderMaterial!: THREE.MeshStandardMaterial;
  private skirtMaterial!: THREE.MeshStandardMaterial;
  private farMaterial!: THREE.MeshStandardMaterial;
  private railsMesh!: THREE.Mesh;
  private bonusRailsMesh!: THREE.Mesh; // Soweto temporary side-lane rails
  private bonusTiesMesh!: THREE.InstancedMesh; // sleepers for the bonus lane
  private bonusBeaconMesh!: THREE.Mesh; // glowing marker where the lane opens
  private bonusSideFenceL!: THREE.Group[]; // chain-link panels marking the closed bonus side
  private bonusSideFenceR!: THREE.Group[];
  private curbsMesh!: THREE.Mesh;
  private tiesInstancedMesh!: THREE.InstancedMesh;
  private obstacles: ActiveObstacle[] = [];
  private activeCoins: ActiveCoin[] = [];
  private activePowerups: ActivePowerupItem[] = [];

  // Particle System
  private particles: Particle[] = [];
  private particleGroup: THREE.Group = new THREE.Group();
  private dustTimer: number = 0;

  // Track Chunk generation
  private nextSpawnZ: number = -20;
  private nextObstacleId: number = 1;
  private animClock: number = 0;

  // Input listeners cleanup
  private cleanupListeners: () => void = () => {};

  constructor(container: HTMLElement, city: SouthAfricanCity, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.city = city;
    this.callbacks = callbacks;
    this.highScore = parseInt(localStorage.getItem('mzansi_high_score') || '0', 10);
    this.totalCoins = parseInt(localStorage.getItem('mzansi_total_coins') || '0', 10);

    this.initThree();
    this.setupScene();
    this.setupInput();
  }

  private initThree() {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      this.isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } else {
      this.isSoftwareGl = true;
    }

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // far=500 so the distant city skyline/backdrop (z≈-400 world) is not clipped.
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.5, 500);
    this.camera.position.set(0, 4.8, this.cameraZ);
    this.camera.lookAt(0, 1.8, -4.0);

    // Environment reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();
  }

  public setCity(city: SouthAfricanCity) {
    this.city = city;
    this.setupSkyAndLighting();
    if (this.landmarkGroup) {
      this.scene.remove(this.landmarkGroup);
    }
    this.landmarkGroup = createLandmarkMesh(this.city);
    this.landmarkGroup.position.z = this.landmarkZ = -320;
    this.scene.add(this.landmarkGroup);

    // Rebuild city-specific roadside scenery that dynamically bends with tracks
    this.initSideScenery();
    // Rebuild city-specific ground (veld vs neon circuit grid)
    this.rebuildGroundForCity();
    this.applyTrackSurfaceForCity();
    this.ensureRoadForCity();
  }

  /**
   * City-specific track surface: Neon City runs on an asphalt road — the
   * railway rails/sleepers/curbs are hidden and a dedicated bent road mesh
   * spanning exactly the 5 lanes is added, retextured as wet neon asphalt.
   */
  private applyTrackSurfaceForCity() {
    if (!this.groundMesh || !this.railsMesh || !this.curbsMesh || !this.tiesInstancedMesh) return;
    const neon = this.city === 'neon_city';
    this.railsMesh.visible = !neon;
    this.curbsMesh.visible = !neon;
    this.tiesInstancedMesh.visible = !neon;
    const mat = this.groundMesh.material as THREE.MeshStandardMaterial;
    if (neon) {
      if (!this.ballastTexture?.image) {
        const groundTex = createNeonGroundTexture();
        mat.map = groundTex;
      }
      mat.roughness = 0.6;
      mat.metalness = 0.2;
      mat.needsUpdate = true;
    } else {
      mat.map = this.ballastTexture;
      mat.roughness = 0.85;
      mat.metalness = 0.1;
      mat.needsUpdate = true;
    }
  }

  /**
   * Rebuild the Neon City lane-divider strips when entering/leaving the city.
   * (The road surface itself is the ground bed — see rebuildGroundBedForCity.)
   */
  private ensureRoadForCity() {
    const neon = this.city === 'neon_city';
    if (neon && !this.roadDividerMesh) {
      // Glowing lane markings as REAL GEOMETRY — unlit neon strips that follow
      // the bend. Texture filtering smears thin lines at grazing angles; 3D
      // strips can't blur. 4 dividers between the 5 lanes + 2 edges = 6 strips.
      const stripGeo = this.createRailsGeometry(6, 70);
      const dividerMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        side: THREE.DoubleSide,
        fog: false,
      });
      this.roadDividerMesh = new THREE.Mesh(stripGeo, dividerMat);
      this.roadDividerMesh.frustumCulled = false;
      this.scene.add(this.roadDividerMesh);
    } else if (!neon && this.roadDividerMesh) {
      this.scene.remove(this.roadDividerMesh);
      this.roadDividerMesh.geometry.dispose();
      (this.roadDividerMesh.material as THREE.Material).dispose();
      this.roadDividerMesh = undefined;
    }
  }

  /** Rebuild the ground/skirt textures when the city (and its palette) changes. */
  private rebuildGroundForCity() {
    const neon = this.city === 'neon_city';
    const newTex = neon ? createNeonGroundTexture() : createVeldTexture();
    newTex.wrapS = THREE.RepeatWrapping;
    newTex.wrapT = THREE.RepeatWrapping;
    newTex.repeat.set(2, 12);
    if (this.shoulderTexture) this.shoulderTexture.dispose();
    this.shoulderTexture = newTex;

    // Swap the material maps in place — geometry (bending vertices) is unchanged.
    if (this.shoulderMaterial) this.shoulderMaterial.map = newTex;
    if (this.skirtMaterial) this.skirtMaterial.map = newTex;
    if (this.farMaterial) {
      // Far plane gets its own texture with a wider repeat for the horizon.
      const farTex = neon ? createNeonGroundTexture() : createVeldTexture();
      farTex.wrapS = THREE.RepeatWrapping;
      farTex.wrapT = THREE.RepeatWrapping;
      farTex.repeat.set(24, 14);
      this.farMaterial.map = farTex;
    }

    // The ground bed itself becomes the 5-lane asphalt road on Neon City,
    // or reverts to the wide ballast bed on the rail routes.
    this.rebuildGroundBedForCity(neon);
  }

  /** Swap the ground bed geometry and texture between ballast and road. */
  private rebuildGroundBedForCity(neon: boolean) {
    if (!this.groundMesh) return;
    const oldGeo = this.groundMesh.geometry;
    const newGeo = neon
      ? this.createRoadGeometry(70, 6, (getLaneCount(this.city) / 2) * LANE_WIDTH)
      : this.createGroundGeometry(70, 4);
    this.groundMesh.geometry = newGeo;
    oldGeo.dispose();

    if (neon) {
      // Unlit material: renders the asphalt exactly as drawn — dark wet
      // tarmac with crisp cyan dashed dividers and magenta edges — immune
      // to the violet night lighting that washes lit materials into a haze.
      this.roadTexture?.dispose();
      const roadTex = createNeonRoadTexture();
      roadTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.roadTexture = roadTex;
      const basic = this.roadBasicMat ??= new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      basic.map = roadTex;
      basic.needsUpdate = true;
      this.groundMesh.material = basic;
    } else {
      this.roadTexture?.dispose();
      this.roadTexture = undefined;
      this.groundMesh.material = this.ballastMaterial ?? this.groundMesh.material;
    }
  }

  public setCharacter(characterId: CharacterId, color?: string) {
    this.characterId = characterId;
    if (color) this.characterOutfit = color;
    // Load the selected character's powers (extra lives, sneaker duration,
    // bonus weapon uses). Lives reset here and at each run start.
    const info = CHARACTERS.find((c) => c.id === characterId);
    this.characterPowers = {
      extraLives: info?.extraLives ?? 0,
      sneakerDurationMult: info?.sneakerDurationMult ?? 1,
      weaponExtraUses: info?.weaponExtraUses ?? 0,
    };
    if (this.playerModel) {
      this.scene.remove(this.playerModel.group);
    }
    this.playerModel = createCharacterModel(this.characterId, this.characterOutfit);
    if (this.isTitleLooping || !this.isRunning) {
      this.playerModel.group.rotation.y = Math.PI - 0.28;
    }
    this.updatePlayerHoverboardMesh();
    this.scene.add(this.playerModel.group);
  }

  public setCharacterOutfit(color: string) {
    this.characterOutfit = color;
    if (this.playerModel) {
      this.scene.remove(this.playerModel.group);
    }
    this.playerModel = createCharacterModel(this.characterId, this.characterOutfit);
    if (this.isTitleLooping || !this.isRunning) {
      this.playerModel.group.rotation.y = Math.PI - 0.28;
    }
    this.updatePlayerHoverboardMesh();
    this.scene.add(this.playerModel.group);
  }

  public setCustomGltfModel(
    gltfScene: THREE.Group,
    animations: THREE.AnimationClip[] = [],
    name: string = 'Custom 3D Runner'
  ) {
    if (this.playerModel) {
      this.scene.remove(this.playerModel.group);
    }
    this.playerModel = createCustomGltfCharacter(gltfScene, animations);
    if (this.isTitleLooping || !this.isRunning) {
      this.playerModel.group.rotation.y = Math.PI - 0.28;
    }
    this.updatePlayerHoverboardMesh();
    this.scene.add(this.playerModel.group);
    this.triggerSplash(`${name.toUpperCase()} LOADED!`, 'wow');
  }

  private hoverboardId: string = 'kasi_cruiser';

  public setHoverboard(boardId: string) {
    this.hoverboardId = boardId;
    this.updatePlayerHoverboardMesh();
  }

  // ── Weapon system ──────────────────────────────────────────────

  /** Player triggers the weapon (double-tap / space): DRAW it if ready.
   * While drawn, obstacles are auto-smashed on collision. When uses run out,
   * the weapon is holstered and its cooldown starts; after the cooldown the
   * player must double-tap again to draw it. */
  public useWeapon() {
    if (this.weaponCooldownLeft > 0) {
      this.triggerSplash('RECHARGING!', 'pow');
      sound.playLaneSwitch(); // soft denied blip
      return;
    }
    if (this.weaponDrawn) return; // already drawn
    // DRAW!
    this.weaponDrawn = true;
    // Character power (Sting Ray): +1 weapon hit — only when a weapon is
    // equipped (weaponId !== 'none' is implicit: can't draw none).
    this.weaponUsesLeft = getWeaponById(this.weaponId).uses + this.characterPowers.weaponExtraUses;
    if (this.weaponRig) this.weaponRig.group.visible = true;
    this.weaponSwingAnimator?.trigger();
    sound.playWeaponSwing(this.weaponId);
    this.triggerSplash('WEAPON OUT!', 'power');
    if (navigator.vibrate) navigator.vibrate([20, 15, 25]);
  }

  /** Select a weapon; holstered until the player draws it in a run. */
  public setWeapon(weaponId: WeaponId) {
    this.weaponId = weaponId;
    this.weaponUsesLeft = getWeaponById(weaponId).uses;
    this.weaponCooldownLeft = 0;
    this.weaponDrawn = false;
    this.attachWeaponModel();
  }

  public getWeaponState() {
    const w = getWeaponById(this.weaponId);
    return {
      id: this.weaponId,
      usesLeft: this.weaponUsesLeft,
      usesMax: w.uses,
      cooldownLeft: Math.max(0, Math.ceil(this.weaponCooldownLeft)),
      cooldown: w.cooldown,
      drawn: this.weaponDrawn,
      ready: !this.weaponDrawn && this.weaponCooldownLeft <= 0,
    };
  }

  /** (Re)create the weapon mesh in the player's right hand. */
  private attachWeaponModel() {
    if (!this.playerModel?.rightArm) return;
    // Remove previous
    if (this.weaponRig) {
      this.weaponRig.group.parent?.remove(this.weaponRig.group);
      this.weaponRig = null;
    }
    // "No weapon" option: nothing attached, auto-smash disabled
    if (this.weaponId === 'none') {
      this.weaponSwingAnimator = null;
      return;
    }
    this.weaponRig = createWeaponModel(this.weaponId);
    // Right-hand hold: weapon pivot sits at hand height below the arm pivot
    this.weaponRig.group.position.set(0.1, -0.55, 0.08);
    this.weaponRig.group.rotation.set(0.2, 0, -0.3);
    // Holstered until drawn via double-tap/space
    this.weaponRig.group.visible = this.weaponDrawn;
    this.playerModel.rightArm.add(this.weaponRig.group);
    this.weaponSwingAnimator = new WeaponSwingAnimator(this.weaponRig.swingPivot);
  }

  /** Attempt to smash an obstacle. Only works while the weapon is DRAWN. */
  private tryWeaponSmash(obs: { group: THREE.Group; type: string }): boolean {
    // Trains are invincible to all weapons
    if (obs.type === 'train') return false;
    if (!this.weaponDrawn) return false; // holstered: no auto-smash
    if (this.weaponCooldownLeft > 0) return false;
    if (this.weaponUsesLeft <= 0) return false;

    // SMASH!
    this.scene.remove(obs.group);
    this.weaponUsesLeft--;
    this.triggerSplash(['SMASH!', 'KAPOW!', 'WHACK!'][Math.floor(Math.random() * 3)], 'boom');
    sound.playWeaponSwing(this.weaponId);
    if (navigator.vibrate) navigator.vibrate([30, 20, 40]);
    this.weaponSwingAnimator?.trigger();

    if (this.weaponUsesLeft <= 0) {
      // Uses exhausted: holster the weapon and start the cooldown
      this.weaponDrawn = false;
      if (this.weaponRig) this.weaponRig.group.visible = false;
      this.weaponCooldownLeft = getWeaponById(this.weaponId).cooldown;
      this.triggerSplash('RECHARGING!', 'pow');
    }
    return true;
  }

  private updateWeapon(dt: number) {
    if (this.weaponCooldownLeft > 0) {
      this.weaponCooldownLeft = Math.max(0, this.weaponCooldownLeft - dt);
      // Note: cooldown end does NOT auto-draw — player must double-tap again.
    }
    // Chainsaw: chain-drive slide along the bar while drawn + swing animation tick
    if (this.weaponRig?.blade && this.weaponDrawn) {
      this.chainSpin += dt * 3.0;
      this.weaponRig.blade.position.z = 0.6 + ((this.chainSpin % 0.1) - 0.05) * 0.5;
    }
    this.weaponSwingAnimator?.tick(dt);
  }

  public updatePlayerHoverboardMesh() {
    if (!this.playerModel || !this.playerModel.hoverboardMesh) return;
    const mesh = this.playerModel.hoverboardMesh;
    mesh.clear();

    // v5 rideable art installs itself when loaded, including when the menu is open.
    const modeledBoard = this.hoverboardId === 'kasi_cruiser' ? 'kasi_cruiser'
      : this.hoverboardId === 'bmx_bicycle' ? 'bmx_bicycle'
      : this.hoverboardId === 'electric_scooter' ? 'electric_scooter'
      : null;
    if (modeledBoard) {
      const target: [number, number, number] = modeledBoard === 'bmx_bicycle'
        ? [0.85, 1.45, 2.5]
        : modeledBoard === 'electric_scooter' ? [0.75, 1.4, 1.7]
          : [0.95, 0.35, 1.9];
      const model = assetManager.instantiate(modeledBoard, { targetDimensions: target });
      model.rotation.y = Math.PI;
      model.position.y = -0.08;
      mesh.add(model);
      return;
    }

    // Default procedural deck
    const isToxicSkull = this.hoverboardId === 'skull_skateboard';
    const deckColor = isToxicSkull ? 0x18181b : 0x059669;
    const rimColor = isToxicSkull ? 0x84cc16 : 0x34d399;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.08, 1.8),
      new THREE.MeshStandardMaterial({
        color: deckColor,
        roughness: 0.25,
        metalness: isToxicSkull ? 0.4 : 0.6,
      })
    );
    const neonRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: rimColor })
    );
    neonRim.rotation.x = Math.PI / 2;
    neonRim.position.y = -0.02;

    const thrusterL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 0.25, 12),
      new THREE.MeshStandardMaterial({ color: isToxicSkull ? 0x1f2937 : 0x334155, metalness: 0.8 })
    );
    thrusterL.rotation.x = Math.PI / 2;
    thrusterL.position.set(-0.3, -0.08, -0.75);
    const thrusterR = thrusterL.clone();
    thrusterR.position.x = 0.3;

    mesh.add(deck, neonRim, thrusterL, thrusterR);
  }

  private triggerSplash(text: string, style: ComicSplashStyle, x?: number, y?: number) {
    this.callbacks.onSplashText?.(text, style, x, y);
  }

  private setupSkyAndLighting() {
    const cfg = CITIES[this.city];
    this.scene.background = new THREE.Color(cfg.skyColor);
    // Soweto gets a softer haze and warmer golden highveld sunlight (the
    // township art direction: dust-bath afternoon, painted murals glowing);
    // other cities keep the standard arcade density.
    const fogDensity = this.city === 'soweto' ? 0.009 : this.city === 'neon_city' ? 0.011 : 0.016;
    this.scene.fog = new THREE.FogExp2(cfg.fogColor, fogDensity);

    // Clear old lights if updating city
    const oldLights = this.scene.children.filter((c) => c instanceof THREE.Light);
    oldLights.forEach((l) => this.scene.remove(l));

    if (this.city === 'neon_city') {
      // CYBERPUNK NIGHT: dim cool moonlight, violet rim, and neon fills.
      const moonLight = new THREE.DirectionalLight(0x8b9dc9, 0.55);
      moonLight.position.set(15, 30, 20);
      moonLight.castShadow = !this.isSoftwareGl;
      if (!this.isSoftwareGl) {
        moonLight.shadow.mapSize.width = 1024;
        moonLight.shadow.mapSize.height = 1024;
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 80;
        moonLight.shadow.camera.left = -15;
        moonLight.shadow.camera.right = 15;
        moonLight.shadow.camera.top = 20;
        moonLight.shadow.camera.bottom = -10;
        moonLight.shadow.bias = -0.0005;
      }
      this.scene.add(moonLight);

      // Violet rim light from behind (city glow)
      const cityGlow = new THREE.DirectionalLight(0xa855f7, 0.9);
      cityGlow.position.set(-12, 18, -30);
      this.scene.add(cityGlow);

      // Cyan underglow from the street
      const underglow = new THREE.HemisphereLight(0x22d3ee, 0x1e1b4b, 0.7);
      this.scene.add(underglow);

      // Warm neon accent light near the player
      const neonAccent = new THREE.PointLight(0xf472b6, 10, 30, 1.6);
      neonAccent.position.set(6, 8, -10);
      this.scene.add(neonAccent);
      return;
    }

    // Warm Sun Key Light
    const sunLight = new THREE.DirectionalLight(this.city === 'soweto' ? 0xffdfac : 0xfff7ed, 1.6);
    sunLight.position.set(15, 30, 20);
    sunLight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 80;
      sunLight.shadow.camera.left = -15;
      sunLight.shadow.camera.right = 15;
      sunLight.shadow.camera.top = 20;
      sunLight.shadow.camera.bottom = -10;
      sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(sunLight);

    // Warm Golden Rim / Backlight for cinematic edge definition on character & trains
    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.75);
    rimLight.position.set(-15, 22, -25);
    this.scene.add(rimLight);

    // Cool Sky & Warm Earth Fill
    const hemiLight = new THREE.HemisphereLight(cfg.skyColor, 0x475569, 0.85);
    this.scene.add(hemiLight);
  }

  private setupScene() {
    this.setupSkyAndLighting();

    // High-Fidelity Ballast Gravel Ground Bed (Segmented for procedural bending).
    // On Neon City the bed is rebuilt as the 5-lane asphalt road below.
    this.ballastTexture = createBallastTexture();
    const neonInit = this.city === 'neon_city';
    const groundGeo = this.createGroundGeometry(70, 4);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.ballastTexture,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
    this.ballastMaterial = groundMat;
    if (neonInit) {
      // Engine constructed directly into Neon City (persisted city save):
      // swap the bed to the 5-lane unlit asphalt road immediately.
      this.rebuildGroundBedForCity(true);
    }

    // Green veld-grass shoulder strips hugging the rails (x = ±7.5 to ±30).
    // They bend with the track like the ballast, and use the same veld texture
    // as the horizon skirts so the ground reads as one continuous landscape.
    // Neon City gets a glowing circuit-grid ground instead of grass.
    this.shoulderTexture = this.city === 'neon_city' ? createNeonGroundTexture() : createVeldTexture();
    this.shoulderTexture.wrapS = THREE.RepeatWrapping;
    this.shoulderTexture.wrapT = THREE.RepeatWrapping;
    this.shoulderTexture.repeat.set(2, 12);
    const shoulderMat = new THREE.MeshStandardMaterial({
      map: this.shoulderTexture,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const shoulderGeoL = this.createGroundGeometry(70, 1);
    this.shoulderMeshL = new THREE.Mesh(shoulderGeoL, shoulderMat);
    this.shoulderMeshL.receiveShadow = true;
    this.shoulderMeshL.frustumCulled = false;
    const shoulderGeoR = this.createGroundGeometry(70, 1);
    this.shoulderMeshR = new THREE.Mesh(shoulderGeoR, shoulderMat);
    this.shoulderMeshR.receiveShadow = true;
    this.shoulderMeshR.frustumCulled = false;
    this.scene.add(this.shoulderMeshL, this.shoulderMeshR);
    this.shoulderMaterial = shoulderMat;

    // Side terrain skirts + far ground plane: fills the blue-sky gap beyond the
    // ballast bed (x = ±22) out to the horizon with veld-grass colors.
    // They share the shoulder texture so the horizon blends seamlessly.
    const skirtTexture = this.shoulderTexture;
    const skirtMat = new THREE.MeshStandardMaterial({ map: skirtTexture, roughness: 0.95, metalness: 0 });
    this.skirtMaterial = skirtMat;
    const skirtGeo = new THREE.PlaneGeometry(160, 320);
    const skirtL = new THREE.Mesh(skirtGeo, skirtMat);
    skirtL.rotation.x = -Math.PI / 2;
    skirtL.position.set(-95, -0.05, -110);
    const skirtR = new THREE.Mesh(skirtGeo, skirtMat);
    skirtR.rotation.x = -Math.PI / 2;
    skirtR.position.set(95, -0.05, -110);
    this.scene.add(skirtL, skirtR);

    // Far fill plane under everything at the horizon (matches fog/sky line).
    // Own texture clone so its repeat/scale can differ from the skirts.
    const farTexture = this.city === 'neon_city' ? createNeonGroundTexture() : createVeldTexture();
    farTexture.repeat.set(24, 14);
    const farGeo = new THREE.PlaneGeometry(600, 320);
    const farMat = new THREE.MeshStandardMaterial({ map: farTexture, roughness: 1, metalness: 0 });
    this.farMaterial = farMat;
    const farPlane = new THREE.Mesh(farGeo, farMat);
    farPlane.rotation.x = -Math.PI / 2;
    farPlane.position.set(0, -0.12, -280);
    this.scene.add(farPlane);

    const curbsGeo = this.createCurbsGeometry(2, 70);
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    this.curbsMesh = new THREE.Mesh(curbsGeo, curbMat);
    this.scene.add(this.curbsMesh);

    // 6 Shiny Steel Rails (Left & Right rail across 3 lanes, segmented for procedural bending)
    const railsGeo = this.createRailsGeometry(6, 70);
    const railsMat = new THREE.MeshStandardMaterial({
      color: 0xc8d1dc,
      metalness: 0.9,
      roughness: 0.18,
      side: THREE.DoubleSide,
    });
    this.railsMesh = new THREE.Mesh(railsGeo, railsMat);
    this.scene.add(this.railsMesh);

    // Temporary bonus-lane rails (Soweto only): a pair of rails shown when a
    // bonus lane opens. Gold-tinted so it reads as a special lane from afar.
    const bonusRailsGeo = this.createRailsGeometry(2, 70);
    this.bonusRailsMesh = new THREE.Mesh(bonusRailsGeo, new THREE.MeshStandardMaterial({
      color: 0xffd766,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide,
    }));
    this.bonusRailsMesh.visible = false;
    this.bonusRailsMesh.frustumCulled = false;
    this.scene.add(this.bonusRailsMesh);

    // Bonus-lane sleepers: same look as the main track's ties, matched to the
    // gold rails, so the bonus lane reads as a REAL railway lane.
    const BONUS_TIE_COUNT = 133;
    const bonusTieGeo = new THREE.BoxGeometry(2.1, 0.08, 0.35);
    const bonusTieMat = new THREE.MeshStandardMaterial({ color: 0x8a6a1f, roughness: 0.8 });
    this.bonusTiesMesh = new THREE.InstancedMesh(bonusTieGeo, bonusTieMat, BONUS_TIE_COUNT);
    this.bonusTiesMesh.visible = false;
    this.bonusTiesMesh.frustumCulled = false;
    this.scene.add(this.bonusTiesMesh);

    // Bonus-lane switch beacon: a glowing marker shown in the distance at the
    // point where the bonus lane opens, so the player sees it coming.
    const beaconGeo = new THREE.ConeGeometry(0.5, 1.4, 8);
    this.bonusBeaconMesh = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd766, fog: false })
    );
    this.bonusBeaconMesh.rotation.x = Math.PI; // point down, like a signal lamp
    this.bonusBeaconMesh.visible = false;
    this.scene.add(this.bonusBeaconMesh);

    // Side fences: repeating chain-link panels (low-poly pack asset) on the
    // side WITHOUT an active bonus lane, just outside the last permanent lane.
    // Panels are placed/oriented per-frame along the track curve. The asset
    // loads asynchronously — start with empty arrays, fill when it arrives.
    this.bonusSideFenceL = [];
    this.bonusSideFenceR = [];
    const FENCE_PANELS = 40;
    assetManager.loadModel('chain_link_fence', 0).then((template) => {
      // TEMP DEBUG
      document.body.dataset.fenceDebug = template ? 'loaded' : 'load-failed';
      if (!template) return;
      // Re-center the template on its bounding box (the pack model's origin
      // sits off to the side) and normalize its size to fence-line dimensions.
      const box = new THREE.Box3().setFromObject(template);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const wrapper = new THREE.Group();
      template.position.set(-center.x, -box.min.y, -center.z);
      wrapper.add(template);
      const targetW = 4.6; // span between posts
      const s = targetW / (size.x || 1);
      wrapper.scale.setScalar(s);
      wrapper.updateMatrixWorld(true);
      for (const arr of [this.bonusSideFenceL, this.bonusSideFenceR]) {
        for (let i = 0; i < FENCE_PANELS; i++) {
          // Clone the WRAPPER (which carries the re-centering offset + scale),
          // not the raw template — otherwise every panel loses both.
          const panel = wrapper.clone(true);
          panel.visible = false;
          this.scene.add(panel);
          arr.push(panel);
        }
      }
    });

    // Railway Sleepers / Ties (InstancedMesh updated along curved tracks)
    const TOTAL_TIES = 133 * 3;
    const tieGeo = new THREE.BoxGeometry(2.1, 0.08, 0.35);
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    this.tiesInstancedMesh = new THREE.InstancedMesh(tieGeo, tieMat, TOTAL_TIES);
    this.scene.add(this.tiesInstancedMesh);

    // Initial positioning of track curvature
    this.updateTrackCurvature();

    // City-specific track surface (asphalt road on Neon City) + road mesh
    this.applyTrackSurfaceForCity();
    this.ensureRoadForCity();

    // Overhead catenary wire gantries
    this.catenaryInstances = new THREE.Group();
    for (let z = 10; z >= -220; z -= 35) {
      const gantry = this.createCatenaryGantry();
      gantry.position.z = z;
      this.catenaryInstances.add(gantry);
    }
    this.scene.add(this.catenaryInstances);

    // Dynamic Roadside Scenery Group (Bespoke buildings, vehicles, flora & comic signs)
    this.scene.add(this.sideSceneryGroup);
    this.initSideScenery();

    // Scattered rocks & shrubs across the grass shoulders
    this.scene.add(this.veldPropsGroup);
    this.initVeldProps();

    // South Africa Landmark distant backdrop
    this.landmarkGroup = createLandmarkMesh(this.city);
    this.landmarkGroup.position.z = this.landmarkZ = -320;
    this.scene.add(this.landmarkGroup);

    // Player Model
    this.playerModel = createCharacterModel(this.characterId, this.characterOutfit);
    this.scene.add(this.playerModel.group);

    // Inspector & Dog Model
    this.inspectorModel = createInspectorModel();
    this.inspectorModel.group.position.set(0, 0, this.inspectorOffsetZ);
    this.scene.add(this.inspectorModel.group);

    // Particle System Group
    this.scene.add(this.particleGroup);

    // Resize handler — keep the HORIZONTAL view constant across aspect ratios:
    // with a fixed vertical FOV, portrait phones see too little to the sides and
    // the player disappears when moving to the outer lanes (a real bug on
    // Android portrait). Solving for FOV from a reference horizontal width keeps
    // the lanes visible on any screen shape.
    const REF_FOV = 70;
    const applyCameraFraming = (w: number, h: number) => {
      const aspect = w / h;
      this.camera.aspect = aspect;
      // hFov = 2*atan(tan(vFov/2)*aspect)  =>  vFov = 2*atan(tan(hFov/2)/aspect)
      const hFov = 2 * Math.atan(Math.tan((REF_FOV * Math.PI) / 360) * (16 / 9));
      const targetVFov = (2 * Math.atan(Math.tan(hFov / 2) / aspect) * 180) / Math.PI;
      // Portrait needs a wider vertical FOV to preserve the horizontal view.
      // Cap the widening so distant details don't shrink too much.
      const clamped = Math.min(REF_FOV + 10, Math.max(REF_FOV, targetVFov));
      this.camera.fov = clamped;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    const onResize = () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      applyCameraFraming(w, h);
    };
    applyCameraFraming(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    this.cleanupListeners = () => {
      window.removeEventListener('resize', onResize);
    };
  }

  private createCatenaryGantry(): THREE.Group {
    const gantry = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });

    // Wide side pillars set well outside track curbs (track curbs at ±5.2)
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 8.2, 0.2), metalMat);
    pillarL.position.set(-7.8, 4.1, 0);

    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 8.2, 0.2), metalMat);
    pillarR.position.set(7.8, 4.1, 0);

    // Overhead truss beam spanning 16.2 units
    const beam = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.25, 0.25), metalMat);
    beam.position.set(0, 8.1, 0);

    gantry.add(pillarL, pillarR, beam);
    return gantry;
  }

  private createGroundGeometry(segZ: number, segX: number): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const numVerts = (segX + 1) * (segZ + 1);
    const positions = new Float32Array(numVerts * 3);
    const uvs = new Float32Array(numVerts * 2);
    const indices: number[] = [];

    let uvIdx = 0;
    for (let i = 0; i <= segZ; i++) {
      const v = (i / segZ) * 35;
      for (let c = 0; c <= segX; c++) {
        const u = (c / segX) * 6;
        uvs[uvIdx++] = u;
        uvs[uvIdx++] = v;
      }
    }

    for (let i = 0; i < segZ; i++) {
      for (let c = 0; c < segX; c++) {
        const row1 = i * (segX + 1);
        const row2 = (i + 1) * (segX + 1);
        const a = row1 + c;
        const b = row1 + c + 1;
        const d = row2 + c;
        const e = row2 + c + 1;

        indices.push(a, b, d);
        indices.push(b, e, d);
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  /**
   * Neon City road surface geometry: segX=6 columns whose U coords are pinned
   * so the road texture's 4 lane-divider lines (at U = 1/5, 2/5, 3/5, 4/5 of
   * the texture) land exactly between the 5 lanes. Vertex X positions are set
   * each frame in updateTrackCurvature, offset around the track centerline.
   */
  private createRoadGeometry(segZ: number, segX: number, halfWidth: number): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const numVerts = (segX + 1) * (segZ + 1);
    const positions = new Float32Array(numVerts * 3);
    const uvs = new Float32Array(numVerts * 2);
    const indices: number[] = [];

    // Column X fractions of half-width: dividers between lanes must map to
    // texture U = k/5. With roadHalfW = 2.9*LANE_WIDTH, lane edges (dividers)
    // sit at ±0.5, ±1.5 lanes → offset fractions: (laneOff/ (halfW))/2 + 0.5 in U.
    // We simply lay 7 evenly spaced columns from -halfWidth to +halfWidth and
    // give U proportional to X so the texture's dividers align with lanes.
    let uvIdx = 0;
    for (let i = 0; i <= segZ; i++) {
      const v = (i / segZ) * 34; // matches roadTex.repeat.y = 34
      for (let c = 0; c <= segX; c++) {
        const frac = c / segX;            // 0..1 across road
        uvs[uvIdx++] = frac;              // U 0..1 (texture draws dividers at 1/5..4/5)
        uvs[uvIdx++] = v;
      }
    }

    for (let i = 0; i < segZ; i++) {
      for (let c = 0; c < segX; c++) {
        const row1 = i * (segX + 1);
        const row2 = (i + 1) * (segX + 1);
        indices.push(row1 + c, row1 + c + 1, row2 + c);
        indices.push(row1 + c + 1, row2 + c + 1, row2 + c);
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  /**
   * Bonus-side fence geometry: two segmented beams (top rail + bottom rail)
   * bent along the track, matching createRailsGeometry(2, segZ)'s layout.
   */
  private createFenceGeometry(segZ: number): THREE.BufferGeometry {
    return this.createRailsGeometry(2, segZ);
  }

  private createRailsGeometry(numRails: number, segZ: number): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const vertsPerRail = (segZ + 1) * 4;
    const totalVerts = numRails * vertsPerRail;
    const positions = new Float32Array(totalVerts * 3);
    const indices: number[] = [];

    for (let r = 0; r < numRails; r++) {
      const baseRailVert = r * vertsPerRail;
      for (let i = 0; i < segZ; i++) {
        const curr = baseRailVert + i * 4;
        const next = baseRailVert + (i + 1) * 4;

        // Quad 1: Inner side
        indices.push(curr + 0, curr + 1, next + 1);
        indices.push(curr + 0, next + 1, next + 0);

        // Quad 2: Top face
        indices.push(curr + 1, curr + 2, next + 2);
        indices.push(curr + 1, next + 2, next + 1);

        // Quad 3: Outer side
        indices.push(curr + 2, curr + 3, next + 3);
        indices.push(curr + 2, next + 3, next + 2);
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }

  private createCurbsGeometry(numCurbs: number, segZ: number): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const vertsPerCurb = (segZ + 1) * 4;
    const totalVerts = numCurbs * vertsPerCurb;
    const positions = new Float32Array(totalVerts * 3);
    const indices: number[] = [];

    for (let c = 0; c < numCurbs; c++) {
      const baseCurbVert = c * vertsPerCurb;
      for (let i = 0; i < segZ; i++) {
        const curr = baseCurbVert + i * 4;
        const next = baseCurbVert + (i + 1) * 4;

        // Quad 1: Inner side
        indices.push(curr + 0, curr + 1, next + 1);
        indices.push(curr + 0, next + 1, next + 0);

        // Quad 2: Top surface
        indices.push(curr + 1, curr + 2, next + 2);
        indices.push(curr + 1, next + 2, next + 1);

        // Quad 3: Outer face
        indices.push(curr + 2, curr + 3, next + 3);
        indices.push(curr + 2, next + 3, next + 2);
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }

  public updateTrackCurvature() {
    if (!this.groundMesh || !this.railsMesh || !this.curbsMesh || !this.tiesInstancedMesh) return;

    const SEG_Z = 70;
    const startZ = 25;
    const endZ = -255;
    const stepZ = (endZ - startZ) / SEG_Z; // -4.0 units per slice

    // 1. Update Ground Mesh Vertices
    // On Neon City the bed IS the road: 7 columns at the exact lane boundaries
    // (±2.5, ±1.5, ±0.5 lanes + center) so the texture's divider lines align.
    const isRoad = !!this.roadTexture;
    const groundCols = isRoad ? 6 : 4;
    const groundHalfW = isRoad ? (getLaneCount(this.city) / 2) * LANE_WIDTH : 22;
    const groundPos = this.groundMesh.geometry.attributes.position as THREE.BufferAttribute;
    const gArray = groundPos.array as Float32Array;
    let gIdx = 0;
    for (let i = 0; i <= SEG_Z; i++) {
      const z = startZ + i * stepZ;
      const cx = getTrackCurveX(z, this.distance, this.city);
      const angle = getTrackCurveAngle(z, this.distance, this.city);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      for (let c = 0; c <= groundCols; c++) {
        const baseX = isRoad
          ? -groundHalfW + (c / groundCols) * groundHalfW * 2
          : -22 + c * 11; // Spans width: -22, -11, 0, 11, 22
        gArray[gIdx++] = cx + baseX * cosA;
        gArray[gIdx++] = 0.0;
        gArray[gIdx++] = z - baseX * sinA;
      }
    }
    groundPos.needsUpdate = true;

    // Scroll ballast / road texture seamlessly with distance
    const scrollTex = this.roadTexture ?? this.ballastTexture;
    if (scrollTex) {
      scrollTex.offset.y = -(this.distance * 0.04) % 1;
    }

    // 1b. Update Dirt Shoulder Strips (x = ±22 to ±32, bending with the track)
    if (this.shoulderMeshL && this.shoulderMeshR) {
      for (const mesh of [this.shoulderMeshL, this.shoulderMeshR]) {
        const sideSign = mesh === this.shoulderMeshL ? -1 : 1;
        const sPos = mesh.geometry.attributes.position as THREE.BufferAttribute;
        const sArray = sPos.array as Float32Array;
        let sIdx = 0;
        for (let i = 0; i <= SEG_Z; i++) {
          const z = startZ + i * stepZ;
          const cx = getTrackCurveX(z, this.distance, this.city);
          const angle = getTrackCurveAngle(z, this.distance, this.city);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
        for (let c = 0; c <= 1; c++) {
          // Veld starts beside the rails (±7.5). On Neon City the road spans
          // ±2.5 lanes (±6.5 world units) — the grid ground must start beyond
          // the road edge or it covers the outer lanes.
          const inner = this.city === 'neon_city' ? 6.6 : 7.5;
          const baseX = sideSign * (inner + c * (this.city === 'neon_city' ? 23.4 : 22.5));
          sArray[sIdx++] = cx + baseX * cosA;
          sArray[sIdx++] = 0.02;
          sArray[sIdx++] = z - baseX * sinA;
        }
        }
        sPos.needsUpdate = true;
        // Recompute normals each frame so the dirt texture is lit correctly
        mesh.geometry.computeVertexNormals();
      }
    }
    // Scroll dirt shoulder texture with distance
    if (this.shoulderTexture) {
      this.shoulderTexture.offset.y = -(this.distance * 0.04) % 1;
    }

    // Scroll road/ballast texture with distance (road handled in section 1)
    if (this.roadTexture) {
      this.roadTexture.offset.y = -(this.distance * 0.04) % 1;
    }

    // 2b. Update glowing lane divider strips (4 dividers + 2 edges = 6 strips)
    if (this.roadDividerMesh) {
      const stripPos = this.roadDividerMesh.geometry.attributes.position as THREE.BufferAttribute;
      const stripArr = stripPos.array as Float32Array;
      let stripIdx = 0;
      const halfStripW = 0.035;
      // 4 dividers between the 5 lanes (at ±0.5, ±1.5 lanes) + 2 edges (±2.5)
      // = exactly 6 strips, matching createRailsGeometry(6, 70).
      const stripOffsets = [
        -1.5 * LANE_WIDTH, -0.5 * LANE_WIDTH, // left dividers
        0.5 * LANE_WIDTH, 1.5 * LANE_WIDTH,   // right dividers
        -2.5 * LANE_WIDTH, 2.5 * LANE_WIDTH,  // road edges
      ];
      for (const baseOff of stripOffsets) {
        for (let i = 0; i <= SEG_Z; i++) {
          const z = startZ + i * stepZ;
          const cx = getTrackCurveX(z, this.distance, this.city);
          const angle = getTrackCurveAngle(z, this.distance, this.city);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const innerOff = baseOff - halfStripW;
          const outerOff = baseOff + halfStripW;
          stripArr[stripIdx++] = cx + innerOff * cosA;
          stripArr[stripIdx++] = 0.045;
          stripArr[stripIdx++] = z - innerOff * sinA;
          stripArr[stripIdx++] = cx + innerOff * cosA;
          stripArr[stripIdx++] = 0.055;
          stripArr[stripIdx++] = z - innerOff * sinA;
          stripArr[stripIdx++] = cx + outerOff * cosA;
          stripArr[stripIdx++] = 0.055;
          stripArr[stripIdx++] = z - outerOff * sinA;
          stripArr[stripIdx++] = cx + outerOff * cosA;
          stripArr[stripIdx++] = 0.045;
          stripArr[stripIdx++] = z - outerOff * sinA;
        }
      }
      stripPos.needsUpdate = true;
    }

    // 2. Update Rails Vertices (6 Rails across Left, Center, Right lanes)
    const railsPos = this.railsMesh.geometry.attributes.position as THREE.BufferAttribute;
    const rArray = railsPos.array as Float32Array;
    const railOffsets = [-3.35, -1.85, -0.75, 0.75, 1.85, 3.35];
    const halfRailW = 0.042;
    let rIdx = 0;

    for (let r = 0; r < 6; r++) {
      const baseOff = railOffsets[r];
      for (let i = 0; i <= SEG_Z; i++) {
        const z = startZ + i * stepZ;
        const cx = getTrackCurveX(z, this.distance, this.city);
        const angle = getTrackCurveAngle(z, this.distance, this.city);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const innerOff = baseOff - halfRailW;
        const outerOff = baseOff + halfRailW;

        const innerX = cx + innerOff * cosA;
        const innerZ = z - innerOff * sinA;
        const outerX = cx + outerOff * cosA;
        const outerZ = z - outerOff * sinA;

        // V0: Inner bottom
        rArray[rIdx++] = innerX;
        rArray[rIdx++] = 0.01;
        rArray[rIdx++] = innerZ;

        // V1: Inner top
        rArray[rIdx++] = innerX;
        rArray[rIdx++] = 0.12;
        rArray[rIdx++] = innerZ;

        // V2: Outer top
        rArray[rIdx++] = outerX;
        rArray[rIdx++] = 0.12;
        rArray[rIdx++] = outerZ;

        // V3: Outer bottom
        rArray[rIdx++] = outerX;
        rArray[rIdx++] = 0.01;
        rArray[rIdx++] = outerZ;
      }
    }
    railsPos.needsUpdate = true;

    // 2c. Update Soweto bonus-lane rails (a rail pair at lane ±2, gold-tinted).
    // During the closing-warn phase the rails blink to telegraph the shutdown.
    if (this.bonusRailsMesh) {
      const bonusActive = this.city === 'soweto' && this.bonusLaneSide !== 0;
      const blinkOff = this.bonusLaneClosing && Math.floor(this.animClock * 5) % 2 === 0;
      this.bonusRailsMesh.visible = bonusActive && !blinkOff;
      if (bonusActive) {
        const bPos = this.bonusRailsMesh.geometry.attributes.position as THREE.BufferAttribute;
        const bArr = bPos.array as Float32Array;
        const bonusCenter = this.bonusLaneSide * 2 * LANE_WIDTH;
        let bIdx = 0;
        for (const baseOff of [bonusCenter - 0.65, bonusCenter + 0.65]) {
          for (let i = 0; i <= SEG_Z; i++) {
            const z = startZ + i * stepZ;
            const cx = getTrackCurveX(z, this.distance, this.city);
            const angle = getTrackCurveAngle(z, this.distance, this.city);
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const innerOff = baseOff - halfRailW;
            const outerOff = baseOff + halfRailW;
            bArr[bIdx++] = cx + innerOff * cosA; bArr[bIdx++] = 0.01; bArr[bIdx++] = z - innerOff * sinA;
            bArr[bIdx++] = cx + innerOff * cosA; bArr[bIdx++] = 0.12; bArr[bIdx++] = z - innerOff * sinA;
            bArr[bIdx++] = cx + outerOff * cosA; bArr[bIdx++] = 0.12; bArr[bIdx++] = z - outerOff * sinA;
            bArr[bIdx++] = cx + outerOff * cosA; bArr[bIdx++] = 0.01; bArr[bIdx++] = z - outerOff * sinA;
          }
        }
        bPos.needsUpdate = true;
      }
    }

    // 3. Update Curbs Vertices (2 Retaining Curbs: Left at -5.2, Right at +5.2)
    const curbsPos = this.curbsMesh.geometry.attributes.position as THREE.BufferAttribute;
    const cArray = curbsPos.array as Float32Array;
    let cIdx = 0;
    const curbOffsets = [-5.2, 5.2];
    const halfCurbW = 0.16;

    for (let curb = 0; curb < 2; curb++) {
      const centerOff = curbOffsets[curb];
      const isLeft = curb === 0;
      for (let i = 0; i <= SEG_Z; i++) {
        const z = startZ + i * stepZ;
        const cx = getTrackCurveX(z, this.distance, this.city);
        const angle = getTrackCurveAngle(z, this.distance, this.city);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const innerOff = isLeft ? centerOff + halfCurbW : centerOff - halfCurbW;
        const outerOff = isLeft ? centerOff - halfCurbW : centerOff + halfCurbW;

        const innerX = cx + innerOff * cosA;
        const innerZ = z - innerOff * sinA;
        const outerX = cx + outerOff * cosA;
        const outerZ = z - outerOff * sinA;

        // V0: Inner bottom
        cArray[cIdx++] = innerX;
        cArray[cIdx++] = 0.01;
        cArray[cIdx++] = innerZ;

        // V1: Inner top
        cArray[cIdx++] = innerX;
        cArray[cIdx++] = 0.15;
        cArray[cIdx++] = innerZ;

        // V2: Outer top
        cArray[cIdx++] = outerX;
        cArray[cIdx++] = 0.15;
        cArray[cIdx++] = outerZ;

        // V3: Outer bottom
        cArray[cIdx++] = outerX;
        cArray[cIdx++] = 0.01;
        cArray[cIdx++] = outerZ;
      }
    }
    curbsPos.needsUpdate = true;

    // 4. Update Sleepers / Ties (Instanced along curved track)
    const dummy = new THREE.Object3D();
    let tieIdx = 0;
    for (let z = 18; z >= -220; z -= 1.8) {
      const cx = getTrackCurveX(z, this.distance, this.city);
      const angle = getTrackCurveAngle(z, this.distance, this.city);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      for (let l = 0; l < 3; l++) {
        const laneOffset = LANES[l];
        const tx = cx + laneOffset * cosA;
        const tz = z - laneOffset * sinA;
        dummy.position.set(tx, 0.04, tz);
        dummy.rotation.set(0, angle, 0);
        dummy.updateMatrix();
        this.tiesInstancedMesh.setMatrixAt(tieIdx++, dummy.matrix);
      }
    }
    this.tiesInstancedMesh.instanceMatrix.needsUpdate = true;

    // 4b. Update bonus-lane sleepers + switch beacon (Soweto bonus lane)
    if (this.bonusTiesMesh && this.bonusBeaconMesh) {
      const bonusActive = this.city === 'soweto' && this.bonusLaneSide !== 0;
      const blinkOff = this.bonusLaneClosing && Math.floor(this.animClock * 5) % 2 === 0;
      this.bonusTiesMesh.visible = bonusActive && !blinkOff;
      if (bonusActive) {
        const bonusX = this.bonusLaneSide * 2 * LANE_WIDTH;
        let bTieIdx = 0;
        for (let z = 18; z >= -220; z -= 1.8) {
          const cx = getTrackCurveX(z, this.distance, this.city);
          const angle = getTrackCurveAngle(z, this.distance, this.city);
          const tx = cx + bonusX * Math.cos(angle);
          const tz = z - bonusX * Math.sin(angle);
          dummy.position.set(tx, 0.04, tz);
          dummy.rotation.set(0, angle, 0);
          dummy.updateMatrix();
          this.bonusTiesMesh.setMatrixAt(bTieIdx++, dummy.matrix);
        }
        this.bonusTiesMesh.instanceMatrix.needsUpdate = true;

      // Switch beacons: one bobbing near the player marking the lane entry,
      // the lane itself (gold rails + ties) extends to z = -220 so it is
      // clearly visible opening in the distance.
      const beaconZ = 14;
      const bcx = getTrackCurveX(beaconZ, this.distance, this.city);
      const bAngle = getTrackCurveAngle(beaconZ, this.distance, this.city);
      this.bonusBeaconMesh.visible = true;
      this.bonusBeaconMesh.position.set(
        bcx + bonusX * Math.cos(bAngle),
        2.2 + Math.sin(this.animClock * 4) * 0.25,
        beaconZ
      );
        this.bonusBeaconMesh.rotation.y = bAngle;
      } else {
        this.bonusBeaconMesh.visible = false;
      }
    }

    // 4c. Bonus-side fences (Soweto only): chain-link panels (the extracted
    // low-poly pack asset) placed at intervals along the track, each oriented
    // to the local track angle so the fence line follows the road's bends.
    // Shown on the side WITHOUT an open bonus lane.
    if (this.bonusSideFenceL && this.bonusSideFenceR) {
      const soweto = this.city === 'soweto';
      const fenceX = 1.75 * LANE_WIDTH; // just outside the outer permanent lane
      const sides: [THREE.Group[], -1 | 1][] = [[this.bonusSideFenceL, -1], [this.bonusSideFenceR, 1]];
      for (const [panels, side] of sides) {
        const show = soweto && this.bonusLaneSide !== side;
        for (const p of panels) p.visible = show;
        if (!show) continue;
        // Panel width is 4.6 (set at load); spacing slightly smaller so
        // consecutive panels overlap and there are no gaps between them.
        const panelW = 4.6;
        const spacing = panelW * 0.98;
        // Scroll: panels stream toward the player as the run advances and
        // wrap around, so the fence appears endless.
        const totalLen = panels.length * spacing;
        // Each panel slides forward; when it passes the camera it recycles to
        // the far end of the fence line.
        const scroll = (this.distance % spacing);
        for (let i = 0; i < panels.length; i++) {
          let z = 20 - i * spacing + scroll;
          if (z > 20) z -= totalLen; // recycle to the far end
          const cx = getTrackCurveX(z, this.distance, this.city);
          const angle = getTrackCurveAngle(z, this.distance, this.city);
          panels[i].position.set(cx + side * fenceX * Math.cos(angle), 0, z - side * fenceX * Math.sin(angle));
          // The panel spans its local X axis; rotating by angle alone points
          // that X across the track. Add PI/2 so the fence runs ALONG the road.
          panels[i].rotation.y = angle + Math.PI / 2;
        }
      }
    }
  }

  private setupInput() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let lastTapTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (!this.isRunning || this.isPaused) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();

      // Double Tap detection: draw the weapon
      const now = Date.now();
      if (now - lastTapTime < 320) {
        this.useWeapon();
      }
      lastTapTime = now;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!this.isRunning || this.isPaused) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;

      const minSwipeDist = 28;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal Swipe
        if (dx < -minSwipeDist) {
          this.moveLane(-1);
        } else if (dx > minSwipeDist) {
          this.moveLane(1);
        }
      } else {
        // Vertical Swipe
        if (dy < -minSwipeDist) {
          this.jump();
        } else if (dy > minSwipeDist) {
          this.roll();
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.isRunning || this.isPaused) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.moveLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.moveLane(1);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.jump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.roll();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        this.useWeapon();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    const prevCleanup = this.cleanupListeners;
    this.cleanupListeners = () => {
      prevCleanup();
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
    };
  }

  public moveLane(direction: number) {
    const nextLane = clampLane(this.targetLane + direction, this.city);
    // Bonus lane override: allow stepping out to the temporary side lane
    // (clampLane alone would cap at ±1, blocking lane ±2).
    const target = this.targetLane + direction;
    const bonusLane = this.bonusLaneSide * 2;
    if (this.city === 'soweto' && this.bonusLaneSide !== 0 && target === bonusLane && Math.abs(this.targetLane) <= 1) {
      this.targetLane = bonusLane;
      sound.playLaneSwitch();
      if (navigator.vibrate) navigator.vibrate(15);
      return;
    }
    if (nextLane !== this.targetLane) {
      this.targetLane = nextLane;
      sound.playLaneSwitch();
      if (navigator.vibrate) navigator.vibrate(15);
    }
  }

  public jump() {
    // Can jump if grounded on track or on top of train (not while jetpacking)
    if (!this.isJumping && this.powerups.jetpack <= 0) {
      this.isJumping = true;
      this.isRolling = false;
      const isSneakers = this.powerups.sneakers > 0;
      this.playerVy = isSneakers ? SNEAKER_JUMP_VELOCITY : JUMP_VELOCITY;
      sound.playJump(isSneakers);
      if (Math.random() < 0.75) {
        const jumpWords = ['HOP!', 'LEAP!', 'UP!', 'SPRING!'];
        this.triggerSplash(jumpWords[Math.floor(Math.random() * jumpWords.length)], 'zoom');
      }
      if (navigator.vibrate) navigator.vibrate(20);
    }
  }

  public roll() {
    this.isRolling = true;
    this.rollTimer = ROLL_DURATION;
    // Swipe-down cancels the jetpack and slams the player back to the ground
    if (this.powerups.jetpack > 0) {
      this.powerups.jetpack = 0;
      this.playerModel.jetpackMesh.visible = false;
      this.playerY = Math.max(this.playerY, 0.5); // ensure a clean descent start
      this.playerVy = -26.0; // hard dive
      this.triggerSplash('JETPACK OFF!', 'pow');
      sound.playSlide();
      if (navigator.vibrate) navigator.vibrate([25, 15, 25]);
      return;
    }
    // If airborne, dive down fast!
    if (this.isJumping) {
      this.playerVy = -18.0;
    }
    sound.playSlide();
    if (Math.random() < 0.75) {
      const rollWords = ['ZOOM!', 'SWOOSH!', 'SLIDE!'];
      this.triggerSplash(rollWords[Math.floor(Math.random() * rollWords.length)], 'zoom');
    }
    if (navigator.vibrate) navigator.vibrate(20);
  }

  public activateHoverboard() {
    if (!this.hasHoverboard) {
      this.hasHoverboard = true;
      this.hoverboardTimer = HOVERBOARD_DURATION;
      this.playerModel.hoverboardMesh.visible = true;
      this.triggerSplash("SURF'S UP!", 'power');
      sound.playHoverboard();
      if (navigator.vibrate) navigator.vibrate([30, 20, 40]);
    }
  }

  public start() {
    this.isTitleLooping = false;
    this.isRunning = true;
    this.isPaused = false;
    this.distance = 0;
    this.coins = 0;
    this.score = 0;
    this.currentSpeed = BASE_SPEED;
    this.currentLane = 0;
    this.targetLane = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.playerVy = 0;
    this.isJumping = false;
    this.isRolling = false;
    this.groundY = 0;
    this.standingRoofY = 0;
    this.bonusLaneSide = 0;
    this.bonusLaneChunksLeft = 0;
    this.hasHoverboard = false;
    this.hoverboardTimer = 0;
    // Classic opening chase: Inspector starts right on player's heels for first 3.5 seconds!
    this.stumbleTimer = 3.5;
    this.inspectorOffsetZ = 3.4;
    this.powerups = { sneakers: 0, magnet: 0, jetpack: 0, multiplier: 0 };
    this.characterPowers.extraLives = CHARACTERS.find((c) => c.id === this.characterId)?.extraLives ?? 0;
    this.nextSpawnZ = -25;

    // Reset models
    this.playerModel.hoverboardMesh.visible = false;
    this.playerModel.jetpackMesh.visible = false;
    this.playerModel.sneakersGroup.visible = false;

    // Clear existing obstacles and coins
    this.clearSpawnedObjects();

    this.isTitleLooping = false;
    this.playerModel.group.rotation.y = 0;
    this.camera.position.set(0, 4.8, this.cameraZ);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, 1.8, -4.0);

    // Spawn first obstacle chunk immediately at Z = -35 so action starts right away!
    this.spawnNextChunkAt(-35);
    this.spawnNextChunkAt(-75);
    this.spawnNextChunkAt(-115);
    this.spawnNextChunkAt(-155);

    sound.startBGM();
    sound.playWhistle();

    // Dev/QA hook: with ?debug in the URL, the render loop polls a DOM
    // attribute so external test tooling (isolated JS world) can request
    // obstacles: set body[data-spawn-bus="z,lane"] to force a school bus.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
      document.body.dataset.debugSpawner = 'on';
      this.debugSpawner = true;
    }

    // Start 60 FPS Render Loop
    this.startLoop();
  }

  private isTitleLooping: boolean = false;
  private debugSpawner: boolean = false; // ?debug enables DOM-driven spawns
  /** Camera distance behind the player (Z). Smaller = camera further
   *  forward = character sits lower in frame with more track visible. */
  private cameraZ: number = 4.6; // moved forward from 6.2 for a better mobile view

  public startTitleIdleLoop() {
    this.isTitleLooping = true;
    let lastTime = performance.now();

    const titleTick = () => {
      if (!this.isTitleLooping || this.isRunning) return;

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      this.animClock += dt;

      // Gentle idling character breathing & arm sway facing 3/4 front so all features are visible
      const idle = Math.sin(this.animClock * 2.5);
      this.playerModel.group.position.set(0, idle * 0.03, 0);
      this.playerModel.group.rotation.y = Math.PI - 0.28 + Math.sin(this.animClock * 1.0) * 0.12;
      this.playerModel.leftArm.rotation.x = idle * 0.15;
      this.playerModel.rightArm.rotation.x = -idle * 0.15;

      // Flutter cape in idle (top-pivoted geometry: hem-only motion, positive = backward)
      if (this.playerModel.capeMesh) {
        this.playerModel.capeMesh.rotation.x = 0.15 + Math.abs(Math.sin(this.animClock * 5)) * 0.1;
      }
      // Pulse lightsaber blade in idle
      if (this.playerModel.saberBlade) {
        const mat = this.playerModel.saberBlade.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.emissiveIntensity = 2.0 + Math.sin(this.animClock * 16) * 0.8;
        }
      }

      // Update custom 3D model skeletal animation mixer if loaded
      if (this.playerModel.mixer) {
        this.playerModel.mixer.update(dt);
      }

      // Inspector and dog idling behind on the track
      this.inspectorModel.group.position.set(1.4, 0, -2.6);
      this.inspectorModel.group.rotation.y = 0.25;

      // Update dynamic track curvature & roadside scenery
      this.updateTrackCurvature();
      this.updateSideSceneryPositions(0);

      // Camera positioned closely in front of the character in 3/4 showcase view
      this.camera.position.set(0, 2.3, 4.2);
      this.camera.lookAt(0, 1.25, 0);

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.frameId = window.setTimeout(titleTick, 100);
      } else {
        this.frameId = requestAnimationFrame(titleTick);
      }
    };

    titleTick();
  }

  public renderTitleFrame() {
    this.startTitleIdleLoop();
  }

  public returnToMainMenu() {
    this.isRunning = false;
    this.isPaused = false;
    sound.stopBGM();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.clearSpawnedObjects();
    this.playerX = 0;
    this.playerY = 0;
    this.targetLane = 0;
    this.currentLane = 0;
    this.distance = 0;
    this.currentSpeed = BASE_SPEED;
    this.groundY = 0;
    this.standingRoofY = 0;
    this.bonusLaneSide = 0;
    this.bonusLaneChunksLeft = 0;
    this.hasHoverboard = false;
    this.hoverboardTimer = 0;
    this.powerups = { sneakers: 0, magnet: 0, jetpack: 0, multiplier: 0 };
    // Weapon starts HOLSTERED each run — player must double-tap/space to draw
    this.weaponDrawn = false;
    this.weaponUsesLeft = getWeaponById(this.weaponId).uses + this.characterPowers.weaponExtraUses;
    this.weaponCooldownLeft = 0;
    if (this.weaponRig) this.weaponRig.group.visible = false;
    this.attachWeaponModel();
    if (this.playerModel) {
      this.playerModel.hoverboardMesh.visible = false;
      this.playerModel.jetpackMesh.visible = false;
      this.playerModel.sneakersGroup.visible = false;
    }
    this.startTitleIdleLoop();
  }

  private bonusLaneSide: -1 | 0 | 1 = 0;   // active bonus side lane (0 = none)
  private bonusLaneChunksLeft: number = 0; // remaining chunks the bonus lane stays open
  private bonusLaneClosing: boolean = false; // blink phase before the lane shuts
  private bonusLaneJustOpened: boolean = false; // suppresses the next chunk's bonus fill
  private lastBonusSide: -1 | 1 = 1;       // alternates so it swaps sides each time

  /** Lane indices available in the current city (3 on rails, 5 on Neon City,
   *  3 + an occasional temporary 4th "bonus lane" on Soweto). */
  private laneIndices(): number[] {
    const half = Math.floor(getLaneCount(this.city) / 2);
    const out: number[] = [];
    for (let l = -half; l <= half; l++) out.push(l);
    if (this.city === 'soweto' && this.bonusLaneSide !== 0) {
      out.push(this.bonusLaneSide * 2);
    }
    return out;
  }

  /**
   * Remove any obstacles and coins still sitting in the bonus lane when it
   * closes, so nothing floats in a lane that no longer exists.
   */
  private clearBonusLaneContent(lane: number) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (obs.lane === lane) {
        this.scene.remove(obs.group);
        this.obstacles.splice(i, 1);
      }
    }
    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const coin = this.activeCoins[i];
      if (coin.lane === lane && !coin.collected) {
        this.scene.remove(coin.group);
        this.activeCoins.splice(i, 1);
      }
    }
    for (let i = this.activePowerups.length - 1; i >= 0; i--) {
      const p = this.activePowerups[i];
      if (p.lane === lane) {
        this.scene.remove(p.group);
        this.activePowerups.splice(i, 1);
      }
    }
  }

  /**
   * Bonus lane lifecycle, evaluated once per spawn chunk on Soweto:
   * opens on the side NOT used last time, stays open a few chunks, then closes.
   */
  private updateBonusLane(chunkZ: number) {
    if (this.city !== 'soweto') return;
    if (this.bonusLaneSide !== 0) {
      this.bonusLaneChunksLeft--;
      if (this.bonusLaneChunksLeft <= 0) {
        // Lane closes — nudge the player back if they were riding it
        if (this.targetLane === this.bonusLaneSide * 2) {
          this.targetLane = this.bonusLaneSide * 1;
        }
        this.triggerSplash('LANE CLOSING!', 'pow');
        // Purge anything still in the lane so no barrier/coins hang there
        // after the gold rails have vanished.
        this.clearBonusLaneContent(this.bonusLaneSide * 2);
        this.lastBonusSide = this.bonusLaneSide;
        this.bonusLaneSide = 0;
        this.bonusLaneClosing = false;
        this.bonusLaneJustOpened = false;
      } else if (this.bonusLaneChunksLeft === 1) {
        // One chunk left: warn phase — the lane's gold visuals will blink
        // (handled in updateTrackCurvature via bonusLaneClosing) and the
        // closing splash fires here so the player sees it coming.
        this.bonusLaneClosing = true;
        this.triggerSplash('LANE CLOSING!', 'pow');
      }
      return;
    }
    // Chance to open a new bonus lane, alternating sides
    // Rare, brief appearance: low open chance + short duration keeps the
    // lane feeling special without dominating runs.
    if (Math.random() < 0.12) {
      const side: -1 | 1 = this.lastBonusSide === 1 ? -1 : 1;
      this.bonusLaneSide = side;
      this.bonusLaneChunksLeft = 3 + Math.floor(Math.random() * 2); // 3-4 chunks
      this.bonusLaneClosing = false;
      this.bonusLaneJustOpened = true;
      this.triggerSplash('BONUS LANE!', 'wow');
      // Fill the lane ahead immediately so the player sees the full
      // coin trail and barrier running into the distance as it opens.
      for (let ahead = 0; ahead < 3; ahead++) {
        const z = chunkZ + ahead * 40;
        this.spawnBarrierHigh(side * 2, z);
        for (let c = 0; c < 9; c++) {
          this.spawnCoin(getLaneX(side * 2), 0.9, z + c * 3.2);
        }
      }
    }
  }

  private spawnNextChunkAt(chunkZ: number) {
    this.nextSpawnZ = chunkZ;
    this.updateBonusLane(chunkZ);

    // Pick 1 or 2 lanes to place obstacles
    const occupiedLanes = new Set<number>();
    const allLanes = this.laneIndices();
    const numObstacles = Math.random() > 0.4 ? 2 : 1;

    // Bonus lane (Soweto): while the lane is open, it ALWAYS carries its
    // signature content — a slide barrier + a long coin row through the lane.
    // (On the chunk where the lane just opened, updateBonusLane already filled
    // the lane ahead — skip here to avoid double-spawning.)
    if (this.city === 'soweto' && this.bonusLaneSide !== 0 && !this.bonusLaneJustOpened) {
      const bonusLane = this.bonusLaneSide * 2;
      occupiedLanes.add(bonusLane);
      // Slide barrier (not jump): the bonus lane is a slide-and-collect sprint.
      this.spawnBarrierHigh(bonusLane, chunkZ);
      for (let c = -1; c <= 8; c++) {
        this.spawnCoin(getLaneX(bonusLane), 0.9, chunkZ + c * 3.2);
      }
    }
    this.bonusLaneJustOpened = false;

    for (let i = 0; i < numObstacles; i++) {
      const laneIdx = allLanes[Math.floor(Math.random() * allLanes.length)];
      if (occupiedLanes.has(laneIdx)) continue;
      occupiedLanes.add(laneIdx);

      const roll = Math.random();
      if (this.city === 'neon_city') {
        // Cyberpunk streets: cars are the common obstacle, the school bus
        // is the rare 'train'-class vehicle, plus roadwork barriers.
        if (roll < 0.12) {
          this.spawnSchoolBus(laneIdx, chunkZ);
        } else if (roll < 0.62) {
          this.spawnCar(laneIdx, chunkZ);
        } else if (roll < 0.81) {
          this.spawnBarrierLow(laneIdx, chunkZ);
        } else {
          this.spawnBarrierHigh(laneIdx, chunkZ);
        }
      } else if (roll < 0.45) {
        // Passenger Train
        this.spawnTrain(laneIdx, chunkZ);
      } else if (roll < 0.75) {
        // Low Jump Barrier
        this.spawnBarrierLow(laneIdx, chunkZ);
      } else {
        // High Slide Barrier
        this.spawnBarrierHigh(laneIdx, chunkZ);
      }
    }

    // In open lanes, spawn coin patterns or powerups
    const openLanes = allLanes.filter((l) => !occupiedLanes.has(l));
    if (openLanes.length > 0) {
      const coinLane = openLanes[0];
      const coinX = getLaneX(coinLane);

      // 10% chance to spawn a powerup item
      if (Math.random() < 0.16) {
        const pTypes: PowerupType[] = ['magnet', 'jetpack', 'sneakers', 'multiplier'];
        const chosen = pTypes[Math.floor(Math.random() * pTypes.length)];
        this.spawnPowerup(chosen, coinX, 1.2, chunkZ);
      } else {
        // Spawn coin row or jump arc
        const isArc = Math.random() > 0.5;
        for (let c = 0; c < 5; c++) {
          const coinZ = chunkZ + c * 3.0;
          const coinY = isArc ? 0.9 + Math.sin((c / 4) * Math.PI) * 1.8 : 0.9;
          this.spawnCoin(coinX, coinY, coinZ);
        }
      }
    }
  }

  public pause() {
    this.isPaused = true;
    sound.stopBGM();
  }

  public resume() {
    this.isPaused = false;
    sound.startBGM();
    this.startLoop();
  }

  private startLoop() {
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (!this.isRunning || this.isPaused) return;

      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private update(dt: number) {
    this.animClock += dt;

    // Debug spawner: DOM attribute lets test tooling force obstacles.
    if (this.debugSpawner && document.body.dataset.spawnBus) {
      const [zRaw, laneRaw] = document.body.dataset.spawnBus.split(',');
      this.spawnSchoolBus(Number(laneRaw ?? 1), Number(zRaw ?? -30));
      delete document.body.dataset.spawnBus;
    }
    if (this.debugSpawner && document.body.dataset.spawnCar) {
      const [zRaw, laneRaw] = document.body.dataset.spawnCar.split(',');
      this.spawnCar(Number(laneRaw ?? 0), Number(zRaw ?? -25));
      delete document.body.dataset.spawnCar;
    }

    // Advance Run Distance & Acceleration
    const isJetpack = this.powerups.jetpack > 0;
    const speedMult = isJetpack ? 1.5 : 1.0;
    const stepDist = this.currentSpeed * speedMult * dt;
    this.distance += stepDist;
    this.currentSpeed = Math.min(MAX_SPEED, this.currentSpeed + SPEED_ACCELERATION * dt);

    // Update dynamic track curvature along running distance
    this.updateTrackCurvature();

    // Score calculation & throttling
    this.score = calculateRunScore(this.distance, this.coins, this.multiplier, this.powerups.multiplier > 0);
    this.callbacks.onScoreUpdate({
      score: this.score,
      coins: this.coins,
      distance: Math.floor(this.distance),
      multiplier: this.multiplier * (this.powerups.multiplier > 0 ? 2 : 1),
      highScore: Math.max(this.highScore, this.score),
      totalCoins: this.totalCoins + this.coins,
    });

    // Tick Powerups
    this.powerups = tickPowerupTimers(this.powerups, dt);
    if (this.hasHoverboard) {
      this.hoverboardTimer = Math.max(0, this.hoverboardTimer - dt);
      if (this.hoverboardTimer <= 0) {
        this.hasHoverboard = false;
        this.playerModel.hoverboardMesh.visible = false;
      }
    }
    this.playerModel.jetpackMesh.visible = this.powerups.jetpack > 0;
    this.playerModel.sneakersGroup.visible = this.powerups.sneakers > 0;
    this.callbacks.onPowerupUpdate(this.powerups, this.hasHoverboard, this.hoverboardTimer);

    // Weapon cooldown + swing animation
    this.updateWeapon(dt);

    // Lateral Lane Movement (exponential damp toward target lane X)
    const targetX = getLaneX(this.targetLane);
    this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 14, dt);
    this.currentLane = Math.round(this.playerX / LANE_WIDTH);

    // Vertical Physics (Jump / Fall / Ground)
    const targetGroundY = isJetpack ? JETPACK_HEIGHT : this.groundY;

    if (isJetpack) {
      this.playerY = THREE.MathUtils.damp(this.playerY, JETPACK_HEIGHT, 6, dt);
      this.playerVy = 0;
      this.isJumping = false;
    } else {
      this.playerVy -= GRAVITY * dt;
      this.playerY += this.playerVy * dt;

      if (this.playerY <= targetGroundY) {
        this.playerY = targetGroundY;
        this.playerVy = 0;
        this.isJumping = false;
      }
    }

    // Roll duration
    if (this.isRolling) {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) {
        this.isRolling = false;
      }
    }

    // Update Player Mesh Position & Tilt into upcoming bends
    this.playerModel.group.position.set(this.playerX, this.playerY, 0);

    // Dynamic runner banking into curves + lateral shift: player faces FORWARD down the tracks (Math.PI)
    const lateralVel = targetX - this.playerX;
    const nearCurveAngle = getTrackCurveAngle(-12, this.distance, this.city);
    // Forward-facing track alignment with smooth curve banking
    this.playerModel.group.rotation.y = Math.PI - nearCurveAngle * 0.45;
    this.playerModel.group.rotation.z = lateralVel * 0.12 + nearCurveAngle * 0.22;

    // Running limb animation cycle
    const strideFreq = this.currentSpeed * 0.8;
    const stride = Math.sin(this.animClock * strideFreq);

    if (this.hasHoverboard) {
      if (this.hoverboardId === 'bmx_bicycle') {
        // BMX Riding Pose: both hands reach forward onto handlebars, pedaling cadence
        const pedalCycle = Math.sin(this.animClock * this.currentSpeed * 0.7);
        this.playerModel.group.scale.set(1.0, 1.0, 1.0);
        this.playerModel.leftArm.rotation.set(-1.15, 0.18, 0);
        this.playerModel.rightArm.rotation.set(-1.15, -0.18, 0);
        this.playerModel.leftLeg.rotation.set(0.35 + pedalCycle * 0.3, 0, 0);
        this.playerModel.rightLeg.rotation.set(0.35 - pedalCycle * 0.3, 0, 0);
      } else if (this.hoverboardId === 'electric_scooter') {
        // E-Scooter Riding Pose: upright forward stance, both hands gripping handlebars, feet planted on deck
        this.playerModel.group.scale.set(1.0, 1.0, 1.0);
        this.playerModel.leftArm.rotation.set(-1.25, 0.12, 0);
        this.playerModel.rightArm.rotation.set(-1.25, -0.12, 0);
        this.playerModel.leftLeg.rotation.set(0.12, 0, 0);
        this.playerModel.rightLeg.rotation.set(-0.28, 0, 0);
      } else {
        // Skateboard / Kasi Cruiser / Hoverboard Surfing Pose:
        // Surfer stands sideways across the forward-gliding board with athletic balance
        this.playerModel.group.scale.set(1.0, 1.0, 1.0);
        this.playerModel.leftArm.rotation.set(-0.55, 0.35, 0);
        this.playerModel.rightArm.rotation.set(0.55, -0.35, 0);
        this.playerModel.leftLeg.rotation.set(-0.22, 0.35, 0);
        this.playerModel.rightLeg.rotation.set(0.22, 0.35, 0);
      }
    } else if (this.isJumping) {
      // Jump pose: arms up, knees slightly bent
      this.playerModel.group.scale.set(1.0, 1.0, 1.0);
      this.playerModel.leftArm.rotation.set(-1.8, 0, 0);
      this.playerModel.rightArm.rotation.set(-1.8, 0, 0);
      this.playerModel.leftLeg.rotation.set(0.6, 0, 0);
      this.playerModel.rightLeg.rotation.set(0.6, 0, 0);
    } else if (this.isRolling) {
      // Crouch / tuck
      this.playerModel.group.scale.set(1.0, 0.55, 1.0);
      this.playerModel.leftArm.rotation.set(1.0, 0, 0);
      this.playerModel.rightArm.rotation.set(1.0, 0, 0);
      this.playerModel.leftLeg.rotation.set(0, 0, 0);
      this.playerModel.rightLeg.rotation.set(0, 0, 0);
    } else {
      // Standard sprint stride
      this.playerModel.group.scale.set(1.0, 1.0, 1.0);
      this.playerModel.leftArm.rotation.set(stride * 0.9, 0, 0);
      this.playerModel.rightArm.rotation.set(-stride * 0.9, 0, 0);
      this.playerModel.leftLeg.rotation.set(-stride * 1.1, 0, 0);
      this.playerModel.rightLeg.rotation.set(stride * 1.1, 0, 0);
    }

    // Superhero Cape Wind Flutter — geometry is pivoted at the TOP edge, so
    // rotation only waves the free hem (never the attachment line). Positive
    // rotation.x moves the hem backward (z = y·sinθ, y<0 ⇒ −z), away from body.
    if (this.playerModel.capeMesh) {
      this.playerModel.capeMesh.rotation.x = 0.15 + Math.abs(Math.sin(this.animClock * 14)) * 0.2;
      this.playerModel.capeMesh.rotation.z = Math.cos(this.animClock * 10) * 0.05;
    }

    // Jedi Lightsaber Blade Energy Glow Pulse
    if (this.playerModel.saberBlade) {
      const mat = this.playerModel.saberBlade.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 1.8 + Math.sin(this.animClock * 18) * 0.6;
      }
    }

    // Custom Imported 3D Model Skeletal Animation Mixer
    if (this.playerModel.mixer) {
      this.playerModel.mixer.update(dt);
    }

    // Inspector Follower Logic along curved track - faces FORWARD chasing player
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= dt;
      // Close behind player on stumble
      this.inspectorOffsetZ = THREE.MathUtils.damp(this.inspectorOffsetZ, 3.8, 8, dt);
    } else {
      // Inspector drops back
      this.inspectorOffsetZ = THREE.MathUtils.damp(this.inspectorOffsetZ, 12.0, 3, dt);
    }
    const inspCurveX = getTrackCurveX(this.inspectorOffsetZ, this.distance, this.city);
    const inspAngle = getTrackCurveAngle(this.inspectorOffsetZ, this.distance, this.city);
    this.inspectorModel.group.position.set(this.playerX * 0.8 + inspCurveX, 0, this.inspectorOffsetZ);
    this.inspectorModel.group.rotation.y = Math.PI - inspAngle;
    this.inspectorModel.inspectorLegL.rotation.x = -stride * 1.0;
    this.inspectorModel.inspectorLegR.rotation.x = stride * 1.0;

    // Move Obstacles, Coins & World Environment toward camera (-Z to +Z relative)
    this.updateTrackAndEnvironment(stepDist, dt);

    // Collision Detection
    this.checkCollisions();

    // Particles (Sneaker dust puffs and jetpack flames)
    this.dustTimer += dt;
    if (this.dustTimer > 0.12 && !isJetpack && this.playerY <= this.groundY + 0.15 && !this.isRolling) {
      this.dustTimer = 0;
      this.spawnDust(this.playerX, this.playerY, 0);
    }
    if (isJetpack) {
      this.spawnJetpackFlames(this.playerX, this.playerY, 0);
    }
    this.updateParticles(dt);

    // Dynamic Speed FOV Kick
    const targetFov = isJetpack ? 75 : THREE.MathUtils.mapLinear(this.currentSpeed, BASE_SPEED, MAX_SPEED, 65, 73);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 3, dt);
      this.camera.updateProjectionMatrix();
    }

    // Camera follow with spring damping, dynamic track bend lookahead & banking
    const lookAheadTrackX = getTrackCurveX(-24, this.distance, this.city);
    const camTrackX = getTrackCurveX(5.5, this.distance, this.city);
    const upcomingCurveAngle = getTrackCurveAngle(-25, this.distance, this.city);

    const targetCamY = isJetpack ? JETPACK_HEIGHT + 4.5 : Math.max(4.8, this.playerY + 4.2);
    // Follow the player laterally almost 1:1 — if the camera lags behind the
    // lateral move, the character slides out of a narrow portrait frustum when
    // entering the side lanes (outer lanes are up to ±5.2 on Neon City).
    const targetCamX = camTrackX * 0.35 + this.playerX * 0.92;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 9, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 8, dt);
    this.camera.lookAt(lookAheadTrackX * 0.45 + this.playerX * 0.85, isJetpack ? JETPACK_HEIGHT : 1.6, -14);

    // Dynamic camera banking roll (leaning subtly into the curve)
    this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, -upcomingCurveAngle * 0.22, 5, dt);
  }

  public spawnDust(x: number, y: number, z: number) {
    if (this.particles.length > 45) return;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 })
    );
    mesh.position.set(x + (Math.random() - 0.5) * 0.35, y + 0.08, z + 0.25);
    this.particleGroup.add(mesh);
    this.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 0.7,
      vy: 0.4 + Math.random() * 0.5,
      vz: 1.8 + Math.random() * 1.5,
      life: 0.32,
      maxLife: 0.32,
    });
  }

  public spawnSparkles(x: number, y: number, z: number) {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.12, 0),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      mesh.position.set(x, y, z);
      this.particleGroup.add(mesh);
      const angle = (i / 8) * Math.PI * 2;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * (2.2 + Math.random() * 2.5),
        vy: Math.sin(angle) * (2.2 + Math.random() * 2.5),
        vz: (Math.random() - 0.5) * 2.5,
        life: 0.4,
        maxLife: 0.4,
      });
    }
  }

  public spawnJetpackFlames(x: number, y: number, z: number) {
    [-0.18, 0.18].forEach((offsetX) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 6),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0xf59e0b : 0xef4444, transparent: true, opacity: 0.85 })
      );
      mesh.position.set(x + offsetX, y + 0.8, z - 0.45);
      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -2.8 - Math.random() * 1.5,
        vz: 3.5 + Math.random() * 2.5,
        life: 0.24,
        maxLife: 0.24,
      });
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particleGroup.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const progress = p.life / p.maxLife;
      p.mesh.scale.setScalar(progress * 1.25);
    }
  }

  private updateTrackAndEnvironment(stepDist: number, dt: number) {
    // 1. Move Obstacles & Follow Track Curvature
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      // If train is oncoming moving, add extra relative speed
      const extraSpeed = obs.speed ? obs.speed * dt : 0;
      obs.z += stepDist + extraSpeed;

      const cx = getTrackCurveX(obs.z, this.distance, this.city);
      const angle = getTrackCurveAngle(obs.z, this.distance, this.city);
      const laneOffset = getLaneX(obs.lane);

      obs.group.position.x = cx + laneOffset * Math.cos(angle);
      obs.group.position.z = obs.z - laneOffset * Math.sin(angle);
      obs.group.rotation.y = angle + (obs.extraRotationY ?? 0);

      // Despawn passed obstacles behind player
      if (obs.z > 25) {
        this.scene.remove(obs.group);
        this.obstacles.splice(i, 1);
      }
    }

    // 2. Move Coins & Follow Track Curvature
    const isMagnet = this.powerups.magnet > 0;
    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const coin = this.activeCoins[i];
      coin.z += stepDist;
      coin.group.rotation.y += 0.08;

      const cx = getTrackCurveX(coin.z, this.distance, this.city);
      const angle = getTrackCurveAngle(coin.z, this.distance, this.city);
      const laneOffset = getLaneX(coin.lane);

      // Magnet pulls coins within 16 units toward player
      if (isMagnet && !coin.collected && coin.z > -16 && coin.z < 6) {
        coin.x = THREE.MathUtils.damp(coin.x, this.playerX, 14, dt);
        coin.y = THREE.MathUtils.damp(coin.y, this.playerY + 0.8, 14, dt);
        coin.group.position.set(coin.x, coin.y, coin.z);
      } else {
        coin.x = cx + laneOffset * Math.cos(angle);
        coin.group.position.x = coin.x;
        coin.group.position.z = coin.z - laneOffset * Math.sin(angle);
      }

      // Coin pickup check
      const distToPlayer = Math.hypot(coin.x - this.playerX, coin.y - (this.playerY + 0.8), coin.z);
      if (distToPlayer < 1.3 && !coin.collected) {
        coin.collected = true;
        this.coins++;
        this.spawnSparkles(coin.x, coin.y, coin.z);
        sound.playCoin();
        if (this.coins % 6 === 0 || Math.random() < 0.22) {
          const coinPuffs = ['WOW!', 'CHING!', 'BONANZA!', 'SWEET!', 'NICE!'];
          this.triggerSplash(coinPuffs[Math.floor(Math.random() * coinPuffs.length)], 'wow');
        }
        if (navigator.vibrate) navigator.vibrate(15);
        this.scene.remove(coin.group);
        this.activeCoins.splice(i, 1);
        continue;
      }

      if (coin.z > 20) {
        this.scene.remove(coin.group);
        this.activeCoins.splice(i, 1);
      }
    }

    // 3. Move Powerup Items & Follow Track Curvature
    for (let i = this.activePowerups.length - 1; i >= 0; i--) {
      const p = this.activePowerups[i];
      p.z += stepDist;
      p.group.rotation.y += 0.05;

      const cx = getTrackCurveX(p.z, this.distance, this.city);
      const angle = getTrackCurveAngle(p.z, this.distance, this.city);
      const laneOffset = getLaneX(p.lane);
      p.x = cx + laneOffset * Math.cos(angle);
      p.group.position.x = p.x;
      p.group.position.z = p.z - laneOffset * Math.sin(angle);

      const dist = Math.hypot(p.x - this.playerX, p.y - (this.playerY + 0.8), p.z);
      if (dist < 1.4 && !p.collected) {
        p.collected = true;
        this.collectPowerup(p.type);
        this.scene.remove(p.group);
        this.activePowerups.splice(i, 1);
        continue;
      }

      if (p.z > 20) {
        this.scene.remove(p.group);
        this.activePowerups.splice(i, 1);
      }
    }

    // 4. Move Catenary Gantries & Track Curvature Loop
    this.catenaryInstances.children.forEach((gantry) => {
      gantry.position.z += stepDist;
      if (gantry.position.z > 15) {
        gantry.position.z -= 245;
      }
      const gz = gantry.position.z;
      const cx = getTrackCurveX(gz, this.distance, this.city);
      const angle = getTrackCurveAngle(gz, this.distance, this.city);
      gantry.position.x = cx;
      gantry.position.z = gz;
      gantry.rotation.y = angle;
    });

    // 5. Move Roadside Scenery along dynamic track curvature (strictly curves with track)
    this.updateSideSceneryPositions(stepDist);
    this.updateVeldPropsPositions(stepDist);

    // 6. Distant landmark parallax: drifts slowly toward the player (a fraction
    // of run speed) so the towers approach like real distant scenery, then
    // recycles far behind when passed. The curve offset is scaled down at long
    // range — evaluating the track curve at far z otherwise swings the landmark
    // off-screen laterally during curves.
    if (this.landmarkGroup) {
      this.landmarkZ = (this.landmarkZ ?? -320) + stepDist * 0.18;
      if (this.landmarkZ > -150) {
        this.landmarkZ = -320; // recycle far ahead again
      }
      const lkCurveX = getTrackCurveX(this.landmarkZ, this.distance, this.city);
      const depthScale = Math.min(1, Math.max(0.15, -this.landmarkZ / 420));
      this.landmarkGroup.position.x = lkCurveX * 0.45 * depthScale;
      this.landmarkGroup.position.z = this.landmarkZ;
    }

    // 7. Spawn new chunks ahead
    this.nextSpawnZ += stepDist;
    if (this.nextSpawnZ > -80) {
      this.spawnNextChunk();
    }
  }

  private collectPowerup(type: PowerupType) {
    sound.playPowerup();
    if (navigator.vibrate) navigator.vibrate([40, 20, 60]);

    if (type === 'sneakers') {
      // Character power (Sting Ray): super kicks last 50% longer.
      this.powerups.sneakers = SNEAKERS_DURATION * this.characterPowers.sneakerDurationMult;
      this.triggerSplash('BOING!', 'pow');
    } else if (type === 'magnet') {
      this.powerups.magnet = MAGNET_DURATION;
      this.triggerSplash('MAGNETIC!', 'power');
    } else if (type === 'jetpack') {
      this.powerups.jetpack = JETPACK_DURATION;
      this.triggerSplash('BLAST OFF!', 'boom');
      this.spawnJetpackCoinSkyway();
    } else if (type === 'multiplier') {
      this.powerups.multiplier = MULTIPLIER_DURATION;
      this.triggerSplash('2X SCORE!', 'wow');
    }
  }

  private spawnJetpackCoinSkyway() {
    // Spawn lines of gold coins high in the sky
    for (let z = -20; z >= -180; z -= 3.5) {
      const lanes = this.laneIndices();
      const lane = lanes[Math.floor(Math.sin(z * 0.05) * 1.5 + 2.5) % lanes.length];
      this.spawnCoin(lane, JETPACK_HEIGHT, z);
    }
  }

  private spawnNextChunk() {
    const chunkZ = -120 - Math.random() * 20;
    this.nextSpawnZ = chunkZ;
    this.updateBonusLane(chunkZ);

    // Pick 1 or 2 lanes to place obstacles
    const occupiedLanes = new Set<number>();
    const allLanes = this.laneIndices();
    const numObstacles = Math.random() > 0.4 ? 2 : 1;

    // Bonus lane (Soweto): while the lane is open, it ALWAYS carries its
    // signature content — a slide barrier + a long coin row through the lane.
    // (On the chunk where the lane just opened, updateBonusLane already filled
    // the lane ahead — skip here to avoid double-spawning.)
    if (this.city === 'soweto' && this.bonusLaneSide !== 0 && !this.bonusLaneJustOpened) {
      const bonusLane = this.bonusLaneSide * 2;
      occupiedLanes.add(bonusLane);
      // Slide barrier (not jump): the bonus lane is a slide-and-collect sprint.
      this.spawnBarrierHigh(bonusLane, chunkZ);
      for (let c = -1; c <= 8; c++) {
        this.spawnCoin(getLaneX(bonusLane), 0.9, chunkZ + c * 3.2);
      }
    }
    this.bonusLaneJustOpened = false;

    for (let i = 0; i < numObstacles; i++) {
      const laneIdx = allLanes[Math.floor(Math.random() * allLanes.length)];
      if (occupiedLanes.has(laneIdx)) continue;
      occupiedLanes.add(laneIdx);

      const roll = Math.random();
      if (this.city === 'neon_city') {
        // Cyberpunk streets: cars are the common obstacle, the school bus
        // is the rare 'train'-class vehicle, plus roadwork barriers.
        if (roll < 0.12) {
          this.spawnSchoolBus(laneIdx, chunkZ);
        } else if (roll < 0.62) {
          this.spawnCar(laneIdx, chunkZ);
        } else if (roll < 0.81) {
          this.spawnBarrierLow(laneIdx, chunkZ);
        } else {
          this.spawnBarrierHigh(laneIdx, chunkZ);
        }
      } else if (roll < 0.45) {
        // Passenger Train
        this.spawnTrain(laneIdx, chunkZ);
      } else if (roll < 0.75) {
        // Low Jump Barrier
        this.spawnBarrierLow(laneIdx, chunkZ);
      } else {
        // High Slide Barrier
        this.spawnBarrierHigh(laneIdx, chunkZ);
      }
    }

    // In open lanes, spawn coin patterns or powerups
    const openLanes = allLanes.filter((l) => !occupiedLanes.has(l));
    if (openLanes.length > 0) {
      const coinLane = openLanes[0];
      const coinX = getLaneX(coinLane);

      // 10% chance to spawn a powerup item
      if (Math.random() < 0.14) {
        const pTypes: PowerupType[] = ['magnet', 'jetpack', 'sneakers', 'multiplier'];
        const chosen = pTypes[Math.floor(Math.random() * pTypes.length)];
        this.spawnPowerup(chosen, coinX, 1.2, chunkZ);
      } else {
        // Spawn coin row or jump arc
        const isArc = Math.random() > 0.6;
        for (let c = 0; c < 5; c++) {
          const coinZ = chunkZ + c * 3.2;
          const coinY = isArc ? 0.9 + Math.sin((c / 4) * Math.PI) * 1.8 : 0.9;
          this.spawnCoin(coinX, coinY, coinZ);
        }
      }
    }
  }

  private spawnTrain(lane: number, z: number) {
    const trainMesh = createTrainMesh(this.city);
    const laneX = getLaneX(lane);
    const cx = getTrackCurveX(z, this.distance, this.city);
    const angle = getTrackCurveAngle(z, this.distance, this.city);
    trainMesh.position.set(cx + laneX * Math.cos(angle), 0, z - laneX * Math.sin(angle));
    trainMesh.rotation.y = angle;
    this.scene.add(trainMesh);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: 'train',
      lane,
      group: trainMesh,
      z,
      y: 0,
      width: 2.3,
      height: TRAIN_HEIGHT,
      depth: TRAIN_LENGTH,
    });

    // Spawn coins on top of the train!
    for (let c = -TRAIN_LENGTH / 2 + 4; c <= TRAIN_LENGTH / 2 - 4; c += 4) {
      this.spawnCoin(laneX, TRAIN_HEIGHT + 0.9, z + c);
    }
  }

  /**
   * Neon City: a parked car blocks one lane. Uses the generic passenger car
   * pack (compact / coupe / hatch / minivan, random variant), auto-fit to the
   * collision box. Can be jumped over with a normal jump.
   */
  private spawnCar(lane: number, z: number) {
    const car = new THREE.Group();
    const NEON_PAINT = [0x7c3aed, 0x22d3ee, 0xf472b6, 0x4ade80];
    const paintColor = NEON_PAINT[Math.floor(Math.random() * NEON_PAINT.length)];
    const paint = new THREE.MeshStandardMaterial({ color: paintColor, metalness: 0.55, roughness: 0.35, flatShading: true });
    const paintDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(paintColor).multiplyScalar(0.55), metalness: 0.55, roughness: 0.45, flatShading: true });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2340, metalness: 0.5, roughness: 0.12, flatShading: true });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x05070f, roughness: 0.85, flatShading: true });

    // Lower body: tapered slab (beltline inset, nose narrower) so it reads as
    // sheet metal rather than a pure cube.
    const lowerGeo = new THREE.BoxGeometry(1.9, 0.6, 4.2);
    const lowerPos = lowerGeo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < lowerPos.count; v++) {
      const y = lowerPos.getY(v);
      const z2 = lowerPos.getZ(v);
      if (y > 0) {
        lowerPos.setX(v, lowerPos.getX(v) * 0.92);
        lowerPos.setZ(v, z2 * 0.9);
      }
      lowerPos.setX(v, lowerPos.getX(v) * (1 - (z2 / 4.2) * 0.12));
    }
    lowerGeo.computeVertexNormals();
    const body = new THREE.Mesh(lowerGeo, paint);
    body.position.y = 0.62;
    body.castShadow = true;

    // Cabin: tapered greenhouse (narrower roof, raked glass)
    const cabinGeo = new THREE.BoxGeometry(1.5, 0.5, 2.1);
    const cabinPos = cabinGeo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < cabinPos.count; v++) {
      if (cabinPos.getY(v) > 0) {
        cabinPos.setX(v, cabinPos.getX(v) * 0.78);
        cabinPos.setZ(v, cabinPos.getZ(v) * 0.82);
      }
    }
    cabinGeo.computeVertexNormals();
    const cabin = new THREE.Mesh(cabinGeo, paintDark);
    cabin.position.set(0, 1.12, -0.15);
    cabin.castShadow = true;

    // Glass panels inset within the cabin pillars
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.51, 0.34, 1.95), glassMat);
    glass.position.set(0, 1.14, -0.15);

    // Front/rear bumpers (dark trim)
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.3), trimMat);
    bumperF.position.set(0, 0.42, 2.14);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.3), trimMat);
    bumperR.position.set(0, 0.42, -2.14);

    // Headlights and taillights (emissive so they glow in the night scene)
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe9a8, emissiveIntensity: 0.9, roughness: 0.4 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2d55, emissive: 0xff2d55, emissiveIntensity: 0.8, roughness: 0.4 });
    for (const sx of [-0.58, 0.58]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), lightMat);
      head.position.set(sx, 0.72, 2.12);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
      tail.position.set(sx, 0.72, -2.12);
      car.add(head, tail);
    }

    // Fender bulges over each wheel (comic chunky look, paint-colored)
    const fenderGeo = new THREE.BoxGeometry(0.22, 0.32, 0.95);
    for (const [fx, fz] of [[-0.99, 1.35], [0.99, 1.35], [-0.99, -1.35], [0.99, -1.35]]) {
      const fender = new THREE.Mesh(fenderGeo, paint);
      fender.position.set(fx, 0.56, fz);
      fender.castShadow = true;
      car.add(fender);
    }
    // Side skirts (dark rocker panels between the wheels)
    const skirtGeo = new THREE.BoxGeometry(0.1, 0.16, 2.3);
    for (const sx of [-0.95, 0.95]) {
      const skirt = new THREE.Mesh(skirtGeo, trimMat);
      skirt.position.set(sx, 0.36, 0);
      car.add(skirt);
    }
    // Grille (dark slats between the headlights)
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.06), trimMat);
    grille.position.set(0, 0.72, 2.12);
    car.add(grille);

    // Wheels: chunky tyre + detailed rim (hub cap + cross spokes)
    const tyreGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
    const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.3, 8);
    const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.33, 6);
    const spokeGeo = new THREE.BoxGeometry(0.04, 0.3, 0.05);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.8, roughness: 0.3, flatShading: true });
    for (const [wx, wz] of [[-0.88, 1.35], [0.88, 1.35], [-0.88, -1.35], [0.88, -1.35]]) {
      const tyre = new THREE.Mesh(tyreGeo, trimMat);
      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(wx, 0.34, wz);
      const rim = new THREE.Mesh(rimGeo, hubMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, 0.34, wz);
      const hub = new THREE.Mesh(hubGeo, trimMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(wx, 0.34, wz);
      tyre.castShadow = true;
      car.add(tyre, rim, hub);
      // 4 spokes per wheel, cross pattern, facing outward
      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(spokeGeo, hubMat);
        spoke.rotation.x = (s * Math.PI) / 4;
        spoke.position.set(wx + (wx > 0 ? 0.13 : -0.13), 0.34, wz);
        car.add(spoke);
      }
    }

    // Roof accent: small painted spoiler at the tail
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.34), paintDark);
    spoiler.position.set(0, 1.16, -1.28);
    spoiler.rotation.x = -0.18;
    car.add(body, cabin, glass, bumperF, bumperR, spoiler);

    const laneX = getLaneX(lane);
    const cx = getTrackCurveX(z, this.distance, this.city);
    const angle = getTrackCurveAngle(z, this.distance, this.city);
    car.position.set(cx + laneX * Math.cos(angle), 0, z - laneX * Math.sin(angle));
    car.rotation.y = angle; // taillights face the player, headlights point ahead
    this.scene.add(car);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: 'train', // reuse train roof-jump logic: can land on the roof
      lane,
      group: car,
      z,
      y: 0,
      width: 2.0,
      height: 1.4,
      depth: 4.4,
    });

    // Coin arc over the car
    for (let c = -1; c <= 1; c++) {
      this.spawnCoin(laneX, 1.9 + Math.cos(c * (Math.PI / 2)) * 0.7, z + c * 2.0);
    }
  }

  /**
   * Neon City: the rare school bus — the 'train' of the streets. Uses the
   * school_bus GLB asset, fit to a shorter-than-train collision box so the
   * silhouette reads as a bus; still too tall for a normal jump, so super
   * sneakers are required to land on its roof (which carries a coin trail).
   */
  private spawnSchoolBus(lane: number, z: number) {
    // Shorter than a full train — ~55% of TRAIN_LENGTH keeps proportions
    // bus-like while remaining sneakers-jump territory.
    const BUS_LENGTH = TRAIN_LENGTH * 0.55;
    const BUS_WIDTH = 2.4;
    const bus = new THREE.Group();

    // The GLB loads asynchronously; add it to the group when it arrives.
    assetManager.loadModel('school_bus', 0).then((model) => {
      if (!model || !bus.parent) return; // bus may already be gone
      // Exact fit to the (shortened) collision box.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.set(
        BUS_WIDTH / (size.x || 1),
        TRAIN_HEIGHT / (size.y || 1),
        BUS_LENGTH / (size.z || 1),
      );
      model.updateMatrixWorld(true);
      // Recenter after scaling: bottom of the box on the ground, centered on
      // the lane axis so the bus sits where the collision box says it does.
      const nb = new THREE.Box3().setFromObject(model);
      const nc = nb.getCenter(new THREE.Vector3());
      model.position.set(-nc.x, -nb.min.y, -nc.z);
      // Vibrant repaint by mesh name: only the carpaint (body) gets pushed to
      // bright school-bus yellow. Everything else — glass/windows, lights,
      // chrome, rims, tyres, seats, lettering — keeps its original colours.
      const vibrant = new THREE.Color(0xffc21a);
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const name = (mesh.name || '') + (mesh.parent?.name || '');
        const isBody = /carpaint/i.test(name);
        if (!isBody) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const mat = m as THREE.MeshStandardMaterial;
          mat.color.lerp(vibrant, 0.85);
          mat.emissive = new THREE.Color(0x664400);
          mat.emissiveIntensity = 0.35;
          mat.needsUpdate = true;
        }
      });
      bus.add(model);
      ghost.visible = false; // real model mounted — hide the placeholder
    });

    // Collision placeholder body (kept so the bus never spawns invisible if
    // the GLB is slow to arrive — matches the collision box exactly).
    const ghostMat = new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.3, roughness: 0.5 });
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(BUS_WIDTH, TRAIN_HEIGHT, BUS_LENGTH), ghostMat);
    ghost.position.y = TRAIN_HEIGHT / 2;
    ghost.visible = false; // hidden once the GLB mounts (handled below)
    bus.add(ghost);

    const laneX = getLaneX(lane);
    const cx = getTrackCurveX(z, this.distance, this.city);
    const angle = getTrackCurveAngle(z, this.distance, this.city);
    bus.position.set(cx + laneX * Math.cos(angle), 0, z - laneX * Math.sin(angle));
    bus.rotation.y = angle + Math.PI; // flipped so the windshield/front faces the player
    this.scene.add(bus);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: 'train',
      lane,
      group: bus,
      z,
      y: 0,
      width: BUS_WIDTH,
      height: TRAIN_HEIGHT,
      depth: BUS_LENGTH,
      extraRotationY: Math.PI, // keep the flip through per-frame rotation updates
    });

    // Coin trail along the bus roof (reward for the sneakers jump)
    for (let c = -BUS_LENGTH / 2 + 3; c <= BUS_LENGTH / 2 - 3; c += 3) {
      this.spawnCoin(laneX, TRAIN_HEIGHT + 0.9, z + c);
    }
  }

  private spawnBarrierLow(lane: number, z: number) {
    const mesh = createBarrierLow();
    const laneX = getLaneX(lane);
    const cx = getTrackCurveX(z, this.distance, this.city);
    const angle = getTrackCurveAngle(z, this.distance, this.city);
    mesh.position.set(cx + laneX * Math.cos(angle), 0, z - laneX * Math.sin(angle));
    mesh.rotation.y = angle;
    this.scene.add(mesh);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: 'barrier_low',
      lane,
      group: mesh,
      z,
      y: 0,
      width: 2.2,
      height: 1.3,
      depth: 0.5,
    });

    // Jump arc coins over low barrier
    for (let c = -2; c <= 2; c++) {
      const coinZ = z + c * 2.2;
      const coinY = 1.0 + Math.cos((c / 2) * (Math.PI / 2)) * 1.5;
      this.spawnCoin(laneX, coinY, coinZ);
    }
  }

  private spawnBarrierHigh(lane: number, z: number) {
    const mesh = createBarrierHigh();
    const laneX = getLaneX(lane);
    const cx = getTrackCurveX(z, this.distance, this.city);
    const angle = getTrackCurveAngle(z, this.distance, this.city);
    mesh.position.set(cx + laneX * Math.cos(angle), 0, z - laneX * Math.sin(angle));
    mesh.rotation.y = angle;
    this.scene.add(mesh);

    this.obstacles.push({
      id: this.nextObstacleId++,
      type: 'barrier_high',
      lane,
      group: mesh,
      z,
      y: 0,
      width: 2.3,
      height: 2.4,
      depth: 0.5,
    });

    // Low slide coins underneath — normal lanes only. In the Soweto bonus
    // lane the barrier already gets its own long coin row; these extras would
    // hang in front of the barrier and clip into it.
    if (Math.abs(lane) < 2) {
      for (let c = -1; c <= 1; c++) {
        this.spawnCoin(laneX, 0.4, z + c * 2.2);
      }
    }
  }

  private spawnCoin(x: number, y: number, z: number) {
    const mesh = createCoinMesh();
    // Round to the nearest lane but do NOT clamp — bonus-lane coins (lane ±2
    // on Soweto) must keep their lane or the per-frame update drags them back
    // to a permanent lane, leaving roof coins hanging over the wrong track.
    const lane = Math.round(x / LANE_WIDTH);
    const laneX = getLaneX(lane);
    const cx = getTrackCurveX(z, this.distance, this.city);
    const angle = getTrackCurveAngle(z, this.distance, this.city);
    const curX = cx + laneX * Math.cos(angle);
    const curZ = z - laneX * Math.sin(angle);
    mesh.position.set(curX, y, curZ);
    this.scene.add(mesh);

    this.activeCoins.push({
      id: this.nextObstacleId++,
      lane,
      group: mesh,
      x: curX,
      y,
      z,
      collected: false,
    });
  }

  private spawnPowerup(type: PowerupType, x: number, y: number, z: number) {
    const mesh = createPowerupMesh(type);
    // Same rule as spawnCoin: keep the true lane (bonus lane included).
    const lane = Math.round(x / LANE_WIDTH);
    const laneX = getLaneX(lane);
    const cx = getTrackCurveX(z, this.distance, this.city);
    const angle = getTrackCurveAngle(z, this.distance, this.city);
    const curX = cx + laneX * Math.cos(angle);
    const curZ = z - laneX * Math.sin(angle);
    mesh.position.set(curX, y, curZ);
    this.scene.add(mesh);

    this.activePowerups.push({
      id: this.nextObstacleId++,
      type,
      lane,
      group: mesh,
      x: curX,
      y,
      z,
      collected: false,
    });
  }

  private checkCollisions() {
    // Jetpack grants total invulnerability
    if (this.powerups.jetpack > 0) {
      this.groundY = 0;
      return;
    }

    let foundTrainRoof = false;

    for (const obs of this.obstacles) {
      // Check X overlap
      const obsX = getLaneX(obs.lane);
      const xDist = Math.abs(this.playerX - obsX);
      if (xDist > obs.width / 2 + 0.35) continue;

      // Check Z overlap
      const zDist = Math.abs(this.playerZ - obs.z);
      if (zDist > obs.depth / 2 + 0.4) continue;

      // Handle Train (and school bus — both use the roof-riding logic)
      if (obs.type === 'train') {
        const trainTopY = obs.y + obs.height;

        // Check if player is on or landing onto the roof of the train
        if (this.playerY >= trainTopY - 0.4 && this.playerVy <= 0.8) {
          this.groundY = trainTopY;
          this.standingRoofY = trainTopY;
          foundTrainRoof = true;
          continue;
        }

        // High-power jump (super sneakers): while ascending, let the player
        // pass through the train volume if their predicted apex clears the
        // roof — they land on top via the roof check when they come down.
        if (this.playerVy > 0.8) {
          const apexY = this.playerY + (this.playerVy * this.playerVy) / (2 * GRAVITY);
          if (apexY >= trainTopY) continue;
        }

        // Side Stumble vs Frontal Crash:
        if (xDist > obs.width / 2 - 0.25) {
          // Grazed side of train while changing lanes!
          this.stumble();
          continue;
        }

        // Direct frontal impact with train!
        this.handleCrash();
        return;
      }

      // Handle Low Barrier (Must jump over) — weapon can smash it
      if (obs.type === 'barrier_low') {
        if (this.playerY > obs.height - 0.25) {
          // Safely jumped over!
          continue;
        }
        if (this.tryWeaponSmash(obs)) {
          this.obstacles = this.obstacles.filter((o) => o !== obs);
          continue;
        }
        this.handleCrash();
        return;
      }

      // Handle High Barrier (Must slide under) — weapon can smash it
      if (obs.type === 'barrier_high') {
        if (this.isRolling && this.playerY <= 0.6) {
          // Safely sliding under!
          continue;
        }
        if (this.tryWeaponSmash(obs)) {
          this.obstacles = this.obstacles.filter((o) => o !== obs);
          continue;
        }
        this.handleCrash();
        return;
      }
    }

    if (!foundTrainRoof) {
      // Dropping off back or side of a train/car roof onto the ground.
      // Compare against the actual roof we were standing on (car roofs are
      // low — TRAIN_HEIGHT-based checks would leave the player floating).
      if (this.playerY >= this.standingRoofY - 0.2) {
        this.groundY = 0;
        this.standingRoofY = 0;
      }
    }
  }

  private stumble() {
    if (this.stumbleTimer > 0) {
      // Already stumbled and inspector was close -> CAUGHT!
      this.handleCrash();
      return;
    }
    this.stumbleTimer = 3.5;
    this.triggerSplash('OUCH!', 'pow');
    sound.playStumble();
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
  }

  private handleCrash() {
    // If Hoverboard is active, it sacrifices itself and saves the player!
    if (this.hasHoverboard) {
      this.hasHoverboard = false;
      this.hoverboardTimer = 0;
      this.playerModel.hoverboardMesh.visible = false;
      this.triggerSplash('WHAM!', 'boom');
      sound.playCrash();
      if (navigator.vibrate) navigator.vibrate([60, 30, 80]);

      // Knock back & clear nearby obstacles in this lane
      this.playerY = 0;
      this.groundY = 0;
      this.obstacles = this.obstacles.filter((o) => {
        if (Math.abs(o.z - this.playerZ) < 15 && o.lane === this.targetLane) {
          this.scene.remove(o.group);
          return false;
        }
        return true;
      });
      return;
    }

    // Character power: extra lives — Mr. Bones (1) / Skullface (2) survive a
    // fatal crash this many times (consumed one per crash, like the hoverboard).
    if (this.characterPowers.extraLives > 0) {
      this.characterPowers.extraLives--;
      this.triggerSplash(this.characterPowers.extraLives > 0 ? 'EXTRA LIFE!' : 'SAVED!', 'power');
      sound.playPowerup();
      if (navigator.vibrate) navigator.vibrate([60, 30, 80]);
      // Same recovery as the hoverboard save: back on the ground, lane cleared
      this.playerY = 0;
      this.groundY = 0;
      this.obstacles = this.obstacles.filter((o) => {
        if (Math.abs(o.z - this.playerZ) < 15 && o.lane === this.targetLane) {
          this.scene.remove(o.group);
          return false;
        }
        return true;
      });
      return;
    }

    // Fatal Crash - Run Over!
    this.isRunning = false;
    const fatalWords = ['KAPOW!', 'CRASH!', 'BOOM!', 'SMASH!'];
    this.triggerSplash(fatalWords[Math.floor(Math.random() * fatalWords.length)], 'kapow');
    sound.stopBGM();
    sound.playCrash();
    if (navigator.vibrate) navigator.vibrate([150, 50, 200]);

    // Save High Score & Total Coins to LocalStorage
    const finalScore = this.score;
    const newHighScore = Math.max(this.highScore, finalScore);
    const newTotalCoins = this.totalCoins + this.coins;
    localStorage.setItem('mzansi_high_score', newHighScore.toString());
    localStorage.setItem('mzansi_total_coins', newTotalCoins.toString());

    this.callbacks.onGameOver({
      score: finalScore,
      coins: this.coins,
      distance: Math.floor(this.distance),
      multiplier: this.multiplier,
      highScore: newHighScore,
      totalCoins: newTotalCoins,
    });
  }


  // Soweto art-direction pass: small inexpensive meshes dress the existing GLB assets.
  // They belong to the scenery groups and therefore follow the curved/recycled track.
  private createSowetoStreetArt(index: number, side: -1 | 1): THREE.Group {
    const scene = new THREE.Group();
    const palette = [0xf59e0b, 0x06b6d4, 0xf43f5e, 0x84cc16, 0xa855f7];
    const paint = (hex: number) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.82 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.5, 0.28), paint(palette[(index + (side + 1)) % palette.length]));
    wall.position.set(0, 1.25, side * 2.0);
    scene.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 0.55), paint(0x111827));
    cap.position.set(0, 2.53, side * 2.0);
    scene.add(cap);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.18, 0.35), paint(0xfef08a));
    trim.position.set(0, 0.53, side * 1.8);
    scene.add(trim);
    // Shop mural uses a local canvas texture: no external image requests or new GLB dependencies.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 512, 192);
      ctx.fillStyle = ['#facc15', '#38bdf8', '#f472b6'][index % 3];
      ctx.fillRect(10, 10, 492, 172);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 68px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(['KASI VIBES', 'SPAZA!', 'SOWETO', 'STREET ART'][index % 4], 256, 117);
      const muralTexture = new THREE.CanvasTexture(canvas);
      muralTexture.colorSpace = THREE.SRGBColorSpace;
      const mural = new THREE.Mesh(new THREE.PlaneGeometry(4.75, 1.65), new THREE.MeshBasicMaterial({ map: muralTexture, side: THREE.DoubleSide }));
      mural.position.set(0, 1.55, side * 1.82);
      mural.rotation.y = side < 0 ? Math.PI : 0;
      scene.add(mural);
    }
    scene.position.set(side * 0.6, 0, 0);
    return scene;
  }

  /**
   * Abstract cyberpunk roadside element: rotating neon monolith slab, a holo
   * pylon with pulsing rings, or a light arch spanning toward the road.
   * Purely decorative, no house-like geometry.
   */
  private createCyberPunkProp(side: -1 | 1, index: number, lod: 0 | 1): THREE.Group {
    const NEON = [0x22d3ee, 0xa855f7, 0xf472b6, 0x4ade80, 0x60a5fa];
    const neon = NEON[index % NEON.length];
    const neon2 = NEON[(index + 2) % NEON.length];
    const kind = index % 3;
    const group = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b1026, roughness: 0.4, metalness: 0.6 });
    const neonMat = new THREE.MeshBasicMaterial({ color: neon });

    if (kind === 0) {
      // Monolith slab with glowing edge lines
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9 + (index % 3) * 2.5, 1.1), darkMat);
      slab.position.y = 4.5;
      slab.castShadow = !lod;
      group.add(slab);
      const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 9 + (index % 3) * 2.5, 0.16), neonMat);
      edgeL.position.set(-0.55, 4.5, 0.55);
      const edgeR = edgeL.clone(); edgeR.position.x = 0.55; edgeR.position.z = -0.55;
      group.add(edgeL, edgeR);
      // Floating halo ring near the top
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: neon2 }));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 10.5 + (index % 3);
      group.add(halo);
    } else if (kind === 1) {
      // Holo pylon: stacked glowing discs on a dark core
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 11, 8), darkMat);
      core.position.y = 5.5;
      core.castShadow = !lod;
      group.add(core);
      const discMat = new THREE.MeshBasicMaterial({ color: neon, transparent: true, opacity: 0.55 });
      for (let d = 0; d < 5; d++) {
        const disc = new THREE.Mesh(new THREE.TorusGeometry(1.15 - d * 0.14, 0.09, 8, 20), discMat);
        disc.rotation.x = Math.PI / 2;
        disc.position.y = 2.2 + d * 2.1;
        group.add(disc);
      }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), neonMat);
      cap.position.y = 11.3;
      group.add(cap);
    } else {
      // Light arch: two pylons + a glowing beam angled over the road
      const py1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 7.5, 0.7), darkMat);
      py1.position.y = 3.75;
      py1.castShadow = !lod;
      group.add(py1);
      const beamMat = new THREE.MeshBasicMaterial({ color: neon });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 9), beamMat);
      beam.position.set(-side * 4.2, 7.2, 0);
      beam.rotation.y = side * 0.45;
      group.add(beam);
      const beam2 = beam.clone();
      beam2.position.y = 6.4;
      beam2.material = new THREE.MeshBasicMaterial({ color: neon2 });
      group.add(beam2);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), neonMat);
      tip.position.set(0, 7.7, 0);
      group.add(tip);
    }

    // Ground glow pad under the prop
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 20),
      new THREE.MeshBasicMaterial({ color: neon, transparent: true, opacity: 0.28 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.05;
    group.add(pad);

    return group;
  }

  private initSideScenery() {
    this.sideSceneryGroup.clear();
    this.sideScenery = [];
    this.veldPropsGroup.clear();
    this.veldProps = [];

    const city = this.city;
    const spacing = 16;
    const count = 16;
    // Loading is asynchronous. Each instance starts empty and fills itself with
    // the corresponding embedded-texture GLB; scenery never blocks game startup.
    const model = (name: string, lod: 0 | 1 | 2 = 0, artVariant?: number) =>
      assetManager.instantiate(name, { lod, artVariant });

    for (let i = 0; i < count; i++) {
      const zL = 16 - i * spacing;
      const zR = 8 - i * spacing;
      let groupL: THREE.Group;
      let groupR: THREE.Group;
      let offsetL = -12.5;
      let offsetR = 12.5;
      let rotL = 0;
      let rotR = 0;
      // Distance LODs keep GPU load in check for the two distant sides.
      const lod: 0 | 1 = i > 8 ? 1 : 0;

      if (city === 'soweto') {
        const left = ['sa_minibus_taxi', 'soweto_shack', 'kasi_spaza_shop',
          'shipping_container', 'power_pole', 'market_stall',
          'bus_stop_taxi_rank', 'graffiti_wall', 'station_lamp_post'];
        const right = ['soweto_shack', 'sa_minibus_taxi', 'kasi_spaza_shop',
          'street_bench', 'railway_station',
          'recycling_bin', 'station_lamp_post', 'fence', 'dumpster'];
        groupL = model(left[i % left.length], lod, i);
        groupR = model(right[i % right.length], lod, i + 3);
        // Optional third-party city buildings: use installed CC0 Kenney GLBs
        // in selected slots. If absent, keep the original South African scenery.
        if (i % 4 === 1) groupL = createOptionalKenneyBuilding('suburban', groupL, i);
        if (i % 4 === 2) groupR = createOptionalKenneyBuilding('commercial', groupR, i);
        if ([1, 2, 6].includes(i % left.length)) rotL = Math.PI / 2;
        if ([0, 2, 5].includes(i % right.length)) rotR = -Math.PI / 2;
        // Cluster small textured street props into lived-in blocks (well
        // outside the collision lanes) — the art sheet's "inhabited street" look.
        if (i % 3 === 0) {
          const roadsideDetail = model('street_bench', lod);
          roadsideDetail.position.set(-2.7, 0, 2.4);
          groupL.add(roadsideDetail);
        }
        if (i % 4 === 1) {
          const roadsideDetail = model('recycling_bin', lod);
          roadsideDetail.position.set(2.8, 0, -2.4);
          groupR.add(roadsideDetail);
        }
        if (i % 5 === 2) {
          const roadsideDetail = model('tyre_stack', lod);
          roadsideDetail.position.set(-2.6, 0, -2.2);
          groupL.add(roadsideDetail);
        }
        offsetL = -13.5;
        offsetR = 13.5;
      } else if (city === 'durban') {
        const left = ['palm_tree', 'durban_lifeguard_hut', 'surfboards',
          'palm_tree', 'fishing_boat', 'street_bench'];
        const right = ['palm_tree', 'surfboards', 'durban_lifeguard_hut',
          'palm_tree', 'market_stall', 'lamp_post'];
        groupL = model(left[i % left.length], lod, i);
        groupR = model(right[i % right.length], lod, i + 2);
        offsetL = -14;
        offsetR = 14;
        if (i % 7 === 1) rotL = Math.PI / 2;
        if (i % 7 === 2) rotR = -Math.PI / 2;
      } else if (city === 'capetown') {
        const left = ['cape_town_bokaap_house', 'lamp_post',
          'cape_town_bokaap_house', 'market_stall', 'traffic_light'];
        const right = ['cape_town_bokaap_house', 'street_bench',
          'cape_town_bokaap_house', 'lamp_post', 'traffic_light'];
        groupL = model(left[i % left.length], lod, i);
        groupR = model(right[i % right.length], lod, i + 2);
        rotL = i % 6 === 0 || i % 6 === 2 ? Math.PI / 2 : 0;
        rotR = i % 6 === 0 || i % 6 === 2 ? -Math.PI / 2 : 0;
        offsetL = -13.3;
        offsetR = 13.3;
      } else if (city === 'nelspruit') {
        const left = ['nelspruit_building', 'indigenous_tree',
          'market_stall', 'nelspruit_building', 'street_bench'];
        const right = ['indigenous_tree', 'nelspruit_building',
          'bus_stop_taxi_rank', 'palm_tree', 'nelspruit_building'];
        groupL = model(left[i % left.length], lod);
        groupR = model(right[i % right.length], lod);
        rotL = i % 6 === 0 || i % 6 === 3 ? Math.PI / 2 : 0;
        rotR = i % 6 === 1 || i % 6 === 4 ? -Math.PI / 2 : 0;
        offsetL = -13.5;
        offsetR = 13.5;
      } else if (city === 'neon_city') {
        // Cyberpunk district: NO houses — abstract neon monoliths, holo pylons
        // and light arches frame the 5-lane asphalt. Bases are placed wide to
        // clear the extra road width.
        groupL = this.createCyberPunkProp(-1, i, lod);
        groupR = this.createCyberPunkProp(1, i, lod);
        offsetL = -16;
        offsetR = 16;
      } else {
        // Wild Coast: refined Eastern Cape houses plus landscape foliage.
        const left = ['eastern_cape_house', 'indigenous_tree',
          'eastern_cape_house', 'indigenous_tree', 'market_stall'];
        const right = ['indigenous_tree', 'eastern_cape_house',
          'indigenous_tree', 'eastern_cape_house', 'fishing_boat'];
        groupL = model(left[i % left.length], lod);
        groupR = model(right[i % right.length], lod);
        rotL = i % 6 === 0 || i % 6 === 3 ? Math.PI / 2 : 0;
        rotR = i % 6 === 1 || i % 6 === 4 ? -Math.PI / 2 : 0;
        offsetL = -14;
        offsetR = 14;
      }

      this.sideSceneryGroup.add(groupL);
      this.sideScenery.push({ group: groupL, z: zL, sideOffset: offsetL, localRotY: rotL });
      this.sideSceneryGroup.add(groupR);
      this.sideScenery.push({ group: groupR, z: zR, sideOffset: offsetR, localRotY: rotR });
    }
    this.updateSideSceneryPositions(0);
  }

  /** Scatter low-poly rocks & shrubs across both grass shoulders. */
  private initVeldProps() {
    this.veldPropsGroup.clear();
    this.veldProps = [];
    // Neon City is a paved metropolis — no rocks or shrubs there.
    if (this.city === 'neon_city') return;
    const count = 40;
    for (let i = 0; i < count; i++) {
      const group = createVeldProp(Math.random() > 0.45 ? 'shrub' : 'rock');
      const side = Math.random() > 0.5 ? 1 : -1;
      // Keep props off the track and out of the collision lanes
      const sideOffset = side * (9 + Math.random() * 16);
      const z = 16 - i * (240 / count) - Math.random() * 4;
      this.veldPropsGroup.add(group);
      this.veldProps.push({ group, z, sideOffset, localRotY: Math.random() * Math.PI * 2 });
    }
    this.updateVeldPropsPositions(0);
  }

  private updateVeldPropsPositions(stepDist: number) {
    for (const item of this.veldProps) {
      item.z += stepDist;
      if (item.z > 25) {
        item.z -= 256;
      }
      const cx = getTrackCurveX(item.z, this.distance, this.city);
      const angle = getTrackCurveAngle(item.z, this.distance, this.city);
      item.group.position.set(cx + item.sideOffset * Math.cos(angle), 0.02, item.z - item.sideOffset * Math.sin(angle));
      item.group.rotation.y = item.localRotY;
    }
  }

  private updateSideSceneryPositions(stepDist: number) {
    for (let i = 0; i < this.sideScenery.length; i++) {
      const item = this.sideScenery[i];
      item.z += stepDist;
      if (item.z > 25) {
        item.z -= 256;
      }
      const cx = getTrackCurveX(item.z, this.distance, this.city);
      const angle = getTrackCurveAngle(item.z, this.distance, this.city);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      item.group.position.x = cx + item.sideOffset * cosA;
      item.group.position.z = item.z - item.sideOffset * sinA;
      item.group.rotation.y = angle + item.localRotY;
    }
  }

  private clearSpawnedObjects() {
    this.obstacles.forEach((o) => this.scene.remove(o.group));
    this.obstacles = [];

    this.activeCoins.forEach((c) => this.scene.remove(c.group));
    this.activeCoins = [];

    this.activePowerups.forEach((p) => this.scene.remove(p.group));
    this.activePowerups = [];

    this.particles.forEach((p) => this.particleGroup.remove(p.mesh));
    this.particles = [];
  }

  public dispose() {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    sound.stopBGM();
    this.cleanupListeners();
    this.clearSpawnedObjects();
    this.sideSceneryGroup.clear();
    this.sideScenery = [];
    this.veldPropsGroup.clear();
    this.veldProps = [];
    if (this.groundMesh) {
      this.groundMesh.geometry.dispose();
      (this.groundMesh.material as THREE.Material).dispose();
    }
    if (this.railsMesh) {
      this.railsMesh.geometry.dispose();
      (this.railsMesh.material as THREE.Material).dispose();
    }
    if (this.bonusRailsMesh) {
      this.bonusRailsMesh.geometry.dispose();
      (this.bonusRailsMesh.material as THREE.Material).dispose();
    }
    if (this.bonusTiesMesh) {
      this.bonusTiesMesh.geometry.dispose();
      (this.bonusTiesMesh.material as THREE.Material).dispose();
    }
    if (this.bonusBeaconMesh) {
      this.bonusBeaconMesh.geometry.dispose();
      (this.bonusBeaconMesh.material as THREE.Material).dispose();
    }
    if (this.bonusSideFenceL) {
      for (const panel of [...this.bonusSideFenceL, ...this.bonusSideFenceR]) {
        this.scene.remove(panel);
      }
    }
    if (this.curbsMesh) {
      this.curbsMesh.geometry.dispose();
      (this.curbsMesh.material as THREE.Material).dispose();
    }
    if (this.tiesInstancedMesh) {
      this.tiesInstancedMesh.geometry.dispose();
      (this.tiesInstancedMesh.material as THREE.Material).dispose();
    }
    if (this.ballastTexture) {
      this.ballastTexture.dispose();
    }
    for (const mesh of [this.shoulderMeshL, this.shoulderMeshR]) {
      if (mesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    }
    if (this.shoulderTexture) {
      this.shoulderTexture.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
