import * as THREE from 'three';
import { ParticleSystem } from '../effects/ParticleSystem';
import { ShockwaveSystem } from '../effects/Shockwave';
import { CameraController } from '../renderer/CameraController';
import { AudioManager } from '../audio/AudioManager';
import { Planet } from './Planet';
import { vector3ToUV, vector3ToLatLon } from '../utils/math';
import { disposeNode } from '../utils/disposal';
import type { MoonDefinition, MoonState, MoonTextureType } from '../types/moon';

export type { MoonState };

export interface MoonContext {
  scene: THREE.Scene;
  planet: Planet;
  particleSystem: ParticleSystem;
  shockwaveSystem: ShockwaveSystem;
  cameraController: CameraController;
  audioManager: AudioManager;
}

/**
 * Represents an individual physical Moon in orbit around a celestial body.
 */
export class MoonInstance {
  public definition: MoonDefinition;
  public group: THREE.Group;
  public mesh: THREE.Mesh;
  public orbitRing: THREE.LineLoop;
  public debrisGroup: THREE.Group;

  public state: MoonState = 'orbiting';
  public radius: number;
  public orbitRadius: number;
  public orbitSpeed: number;
  public inclination: number;
  public currentAngle: number;

  public health: number = 100;
  public maxHealth: number = 100;

  // Dynamic interactive canvas texture
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private pristineCanvas!: HTMLCanvasElement;
  public moonTex!: THREE.CanvasTexture;

