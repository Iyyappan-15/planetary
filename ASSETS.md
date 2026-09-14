# Asset Attribution & Technical Credits

## 1. NASA Blue Marble & Earth Imagery
* **Source**: [NASA Earth Observatory / Three.js Official Examples](https://threejs.org/examples/#webgl_planets_earth)
* **License**: Public Domain (NASA imagery is freely usable and in the public domain under US copyright law).
* **Included Local Textures**:
  - `earth_day.jpg` (NASA Visible Earth Blue Marble daytime surface map)
  - `earth_clouds.png` (NASA satellite cloud photography with alpha transparency)
  - `earth_lights.png` (NASA nighttime city illumination map)
  - `earth_normal.jpg` (NASA topographic relief normal map)
  - `earth_specular.jpg` (NASA ocean surface reflectivity map)

## 2. Procedural Textures & Noise Generator
* **Generator**: Custom in-engine `ProceduralNoise` (Simplex/Perlin noise & Fractal Brownian Motion) written in pure TypeScript (`src/utils/noise.ts`). Used for Mars, Jupiter, Saturn, and fictional exoplanets.
* **Licensing**: Open source, developed specifically for PLANETARY.

## 3. Audio Design
* **Synthesizer**: Procedural sound effects, cinematic sub-bass rumbles, and space ambient drones generated dynamically via native **Web Audio API** nodes (`src/audio/AudioManager.ts`).
* **Dependencies**: Native browser Web Audio API, zero external audio clips or network requests.

## 4. UI Icons
* **Library**: [Lucide Icons](https://lucide.dev/)
* **License**: ISC License (Copyright (c) 2022 Lucide Contributors).

## 5. 3D Engine & Shaders
* **Engine**: [Three.js](https://threejs.org/)
* **License**: MIT License (Copyright (c) 2010-2026 Three.js Authors).
* **Atmosphere & Surface Shaders**: Custom GLSL Rayleigh scattering shader and surface damage sampling shader developed for PLANETARY.
