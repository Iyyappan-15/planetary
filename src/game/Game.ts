import * as THREE from 'three';
import { GameSettings, PlanetIntegrity } from '../types/game';
import { WeaponId, TargetInfo } from '../types/weapon';
import { PlanetConfig } from '../types/planet';
import { PLANET_PRESETS } from '../data/planets';
import { SceneManager } from '../renderer/SceneManager';
import { CameraController } from '../renderer/CameraController';
import { Planet } from '../planets/Planet';
import { WeaponManager } from '../weapons/WeaponManager';
import { ParticleSystem } from '../effects/ParticleSystem';
import { ShockwaveSystem } from '../effects/Shockwave';
import { AudioManager } from '../audio/AudioManager';
import { GravityWellWeapon } from '../weapons/gravity/GravityWell';
import { latLonToVector3, vector3ToUV } from '../utils/math';
import { ShieldType, ActiveShieldState } from '../types/shield';
import { MoonSystem, MoonState } from '../planets/MoonSystem';

export interface GameCallbacks {
  onIntegrityChange?: (integrity: PlanetIntegrity) => void;
  onTargetChange?: (target: TargetInfo | null) => void;
  onActiveWeaponChange?: (weaponId: WeaponId | null) => void;
  onShieldChange?: (shield: ActiveShieldState | null) => void;
  onMoonStateChange?: (state: MoonState | null) => void;
  onSolarViewChange?: (isSolarView: boolean) => void;
}

export class Game {
  public canvas: HTMLCanvasElement;
  public settings: GameSettings;
  public callbacks: GameCallbacks;

  public sceneManager: SceneManager;
  public cameraController: CameraController;
  public planet: Planet;
  public weaponManager: WeaponManager;
  public particleSystem: ParticleSystem;
  public shockwaveSystem: ShockwaveSystem;
  public audioManager: AudioManager;

  public moonSystem: MoonSystem | null = null;

  private isRunning: boolean = false;
  private animationFrameId: number = 0;
  private lastTime: number = 0;

  private isPointerOverCanvas: boolean = false;
  private currentMouseX: number = 0;
  private currentMouseY: number = 0;
  private wasDestroyed: boolean = false;
  private isRotationPaused: boolean = false;

  constructor(canvas: HTMLCanvasElement, settings: GameSettings, callbacks: GameCallbacks = {}) {
    this.canvas = canvas;
    this.settings = settings;
    this.callbacks = callbacks;

    // 1. Renderer & Scene
    this.sceneManager = new SceneManager(canvas, settings.graphics);

    // 2. Camera Controller
    this.cameraController = new CameraController(window.innerWidth / window.innerHeight);
    this.cameraController.sensitivity = settings.cameraSensitivity;
    this.cameraController.shakeEnabled = settings.graphics.screenShake;

    // 3. Audio Manager
    this.audioManager = new AudioManager(settings.audio);

    // 4. Effects
    this.particleSystem = new ParticleSystem(settings.graphics.maxParticles);
    this.sceneManager.scene.add(this.particleSystem.group);

    this.shockwaveSystem = new ShockwaveSystem();
    this.sceneManager.scene.add(this.shockwaveSystem.group);

    // 5. Default Planet (Earth)
    const defaultPlanetConfig = PLANET_PRESETS.find((p) => p.id === 'earth') || PLANET_PRESETS[0];
    this.planet = new Planet(defaultPlanetConfig, this.sceneManager.sunLight.position, (state) => {
      this.callbacks.onShieldChange?.(state);
    });
    this.planet.setShieldContext({
      scene: this.sceneManager.scene,
      particleSystem: this.particleSystem,
      audioManager: this.audioManager,
      cameraController: this.cameraController,
    });
    this.sceneManager.scene.add(this.planet.group);
    this.cameraController.setPlanetRadius(defaultPlanetConfig.radius);
    this.hookPlanetCallbacks();

    // Initialize Moon if default world is Earth
    if (defaultPlanetConfig.id === 'earth') {
      this.initMoonSystem();
    }

    // 6. Weapon Manager
    this.weaponManager = new WeaponManager();
    this.sceneManager.scene.add(this.weaponManager.targetMarker);

    // Bind event listeners
    this.bindEvents();
  }

