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

export interface GameCallbacks {
  onIntegrityChange?: (integrity: PlanetIntegrity) => void;
  onTargetChange?: (target: TargetInfo | null) => void;
  onActiveWeaponChange?: (weaponId: WeaponId) => void;
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
    this.planet = new Planet(defaultPlanetConfig, this.sceneManager.sunLight.position);
    this.sceneManager.scene.add(this.planet.group);
    this.cameraController.setPlanetRadius(defaultPlanetConfig.radius);

    // 6. Weapon Manager
    this.weaponManager = new WeaponManager();
    this.sceneManager.scene.add(this.weaponManager.targetMarker);

    // Bind event listeners
    this.bindEvents();
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
    this.planet.update(delta, this.sceneManager.sunLight.position, gravPos);
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
    this.planet = new Planet(newConfig, this.sceneManager.sunLight.position);
    this.planet.isRotationPaused = this.isRotationPaused;
    this.sceneManager.scene.add(this.planet.group);

    this.cameraController.setPlanetRadius(newConfig.radius);
    this.cameraController.resetCamera();
    this.wasDestroyed = false;

    this.audioManager.playReset();
  }

  public setWeapon(id: WeaponId): void {
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

  public setRotationPaused(paused: boolean): void {
    this.isRotationPaused = paused;
    this.planet.isRotationPaused = paused;
  }

  public resetPlanet(): void {
    this.particleSystem.clear();
    this.shockwaveSystem.clear();
    this.planet.reset();
    this.cameraController.resetCamera();
    this.wasDestroyed = false;
    this.audioManager.playReset();
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
        // Left click = fire or start firing continuous weapon
        const context = {
          scene: this.sceneManager.scene,
          planet: this.planet,
          cameraController: this.cameraController,
          particleSystem: this.particleSystem,
          shockwaveSystem: this.shockwaveSystem,
          audioManager: this.audioManager,
        };

        if (this.weaponManager.currentTarget) {
          this.weaponManager.startContinuous(context);
        } else {
          // If clicked in empty space, allow rotating with left click as well!
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
