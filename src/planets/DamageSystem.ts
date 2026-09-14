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
    const cx = impact.u * this.width;
    const cy = impact.v * this.height;
    const pixelRadius = Math.max(8, impact.radius * this.width);

    this.impactCount++;
    this.totalDamageScore += impact.intensity * (pixelRadius / 15);

    // Render crater depression & scorch
    this.drawCrater(cx, cy, pixelRadius, impact.intensity, impact.heat);

    // Handle seamless UV seam wrapping horizontally
    if (cx - pixelRadius < 0) {
      this.drawCrater(cx + this.width, cy, pixelRadius, impact.intensity, impact.heat);
    } else if (cx + pixelRadius > this.width) {
      this.drawCrater(cx - this.width, cy, pixelRadius, impact.intensity, impact.heat);
    }

    this.damageTexture.needsUpdate = true;
  }

  private drawCrater(x: number, y: number, r: number, intensity: number, heat: number): void {
    const ctx = this.ctx;

    // Layer 1: Scorch & crater depth (drawn with red/green channels)
    const scorchGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    // Center: high depression (R) and high scorch (G)
    scorchGrad.addColorStop(0, `rgba(255, 240, ${Math.floor(heat * 255)}, ${clamp(intensity * 1.2, 0.4, 1.0)})`);
    scorchGrad.addColorStop(0.45, `rgba(200, 220, ${Math.floor(heat * 180)}, ${clamp(intensity * 0.9, 0.3, 0.9)})`);
    scorchGrad.addColorStop(0.75, `rgba(120, 160, 40, ${clamp(intensity * 0.7, 0.1, 0.7)})`);
    scorchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // Accumulate damage smoothly
    ctx.fillStyle = scorchGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: Glowing Molten core / Fissure lines for heavy hits
    if (heat > 0.3) {
      const coreR = r * 0.55;
      const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
      coreGrad.addColorStop(0, `rgba(255, 180, 255, ${heat})`);
      coreGrad.addColorStop(0.6, `rgba(255, 80, 200, ${heat * 0.7})`);
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(x, y, coreR, 0, Math.PI * 2);
      ctx.fill();
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
