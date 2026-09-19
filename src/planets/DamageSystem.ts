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
    // Clean, realistic crater radius proportionate to planet scale
    const pixelRadius = Math.max(6, Math.min(55, impact.radius * this.width * 0.32));

    this.impactCount++;
    this.totalDamageScore += impact.intensity * (pixelRadius / 15);

    // Render clean, realistic circular impact crater
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
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Clean circular scorched crater (R = depth, G = scorch, B = molten heat)
    const scorchGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const heatByte = Math.min(255, Math.floor(heat * 180));
    scorchGrad.addColorStop(0, `rgba(255, 230, ${heatByte}, ${clamp(intensity * 0.95, 0.4, 0.95)})`);
    scorchGrad.addColorStop(0.45, `rgba(180, 200, ${Math.floor(heatByte * 0.5)}, ${clamp(intensity * 0.8, 0.3, 0.85)})`);
    scorchGrad.addColorStop(0.75, `rgba(90, 140, 20, ${clamp(intensity * 0.5, 0.1, 0.5)})`);
    scorchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = scorchGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. Central warm ember core for high-energy hits
    if (heat > 0.4) {
      const coreR = r * 0.38;
      const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
      coreGrad.addColorStop(0, `rgba(255, 180, 200, ${heat * 0.75})`);
      coreGrad.addColorStop(0.6, `rgba(255, 80, 100, ${heat * 0.35})`);
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
