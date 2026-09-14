# PLANETARY — Cinematic Planetary Destruction Sandbox

A complete, production-quality, desktop browser-based planetary destruction sandbox and stress-relief game built with **Three.js**, **WebGL 2**, **React 19**, **TypeScript**, and the **Web Audio API**.

Players can inspect high-detail 3D planets, aim freely in spherical space, unleash an arsenal of kinetic, energy, explosive, gravitational, and cosmic tools, observe multi-stage destruction and planetary breakup simulations, and reset instantly.

---

## 🌌 Overview

* **Core Purpose**: "Select a planet. Pick anything you want. Experiment. Destroy it. Reset it. Repeat."
* **Zero Grind**: No login, no backend, no database, no ads, no paywalls, no artificial progression.
* **100% Client-Side**: No runtime external network dependencies. All planetary geometry, procedural textures, shaders, and audio are synthesized locally in-engine.

---

## 🚀 Key Features

* **Real-Time Procedural Planets**:
  - Realistic terminator day/night lighting with smooth atmospheric scattering.
  - Continental elevation, procedural ocean specular reflections, and night-side city illumination.
  - Rotating multi-altitude cloud spheres and planetary ring systems (e.g., Saturn).
* **Bounded GPU-Efficient Dynamic Damage**:
  - Persistent 2D dynamic damage map recording impact UV coordinates, crater depressions, scorch marks, and molten mantle glow.
  - Cumulative damage accumulation driving planetary integrity from 100% down to 0%.
* **Deterministic Catastrophic Breakup**:
  - Seamless transition from intact sphere to 3D crust and core fracture chunks.
  - Explosive outward momentum, tumbling angular velocity, and glowing molten interior edges.
* **10 Destructive Weapons**:
  - **Kinetic**: Meteor, Giant Asteroid, Moonfall.
  - **Energy**: Orbital Laser (continuous thermal cutting beam), Plasma Beam, Glassmaker.
  - **Explosive**: Nuclear Blast (incandescent expanding fireball, atmospheric shockwave, megacrater).
  - **Gravity**: Gravity Well (singularity vortex pulling debris and fragments).
  - **Cosmic**: Mini Black Hole (event horizon with accretion disc), Space-Time Tear.
* **Procedural Web Audio Engine**:
  - 100% synthesized sound design: sub-bass thuds, crunchy rock explosions, laser humming tones, infrasound gravitational sweeps, and space ambience.
* **Futuristic Sci-Fi HUD**:
  - Minimalist glassmorphism console with real-time telemetry (latitude, longitude, target range).
  - Categorized weapon dock, planet selector modal, settings modal, and bottom cheatsheet.
  - Instant Reset (`R`) and Fullscreen (`F`).

---

## 🪐 Celestial Bodies

### Tier 1 — Showcase & Core
1. **Earth**: Cradle of Humanity — Ocean world featuring continental landmasses, rotating cloud systems, and night-side city lights.
2. **Mars**: The Red Planet — Arid rust-red desert with massive impact basins, volcanic plateaus, and dry ice polar caps.
3. **Jupiter**: The Great Gas Giant — Turbulent atmospheric colossus with counter-rotating cloud bands and the Great Red Spot.
4. **Saturn**: Jewel of the Solar System — Golden gas giant surrounded by a majestic ring system.

### Tier 2 — Solar System Expansion
5. **Mercury**: Scorched iron-core world with heavy crater saturation.
6. **Venus**: Runaway greenhouse inferno under dense sulfuric acid clouds.
7. **Uranus**: Tilted aquamarine ice giant.
8. **Neptune**: Cerulean giant whipped by supersonic winds.

### Tier 3 — Fictional Exoplanets
9. **Terra Nova**: Pristine super-Earth with bioluminescent archipelagos.
10. **Ember**: Tidally locked volcanic magma world with obsidian fractures.
11. **Icefall**: Sub-zero glacial sphere with cryogenic nitrogen plumes.
12. **Abyss**: Shoreless global ocean world cloaked under megastorms.
13. **Verdant**: Hyper-dense jungle exoplanet with emerald canopies.
14. **Inferna**: Extreme supervolcanic world with hyperactive mantle rifts.

---

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Rotate Planet** | Click and Drag on empty space, or Shift + Drag |
| **Zoom In / Out** | Mouse Wheel Scroll |
| **Aim** | Move cursor over planet surface |
| **Fire Selected Weapon** | Left Mouse Click (or Hold for continuous weapons) |
| **Instant Planet Reset** | `R` key or Header Reset button |
| **Toggle Fullscreen** | `F` key or Header Fullscreen button |
| **Quick Arsenal Select** | Keys `1` through `9` |
| **Close Modals** | `Escape` key or Modal Close button |

