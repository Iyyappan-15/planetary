import * as THREE from 'three';
import { clamp } from '../utils/math';

export class CameraController {
  public camera: THREE.PerspectiveCamera;

  // Spherical state
  private currentRadius: number = 7.0;
  private targetRadius: number = 7.0;
  private minRadius: number = 2.8;
  private maxRadius: number = 18.0;

  private currentTheta: number = -1.386; // Azimuthal angle centered on India (lon 79.4E)
  private targetTheta: number = -1.386;

  private currentPhi: number = 1.232; // Polar angle centered on lat 19.4N
  private targetPhi: number = 1.232;
  private minPhi: number = 0.05;
  private maxPhi: number = Math.PI - 0.05;

  // Interaction flags
  private isDragging: boolean = false;
  private prevMouseX: number = 0;
  private prevMouseY: number = 0;

  // Screen trauma / shake
  private trauma: number = 0;
  private traumaDecay: number = 1.6; // Decay per second
  private shakeOffset: THREE.Vector3 = new THREE.Vector3();

  // Settings
  public sensitivity: number = 1.0;
  public shakeEnabled: boolean = true;

  // Target point (planet center)
  public center: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  constructor(aspectRatio: number) {
    this.camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
    this.updateCameraPosition();
  }

  public handleMouseDown(e: MouseEvent): void {
    // Only right click or middle click, or drag when explicitly allowed
    if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    }
  }

  public startDrag(clientX: number, clientY: number): void {
    this.isDragging = true;
    this.prevMouseX = clientX;
    this.prevMouseY = clientY;
  }

  public handleMouseMove(clientX: number, clientY: number): void {
    if (!this.isDragging) return;

    const deltaX = clientX - this.prevMouseX;
    const deltaY = clientY - this.prevMouseY;

    this.prevMouseX = clientX;
    this.prevMouseY = clientY;

    const factor = 0.005 * this.sensitivity;
    this.targetTheta -= deltaX * factor;
    this.targetPhi = clamp(this.targetPhi - deltaY * factor, this.minPhi, this.maxPhi);
  }

  public stopDrag(): void {
    this.isDragging = false;
  }

  public handleWheel(deltaY: number): void {
    const zoomFactor = deltaY * 0.005 * this.sensitivity;
    this.targetRadius = clamp(this.targetRadius + zoomFactor, this.minRadius, this.maxRadius);
  }

  public addTrauma(amount: number): void {
    if (!this.shakeEnabled) return;
    this.trauma = clamp(this.trauma + amount, 0, 1.0);
  }

  public resetCamera(): void {
    this.targetRadius = 7.0;
    this.targetTheta = -1.386;
    this.targetPhi = 1.232;
  }

  public setPlanetRadius(radius: number): void {
    this.minRadius = radius * 1.12; // Allow close satellite orbit inspection
    this.maxRadius = radius * 8.0;
    this.targetRadius = clamp(this.targetRadius, this.minRadius, this.maxRadius);
  }

  /**
   * Smoothly locks the camera into low-orbital satellite inspection over target coordinates
   */
  public focusOnCoordinates(lat: number, lon: number, altitudeMultiplier: number = 1.35): void {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    this.targetPhi = clamp(phi, this.minPhi, this.maxPhi);
    // Adjust theta for current camera angle convention
    this.targetTheta = -theta + Math.PI;
    this.targetRadius = clamp(this.minRadius * altitudeMultiplier, this.minRadius, this.maxRadius);
  }

  public update(delta: number): void {
    // Smooth damping
    const dampFactor = Math.min(1, delta * 10);
    this.currentRadius += (this.targetRadius - this.currentRadius) * dampFactor;
    this.currentTheta += (this.targetTheta - this.currentTheta) * dampFactor;
    this.currentPhi += (this.targetPhi - this.currentPhi) * dampFactor;

    // Process screen trauma
    if (this.trauma > 0) {
      const shakePower = Math.pow(this.trauma, 2) * 0.4;
      const time = performance.now() * 0.035;
      this.shakeOffset.set(
        Math.sin(time * 1.3) * shakePower,
        Math.cos(time * 1.7) * shakePower,
        Math.sin(time * 2.1) * shakePower
      );
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * delta);
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const x = this.currentRadius * Math.sin(this.currentPhi) * Math.sin(this.currentTheta);
    const y = this.currentRadius * Math.cos(this.currentPhi);
    const z = this.currentRadius * Math.sin(this.currentPhi) * Math.cos(this.currentTheta);

    this.camera.position.set(x, y, z).add(this.shakeOffset);
    this.camera.lookAt(this.center);
  }

  public updateAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