  private initMoonSystem(): void {
    if (this.moonSystem) {
      this.sceneManager.scene.remove(this.moonSystem.group);
      this.moonSystem.dispose();
      this.moonSystem = null;
    }
    this.moonSystem = new MoonSystem();
    this.sceneManager.scene.add(this.moonSystem.group);
    this.callbacks.onMoonStateChange?.(this.moonSystem.state);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.update(delta);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(delta: number): void {
    const context = {
      scene: this.sceneManager.scene,
      planet: this.planet,
      cameraController: this.cameraController,
      particleSystem: this.particleSystem,
      shockwaveSystem: this.shockwaveSystem,
      audioManager: this.audioManager,
      moonMesh: this.moonSystem?.moonMesh,
    };

    // Update targeting if pointer is over canvas
    let target: TargetInfo | null = null;
    if (this.isPointerOverCanvas) {
      target = this.weaponManager.updateTargeting(
        this.currentMouseX,
        this.currentMouseY,
        this.canvas.clientWidth,
        this.canvas.clientHeight,
        this.cameraController.camera,
        context
      );
    }
    this.callbacks.onTargetChange?.(target);

    // Check gravity well position for physics attraction
    const gravWeapon = this.weaponManager.getActiveWeapon();
    let gravPos: THREE.Vector3 | null = null;
    if (gravWeapon instanceof GravityWellWeapon) {
      gravPos = gravWeapon.currentWellPosition;
    }

    // Update sub-systems
    this.cameraController.update(delta);

    // Dynamic Google Earth daylight illumination: keeps the visible hemisphere in clear, natural sunlight
    if (!this.planet.config.isStar) {
      const camPos = this.cameraController.camera.position.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(camPos, up).normalize();
      const sunDir = camPos
        .clone()
        .addScaledVector(right, -0.38)
        .addScaledVector(up, 0.42)
        .normalize();
      this.sceneManager.sunLight.position.copy(sunDir).multiplyScalar(30);
    }

    this.planet.update(delta, this.sceneManager.sunLight.position, gravPos);

    if (this.moonSystem) {
      this.moonSystem.update(delta, {
        scene: this.sceneManager.scene,
        planet: this.planet,
        particleSystem: this.particleSystem,
        shockwaveSystem: this.shockwaveSystem,
        cameraController: this.cameraController,
        audioManager: this.audioManager,
      });
      this.callbacks.onMoonStateChange?.(this.moonSystem.state);
    }

    this.weaponManager.update(delta, context);
    this.shockwaveSystem.update(delta);
    this.particleSystem.update(delta, gravPos);

    // Notify integrity changes
    const integrity = this.planet.getIntegrity();
    this.callbacks.onIntegrityChange?.(integrity);

    if (this.planet.isDestroyed && !this.wasDestroyed) {
      this.wasDestroyed = true;
      this.audioManager.playPlanetBreakup();
      this.cameraController.addTrauma(0.95);
    } else if (!this.planet.isDestroyed && this.wasDestroyed) {
      this.wasDestroyed = false;
    }
  }

  private render(): void {
    this.sceneManager.render(this.cameraController.camera);
  }

  public setPlanet(id: string): void {
    const newConfig = PLANET_PRESETS.find((p) => p.id === id);
    if (!newConfig || this.planet.config.id === id) return;

    // Clean up old planet
    this.sceneManager.scene.remove(this.planet.group);
    this.planet.dispose();

    // Clear particles & shockwaves
    this.particleSystem.clear();
    this.shockwaveSystem.clear();

    // Instantiate new planet
    this.planet = new Planet(newConfig, this.sceneManager.sunLight.position, (state) => {
      this.callbacks.onShieldChange?.(state);
    });
    this.planet.setShieldContext({
      scene: this.sceneManager.scene,
      particleSystem: this.particleSystem,
      audioManager: this.audioManager,
      cameraController: this.cameraController,
    });
    this.planet.isRotationPaused = this.isRotationPaused;
    this.planet.setCloudsVisible(this.isCloudsVisible);
    this.sceneManager.scene.add(this.planet.group);

    this.cameraController.setPlanetRadius(newConfig.radius);
    this.cameraController.resetCamera();
    this.hookPlanetCallbacks();
    this.wasDestroyed = false;

    // Handle Moon for Earth
    if (newConfig.id === 'earth') {
      this.initMoonSystem();
    } else if (this.moonSystem) {
      this.sceneManager.scene.remove(this.moonSystem.group);
      this.moonSystem.dispose();
      this.moonSystem = null;
      this.callbacks.onMoonStateChange?.(null);
    }

    this.audioManager.playReset();
  }

  public deployShield(type: ShieldType): void {
    this.planet.deployShield(type);
  }

  public removeShield(): void {
    this.planet.removeShield();
  }

  private hookPlanetCallbacks(): void {
    this.planet.fractureSystem.onCoreExplode = () => {
      this.audioManager.playPlanetBreakup();
      this.cameraController.addTrauma(1.0);
      this.particleSystem.emit(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1, 0),
        180,
        '#ff9933',
        2.5,
        10.0,
        3.0,
        1.0
      );
    };
  }

