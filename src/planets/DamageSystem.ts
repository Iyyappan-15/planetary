import * as THREE from 'three';
import { ImpactData } from '../types/planet';
import { clamp } from '../utils/math';

export class DamageSystem {
  public damageCanvas: HTMLCanvasElement;
  public damageTexture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  public totalDamageScore: number = 0;
  public impactCount: number = 0;
  private maxDamageThreshold: number = 100; // Planet starts breaking around 70-80%

  constructor(width: number = 1024, height: number = 512) {
    this.width = width;
    this.height = height;

    this.damageCanvas = document.createElement('canvas');
    this.damageCanvas.width = width;
    this.damageCanvas.height = height;
    this.ctx = this.damageCanvas.getContext('2d')!;

    // Initialize clean canvas (black = 0 damage, 0 scorch, 0 heat)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    this.ctx.fillRect(0, 0, width, height);

    this.damageTexture = new THREE.CanvasTexture(this.damageCanvas);
    this.damageTexture.wrapS = THREE.RepeatWrapping;
    this.damageTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.damageTexture.minFilter = THREE.LinearFilter;
    this.damageTexture.magFilter = THREE.LinearFilter;
  }

  /**
   * Registers an impact onto the damage texture
   * @param impact Impact data with UV coords, radius, intensity, and heat
   */
  public registerImpact(impact: ImpactData): void {
    // Correct UV to canvas coordinate mapping (flipY accounts for WebGL texture orientation)
    const cx = impact.u * this.width;
    const cy = (1.0 - impact.v) * this.height;
    const pixelRadius = Math.max(10, impact.radius * this.width);

    this.impactCount++;
    this.totalDamageScore += impact.intensity * (pixelRadius / 15);

    // 1. Render primary crater depression, scorch & molten core at exact impact point
    this.drawCrater(cx, cy, pixelRadius, impact.intensity, impact.heat, true);

    // Handle seamless UV seam wrapping horizontally
    if (cx - pixelRadius < 0) {
      this.drawCrater(cx + this.width, cy, pixelRadius, impact.intensity, impact.heat, false);
    } else if (cx + pixelRadius > this.width) {
      this.drawCrater(cx - this.width, cy, pixelRadius, impact.intensity, impact.heat, false);
    }

    // 2. Heavy impacts (e.g. asteroid, nuke, moonfall) send seismic shockwaves through the core,
    // creating a realistic antipodal fault fracture on the opposite side of the planet
    if (impact.intensity >= 0.85 || pixelRadius >= 35) {
      const antipodalX = (cx + this.width * 0.5) % this.width;
      const antipodalY = this.height - cy;
      const antipodalRadius = pixelRadius * 0.45;
      this.drawAntipodalFissure(antipodalX, antipodalY, antipodalRadius, impact.intensity * 0.5, impact.heat * 0.6);
    }

    this.damageTexture.needsUpdate = true;
  }

  private drawCrater(x: number, y: number, r: number, intensity: number, heat: number, drawRays: boolean = true): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // Accumulate damage smoothly

    // 1. Outer blasted soot & scorch ring (G = scorch, R = depth)
    const outerR = r * 1.35;
    const scorchGrad = ctx.createRadialGradient(x, y, 0, x, y, outerR);
    scorchGrad.addColorStop(0, `rgba(255, 245, ${Math.floor(heat * 255)}, ${clamp(intensity * 1.3, 0.5, 1.0)})`);
    scorchGrad.addColorStop(0.35, `rgba(220, 230, ${Math.floor(heat * 200)}, ${clamp(intensity * 1.0, 0.4, 0.95)})`);
    scorchGrad.addColorStop(0.7, `rgba(160, 180, 50, ${clamp(intensity * 0.7, 0.2, 0.7)})`);
    scorchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = scorchGrad;
    ctx.beginPath();
    ctx.arc(x, y, outerR, 0, Math.PI * 2);
    ctx.fill();

    // 2. Glowing Molten Core & Fissure Chamber
    if (heat > 0.2) {
      const coreR = r * 0.65;
      const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${clamp(heat * 1.2, 0.4, 1.0)})`);
      coreGrad.addColorStop(0.4, `rgba(255, 140, 240, ${heat * 0.85})`);
      coreGrad.addColorStop(0.75, `rgba(255, 60, 180, ${heat * 0.5})`);
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(x, y, coreR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Radial Seismic Fracture Rays & Ejecta Splatter (Makes the crater look authentic)
    if (drawRays && r >= 14) {
      const rayCount = 8 + Math.floor(Math.random() * 6);
      ctx.lineWidth = Math.max(1.5, r * 0.05);

      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const rayLen = r * (1.2 + Math.random() * 0.9);

        ctx.strokeStyle = `rgba(255, 160, ${Math.floor(heat * 200)}, ${clamp(intensity * 0.6, 0.2, 0.7)})`;
        ctx.beginPath();
        ctx.moveTo(x, y);

        // Segmented jagged crack line
        const midX = x + Math.cos(angle) * (rayLen * 0.5) + (Math.random() - 0.5) * (r * 0.2);
        const midY = y + Math.sin(angle) * (rayLen * 0.5) + (Math.random() - 0.5) * (r * 0.2);
        const endX = x + Math.cos(angle) * rayLen;
        const endY = y + Math.sin(angle) * rayLen;

        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Draws a realistic secondary antipodal seismic fissure on the opposite hemisphere
   */
  private drawAntipodalFissure(x: number, y: number, r: number, intensity: number, heat: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Soft thermal fissure glow
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(200, 140, ${Math.floor(heat * 200)}, ${intensity * 0.6})`);
    grad.addColorStop(0.5, `rgba(120, 80, 40, ${intensity * 0.3})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Fractured spiderweb lines
    const crackCount = 5;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(220, 100, ${Math.floor(heat * 180)}, ${intensity * 0.5})`;

    for (let i = 0; i < crackCount; i++) {
      const angle = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const len = r * (0.8 + Math.random() * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }

    ctx.restore();
  }

  public getIntegrityPercentage(resistance: number = 1.0): number {
    const scaledThreshold = this.maxDamageThreshold * resistance;
    const percent = Math.max(0, 100 - (this.totalDamageScore / scaledThreshold) * 100);
    return Math.round(percent);
  }

  public reset(): void {
    this.totalDamageScore = 0;
    this.impactCount = 0;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.damageTexture.needsUpdate = true;
  }

  public dispose(): void {
    this.damageTexture.dispose();
  }
}
