export type MoonTextureType =
  | 'lunar'
  | 'volcanic'
  | 'ice'
  | 'cratered_rock'
  | 'titan_haze'
  | 'cyber_station'
  | 'molten';

export interface MoonDefinition {
  id: string;
  name: string;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number; // Radians/sec (negative for retrograde orbits like Triton)
  inclination: number; // Orbital tilt in radians
  initialAngle?: number;
  type: MoonTextureType;
  baseColor: string;
  secondaryColor: string;
  accentColor?: string;
  bumpScale?: number;
  description: string;
}

export type MoonState = 'orbiting' | 'slingshot' | 'deorbiting' | 'destroyed';

export interface MoonSystemState {
  count: number;
  activeCount: number;
  names: string[];
  primaryState: MoonState;
}