  public setWeapon(id: WeaponId | null): void {
    const context = {
      scene: this.sceneManager.scene,
      planet: this.planet,
      cameraController: this.cameraController,
      particleSystem: this.particleSystem,
      shockwaveSystem: this.shockwaveSystem,
      audioManager: this.audioManager,
    };
    this.weaponManager.setActiveWeapon(id, context);
    this.callbacks.onActiveWeaponChange?.(id);
    this.audioManager.playUiClick();
  }

  public isCloudsVisible: boolean = true;

  public setRotationPaused(paused: boolean): void {
    this.isRotationPaused = paused;
    this.planet.isRotationPaused = paused;
  }

  public setCloudsVisible(visible: boolean): void {
    this.isCloudsVisible = visible;
    this.planet.setCloudsVisible(visible);
  }

  public focusOnCoordinates(lat: number, lon: number): void {
    this.cameraController.focusOnCoordinates(lat, lon);
  }

  public fireAtCoordinates(lat: number, lon: number, weaponId?: WeaponId | null): void {
    if (this.planet.isDestroyed) return;

    // Smoothly focus camera onto targeted coordinates
    this.cameraController.focusOnCoordinates(lat, lon);

    const chosenWeaponId = weaponId || this.weaponManager.activeWeaponId || 'meteor';
    const weapon = this.weaponManager.getWeapon(chosenWeaponId);
    if (!weapon) return;

    // Ensure weapon is active
    this.setWeapon(chosenWeaponId);

    // Compute surface coordinates in planet space
    const localPoint = latLonToVector3(lat, lon, this.planet.config.radius);
    const localNormal = localPoint.clone().normalize();

    // Transform to world space
    const worldPoint = localPoint.clone();
    this.planet.surfaceMesh.localToWorld(worldPoint);

    const worldNormal = localNormal.clone();
    worldNormal.transformDirection(this.planet.surfaceMesh.matrixWorld);

    const uv = vector3ToUV(localPoint);

    const target: TargetInfo = {
      point: worldPoint,
      normal: worldNormal,
      uv,
      lat,
      lon,
      distance: this.cameraController.camera.position.distanceTo(worldPoint),
    };

    const context = {
      scene: this.sceneManager.scene,
      planet: this.planet,
      cameraController: this.cameraController,
      particleSystem: this.particleSystem,
      shockwaveSystem: this.shockwaveSystem,
      audioManager: this.audioManager,
    };

    // Execute weapon strike with cinematic orbital trajectory
    setTimeout(() => {
      weapon.execute(target, context);
    }, 120);
  }

  public resetPlanet(): void {
    this.particleSystem.clear();
    this.shockwaveSystem.clear();
    this.planet.reset();
    this.cameraController.resetCamera();
    this.wasDestroyed = false;

    if (this.moonSystem) {
      this.moonSystem.reset();
      this.callbacks.onMoonStateChange?.(this.moonSystem.state);
    }

    this.audioManager.playReset();
  }

