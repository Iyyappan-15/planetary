import * as THREE from 'three';
import { GraphicsSettings } from '../types/game';
import { disposeNode } from '../utils/disposal';

export class SceneManager {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  private starField: THREE.Points | null = null;

  constructor(canvas: HTMLCanvasElement, settings: GraphicsSettings) {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: settings.quality !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Dramatic celestial sun illumination (shining from front-right)
    this.sunLight = new THREE.DirectionalLight(0xfffdf5, 2.8);
    this.sunLight.position.set(12, 5, 14).normalize().multiplyScalar(25);
    this.scene.add(this.sunLight);

    // Deep space ambient fill (ensures unlit side is visible with realistic space contrast)
    this.ambientLight = new THREE.AmbientLight(0x223355, 0.75);
    this.scene.add(this.ambientLight);

    this.createSpaceEnvironment();
  }

  private createSpaceEnvironment(): void {
    // Generate multi-magnitude procedural starfield
    const starCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    const starPalettes = [
      new THREE.Color(0xffffff), // Pure white
      new THREE.Color(0xdbeafe), // Blue-white
      new THREE.Color(0xfef3c7), // Warm yellow
      new THREE.Color(0xfed7aa), // Soft orange
      new THREE.Color(0x93c5fd), // Cyan-blue
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 250 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const color = starPalettes[Math.floor(Math.random() * starPalettes.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = Math.random() < 0.92 ? 1.0 + Math.random() * 1.4 : 2.4 + Math.random() * 2.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: false,
    });

    this.starField = new THREE.Points(geometry, material);
    this.scene.add(this.starField);
  }

  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  public updateSettings(settings: GraphicsSettings): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatio));
  }

  public render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  public dispose(): void {
    if (this.starField) {
      this.scene.remove(this.starField);
      disposeNode(this.starField);
      this.starField = null;
    }
    this.renderer.dispose();
  }
}
