import { PopulationState } from '../types/game';
import { ImpactData } from '../types/planet';
import { clamp } from '../utils/math';

export class PopulationSystem {
  public planetId: string;
  public initialPopulation: number;
  public currentPopulation: number;
  public totalCasualties: number = 0;
  public lastCasualties: number = 0;

  constructor(planetId: string, initialPopulation: number) {
    this.planetId = planetId;
    this.initialPopulation = initialPopulation;
    this.currentPopulation = initialPopulation;
  }

  /**
   * Calculates realistic population density factor at a given latitude/longitude
   */
  private getDensityFactor(lat: number, lon: number): number {
    if (this.currentPopulation <= 0) return 0;

    if (this.planetId === 'earth') {
      // Antarctica & Arctic
      if (lat < -60 || lat > 75) return 0.00005;

      // Deep Pacific Ocean (lat -50..50, lon -180..-100 or 150..180)
      if ((lon < -110 || lon > 150) && lat < 50 && lat > -45) {
        return 0.0001; // Tiny maritime traffic
      }

      // Deep Atlantic Ocean
      if (lon >= -45 && lon <= -20 && lat >= -40 && lat <= 40) {
        return 0.0002;
      }

      // Deep Indian Ocean
      if (lon >= 60 && lon <= 95 && lat >= -45 && lat <= -5) {
        return 0.0002;
      }

      // High Density Megacities & Population Belts
      // 1. South Asia (India, Pakistan, Bangladesh: lat 8..35, lon 65..95) - ~1.9 Billion people
      if (lat >= 8 && lat <= 35 && lon >= 65 && lon <= 95) {
        return 4.5;
      }

      // 2. East Asia (China, Japan, Korea, Taiwan: lat 20..45, lon 100..142) - ~1.6 Billion people
      if (lat >= 20 && lat <= 45 && lon >= 100 && lon <= 142) {
        return 4.2;
      }

      // 3. Europe (lat 36..60, lon -10..35) - ~750 Million
      if (lat >= 36 && lat <= 60 && lon >= -10 && lon <= 35) {
        return 2.6;
      }

      // 4. Eastern North America (lat 25..50, lon -95..-65) - ~350 Million
      if (lat >= 25 && lat <= 50 && lon >= -95 && lon <= -65) {
        return 2.0;
      }

      // 5. Southeast Asia (Indonesia, Philippines, Vietnam: lat -10..22, lon 95..128) - ~680 Million
      if (lat >= -10 && lat <= 22 && lon >= 95 && lon <= 128) {
        return 2.8;
      }

      // 6. Sub-Saharan & West Africa (lat -25..15, lon -18..45) - ~1.2 Billion
      if (lat >= -25 && lat <= 15 && lon >= -18 && lon <= 45) {
        return 1.8;
      }

      // 7. Coastal South America (lat -35..10, lon -75..-35) - ~430 Million
      if (lat >= -35 && lat <= 10 && lon >= -75 && lon <= -35) {
        return 1.4;
      }

      // 8. Australia & Oceania (lat -38..-12, lon 114..155) - ~42 Million
      if (lat >= -38 && lat <= -12 && lon >= 114 && lon <= 155) {
        return 0.4;
      }

      // Other landmasses
      return 0.8;
    }

    // Fictional worlds / colonies
    return 1.0;
  }

  /**
   * Evaluates casualties from an impact event
   */
  public registerImpactCasualties(impact: ImpactData, isCatastrophicBreakup: boolean = false): number {
    if (this.currentPopulation <= 0) {
      this.lastCasualties = 0;
      return 0;
    }

    // Total planetary extinction upon breakup
    if (isCatastrophicBreakup) {
      this.lastCasualties = this.currentPopulation;
      this.totalCasualties += this.lastCasualties;
      this.currentPopulation = 0;
      return this.lastCasualties;
    }

    const lat = impact.lat ?? 0;
    const lon = impact.lon ?? 0;
    const density = this.getDensityFactor(lat, lon);

    // Baseline population slice affected by blast radius relative to planetary surface
    // Planetary surface area ratio ~ (radius)^2
    const blastAreaFactor = Math.pow(impact.radius * 3.5, 2);

    // Direct blast casualties
    let casualtyRatio = blastAreaFactor * density * impact.intensity * 0.45;
    casualtyRatio = clamp(casualtyRatio, 0.00001, 0.45);

    // Apply casualties
    const potentialKilled = Math.round(this.initialPopulation * casualtyRatio);
    // Add realistic randomized micro-variation
    const variance = 0.9 + Math.random() * 0.2;
    const killed = Math.min(this.currentPopulation, Math.max(0, Math.round(potentialKilled * variance)));

    this.lastCasualties = killed;
    this.totalCasualties += killed;
    this.currentPopulation = Math.max(0, this.currentPopulation - killed);

    return killed;
  }

  public getState(): PopulationState {
    const survivalRate = this.initialPopulation > 0
      ? Math.max(0, Math.min(100, (this.currentPopulation / this.initialPopulation) * 100))
      : 0;

    return {
      current: this.currentPopulation,
      initial: this.initialPopulation,
      casualties: this.totalCasualties,
      lastCasualties: this.lastCasualties,
      survivalRate,
    };
  }

  public reset(): void {
    this.currentPopulation = this.initialPopulation;
    this.totalCasualties = 0;
    this.lastCasualties = 0;
  }
}