  public slingshotMoon(): void {
    if (!this.moonSystem) return;
    this.moonSystem.slingshot({
      scene: this.sceneManager.scene,
      planet: this.planet,
      particleSystem: this.particleSystem,
      shockwaveSystem: this.shockwaveSystem,
      cameraController: this.cameraController,
      audioManager: this.audioManager,
    });
    this.callbacks.onMoonStateChange?.(this.moonSystem.state);
  }

  public deorbitMoon(): void {
    if (!this.moonSystem) return;
    this.moonSystem.deorbit({
      scene: this.sceneManager.scene,
      planet: this.planet,
      particleSystem: this.particleSystem,
      shockwaveSystem: this.shockwaveSystem,
      cameraController: this.cameraController,
      audioManager: this.audioManager,
    });
    this.callbacks.onMoonStateChange?.(this.moonSystem.state);
  }

  public resetMoon(): void {
    if (!this.moonSystem) return;
    this.moonSystem.reset();
    this.callbacks.onMoonStateChange?.(this.moonSystem.state);
  }

  public toggleSolarView(): boolean {
    const isSolar = this.cameraController.toggleSolarView();
    this.callbacks.onSolarViewChange?.(isSolar);
    return isSolar;
  }

  public updateSettings(settings: GameSettings): void {
    this.settings = settings;
    this.sceneManager.updateSettings(settings.graphics);
    this.cameraController.sensitivity = settings.cameraSensitivity;
    this.cameraController.shakeEnabled = settings.graphics.screenShake;
    this.planet.setAtmosphereVisible(settings.graphics.atmosphere);
    this.planet.setCloudsVisible(settings.graphics.clouds);
    this.audioManager.updateSettings(settings.audio);
  }

  // ================= EVENT HANDLING =================

  private bindEvents(): void {
    const canvas = this.canvas;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerenter', () => {
      this.isPointerOverCanvas = true;
    });

    canvas.addEventListener('pointerleave', () => {
      this.isPointerOverCanvas = false;
      const context = {
        scene: this.sceneManager.scene,
        planet: this.planet,
        cameraController: this.cameraController,
        particleSystem: this.particleSystem,
        shockwaveSystem: this.shockwaveSystem,
        audioManager: this.audioManager,
      };
      this.weaponManager.stopContinuous(context);
    });

    canvas.addEventListener('pointerdown', (e) => {
      this.audioManager.unlock();

      if (e.button === 0 && !e.shiftKey) {
        // If a weapon is selected and aiming at planet, fire it
        if (this.weaponManager.activeWeaponId && this.weaponManager.currentTarget) {
          const context = {
            scene: this.sceneManager.scene,
            planet: this.planet,
            cameraController: this.cameraController,
            particleSystem: this.particleSystem,
            shockwaveSystem: this.shockwaveSystem,
            audioManager: this.audioManager,
          };
          this.weaponManager.startContinuous(context);
        } else {
          // If no weapon is selected or clicked in empty space, left drag orbits/rotates camera freely!
          this.cameraController.startDrag(e.clientX, e.clientY);
        }
      } else {
        // Right drag or shift drag = orbit camera
        this.cameraController.startDrag(e.clientX, e.clientY);
      }
    });

    window.addEventListener('pointermove', (e) => {
      this.currentMouseX = e.clientX;
      this.currentMouseY = e.clientY;
      this.cameraController.handleMouseMove(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', (e) => {
      this.cameraController.stopDrag();
      if (e.button === 0) {
        const context = {
          scene: this.sceneManager.scene,
          planet: this.planet,
          cameraController: this.cameraController,
          particleSystem: this.particleSystem,
          shockwaveSystem: this.shockwaveSystem,
          audioManager: this.audioManager,
        };
        this.weaponManager.stopContinuous(context);
      }
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.cameraController.handleWheel(e.deltaY);
      },
      { passive: false }
    );

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.sceneManager.resize(width, height);
    this.cameraController.updateAspect(width / height);
  };

  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.sceneManager.dispose();
    this.planet.dispose();
    this.weaponManager.dispose();
    this.particleSystem.dispose();
    this.shockwaveSystem.dispose();
  }
}
