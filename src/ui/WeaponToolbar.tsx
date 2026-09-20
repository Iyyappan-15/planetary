import React, { useState } from 'react';
import { WeaponId, WeaponCategory } from '../types/weapon';
import { WEAPON_CATEGORIES, WEAPON_DEFINITIONS } from '../data/weapons';
import {
  Rocket,
  Zap,
  Orbit,
  Radio,
  Bug,
  Boxes,
  Radiation,
  Plane,
  Anchor,
  Snowflake,
  Sun,
  Sword,
  CloudLightning,
  Flame,
  CircleDot,
  Moon,
  Disc,
  Maximize2,
  Disc3,
  Crosshair,
  Shield,
  Activity,
  HandMetal,
  Octagon,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from 'lucide-react';

interface WeaponToolbarProps {
  activeWeaponId: WeaponId | null;
  onSelectWeapon: (id: WeaponId | null) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Rocket,
  Zap,
  Orbit,
  Radio,
  Bug,
  Boxes,
  Radiation,
  Plane,
  Anchor,
  Snowflake,
  Sun,
  Sword,
  CloudLightning,
  Flame,
  CircleDot,
  Moon,
  Disc,
  Maximize2,
  Disc3,
  Crosshair,
  Shield,
  Activity,
  HandMetal,
  Octagon,
};

const CATEGORY_THEMES: Record<WeaponCategory, { color: string; bgGlow: string }> = {
  explosives: { color: '#ff6622', bgGlow: 'rgba(255, 102, 34, 0.35)' },
  lasers: { color: '#00f0ff', bgGlow: 'rgba(0, 240, 255, 0.35)' },
  celestial: { color: '#bd44ff', bgGlow: 'rgba(189, 68, 255, 0.35)' },
  alien: { color: '#00ff88', bgGlow: 'rgba(0, 255, 136, 0.35)' },
  monsters: { color: '#ff2255', bgGlow: 'rgba(255, 34, 85, 0.35)' },
};

export const WeaponToolbar: React.FC<WeaponToolbarProps> = ({ activeWeaponId, onSelectWeapon }) => {
  // Find which category the active weapon belongs to
  const activeDef = WEAPON_DEFINITIONS.find((w) => w.id === activeWeaponId);
  const initialCat: WeaponCategory = activeDef ? activeDef.category : 'explosives';

  const [activeCategory, setActiveCategory] = useState<WeaponCategory>(initialCat);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);

  const handleCategoryClick = (catId: WeaponCategory) => {
    if (activeCategory === catId) {
      // Toggle drawer if clicking current category
      setIsDrawerOpen((prev) => !prev);
    } else {
      setActiveCategory(catId);
      setIsDrawerOpen(true);
    }
  };

  const categoryWeapons = WEAPON_DEFINITIONS.filter((w) => w.category === activeCategory);
  const currentTheme = CATEGORY_THEMES[activeCategory];

  return (
    <div className="solar-smash-weapon-dock">
      {/* Slide-out Weapon Selection Drawer */}
      <div className={`weapon-drawer ${isDrawerOpen ? 'open' : 'closed'}`}>
        <div className="drawer-header" style={{ borderColor: currentTheme.color }}>
          <span className="drawer-title" style={{ color: currentTheme.color }}>
            {WEAPON_CATEGORIES.find((c) => c.id === activeCategory)?.name.toUpperCase()}
          </span>
          <button
            className="drawer-collapse-btn"
            onClick={() => setIsDrawerOpen(false)}
            title="Collapse Drawer"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="drawer-weapon-grid">
          {categoryWeapons.map((weapon) => {
            const Icon = ICON_MAP[weapon.iconName] || Flame;
            const isActive = activeWeaponId === weapon.id;

            return (
              <div
                key={weapon.id}
                className={`drawer-weapon-card ${isActive ? 'active' : ''}`}
                style={{
                  borderColor: isActive ? currentTheme.color : undefined,
                  boxShadow: isActive ? `0 0 14px ${currentTheme.bgGlow}` : undefined,
                }}
                onClick={() => onSelectWeapon(isActive ? null : weapon.id)}
                title={weapon.description}
              >
                <div
                  className="card-icon-wrap"
                  style={{
                    color: isActive ? currentTheme.color : '#e0e0e0',
                    background: isActive ? currentTheme.bgGlow : 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Icon size={20} />
                </div>
                <div className="card-info">
                  <span className="card-name">{weapon.name}</span>
                  {weapon.requiresHold && <span className="card-tag">CONTINUOUS</span>}
                </div>
                {weapon.keyShortcut && (
                  <span className="card-shortcut">{weapon.keyShortcut}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Vertical Solar Smash Category Dock (Right Edge) */}
      <div className="category-dock-strip">
        {WEAPON_CATEGORIES.map((cat) => {
          const Icon = ICON_MAP[cat.iconName] || Rocket;
          const isSelected = activeCategory === cat.id && isDrawerOpen;
          const theme = CATEGORY_THEMES[cat.id];

          return (
            <button
              key={cat.id}
              className={`category-dock-btn ${isSelected ? 'active' : ''}`}
              style={{
                borderColor: isSelected ? theme.color : undefined,
                boxShadow: isSelected ? `0 0 16px ${theme.bgGlow}` : undefined,
                color: isSelected ? theme.color : '#8e99aa',
              }}
              onClick={() => handleCategoryClick(cat.id)}
              title={`${cat.name} (${cat.description})`}
            >
              <Icon size={22} className="cat-btn-icon" />
              <span className="cat-btn-label">{cat.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