---

## 🛠️ Technology Stack & Architecture

```
src/
├── app/
│   └── App.tsx                 # Root React component managing UI & Game engine
├── game/
│   └── Game.ts                 # Master 3D simulation loop and input dispatcher
├── renderer/
│   ├── SceneManager.ts         # Three.js WebGL2 renderer, lighting, starfield
│   └── CameraController.ts     # Smooth orbital camera with damping & screen trauma
├── planets/
│   ├── Planet.ts               # Master celestial body coordinator
│   ├── PlanetMaterial.ts       # Custom GLSL shader with terminator & molten glow
│   ├── Atmosphere.ts           # Fresnel rim scattering shell with disturbance
│   ├── CloudLayer.ts           # Rotating cloud sphere
│   ├── DamageSystem.ts         # Bounded GPU/Canvas dynamic damage & cratering
│   └── FractureSystem.ts       # 3D crust & core breakup chunks
├── weapons/
│   ├── Weapon.ts               # Base weapon lifecycle
│   ├── WeaponManager.ts        # Raycasting targeting & arsenal management
│   ├── kinetic/                # Meteor, GiantAsteroid, Moonfall
│   ├── energy/                 # OrbitalLaser, PlasmaBeam, Glassmaker
│   ├── explosive/              # NuclearBlast
│   ├── gravity/                # GravityWell
│   └── cosmic/                 # MiniBlackHole, SpaceTear
├── effects/
│   ├── ParticleSystem.ts       # GPU-efficient pooled ejecta & molten embers
│   ├── Shockwave.ts            # Expanding atmospheric shockwave rings
│   └── BeamEffect.ts           # High-energy laser beam & contact flare
├── audio/
│   └── AudioManager.ts         # Procedural Web Audio API synthesizer
├── ui/
│   ├── HUD.tsx                 # Sci-fi telemetry header & action controls
│   ├── WeaponToolbar.tsx       # Categorized weapon dock
│   ├── PlanetSelector.tsx      # 14-planet selection modal
│   ├── SettingsModal.tsx       # Quality presets & audio sliders
│   ├── ControlsHelp.tsx        # Bottom keybinding cheatsheet
│   └── LandingScreen.tsx       # Cinematic introductory landing overlay
├── data/
│   ├── planets.ts              # Declarative planet presets
│   └── weapons.ts              # Weapon specifications
└── utils/
    ├── noise.ts                # Self-contained Simplex/Perlin noise engine
    ├── textures.ts             # Procedural canvas texture generator
    ├── math.ts                 # Spherical coordinates & UV projections
    ├── storage.ts              # Persistent localStorage preferences
    └── disposal.ts             # Strict GPU memory & resource disposal
```

---

## ⚡ Performance & Adaptive Quality

* **Target**: 60 FPS on modern desktop hardware with graceful quality scaling.
* **Quality Presets**:
  - **Low**: Pixel ratio 1.0, 300 max particles, antialiasing disabled.
  - **Medium**: Pixel ratio 1.25, 500 max particles, balanced effects.
  - **High** (Default): Native pixel ratio, 800 max particles, full atmosphere and clouds.
  - **Ultra**: High-DPI scaling, 1200 max particles, maximum visual fidelity.
* **Strict Memory Management**: All textures, materials, and geometries are explicitly tracked and released during planet transitions and resets via `disposeNode()`.

---

## 💻 Local Development

### Prerequisites
- Node.js 18+ (tested on Node v24)
- npm 9+

### Setup & Run
```bash
# Clone the repository
git clone <repo-url>
cd planetary

# Install dependencies
npm install

# Start local dev server
npm run dev

# Or build and test production preview
npm run build
npm run preview
```

Open `http://localhost:4173/` in your browser.

---

## 🌐 Free Static Deployment

This project requires **no backend, database, or API keys**. It compiles to pure static HTML/CSS/JS and can be hosted for free on:

### Vercel
1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com) and import your repository.
3. Framework Preset: **Vite**.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Click **Deploy**.

### Netlify
1. Connect your GitHub repository at [Netlify](https://netlify.com).
2. Build command: `npm run build`.
3. Publish directory: `dist`.
4. Deploy!

### GitHub Pages
1. In `vite.config.ts`, set `base: './'`.
2. Build with `npm run build`.
3. Deploy the `dist/` folder using GitHub Pages Actions.

---

## 📄 License & Safety

* **License**: MIT License (see [LICENSE](LICENSE)).
* **Safety**: This project is fictional entertainment software. All weapons are artistic visual game abstractions.
