import * as THREE from 'three';
import { ProceduralNoise } from './noise';
import { SurfaceProfile } from '../types/planet';

export class ProceduralTextures {
  private static noise = new ProceduralNoise(12345);

  /**
   * Generates procedural Earth surface texture (continents, oceans, mountain ridges, polar ice)
   */
  public static createEarthSurfaceTexture(width: number = 1024, height: number = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const noise = this.noise;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = (0.5 - v) * Math.PI; // -pi/2 to +pi/2
      const isPolar = Math.abs(lat) > 1.15; // Polar regions

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lon = u * Math.PI * 2;

        // Spherical 3D coordinates for seamless noise
        const nx = Math.cos(lat) * Math.sin(lon);
        const ny = Math.sin(lat);
        const nz = Math.cos(lat) * Math.cos(lon);

        // Continental land elevation via 3D noise
        let elevation = noise.fbm2D(nx * 1.8 + 2.5, ny * 1.8 + nz * 1.8 + 2.5, 6, 2.0, 0.5);

        // Polar cap modulation
        const polarBlend = Math.max(0, (Math.abs(ny) - 0.75) / 0.25);

        let r = 0, g = 0, b = 0;

        if (polarBlend > 0.6 || (isPolar && elevation > 0.35)) {
          // Polar ice cap
          r = 230 + Math.floor(Math.random() * 25);
          g = 240 + Math.floor(Math.random() * 15);
          b = 255;
        } else if (elevation < 0.46) {
          // Deep ocean to shallow coastal waters
          const oceanDepth = elevation / 0.46;
          r = Math.floor(10 + oceanDepth * 25);
          g = Math.floor(35 + oceanDepth * 70);
          b = Math.floor(75 + oceanDepth * 95);
        } else if (elevation < 0.50) {
          // Sandy coastline / beaches
          r = 195;
          g = 180;
          b = 135;
        } else if (elevation < 0.65) {
          // Fertile lowland / forests
          const landGrad = (elevation - 0.50) / 0.15;
          r = Math.floor(35 + landGrad * 40);
          g = Math.floor(95 + landGrad * 35);
          b = Math.floor(40 + landGrad * 10);
        } else if (elevation < 0.78) {
          // Highlands / plateaus
          r = 120 + Math.floor((elevation - 0.65) * 200);
          g = 100 + Math.floor((elevation - 0.65) * 120);
          b = 65;
        } else {
          // High mountain peaks / snow tops
          r = 210;
          g = 215;
          b = 220;
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
   * Ocean specular mask: White where oceans are (highly reflective), dark on land
   */
  public static createEarthSpecularTexture(width: number = 512, height: number = 256): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const noise = this.noise;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = (0.5 - v) * Math.PI;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lon = u * Math.PI * 2;
        const nx = Math.cos(lat) * Math.sin(lon);
        const ny = Math.sin(lat);
        const nz = Math.cos(lat) * Math.cos(lon);

        const elevation = noise.fbm2D(nx * 1.8 + 2.5, ny * 1.8 + nz * 1.8 + 2.5, 6, 2.0, 0.5);
        const isWater = elevation < 0.46;

        const val = isWater ? 230 : 15;
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
   * Night lights texture: Glowing golden-amber city lights on the dark side
   */
  public static createEarthNightLightsTexture(width: number = 512, height: number = 256): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const noise = this.noise;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = (0.5 - v) * Math.PI;
      const polar = Math.abs(lat) > 1.1;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lon = u * Math.PI * 2;
        const nx = Math.cos(lat) * Math.sin(lon);
        const ny = Math.sin(lat);
        const nz = Math.cos(lat) * Math.cos(lon);

        const elevation = noise.fbm2D(nx * 1.8 + 2.5, ny * 1.8 + nz * 1.8 + 2.5, 6, 2.0, 0.5);
        const isLand = elevation >= 0.46 && !polar;

        let light = 0;
        if (isLand) {
          // City density clusters
          const cityNoise = noise.fbm2D(nx * 8.0 + 10, ny * 8.0 + nz * 8.0 + 10, 4, 2.0, 0.5);
          if (cityNoise > 0.58) {
            light = Math.pow((cityNoise - 0.58) / 0.42, 2.2) * 255;
          }
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, Math.floor(light * 1.2)); // Golden-orange
        data[idx + 1] = Math.min(255, Math.floor(light * 0.85));
        data[idx + 2] = Math.min(255, Math.floor(light * 0.45));
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
   * Procedural swirling cloud texture with alpha transparency
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

        // Swirling bands with Coriolis-style shear
        const swirlX = nx + Math.sin(ny * 4.0) * 0.15;
        const swirlZ = nz + Math.cos(ny * 4.0) * 0.15;

        let density = cloudNoise.fbm2D(swirlX * 2.5 + 5, ny * 3.5 + swirlZ * 2.5 + 5, 5, 2.1, 0.52);

        // Soft thresholding for fluffy cloud banks
        density = Math.max(0, (density - 0.42) / 0.45);
        density = Math.min(1, Math.pow(density, 1.4));

        const alpha = Math.floor(density * 225);
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
   * Procedural texture generator for other planets (Mars, Jupiter, Saturn, Fictional)
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
          // Atmospheric bands with turbulent vortices (Jupiter / Saturn style)
          const bandNoise = noise.noise2D(nx * 0.5, ny * 16.0);
          const turbulence = noise.fbm2D(nx * 4.0, ny * 8.0 + nz * 4.0, 4, 2.0, 0.5);
          t = Math.sin(ny * 25.0 + bandNoise * 2.0 + turbulence * 1.5) * 0.5 + 0.5;

          // Great spot / storms
          const spotDist = Math.hypot(nx - 0.5, ny + 0.35, nz - 0.2);
          if (spotDist < 0.28) {
            accent = Math.max(0, 1 - spotDist / 0.28);
          }
        } else if (profile.type === 'volcanic') {
          // Cracked magma veins
          const base = noise.fbm2D(nx * 2.0, ny * 2.0 + nz * 2.0, 5, 2.0, 0.5);
          const veins = Math.abs(noise.noise3D(nx * 6.0, ny * 6.0, nz * 6.0));
          t = base;
          accent = veins < 0.12 ? (1 - veins / 0.12) : 0;
        } else {
          // Rocky desert (Mars), Ice world, or Oceanic
          t = noise.fbm2D(nx * 2.2, ny * 2.2 + nz * 2.2, 5, 2.0, 0.5);
          if (profile.type === 'rocky_desert') {
            // Polar dry ice caps on Mars
            if (Math.abs(ny) > 0.88) {
              accent = Math.min(1, (Math.abs(ny) - 0.88) / 0.1);
            }
          }
        }

        // Interpolate colors
        let finalCol = colA.clone().lerp(colB, t);
        if (accent > 0) {
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
   * Concentric ring texture (e.g. for Saturn)
   */
  public static createRingTexture(width: number = 512, height: number = 64): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let x = 0; x < width; x++) {
      const u = x / width; // Radial position from inner to outer edge
      // Cassini division gap and varied dust density bands
      let opacity = Math.sin(u * Math.PI) * 0.85;
      if (u > 0.58 && u < 0.65) {
        opacity *= 0.1; // Cassini division
      }
      opacity *= (0.7 + 0.3 * Math.sin(u * 120.0));

      const r = Math.floor((190 + Math.sin(u * 10) * 30) * 0.95);
      const g = Math.floor((175 + Math.sin(u * 10) * 25) * 0.95);
      const b = Math.floor((140 + Math.sin(u * 10) * 20) * 0.95);
      const a = Math.floor(Math.max(0, Math.min(255, opacity * 255)));

      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }
}
