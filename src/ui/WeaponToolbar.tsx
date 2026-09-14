import React, { useState } from 'react';
import { WeaponId, WeaponCategory } from '../types/weapon';
import { WEAPON_DEFINITIONS } from '../data/weapons';
import {
  Flame,
  Zap,
  Radiation,
  Orbit,
  CircleDot,
  Sun,
  Disc,
  Maximize2,
  Sparkles,
  Moon,
  LucideIcon,
} from 'lucide-react';

interface WeaponToolbarProps {
  activeWeaponId: WeaponId | null;
  onSelectWeapon: (id: WeaponId | null) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Flame,
  Zap,
  Radiation,
  Orbit,
  CircleDot,
  Sun,
  Disc,
  Maximize2,
  Sparkles,
  Moon,
};

export const WeaponToolbar: React.FC<WeaponToolbarProps> = ({ activeWeaponId, onSelectWeapon }) => {
  const [selectedCategory, setSelectedCategory] = useState<WeaponCategory | 'all'>('all');

  const categories: Array<{ id: WeaponCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'kinetic', label: 'Kinetic' },
    { id: 'energy', label: 'Energy' },
    { id: 'explosive', label: 'Explosive' },
    { id: 'gravity', label: 'Gravity' },
    { id: 'cosmic', label: 'Cosmic' },
  ];

  const filteredWeapons = WEAPON_DEFINITIONS.filter((w) =>
    selectedCategory === 'all' ? true : w.category === selectedCategory
  );

  return (
    <div className="weapon-toolbar">
      <div className="weapon-category-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="weapon-list">
        {filteredWeapons.map((weapon) => {
          const Icon = ICON_MAP[weapon.iconName] || Flame;
          const isActive = activeWeaponId === weapon.id;

          return (
            <div
              key={weapon.id}
              className={`weapon-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelectWeapon(isActive ? null : weapon.id)}
              title={isActive ? `Click to deselect ${weapon.name}` : weapon.description}
            >
              <div className="weapon-info">
                <Icon className="weapon-icon" />
                <span className="weapon-name">{weapon.name}</span>
              </div>
              {weapon.keyShortcut && <span className="weapon-shortcut">{weapon.keyShortcut}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
