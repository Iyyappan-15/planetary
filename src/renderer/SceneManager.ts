import * as THREE from 'three';
import { GraphicsSettings } from '../types/game';
import { disposeNode } from '../utils/disposal';

export class SceneManager {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  private starField: THREE.Points | null = null;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, settings: GraphicsSettings) {
    this.canvas = canvas;
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
    this.renderer.toneMappingExposure = 1.1;

    // Deep space lighting
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    this.sunLight.position.set(15, 8, 12).normalize().multiplyScalar(20);
    this.scene.add(this.sunLight);

    // Subtle space ambient fill for the dark side
    this.ambientLight = new THREE.AmbientLight(0x0c1220, 0.4);
    this.scene.add(this.ambientLight);

    this.createSpaceEnvironment();
  }

  private createSpaceEnvironment(): void {
    // Generate multi-magnitude procedural starfield
    const starCount = 2500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    const starPalettes = [
      new THREE.Color(0xffffff), // Pure white
      new THREE.Color(0xcfe2ff), // Blue-white
      new THREE.Color(0xfff3cd), // Warm yellow
      new THREE.Color(0xffd8a8), // Soft orange
      new THREE.Color(0x99b9ff), // Deep blue
    ];

    for (let i = 0; i < starCount; i++) {
      // Distribute stars on a large sphere surrounding the scene
      const radius = 250 + Math.random() * 150;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const color = starPalettes[Math.floor(Math.random() * starPalettes.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Varied star brightness / size
      sizes[i] = Math.random() < 0.9 ? 1.0 + Math.random() * 1.5 : 2.5 + Math.random() * 2.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader or particle material for clean, twinkling stars
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
