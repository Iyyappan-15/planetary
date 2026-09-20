import * as THREE from 'three';
import { ParticleSystem } from '../effects/ParticleSystem';
import { ShockwaveSystem } from '../effects/Shockwave';
import { CameraController } from '../renderer/CameraController';
import { AudioManager } from '../audio/AudioManager';
import { Planet } from './Planet';
import { vector3ToUV, vector3ToLatLon } from '../utils/math';
import { disposeNode } from '../utils/disposal';

export type MoonState = 'orbiting' | 'slingshot' | 'deorbiting' | 'destroyed';

export interface MoonContext {
  scene: THREE.Scene;
  planet: Planet;
  particleSystem: ParticleSystem;
  shockwaveSystem: ShockwaveSystem;
  cameraController: CameraController;
  audioManager: AudioManager;
}

export class MoonSystem {
  public group: THREE.Group;
  public moonMesh: THREE.Mesh;
  public orbitRing: THREE.LineLoop;
  public debrisGroup: THREE.Group;

  public state: MoonState = 'orbiting';
  public radius: number = 0.52; // Scale relative to Earth radius ~2.2
  public orbitRadius: number = 7.2;
  public currentAngle: number = 0;
  public orbitSpeed: number = 0.15; // Radians per second
  public inclination: number = 0.09; // ~5.14 degrees tilt

  public isPaused: boolean = false;
  public health: number = 100;
  public maxHealth: number = 100;

  // Dynamic procedural texture canvas for interactive lunar craters
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private pristineCanvas!: HTMLCanvasElement;
  private moonTex!: THREE.CanvasTexture;