  // Physics trajectory
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private reEntryFlames: THREE.Mesh | null = null;
  private debrisPieces: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3 }[] = [];

  constructor(def: MoonDefinition) {
    this.definition = def;
    this.radius = def.radius;
    this.orbitRadius = def.orbitRadius;
    this.orbitSpeed = def.orbitSpeed;
    this.inclination = def.inclination;
    this.currentAngle = def.initialAngle ?? Math.random() * Math.PI * 2;

    this.group = new THREE.Group();
    this.group.name = `Moon_${def.id}`;

    // 1. Orbit guide ring
    this.orbitRing = this.createOrbitRing();
    this.group.add(this.orbitRing);

    // 2. Procedural texture & bump
    this.moonTex = this.generateTexture();
    const bumpMap = this.generateBumpMap();
    const geo = new THREE.SphereGeometry(this.radius, 40, 40);
    const mat = new THREE.MeshStandardMaterial({
      map: this.moonTex,
      bumpMap: bumpMap,
      bumpScale: def.bumpScale || 0.035,
      roughness: def.type === 'ice' ? 0.45 : def.type === 'cyber_station' ? 0.35 : 0.9,
      metalness: def.type === 'cyber_station' ? 0.75 : 0.05,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = `MoonMesh_${def.id}`;
    this.group.add(this.mesh);

    // 3. Debris group for shattered fragments
    this.debrisGroup = new THREE.Group();
    this.group.add(this.debrisGroup);

    this.updateOrbitalPosition();
  }

  private createOrbitRing(): THREE.LineLoop {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.cos(theta) * this.orbitRadius;
      const y = Math.sin(theta) * Math.sin(this.inclination) * this.orbitRadius;
      const z = Math.sin(theta) * Math.cos(this.inclination) * this.orbitRadius;
      points.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: this.definition.type === 'volcanic' ? 0xffaa44 : this.definition.type === 'ice' ? 0x88ddff : 0x66ccff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.LineLoop(geo, mat);
  }

  private generateTexture(): THREE.CanvasTexture {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const def = this.definition;

    // Base tone
    ctx.fillStyle = def.baseColor;
    ctx.fillRect(0, 0, w, h);

    // Procedural surface details based on moon type
    switch (def.type) {
      case 'volcanic': // e.g. Io, Pyra, Cinder
        this.paintVolcanicDetails(ctx, w, h, def);
        break;
      case 'ice': // e.g. Europa, Enceladus, Triton, Miranda
        this.paintIceDetails(ctx, w, h, def);
        break;
      case 'cratered_rock': // e.g. Phobos, Deimos, Callisto, Mimas
        this.paintCrateredRockDetails(ctx, w, h, def);
        break;
      case 'titan_haze': // e.g. Titan
        this.paintTitanDetails(ctx, w, h, def);
        break;
      case 'cyber_station': // e.g. Citadel Nexus
        this.paintCyberDetails(ctx, w, h, def);
        break;
      case 'molten': // e.g. Doomed Planetoid
        this.paintMoltenDetails(ctx, w, h, def);
        break;
      case 'lunar':
      default:
        this.paintLunarDetails(ctx, w, h, def);
        break;
    }

    // Save pristine backup for resetting
    this.pristineCanvas = document.createElement('canvas');
    this.pristineCanvas.width = w;
    this.pristineCanvas.height = h;
    this.pristineCanvas.getContext('2d')!.drawImage(this.canvas, 0, 0);

    const tex = new THREE.CanvasTexture(this.canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  private paintLunarDetails(ctx: CanvasRenderingContext2D, w: number, h: number, def: MoonDefinition): void {
    // Noise grain
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Dark basalt maria
    const maria = [
      { x: w * 0.35, y: h * 0.45, rx: 120, ry: 80 },
      { x: w * 0.25, y: h * 0.38, rx: 90, ry: 60 },
      { x: w * 0.42, y: h * 0.40, rx: 80, ry: 50 },
      { x: w * 0.72, y: h * 0.48, rx: 65, ry: 45 },
    ];
    for (const m of maria) {
      ctx.fillStyle = def.secondaryColor;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.rx, m.ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Craters
    for (let c = 0; c < 80; c++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const cr = 3 + Math.random() * 16;
      ctx.strokeStyle = 'rgba(235, 235, 240, 0.65)';
      ctx.lineWidth = Math.max(1, cr * 0.18);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(35, 38, 44, 0.55)';
      ctx.beginPath();
      ctx.arc(cx - cr * 0.15, cy - cr * 0.15, cr * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private paintVolcanicDetails(ctx: CanvasRenderingContext2D, w: number, h: number, def: MoonDefinition): void {
    // Sulfurous blotches and dark volcanic calderas (Io)
    for (let i = 0; i < 40; i++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const r = 20 + Math.random() * 70;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, def.secondaryColor);
      grad.addColorStop(0.6, 'rgba(180, 80, 20, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing magma calderas
    for (let i = 0; i < 35; i++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const cr = 4 + Math.random() * 12;
      ctx.fillStyle = def.accentColor || '#ff3300';
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();

      // Dark volcanic rim
      ctx.strokeStyle = 'rgba(20, 10, 5, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cr + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private paintIceDetails(ctx: CanvasRenderingContext2D, w: number, h: number, def: MoonDefinition): void {
    // Cryogenic fractures and lineae (Europa, Enceladus, Triton)
    ctx.strokeStyle = def.secondaryColor;
    for (let l = 0; l < 45; l++) {
      ctx.lineWidth = 1.0 + Math.random() * 3.0;
      ctx.beginPath();
      let px = Math.random() * w;
      let py = Math.random() * h;
      ctx.moveTo(px, py);
      for (let s = 0; s < 5; s++) {
        px += (Math.random() - 0.5) * 180;
        py += (Math.random() - 0.5) * 80;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Soft icy haze & frost mottling
    for (let f = 0; f < 30; f++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const r = 30 + Math.random() * 80;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private paintCrateredRockDetails(ctx: CanvasRenderingContext2D, w: number, h: number, def: MoonDefinition): void {
    // Dense impact scars for Phobos, Deimos, Callisto, Mimas
    for (let c = 0; c < 120; c++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const cr = 2 + Math.random() * 22;

      ctx.strokeStyle = 'rgba(210, 210, 215, 0.6)';
      ctx.lineWidth = Math.max(1, cr * 0.18);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = def.secondaryColor;
      ctx.beginPath();
      ctx.arc(cx - cr * 0.2, cy - cr * 0.2, cr * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    // Huge singular impact basin (like Herschel on Mimas or Valhalla on Callisto)
    if (def.id === 'mimas' || def.id === 'callisto' || def.id === 'phobos') {
      const bx = w * 0.45;
      const by = h * 0.48;
      const br = def.id === 'mimas' ? 55 : 75;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#1e1e22';
      ctx.beginPath();
      ctx.arc(bx, by, br * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Central peak
      ctx.fillStyle = '#f0f0f5';
      ctx.beginPath();
      ctx.arc(bx, by, br * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private paintTitanDetails(ctx: CanvasRenderingContext2D, w: number, h: number, def: MoonDefinition): void {
    // Dense hydrocarbon atmosphere with liquid methane seas (Kraken Mare)
    const seas = [
      { x: w * 0.5, y: h * 0.25, rx: 140, ry: 70 },
      { x: w * 0.65, y: h * 0.3, rx: 80, ry: 50 },
      { x: w * 0.38, y: h * 0.28, rx: 60, ry: 40 },
    ];
    for (const s of seas) {
      ctx.fillStyle = def.accentColor || '#1d354a';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.rx, s.ry, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Atmospheric smog gradient bands
    for (let y = 0; y < h; y += 35) {
      ctx.fillStyle = `rgba(220, 160, 60, ${0.1 + Math.random() * 0.15})`;
      ctx.fillRect(0, y, w, 20);
    }
  }

  private paintCyberDetails(ctx: CanvasRenderingContext2D, w: number, h: number, def: MoonDefinition): void {
    // High-tech orbital station panels with illuminated cyan bus lines
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Quantum nexus nodes
    ctx.fillStyle = '#00f0ff';
    for (let n = 0; n < 60; n++) {
      const nx = Math.floor(Math.random() * (w / 64)) * 64;
      const ny = Math.floor(Math.random() * (h / 64)) * 64;
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private paintMoltenDetails(ctx: CanvasRenderingContext2D, w: number, h: number, def: MoonDefinition): void {
    // Dark cracked obsidian crust floating on glowing lava
    ctx.strokeStyle = def.accentColor || '#ff5500';
    ctx.lineWidth = 3;
    for (let r = 0; r < 50; r++) {
      ctx.beginPath();
      let rx = Math.random() * w;
      let ry = Math.random() * h;
      ctx.moveTo(rx, ry);
      for (let s = 0; s < 4; s++) {
        rx += (Math.random() - 0.5) * 160;
        ry += (Math.random() - 0.5) * 70;
        ctx.lineTo(rx, ry);
      }
      ctx.stroke();
    }
  }

  private generateBumpMap(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let c = 0; c < 50; c++) {
      const cx = Math.random() * canvas.width;
      const cy = Math.random() * canvas.height;
      const cr = 2 + Math.random() * 14;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#252525';
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  public updateOrbitalPosition(): void {
    const x = Math.cos(this.currentAngle) * this.orbitRadius;
    const y = Math.sin(this.currentAngle) * Math.sin(this.inclination) * this.orbitRadius;
    const z = Math.sin(this.currentAngle) * Math.cos(this.inclination) * this.orbitRadius;
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = this.currentAngle * 0.5; // Tidal synchronous rotation
  }

  public registerImpact(
    hitWorldPos: THREE.Vector3,
    intensity: number,
    radius: number,
    context?: MoonContext | null,
    impactType: 'blast' | 'freeze' | 'laser' = 'blast'
  ): void {
    if (this.state === 'destroyed' || !this.mesh.visible) return;

    const localHit = hitWorldPos.clone();
    this.mesh.worldToLocal(localHit);
    const uv = vector3ToUV(localHit);

    const cx = uv.u * this.canvas.width;
    const cy = (1.0 - uv.v) * this.canvas.height;
    const pixelRadius = Math.max(8, Math.min(50, radius * this.canvas.width * 0.45));

    this.ctx.save();
    if (impactType === 'freeze') {
      const frost = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, pixelRadius * 1.3);
      frost.addColorStop(0, 'rgba(215, 245, 255, 0.95)');
      frost.addColorStop(0.4, 'rgba(130, 210, 255, 0.75)');
      frost.addColorStop(0.8, 'rgba(60, 160, 240, 0.4)');
      frost.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = frost;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, pixelRadius * 1.3, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.globalCompositeOperation = 'source-over';

      // 1. Dark charcoal basin
      const basinGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, pixelRadius);
      basinGrad.addColorStop(0, 'rgba(18, 20, 24, 0.98)');
      basinGrad.addColorStop(0.4, 'rgba(38, 42, 48, 0.92)');
      basinGrad.addColorStop(0.75, 'rgba(60, 64, 72, 0.7)');
      basinGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = basinGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, pixelRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // 2. Molten thermal magma core
      const heatGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, pixelRadius * 0.55);
      heatGrad.addColorStop(0, 'rgba(255, 240, 140, 0.95)');
      heatGrad.addColorStop(0.35, 'rgba(255, 120, 30, 0.85)');
      heatGrad.addColorStop(0.7, 'rgba(200, 40, 0, 0.5)');
      heatGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = heatGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, pixelRadius * 0.55, 0, Math.PI * 2);
      this.ctx.fill();

      // 3. Bright high-albedo ejecta rim & rays
      this.ctx.strokeStyle = 'rgba(245, 245, 255, 0.85)';
      this.ctx.lineWidth = Math.max(1.5, pixelRadius * 0.16);
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, pixelRadius * 0.9, 0, Math.PI * 2);
      this.ctx.stroke();

      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
        const rayLen = pixelRadius * (1.2 + Math.random() * 0.8);
        this.ctx.strokeStyle = 'rgba(230, 235, 245, 0.45)';
        this.ctx.lineWidth = Math.max(1, pixelRadius * 0.08);
        this.ctx.beginPath();
        this.ctx.moveTo(cx + Math.cos(angle) * pixelRadius * 0.8, cy + Math.sin(angle) * pixelRadius * 0.8);
        this.ctx.lineTo(cx + Math.cos(angle) * rayLen, cy + Math.sin(angle) * rayLen);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
    this.moonTex.needsUpdate = true;

    const hitNormal = hitWorldPos.clone().sub(this.mesh.position).normalize();

    if (context) {
      if (context.particleSystem) {
        context.particleSystem.emit(hitWorldPos, hitNormal, 40, '#ff7700', 1.8, 4.2, 1.2, 0.6);
        context.particleSystem.emit(hitWorldPos, hitNormal, 30, '#ffffff', 1.4, 3.2, 1.0, 0.5);
      }
      if (context.shockwaveSystem) {
        context.shockwaveSystem.create(hitWorldPos, hitNormal, this.radius * 1.8, '#ffffff');
        context.shockwaveSystem.create(hitWorldPos, hitNormal, this.radius * 2.8, '#ff9900');
      }
      if (context.cameraController) {
        context.cameraController.addTrauma(0.35 * Math.min(1.5, intensity));
      }
      if (context.audioManager) {
        context.audioManager.playMeteorImpact();
      }
    }

    this.health -= intensity * 25;
    if (this.health <= 0) {
      this.shatter(hitWorldPos, context);
    }
  }

  public shatter(hitWorldPos?: THREE.Vector3, context?: MoonContext | null): void {
    if (this.state === 'destroyed') return;
    this.state = 'destroyed';
    this.mesh.visible = false;
    this.orbitRing.visible = false;
    if (this.reEntryFlames) {
      this.reEntryFlames.visible = false;
    }

    const center = this.mesh.position.clone();
    const hitPoint = hitWorldPos || center;
    const hitNormal = hitPoint.clone().sub(center).normalize();

    const chunkGeo = new THREE.DodecahedronGeometry(0.12, 0);
    const chunkMat = new THREE.MeshStandardMaterial({
      color: 0x99999e,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (let c = 0; c < 22; c++) {
      const m = new THREE.Mesh(chunkGeo, chunkMat);
      m.scale.set(
        0.4 + Math.random() * 0.7,
        0.4 + Math.random() * 0.7,
        0.4 + Math.random() * 0.7
      );
      m.position.copy(center).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      ));

      const outwardDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 2.0
      ).normalize();

      const vel = outwardDir.multiplyScalar(3.0 + Math.random() * 6.0);
      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 5.0,
        (Math.random() - 0.5) * 5.0,
        (Math.random() - 0.5) * 5.0
      );

      this.debrisGroup.add(m);
      this.debrisPieces.push({ mesh: m, vel, rotVel });
    }

    if (context) {
      if (context.particleSystem) {
        context.particleSystem.emit(center, hitNormal, 90, '#ff7700', 3.0, 6.0, 2.0, 1.0);
        context.particleSystem.emit(center, hitNormal, 70, '#ffffff', 2.5, 5.0, 1.8, 0.8);
      }
      if (context.shockwaveSystem) {
        context.shockwaveSystem.create(center, hitNormal, this.radius * 3.5, '#ffffff');
        context.shockwaveSystem.create(center, hitNormal, this.radius * 5.0, '#ff5500');
      }
      if (context.cameraController) {
        context.cameraController.addTrauma(0.75);
      }
      if (context.audioManager) {
        context.audioManager.playNuclearBlast();
      }
    }
  }

  public slingshot(context: MoonContext): void {
    if (this.state === 'destroyed') return;
    this.state = 'slingshot';

    const currentPos = this.mesh.position.clone();
    const tangent = new THREE.Vector3(
      -Math.sin(this.currentAngle),
      Math.cos(this.currentAngle) * Math.sin(this.inclination),
      Math.cos(this.currentAngle) * Math.cos(this.inclination)
    ).normalize();

    const radialOutward = currentPos.clone().normalize();
    this.velocity = tangent.multiplyScalar(14.0).add(radialOutward.multiplyScalar(6.0));

    context.audioManager.playCelestialSwordLaunch();
    context.cameraController.addTrauma(0.5);
    context.shockwaveSystem.create(currentPos, radialOutward, 2.5, '#00ffff');
  }

  public deorbit(context: MoonContext): void {
    if (this.state === 'destroyed') return;
    this.state = 'deorbiting';

    const currentPos = this.mesh.position.clone();
    const inward = currentPos.clone().negate().normalize();
    this.velocity = inward.multiplyScalar(1.5);

    if (!this.reEntryFlames) {
      const flameGeo = new THREE.ConeGeometry(this.radius * 1.3, this.radius * 3.5, 16, 1, true);
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      this.reEntryFlames = new THREE.Mesh(flameGeo, flameMat);
      this.group.add(this.reEntryFlames);
    }
    this.reEntryFlames.visible = false;

    context.audioManager.playMeteorImpact();
    context.cameraController.addTrauma(0.4);
  }

  public reset(): void {
    this.state = 'orbiting';
    this.currentAngle = this.definition.initialAngle ?? 0;
    this.health = this.maxHealth;
    this.mesh.visible = true;
    this.orbitRing.visible = true;
    this.velocity.set(0, 0, 0);

    if (this.reEntryFlames) {
      this.reEntryFlames.visible = false;
    }

    for (const p of this.debrisPieces) {
      this.debrisGroup.remove(p.mesh);
      disposeNode(p.mesh);
    }
    this.debrisPieces = [];

    if (this.canvas && this.pristineCanvas && this.ctx && this.moonTex) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.pristineCanvas, 0, 0);
      this.moonTex.needsUpdate = true;
    }

    this.updateOrbitalPosition();
  }

  public update(delta: number, isPaused: boolean, context: MoonContext): void {
    const planetRadius = context.planet.config.radius;

    if (this.state === 'orbiting') {
      if (!isPaused) {
        this.currentAngle += delta * this.orbitSpeed;
        if (this.currentAngle > Math.PI * 2) {
          this.currentAngle -= Math.PI * 2;
        } else if (this.currentAngle < 0) {
          this.currentAngle += Math.PI * 2;
        }
        this.updateOrbitalPosition();
      }
    } else if (this.state === 'slingshot') {
      this.mesh.position.addScaledVector(this.velocity, delta);
      this.orbitRing.visible = false;

      if (Math.random() < 0.6) {
        context.particleSystem.emit(
          this.mesh.position,
          this.velocity.clone().negate().normalize(),
          3,
          '#66ccff',
          0.8,
          2.5,
          0.4,
          0.2
        );
      }

      if (this.mesh.position.length() > 60.0) {
        this.mesh.visible = false;
      }
    } else if (this.state === 'deorbiting') {
      this.orbitRing.visible = false;

      const currentPos = this.mesh.position.clone();
      const distToCenter = currentPos.length();
      const inwardDir = currentPos.clone().negate().normalize();

      const gravityStrength = 42.0 / Math.max(1.0, distToCenter * 0.4);
      this.velocity.addScaledVector(inwardDir, gravityStrength * delta);

      if (this.velocity.length() > 18.0) {
        this.velocity.setLength(18.0);
      }

      this.mesh.position.addScaledVector(this.velocity, delta);

      const entryAltitude = planetRadius * 1.7;
      if (distToCenter < entryAltitude) {
        if (this.reEntryFlames) {
          this.reEntryFlames.visible = true;
          this.reEntryFlames.position.copy(this.mesh.position);
          this.reEntryFlames.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            this.velocity.clone().negate().normalize()
          );
          const flicker = 0.9 + Math.random() * 0.25;
          this.reEntryFlames.scale.set(flicker, flicker, flicker);
        }

        context.particleSystem.emit(
          this.mesh.position,
          this.velocity.clone().negate().normalize(),
          5,
          '#ff6600',
          1.2,
          3.5,
          0.6,
          0.3
        );
      }

      if (distToCenter <= planetRadius + this.radius * 0.7) {
        this.triggerPlanetCollision(context);
      }
    } else if (this.state === 'destroyed') {
      for (let i = this.debrisPieces.length - 1; i >= 0; i--) {
        const p = this.debrisPieces[i];
        p.mesh.position.addScaledVector(p.vel, delta);
        p.mesh.rotation.x += p.rotVel.x * delta;
        p.mesh.rotation.y += p.rotVel.y * delta;
        p.mesh.rotation.z += p.rotVel.z * delta;

        if (Math.random() < 0.15) {
          context.particleSystem.emit(p.mesh.position, p.vel.clone().negate().normalize(), 1, '#ff8800', 0.4, 1.2, 0.2, 0.1);
        }
      }
    }
  }

  private triggerPlanetCollision(context: MoonContext): void {
    this.state = 'destroyed';
    this.mesh.visible = false;
    this.orbitRing.visible = false;
    if (this.reEntryFlames) {
      this.reEntryFlames.visible = false;
    }

    const planetRadius = context.planet.config.radius;
    const hitPos = this.mesh.position.clone().normalize().multiplyScalar(planetRadius);
    const hitNormal = hitPos.clone().normalize();

    const localHit = hitPos.clone();
    context.planet.surfaceMesh.worldToLocal(localHit);
    const uv = vector3ToUV(localHit);
    const { lat, lon } = vector3ToLatLon(localHit);

    // Continental Impact on planet
    context.planet.registerImpact({
      u: uv.u,
      v: uv.v,
      lat,
      lon,
      position: hitPos,
      radius: Math.min(0.48, this.radius * 0.8),
      intensity: 3.5,
      heat: 1.0,
      timestamp: performance.now(),
    });

    context.shockwaveSystem.create(hitPos, hitNormal, planetRadius * 1.5, '#ffffff');
    context.shockwaveSystem.create(hitPos, hitNormal, planetRadius * 2.4, '#ff3300');
    context.shockwaveSystem.create(hitPos, hitNormal, planetRadius * 3.2, '#00f0ff');

    context.particleSystem.emit(hitPos, hitNormal, 140, '#ff6600', 3.5, 8.0, 2.5, 1.2);
    context.particleSystem.emit(hitPos, hitNormal, 100, '#ffffff', 2.8, 6.5, 2.0, 1.0);

    this.shatter(hitPos, context);
    context.cameraController.addTrauma(1.0);
    context.audioManager.playNuclearBlast();
  }

  public dispose(): void {
    disposeNode(this.group);
    this.debrisPieces = [];
    if (this.moonTex) {
      this.moonTex.dispose();
    }
  }
}

/**
 * Manages the multi-moon orbital system for whichever planet is currently active.
 */
export class MoonSystem {
  public group: THREE.Group;
  public moons: MoonInstance[] = [];
  public isPaused: boolean = false;

  constructor(definitions: MoonDefinition[]) {
    this.group = new THREE.Group();
    this.group.name = 'MoonSystem';

    for (const def of definitions) {
      const moon = new MoonInstance(def);
      this.moons.push(moon);
      this.group.add(moon.group);
    }
  }

  /**
   * Legacy primary moon mesh (first moon in the system).
   */
  public get moonMesh(): THREE.Mesh | null {
    return this.moons[0]?.mesh || null;
  }

  /**
   * All active, visible moon meshes for raycast targeting.
   */
  public get moonMeshes(): THREE.Mesh[] {
    return this.moons.filter((m) => m.mesh.visible && m.state !== 'destroyed').map((m) => m.mesh);
  }

  /**
   * Finds the moon instance corresponding to a given mesh.
   */
  public getMoonByMesh(mesh: THREE.Object3D): MoonInstance | null {
    return this.moons.find((m) => m.mesh === mesh) || null;
  }

  /**
   * Finds the moon closest to a given world coordinate.
   */
  public getMoonNearPoint(point: THREE.Vector3): MoonInstance | null {
    let bestDist = Infinity;
    let bestMoon: MoonInstance | null = null;
    for (const m of this.moons) {
      if (!m.mesh.visible || m.state === 'destroyed') continue;
      const d = m.mesh.position.distanceTo(point);
      if (d < bestDist) {
        bestDist = d;
        bestMoon = m;
      }
    }
    return bestMoon;
  }

  /**
   * Primary or aggregate state of the moon system.
   */
  public get state(): MoonState {
    if (this.moons.length === 0) return 'orbiting';
    if (this.moons.some((m) => m.state === 'deorbiting')) return 'deorbiting';
    if (this.moons.some((m) => m.state === 'slingshot')) return 'slingshot';
    if (this.moons.every((m) => m.state === 'destroyed')) return 'destroyed';
    return 'orbiting';
  }

  public registerImpact(
    hitWorldPos: THREE.Vector3,
    intensity: number,
    radius: number,
    context?: MoonContext | null,
    impactType: 'blast' | 'freeze' | 'laser' = 'blast'
  ): void {
    const targetMoon = this.getMoonNearPoint(hitWorldPos);
    if (targetMoon) {
      targetMoon.registerImpact(hitWorldPos, intensity, radius, context, impactType);
    }
  }

  public slingshot(context: MoonContext, moonId?: string): void {
    if (moonId) {
      this.moons.find((m) => m.definition.id === moonId)?.slingshot(context);
    } else {
      // Slingshot all active moons
      for (const m of this.moons) {
        if (m.state === 'orbiting') {
          m.slingshot(context);
        }
      }
    }
  }

  public deorbit(context: MoonContext, moonId?: string): void {
    if (moonId) {
      this.moons.find((m) => m.definition.id === moonId)?.deorbit(context);
    } else {
      // Deorbit first active orbiting moon
      const firstOrbiting = this.moons.find((m) => m.state === 'orbiting');
      if (firstOrbiting) {
        firstOrbiting.deorbit(context);
      }
    }
  }

  public reset(): void {
    for (const m of this.moons) {
      m.reset();
    }
  }

  public update(delta: number, context: MoonContext): void {
    for (const m of this.moons) {
      m.update(delta, this.isPaused, context);
    }
  }

  public dispose(): void {
    for (const m of this.moons) {
      m.dispose();
    }
    this.moons = [];
    disposeNode(this.group);
  }
}
