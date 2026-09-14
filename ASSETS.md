# Asset Attribution & Technical Credits

All visual assets, shaders, procedural textures, and audio in **PLANETARY** are synthesized procedurally in-engine or crafted as inline vector graphics. No copyrighted third-party images, 3D models, or audio samples are used.

## 1. Procedural Planet Textures & Noise
* **Generator**: Custom in-engine `ProceduralNoise` (Simplex/Perlin noise & Fractal Brownian Motion) written in pure TypeScript (`src/utils/noise.ts`).
* **Licensing**: Open source, developed specifically for PLANETARY.

## 2. Audio Design
* **Synthesizer**: Procedural sound effects and space ambient drones generated dynamically via the **Web Audio API** (`src/audio/AudioManager.ts`).
* **Dependencies**: Native browser Web Audio API, zero external audio clips or network downloads.

## 3. Icons
* **Library**: [Lucide Icons](https://lucide.dev/)
* **License**: ISC License (Copyright (c) 2022 Lucide Contributors).

## 4. 3D Engine & Shaders
* **Engine**: [Three.js](https://threejs.org/)
* **License**: MIT License (Copyright (c) 2010-2026 Three.js Authors).
* **Atmosphere & Surface Shaders**: Custom GLSL Fresnel rim shader and surface damage sampling shader developed for PLANETARY.
