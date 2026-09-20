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
    // Precise UV to canvas mapping matching WebGL texture orientation
    const cx = impact.u * this.width;
    const cy = (1.0 - impact.v) * this.height;
    // Clean, realistic crater radius proportionate to planet scale (crisp and high-detail)
    const pixelRadius = Math.max(5, Math.min(38, impact.radius * this.width * 0.26));

    this.impactCount++;
    this.totalDamageScore += impact.intensity * (pixelRadius / 15);

    if (impact.type === 'freeze') {
      this.drawFrost(cx, cy, pixelRadius * 1.3, impact.intensity);
      if (cx - pixelRadius < 0) this.drawFrost(cx + this.width, cy, pixelRadius * 1.3, impact.intensity);
      else if (cx + pixelRadius > this.width) this.drawFrost(cx - this.width, cy, pixelRadius * 1.3, impact.intensity);
    } else {
      // Render clean, realistic circular impact crater
      this.drawCrater(cx, cy, pixelRadius, impact.intensity, impact.heat);

      // Handle seamless UV seam wrapping horizontally
      if (cx - pixelRadius < 0) {
        this.drawCrater(cx + this.width, cy, pixelRadius, impact.intensity, impact.heat);
      } else if (cx + pixelRadius > this.width) {
        this.drawCrater(cx - this.width, cy, pixelRadius, impact.intensity, impact.heat);
      }
    }

    this.damageTexture.needsUpdate = true;
  }

  private drawFrost(x: number, y: number, r: number, intensity: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    const frostGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    frostGrad.addColorStop(0, `rgba(220, 245, 255, ${clamp(intensity * 0.85, 0.4, 0.95)})`);
    frostGrad.addColorStop(0.5, `rgba(160, 220, 255, ${clamp(intensity * 0.65, 0.25, 0.8)})`);
    frostGrad.addColorStop(0.85, `rgba(100, 180, 240, ${clamp(intensity * 0.35, 0.1, 0.5)})`);
    frostGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = frostGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCrater(x: number, y: number, r: number, intensity: number, heat: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Sharp scorched impact basin with charred rim (R = depth, G = scorch, B = molten heat)
    const scorchGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const heatByte = Math.min(255, Math.floor(heat * 140));
    scorchGrad.addColorStop(0, `rgba(255, 240, ${heatByte}, ${clamp(intensity * 0.95, 0.4, 0.95)})`);
    scorchGrad.addColorStop(0.35, `rgba(180, 220, ${Math.floor(heatByte * 0.4)}, ${clamp(intensity * 0.85, 0.35, 0.9)})`);
    scorchGrad.addColorStop(0.70, `rgba(90, 160, 10, ${clamp(intensity * 0.6, 0.15, 0.6)})`);
    scorchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = scorchGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. Focused central ember core (inner 26% of crater) for high-energy strikes
    if (heat > 0.35) {
      const coreR = r * 0.26;
      const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
      coreGrad.addColorStop(0, `rgba(255, 160, 220, ${heat * 0.8})`);
      coreGrad.addColorStop(0.5, `rgba(255, 60, 100, ${heat * 0.35})`);
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