  // Dynamic physics state
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private reEntryFlames: THREE.Mesh | null = null;
  private debrisPieces: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3 }[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'MoonSystem';

    // 1. Orbit Guide Ring
    this.orbitRing = this.createOrbitRing();
    this.group.add(this.orbitRing);

    // 2. Procedural Cratered Lunar Texture & Mesh
    this.moonTex = this.generateLunarTexture();
    const moonBump = this.generateLunarBump();
    const moonGeo = new THREE.SphereGeometry(this.radius, 48, 48);
    const moonMat = new THREE.MeshStandardMaterial({
      map: this.moonTex,
      bumpMap: moonBump,
      bumpScale: 0.04,
      roughness: 0.92,
      metalness: 0.05,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.group.add(this.moonMesh);

    // 3. Debris group for shattered lunar fragments
    this.debrisGroup = new THREE.Group();
    this.group.add(this.debrisGroup);

    // Position initial Moon
    this.updateOrbitalPosition();
  }

  /**
   * Generates a photorealistic procedural lunar texture with dark basalt maria and bright cratered highlands.
   */
  private generateLunarTexture(): THREE.CanvasTexture {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
    const canvas = this.canvas;
    const ctx = this.ctx;

    // Base highland regolith tone
    ctx.fillStyle = '#b0b0b4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fine surface noise
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 25;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Dark Basalt Lunar Maria (Sea of Tranquility, Ocean of Storms, Sea of Serenity)
    const maria = [
      { x: 340, y: 220, rx: 120, ry: 80, col: 'rgba(55, 58, 65, 0.75)' },
      { x: 260, y: 190, rx: 90, ry: 60, col: 'rgba(50, 54, 60, 0.7)' },
      { x: 420, y: 200, rx: 80, ry: 50, col: 'rgba(60, 62, 68, 0.7)' },
      { x: 300, y: 310, rx: 70, ry: 50, col: 'rgba(52, 55, 62, 0.65)' },
      { x: 720, y: 240, rx: 60, ry: 40, col: 'rgba(58, 60, 66, 0.6)' },
      { x: 800, y: 200, rx: 50, ry: 35, col: 'rgba(55, 58, 64, 0.55)' },
    ];

    for (const m of maria) {
      ctx.fillStyle = m.col;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.rx, m.ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Impact Craters with bright rims & dark centers
    for (let c = 0; c < 90; c++) {
      const cx = Math.random() * canvas.width;
      const cy = Math.random() * canvas.height;
      const cr = 3 + Math.random() * 18;

      // Bright crater ejecta rim
      ctx.strokeStyle = 'rgba(235, 235, 240, 0.7)';
      ctx.lineWidth = Math.max(1, cr * 0.2);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.stroke();

      // Shadowed depression inside
      ctx.fillStyle = 'rgba(40, 42, 48, 0.55)';
      ctx.beginPath();
      ctx.arc(cx - cr * 0.15, cy - cr * 0.15, cr * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Central peak
      if (cr > 10) {
        ctx.fillStyle = 'rgba(245, 245, 250, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy, cr * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Save backup pristine texture for resetPlanet()
    this.pristineCanvas = document.createElement('canvas');
    this.pristineCanvas.width = canvas.width;
    this.pristineCanvas.height = canvas.height;
    this.pristineCanvas.getContext('2d')!.drawImage(canvas, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  /**
   * Generates a matching grayscale lunar bump map for realistic craters.
   */
  private generateLunarBump(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let c = 0; c < 60; c++) {
      const cx = Math.random() * canvas.width;
      const cy = Math.random() * canvas.height;
      const cr = 2 + Math.random() * 14;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#202020';
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  /**
   * Constructs the orbital guide ellipse.
   */
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
      color: 0x66ccff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.LineLoop(geo, mat);
  }

  /**
   * Updates standard Keplerian circular orbital position.
   */
  private updateOrbitalPosition(): void {
    const x = Math.cos(this.currentAngle) * this.orbitRadius;
    const y = Math.sin(this.currentAngle) * Math.sin(this.inclination) * this.orbitRadius;
    const z = Math.sin(this.currentAngle) * Math.cos(this.inclination) * this.orbitRadius;
    this.moonMesh.position.set(x, y, z);
    this.moonMesh.rotation.y = this.currentAngle * 0.5; // Tidal synchronous rotation
  }

  /**
   * Gravitational Weapon: Slingshot Moon out of orbit into deep space!
   */
  public slingshot(context: MoonContext): void {
    if (this.state === 'destroyed') return;
    this.state = 'slingshot';

    // Tangential direction along orbital velocity vector
    const currentPos = this.moonMesh.position.clone();
    const tangent = new THREE.Vector3(
      -Math.sin(this.currentAngle),
      Math.cos(this.currentAngle) * Math.sin(this.inclination),
      Math.cos(this.currentAngle) * Math.cos(this.inclination)
    ).normalize();

    const radialOutward = currentPos.clone().normalize();

    // Hyperbolic escape velocity vector
    this.velocity = tangent.multiplyScalar(14.0).add(radialOutward.multiplyScalar(6.0));

    // Audio and shockwave
    context.audioManager.playCelestialSwordLaunch();
    context.cameraController.addTrauma(0.5);
    context.shockwaveSystem.create(currentPos, radialOutward, 2.5, '#00ffff');
  }

  /**
   * Gravitational Weapon: De-orbit Moon on a fiery collision course into Earth!
   */
  public deorbit(context: MoonContext): void {
    if (this.state === 'destroyed') return;
    this.state = 'deorbiting';

    // Zero out orbital tangential speed, begin gravitational plunge inward
    const currentPos = this.moonMesh.position.clone();
    const inward = currentPos.clone().negate().normalize();
    this.velocity = inward.multiplyScalar(1.5);

    // Atmospheric re-entry plasma flame sheath
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
    this.reEntryFlames.visible = false; // Ignites when reaching atmosphere

    context.audioManager.playMeteorImpact();
    context.cameraController.addTrauma(0.4);
  }

  /**
   * Resets the Moon back to a stable circular orbit.
   */
  public reset(): void {
    this.state = 'orbiting';
    this.currentAngle = 0;
    this.health = this.maxHealth;
    this.moonMesh.visible = true;
    this.orbitRing.visible = true;
    this.velocity.set(0, 0, 0);

    if (this.reEntryFlames) {
      this.reEntryFlames.visible = false;
    }

    // Clean up debris
    for (const p of this.debrisPieces) {
      this.debrisGroup.remove(p.mesh);
      disposeNode(p.mesh);
    }
    this.debrisPieces = [];

    // Restore pristine uncratered surface texture
    if (this.canvas && this.pristineCanvas && this.ctx && this.moonTex) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.pristineCanvas, 0, 0);
      this.moonTex.needsUpdate = true;
    }

    this.updateOrbitalPosition();
  }

  /**
   * Physics & Animation update tick.
   */
  public update(delta: number, context: MoonContext): void {
    const planetRadius = context.planet.config.radius;

    // -------------------------------------------------------------
    // STATE 1: ORBITING
    // -------------------------------------------------------------
    if (this.state === 'orbiting') {
      if (!this.isPaused) {
        this.currentAngle += delta * this.orbitSpeed;
        if (this.currentAngle > Math.PI * 2) {
          this.currentAngle -= Math.PI * 2;
        }
        this.updateOrbitalPosition();
      }
    }

    // -------------------------------------------------------------
    // STATE 2: SLINGSHOT ESCAPE
    // -------------------------------------------------------------
    else if (this.state === 'slingshot') {
      this.moonMesh.position.addScaledVector(this.velocity, delta);
      this.orbitRing.visible = false;

      // Trailing stardust
      if (Math.random() < 0.6) {
        context.particleSystem.emit(
          this.moonMesh.position,
          this.velocity.clone().negate().normalize(),
          3,
          '#66ccff',
          0.8,
          2.5,
          0.4,
          0.2
        );
      }

      // Hide if escaped beyond deep space
      if (this.moonMesh.position.length() > 60.0) {
        this.moonMesh.visible = false;
      }
    }

    // -------------------------------------------------------------
    // STATE 3: DE-ORBITING & GRAVITATIONAL PLUNGE
    // -------------------------------------------------------------
    else if (this.state === 'deorbiting') {
      this.orbitRing.visible = false;

      const currentPos = this.moonMesh.position.clone();
      const distToCenter = currentPos.length();
      const inwardDir = currentPos.clone().negate().normalize();

      // Earth's gravitational acceleration (inversely proportional to distance squared)
      const gravityStrength = 42.0 / Math.max(1.0, distToCenter * 0.4);
      this.velocity.addScaledVector(inwardDir, gravityStrength * delta);

      // Terminal velocity cap
      if (this.velocity.length() > 18.0) {
        this.velocity.setLength(18.0);
      }

      this.moonMesh.position.addScaledVector(this.velocity, delta);

      // Atmospheric entry fire: when distance < planetRadius * 1.8
      const entryAltitude = planetRadius * 1.7;
      if (distToCenter < entryAltitude) {
        if (this.reEntryFlames) {
          this.reEntryFlames.visible = true;
          this.reEntryFlames.position.copy(this.moonMesh.position);
          // Point flame cone backward along velocity
          this.reEntryFlames.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            this.velocity.clone().negate().normalize()
          );
          const flicker = 0.9 + Math.random() * 0.25;
          this.reEntryFlames.scale.set(flicker, flicker, flicker);
        }

        // Plasma trail particles
        context.particleSystem.emit(
          this.moonMesh.position,
          this.velocity.clone().negate().normalize(),
          5,
          '#ff6600',
          1.2,
          3.5,
          0.6,
          0.3
        );
      }

      // COLLISION CHECK: When Moon surface touches Earth's surface
      if (distToCenter <= planetRadius + this.radius * 0.7) {
        this.triggerPlanetCollision(context);
      }
    }

    // -------------------------------------------------------------
    // STATE 4: DESTROYED (Debris drifting/orbiting)
    // -------------------------------------------------------------
    else if (this.state === 'destroyed') {
      for (let i = this.debrisPieces.length - 1; i >= 0; i--) {
        const p = this.debrisPieces[i];
        p.mesh.position.addScaledVector(p.vel, delta);
        p.mesh.rotation.x += p.rotVel.x * delta;
        p.mesh.rotation.y += p.rotVel.y * delta;
        p.mesh.rotation.z += p.rotVel.z * delta;

        // Faint trail
        if (Math.random() < 0.15) {
          context.particleSystem.emit(p.mesh.position, p.vel.clone().negate().normalize(), 1, '#ff8800', 0.4, 1.2, 0.2, 0.1);
        }
      }
    }
  }

  /**
   * Cataclysmic continental Moon-Earth collision!
   */
  private triggerPlanetCollision(context: MoonContext): void {
    this.state = 'destroyed';
    this.moonMesh.visible = false;
    this.orbitRing.visible = false;
    if (this.reEntryFlames) {
      this.reEntryFlames.visible = false;
    }

    const planetRadius = context.planet.config.radius;
    // Calculate precise impact point on Earth's surface
    const hitPos = this.moonMesh.position.clone().normalize().multiplyScalar(planetRadius);
    const hitNormal = hitPos.clone().normalize();

    // Map to local Earth UV and Lat/Lon
    const localHit = hitPos.clone();
    context.planet.surfaceMesh.worldToLocal(localHit);
    const uv = vector3ToUV(localHit);
    const { lat, lon } = vector3ToLatLon(localHit);

    // 1. Continental Shattering Impact on Earth
    context.planet.registerImpact({
      u: uv.u,
      v: uv.v,
      lat,
      lon,
      position: hitPos,
      radius: 0.42, // Enormous crater encompassing entire continent
      intensity: 3.5, // Mega cataclysm
      heat: 1.0,
      timestamp: performance.now(),
    });

    // 2. Triple Planetary Shockwaves
    context.shockwaveSystem.create(hitPos, hitNormal, planetRadius * 1.5, '#ffffff');
    context.shockwaveSystem.create(hitPos, hitNormal, planetRadius * 2.4, '#ff3300');
    context.shockwaveSystem.create(hitPos, hitNormal, planetRadius * 3.2, '#00f0ff');

    // 3. Colossal Ejecta Explosion
    context.particleSystem.emit(hitPos, hitNormal, 140, '#ff6600', 3.5, 8.0, 2.5, 1.2);
    context.particleSystem.emit(hitPos, hitNormal, 100, '#ffffff', 2.8, 6.5, 2.0, 1.0);
    context.particleSystem.emit(hitPos, hitNormal, 80, '#b0b0b4', 2.2, 5.0, 1.8, 0.8);

    // 4. Shatter Moon into Physical 3D Lunar Debris Chunks
    const chunkGeo = new THREE.DodecahedronGeometry(0.16, 0);
    const chunkMat = new THREE.MeshStandardMaterial({
      color: 0x99999e,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (let c = 0; c < 22; c++) {
      const mesh = new THREE.Mesh(chunkGeo, chunkMat);
      mesh.scale.set(
        0.5 + Math.random() * 0.8,
        0.5 + Math.random() * 0.8,
        0.5 + Math.random() * 0.8
      );
      mesh.position.copy(hitPos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      ));

      // Radial blowout velocity away from impact
      const vel = hitNormal.clone()
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 1.4
        ))
        .normalize()
        .multiplyScalar(4.0 + Math.random() * 8.0);

      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 6.0,
        (Math.random() - 0.5) * 6.0,
        (Math.random() - 0.5) * 6.0
      );

      this.debrisGroup.add(mesh);
      this.debrisPieces.push({ mesh, vel, rotVel });
    }

    // 5. Camera Trauma & Sound
    context.cameraController.addTrauma(1.0);
    context.audioManager.playNuclearBlast();
  }

  /**
   * Registers a weapon impact directly onto the Moon's surface,
   * drawing realistic molten craters and triggering lunar shockwaves.
   */
  public registerImpact(
    hitWorldPos: THREE.Vector3,
    intensity: number,
    radius: number,
    context?: MoonContext | null,
    impactType: 'blast' | 'freeze' | 'laser' = 'blast'
  ): void {
    if (this.state === 'destroyed' || !this.moonMesh.visible) return;

    // Convert world hit coordinates into Moon's local spherical coordinates
    const localHit = hitWorldPos.clone();
    this.moonMesh.worldToLocal(localHit);
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

      // 1. Charcoal Basin
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

      // 3. Bright high-albedo lunar ejecta rim
      this.ctx.strokeStyle = 'rgba(245, 245, 255, 0.85)';
      this.ctx.lineWidth = Math.max(1.5, pixelRadius * 0.16);
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, pixelRadius * 0.9, 0, Math.PI * 2);
      this.ctx.stroke();

      // Radial ejecta splash rays
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

    const hitNormal = hitWorldPos.clone().sub(this.moonMesh.position).normalize();

    // Spawn Particles & Shockwaves
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

    // Health damage & shattering
    this.health -= intensity * 25;
    if (this.health <= 0) {
      this.shatter(hitWorldPos, context);
    }
  }

  /**
   * Catastrophic lunar destruction: explodes Moon into orbiting 3D debris field
   */
  public shatter(hitWorldPos?: THREE.Vector3, context?: MoonContext | null): void {
    if (this.state === 'destroyed') return;
    this.state = 'destroyed';
    this.moonMesh.visible = false;
    this.orbitRing.visible = false;
    if (this.reEntryFlames) {
      this.reEntryFlames.visible = false;
    }

    const center = this.moonMesh.position.clone();
    const hitPoint = hitWorldPos || center;
    const hitNormal = hitPoint.clone().sub(center).normalize();

    const chunkGeo = new THREE.DodecahedronGeometry(0.12, 0);
    const chunkMat = new THREE.MeshStandardMaterial({
      color: 0x99999e,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (let c = 0; c < 24; c++) {
      const mesh = new THREE.Mesh(chunkGeo, chunkMat);
      mesh.scale.set(
        0.4 + Math.random() * 0.7,
        0.4 + Math.random() * 0.7,
        0.4 + Math.random() * 0.7
      );
      mesh.position.copy(center).add(new THREE.Vector3(
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

      this.debrisGroup.add(mesh);
      this.debrisPieces.push({ mesh, vel, rotVel });
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

  public dispose(): void {
    disposeNode(this.group);
    this.debrisPieces = [];
    if (this.moonTex) {
      this.moonTex.dispose();
    }
  }
}
