export type ShieldType = 'hex_barrier' | 'plasma_deflector' | 'magnetic_aegis' | 'void_ward';

export type ShieldResistanceType = 'balanced' | 'energy' | 'kinetic' | 'cosmic';

export interface ShieldConfig {
  id: ShieldType;
  name: string;
  maxHp: number;
  color: string;
  glowColor: string;
  description: string;
  resistanceType: ShieldResistanceType;
  iconName: string;
  absorptionBonus: string;
}

export interface ActiveShieldState {
  id: ShieldType;
  name: string;
  currentHp: number;
  maxHp: number;
  percentage: number;
  color: string;
  glowColor: string;
}
