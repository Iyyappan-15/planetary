import * as THREE from 'three';
import { ProceduralNoise } from './noise';
import { SurfaceProfile } from '../types/planet';

export class ProceduralTextures {
  private static noise = new ProceduralNoise(777);

  /**
   * Helper determining continental land probability based on realistic Earth geography
   */
  private static getContinentalFactor(latDeg: number, lonDeg: number): number {
    let landScore = 0;

    // 1. Antarctica
    if (latDeg < -62) {
      return 1.0;
    }

    // 2. North America (lat 15..72, lon -168..-50)
    if (latDeg >= 15 && latDeg <= 72 && lonDeg >= -168 && lonDeg <= -50) {
      const dLat = (latDeg - 45) / 28;
      const dLon = (lonDeg - (-105)) / 50;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < 1.0) landScore = Math.max(landScore, 1.0 - dist);
    }

    // 3. South America (lat -55..12, lon -82..-34)
    if (latDeg >= -55 && latDeg <= 12 && lonDeg >= -82 && lonDeg <= -34) {
      const dLat = (latDeg - (-20)) / 32;
      const dLon = (lonDeg - (-60)) / 22;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < 1.0) landScore = Math.max(landScore, 1.0 - dist);
    }

    // 4. Africa (lat -35..37, lon -18..52)
    if (latDeg >= -35 && latDeg <= 37 && lonDeg >= -18 && lonDeg <= 52) {
      const dLat = (latDeg - 2) / 34;
      const dLon = (lonDeg - 18) / 32;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < 1.0) landScore = Math.max(landScore, 1.0 - dist);
    }

    // 5. Europe & Asia (Eurasia: lat 10..76, lon -10..170)
    if (latDeg >= 10 && latDeg <= 76 && lonDeg >= -10 && lonDeg <= 170) {
      const dLat = (latDeg - 46) / 30;
      const dLon = (lonDeg - 85) / 80;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < 1.0) landScore = Math.max(landScore, 1.0 - dist);
    }

    // 6. Australia (lat -42..-10, lon 112..154)
    if (latDeg >= -42 && latDeg <= -10 && lonDeg >= 112 && lonDeg <= 154) {
      const dLat = (latDeg - (-25)) / 15;
      const dLon = (lonDeg - 133) / 20;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < 1.0) landScore = Math.max(landScore, 1.0 - dist);
    }

    // 7. Greenland (lat 60..83, lon -70..-20)
    if (latDeg >= 60 && latDeg <= 83 && lonDeg >= -70 && lonDeg <= -20) {
      landScore = Math.max(landScore, 0.9);
    }

    return landScore;
  }

  /**
   * Generates photorealistic procedural Earth surface map
   */
  public static createEarthSurfaceTexture(width: number = 2048, height: number = 1024): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const noise = this.noise;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const latDeg = (0.5 - v) * 180; // -90 to +90
      const latRad = (latDeg * Math.PI) / 180;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lonDeg = u * 360 - 180; // -180 to +180
        const lonRad = (lonDeg * Math.PI) / 180;

        // 3D coordinates on unit sphere
        const nx = Math.cos(latRad) * Math.sin(lonRad);
        const ny = Math.sin(latRad);
        const nz = Math.cos(latRad) * Math.cos(lonRad);

        // Continental plate template
        const continentFactor = this.getContinentalFactor(latDeg, lonDeg);

        // Multi-octave fractal noise for coastal roughness and mountain topology
        const terrainNoise = (noise.fbm2D(nx * 3.2 + 10, ny * 3.2 + nz * 3.2 + 10, 6, 2.0, 0.5) + 1.0) * 0.5;
        const microNoise = (noise.fbm2D(nx * 12.0, ny * 12.0 + nz * 12.0, 3, 2.0, 0.5) + 1.0) * 0.5;

        // Final elevation blend
        const elevation = continentFactor * 0.65 + terrainNoise * 0.45 + microNoise * 0.08;
        const isLand = elevation > 0.48;

        let r = 0, g = 0, b = 0;

        // Polar Ice Caps
        if (latDeg > 74 || latDeg < -64) {
          r = 235 + Math.floor(microNoise * 20);
          g = 242 + Math.floor(microNoise * 13);
          b = 255;
        } else if (!isLand) {
          // OCEAN
          const depth = Math.max(0, Math.min(1, (0.48 - elevation) / 0.48));
          if (depth < 0.12) {
            // Shallow tropical coastline / turquoise reef shelf
            const t = depth / 0.12;
            r = Math.floor(28 + (15 - 28) * t);
            g = Math.floor(135 + (65 - 135) * t);
            b = Math.floor(165 + (125 - 165) * t);
          } else {
            // Deep sapphire to midnight blue oceanic abyss
            const t = (depth - 0.12) / 0.88;
            r = Math.floor(12 + (6 - 12) * t);
            g = Math.floor(45 + (18 - 45) * t);
            b = Math.floor(105 + (48 - 105) * t);
          }
        } else {
          // LAND
          const landHeight = (elevation - 0.48) / 0.52;

          // Check for arid / desert latitude belts (Sahara, Arabia, Australia)
          const isSahara = latDeg >= 15 && latDeg <= 32 && lonDeg >= -15 && lonDeg <= 55;
          const isAussieOutback = latDeg >= -32 && latDeg <= -18 && lonDeg >= 115 && lonDeg <= 145;
          const isGobi = latDeg >= 38 && latDeg <= 46 && lonDeg >= 90 && lonDeg <= 115;
          const isDesert = isSahara || isAussieOutback || isGobi;

          if (landHeight < 0.03) {
            // Sandy coastline / beach rim
            r = 195;
            g = 182;
            b = 142;
          } else if (isDesert && landHeight < 0.45) {
            // Warm golden Sahara / Australian desert sand
            const dt = landHeight / 0.45;
            r = Math.floor(205 + dt * 25);
            g = Math.floor(165 + dt * 20);
            b = Math.floor(105 + dt * 15);
          } else if (landHeight < 0.42) {
            // Lush lowland forests, plains, temperate river valleys
            const lt = landHeight / 0.42;
            r = Math.floor(38 + lt * 30);
            g = Math.floor(95 + lt * 25);
            b = Math.floor(42 + lt * 10);
          } else if (landHeight < 0.72) {
            // Rocky mountain ranges / plateaus (Andes, Rockies, Alps)
            const mt = (landHeight - 0.42) / 0.3;
            r = Math.floor(115 + mt * 45);
            g = Math.floor(98 + mt * 35);
            b = Math.floor(72 + mt * 25);
          } else {
            // High altitude snow-capped summits (Himalayas)
            r = 230;
            g = 235;
            b = 245;
          }
        }

        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Ocean specular mask: Bright reflective white on water, non-reflective on land
   */
  public static createEarthSpecularTexture(width: number = 1024, height: number = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const noise = this.noise;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const latDeg = (0.5 - v) * 180;
      const latRad = (latDeg * Math.PI) / 180;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lonDeg = u * 360 - 180;
        const lonRad = (lonDeg * Math.PI) / 180;

        const nx = Math.cos(latRad) * Math.sin(lonRad);
        const ny = Math.sin(latRad);
        const nz = Math.cos(latRad) * Math.cos(lonRad);

        const continentFactor = this.getContinentalFactor(latDeg, lonDeg);
        const terrainNoise = (noise.fbm2D(nx * 3.2 + 10, ny * 3.2 + nz * 3.2 + 10, 6, 2.0, 0.5) + 1.0) * 0.5;
        const elevation = continentFactor * 0.65 + terrainNoise * 0.45;
        const isLand = elevation > 0.48;

        // Water reflects sharply; land is matte
        const val = isLand ? 15 : 240;

        const idx = (y * width + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Night lights texture: Glowing amber city lights along populated coastlines
   */
  public static createEarthNightLightsTexture(width: number = 1024, height: number = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const noise = this.noise;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const latDeg = (0.5 - v) * 180;
      const latRad = (latDeg * Math.PI) / 180;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lonDeg = u * 360 - 180;
        const lonRad = (lonDeg * Math.PI) / 180;

        const nx = Math.cos(latRad) * Math.sin(lonRad);
        const ny = Math.sin(latRad);
        const nz = Math.cos(latRad) * Math.cos(lonRad);

        const continentFactor = this.getContinentalFactor(latDeg, lonDeg);
        const terrainNoise = (noise.fbm2D(nx * 3.2 + 10, ny * 3.2 + nz * 3.2 + 10, 6, 2.0, 0.5) + 1.0) * 0.5;
        const elevation = continentFactor * 0.65 + terrainNoise * 0.45;
        const isLand = elevation > 0.48 && latDeg > -55 && latDeg < 70;

        let light = 0;
        if (isLand) {
          // Metropolitan density clusters
          const cityCluster = (noise.fbm2D(nx * 14.0 + 30, ny * 14.0 + nz * 14.0 + 30, 4, 2.0, 0.5) + 1.0) * 0.5;
          if (cityCluster > 0.58) {
            light = Math.pow((cityCluster - 0.58) / 0.42, 2.5) * 255;
          }
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, Math.floor(light * 1.15)); // Warm amber
        data[idx + 1] = Math.min(255, Math.floor(light * 0.85));
        data[idx + 2] = Math.min(255, Math.floor(light * 0.4));
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Procedural swirling cloud texture with soft realistic wisps
   */
  public static createCloudTexture(width: number = 1024, height: number = 512, seed: number = 99): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const cloudNoise = new ProceduralNoise(seed);

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = (0.5 - v) * Math.PI;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lon = u * Math.PI * 2;
        const nx = Math.cos(lat) * Math.sin(lon);
        const ny = Math.sin(lat);
        const nz = Math.cos(lat) * Math.cos(lon);

        // Coriolis shear swirl
        const swirlX = nx + Math.sin(ny * 3.5) * 0.12;
        const swirlZ = nz + Math.cos(ny * 3.5) * 0.12;

        let density = (cloudNoise.fbm2D(swirlX * 3.0 + 8, ny * 4.0 + swirlZ * 3.0 + 8, 5, 2.0, 0.5) + 1.0) * 0.5;

        // Soft thresholding
        density = Math.max(0, (density - 0.44) / 0.46);
        density = Math.pow(density, 1.3);

        const alpha = Math.floor(density * 210);
        const idx = (y * width + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = alpha;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Surface texture for other planets (Mars, Jupiter, Saturn, Fictional)
   */
  public static createSurfaceTexture(profile: SurfaceProfile, width: number = 1024, height: number = 512): THREE.CanvasTexture {
    if (profile.type === 'earth_like') {
      return this.createEarthSurfaceTexture(width, height);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const noise = new ProceduralNoise(profile.seed);
    const colA = new THREE.Color(profile.primaryColor);
    const colB = new THREE.Color(profile.secondaryColor);
    const colAccent = new THREE.Color(profile.accentColor || profile.primaryColor);

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = (0.5 - v) * Math.PI;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lon = u * Math.PI * 2;
        const nx = Math.cos(lat) * Math.sin(lon);
        const ny = Math.sin(lat);
        const nz = Math.cos(lat) * Math.cos(lon);

        let t = 0;
        let accent = 0;

        if (profile.type === 'gas_giant') {
          // Atmospheric bands with turbulent vortices (Jupiter / Saturn)
          const bandNoise = noise.noise2D(nx * 0.5, ny * 16.0);
          const turbulence = (noise.fbm2D(nx * 4.0, ny * 8.0 + nz * 4.0, 4, 2.0, 0.5) + 1.0) * 0.5;
          t = Math.sin(ny * 24.0 + bandNoise * 2.0 + turbulence * 1.5) * 0.5 + 0.5;

          // Storm spot
          const spotDist = Math.hypot(nx - 0.45, ny + 0.3, nz - 0.25);
          if (spotDist < 0.28) {
            accent = Math.max(0, 1 - spotDist / 0.28);
          }
        } else if (profile.type === 'volcanic') {
          t = (noise.fbm2D(nx * 2.2, ny * 2.2 + nz * 2.2, 5, 2.0, 0.5) + 1.0) * 0.5;
          const veins = Math.abs(noise.noise3D(nx * 6.0, ny * 6.0, nz * 6.0));
          accent = veins < 0.12 ? 1 - veins / 0.12 : 0;
        } else if (profile.type === 'star') {
          // Photospheric granulation cells (turbulent convective plasma)
          const gran1 = noise.fbm2D(nx * 12.0, ny * 12.0 + nz * 12.0, 4, 2.0, 0.5);
          const gran2 = noise.noise3D(nx * 24.0, ny * 24.0, nz * 24.0);
          t = (gran1 * 0.65 + gran2 * 0.35 + 1.0) * 0.5;

          // Prominent magnetic sunspots (cooling convective umbra)
          const spot1 = Math.hypot(nx - 0.35, ny - 0.15, nz - 0.55);
          const spot2 = Math.hypot(nx + 0.45, ny + 0.25, nz + 0.35);
          const spot3 = Math.hypot(nx - 0.1, ny + 0.4, nz - 0.6);
          const minSpot = Math.min(spot1, spot2, spot3);
          if (minSpot < 0.18) {
            accent = 1.0 - minSpot / 0.18;
          }
        } else {
          // Rocky desert (Mars), Ice world, or Oceanic
          t = (noise.fbm2D(nx * 2.5, ny * 2.5 + nz * 2.5, 5, 2.0, 0.5) + 1.0) * 0.5;
          if (profile.type === 'rocky_desert') {
            if (Math.abs(ny) > 0.86) {
              accent = Math.min(1, (Math.abs(ny) - 0.86) / 0.12);
            }
          }
        }

        let finalCol = colA.clone().lerp(colB, t);
        if (profile.type === 'star') {
          // Incandescent white hot convective centers
          if (t > 0.6) {
            finalCol.lerp(new THREE.Color('#ffffff'), (t - 0.6) * 1.5);
          }
          // Dark magnetic sunspot umbras
          if (accent > 0) {
            const sunspotColor = new THREE.Color('#380e03');
            finalCol.lerp(sunspotColor, Math.pow(accent, 1.4));
          }
        } else if (accent > 0) {
          finalCol.lerp(colAccent, accent);
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.floor(finalCol.r * 255);
        data[idx + 1] = Math.floor(finalCol.g * 255);
        data[idx + 2] = Math.floor(finalCol.b * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Concentric ring texture based on NASA Cassini-Huygens spectral imaging (e.g. for Saturn)
   */
  public static createRingTexture(width: number = 1024, height: number = 64): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let x = 0; x < width; x++) {
      const u = x / width; // Radial coordinate from inner to outer edge
      let r = 245;
      let g = 230;
      let b = 200;
      let alpha = 0.0;

      // Fine harmonic micro-ring density variations
      const fineGrooves = 0.86 + 0.14 * Math.sin(u * 280.0) * Math.sin(u * 71.0);
      const densityWave = 0.92 + 0.08 * Math.sin(u * 62.0);

      if (u < 0.08) {
        // D Ring: Faint inner dust veil
        alpha = (u / 0.08) * 0.3;
        r = 190; g = 170; b = 145;
      } else if (u < 0.28) {
        // C Ring (Crepe Ring): Translucent warm amber-gray
        const cu = (u - 0.08) / 0.20;
        alpha = (0.42 + 0.25 * Math.sin(cu * Math.PI)) * fineGrooves;
        r = Math.floor(215 * densityWave);
        g = Math.floor(198 * densityWave);
        b = Math.floor(168 * densityWave);
      } else if (u < 0.65) {
        // B Ring: The densest, most brilliant, shimmering gold-cream ring
        const bu = (u - 0.28) / 0.37;
        alpha = (0.92 + 0.08 * Math.sin(bu * 12.0)) * fineGrooves;
        r = Math.floor(252 * densityWave);
        g = Math.floor(238 * densityWave);
        b = Math.floor(210 * densityWave);
      } else if (u < 0.72) {
        // Cassini Division: Prominent dark gap
        const gapU = (u - 0.65) / 0.07;
        alpha = 0.04 + 0.06 * Math.sin(gapU * Math.PI);
        r = 120; g = 110; b = 95;
      } else if (u < 0.96) {
        // A Ring: Silvery-golden outer ring with Encke Gap
        const au = (u - 0.72) / 0.24;
        const encke = Math.abs(u - 0.865) < 0.012 ? 0.08 : 1.0;
        alpha = (0.84 + 0.12 * Math.sin(au * 8.0)) * fineGrooves * encke;
        r = Math.floor(240 * densityWave);
        g = Math.floor(226 * densityWave);
        b = Math.floor(202 * densityWave);
      } else {
        // F Ring: Delicate outer thread
        const fu = (u - 0.96) / 0.04;
        alpha = Math.sin(fu * Math.PI) * 0.75;
        r = 250; g = 235; b = 215;
      }

      const finalAlpha = Math.floor(Math.max(0, Math.min(255, alpha * 255)));

      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = finalAlpha;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
