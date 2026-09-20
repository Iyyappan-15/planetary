import React, { useState } from 'react';
import { WeaponId, WeaponCategory } from '../types/weapon';
import { ShieldType, ActiveShieldState } from '../types/shield';
import { WEAPON_CATEGORIES, WEAPON_DEFINITIONS } from '../data/weapons';
import { SHIELD_DEFINITIONS } from '../data/shields';
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
  ShieldAlert,
  ShieldCheck,
  Activity,
  HandMetal,
  Octagon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ChevronsDown,
  MoveVertical,
  Scissors,
  Footprints,
  Hand,
  Target,
  LucideIcon,
} from 'lucide-react';

interface WeaponToolbarProps {
  activeWeaponId: WeaponId | null;
  onSelectWeapon: (id: WeaponId | null) => void;
  activeShield: ActiveShieldState | null;
  onDeployShield: (type: ShieldType) => void;
  onRemoveShield: () => void;
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
  ShieldAlert,
  ShieldCheck,
  Activity,
  HandMetal,
  Octagon,
  Sparkles,
  ChevronsDown,
  MoveVertical,
  Scissors,
  Footprints,
  Hand,
  Target,
};

const CATEGORY_THEMES: Record<WeaponCategory, { color: string; bgGlow: string }> = {
  explosives: { color: '#ff6622', bgGlow: 'rgba(255, 102, 34, 0.35)' },
  lasers: { color: '#00f0ff', bgGlow: 'rgba(0, 240, 255, 0.35)' },
  celestial: { color: '#bd44ff', bgGlow: 'rgba(189, 68, 255, 0.35)' },
  alien: { color: '#00ff88', bgGlow: 'rgba(0, 255, 136, 0.35)' },
  monsters: { color: '#ff2255', bgGlow: 'rgba(255, 34, 85, 0.35)' },
  shields: { color: '#00e5ff', bgGlow: 'rgba(0, 229, 255, 0.35)' },
};

export const WeaponToolbar: React.FC<WeaponToolbarProps> = ({
  activeWeaponId,
  onSelectWeapon,
  activeShield,
  onDeployShield,
  onRemoveShield,
}) => {
  // Determine initial category
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
  const currentTheme = CATEGORY_THEMES[activeCategory] || { color: '#00f0ff', bgGlow: 'rgba(0, 240, 255, 0.35)' };

  return (
    <div className="solar-smash-weapon-dock left-dock">
      {/* 1. Vertical Category Dock Strip (Fixed on Left Edge) */}
      <div className="category-dock-strip">
        {WEAPON_CATEGORIES.map((cat) => {
          const Icon = ICON_MAP[cat.iconName] || Rocket;
          const isSelected = activeCategory === cat.id && isDrawerOpen;
          const theme = CATEGORY_THEMES[cat.id] || { color: '#00f0ff', bgGlow: 'rgba(0, 240, 255, 0.35)' };

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

      {/* 2. Slide-out Selection Drawer (Opens to the Right) */}
      <div className={`weapon-drawer drawer-right ${isDrawerOpen ? 'open' : 'closed'}`}>
        <div className="drawer-header" style={{ borderColor: currentTheme.color }}>
          <span className="drawer-title" style={{ color: currentTheme.color }}>
            {WEAPON_CATEGORIES.find((c) => c.id === activeCategory)?.name.toUpperCase()}
          </span>
          <button
            className="drawer-collapse-btn"
            onClick={() => setIsDrawerOpen(false)}
            title="Collapse Drawer"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* SHIELDS SECTION */}
        {activeCategory === 'shields' ? (
          <div className="drawer-weapon-grid">
            {SHIELD_DEFINITIONS.map((shield) => {
              const Icon = ICON_MAP[shield.iconName] || Shield;
              const isShieldActive = activeShield?.id === shield.id;

              return (
                <div
                  key={shield.id}
                  className={`drawer-weapon-card shield-card ${isShieldActive ? 'active shield-active' : ''}`}
                  style={{
                    borderColor: isShieldActive ? shield.color : undefined,
                    boxShadow: isShieldActive ? `0 0 16px ${shield.glowColor}` : undefined,
                  }}
                  onClick={() => {
                    if (isShieldActive) {
                      onRemoveShield();
                    } else {
                      onDeployShield(shield.id);
                    }
                  }}
                  title={shield.description}
                >
                  <div
                    className="card-icon-wrap"
                    style={{
                      color: isShieldActive ? shield.color : '#a0c0e0',
                      background: isShieldActive ? shield.glowColor : 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="card-info">
                    <span className="card-name">{shield.name}</span>
                  </div>
                </div>
              );
            })}

            {activeShield && (
              <button className="deactivate-shield-btn" onClick={onRemoveShield}>
                Deactivate Shield
              </button>
            )}
          </div>
        ) : (
          /* WEAPONS SECTION */
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
                    boxShadow: isActive ? `0 0 16px ${currentTheme.bgGlow}` : undefined,
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
