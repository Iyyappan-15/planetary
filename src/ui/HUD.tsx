import React from 'react';
import { PlanetConfig } from '../types/planet';
import { WeaponId, TargetInfo } from '../types/weapon';
import { PlanetIntegrity } from '../types/game';
import { RotateCcw, Sliders, Globe, Maximize } from 'lucide-react';
import { WeaponToolbar } from './WeaponToolbar';
import { ControlsHelp } from './ControlsHelp';

interface HUDProps {
  planet: PlanetConfig;
  integrity: PlanetIntegrity;
  targetInfo: TargetInfo | null;
  activeWeaponId: WeaponId;
  onSelectWeapon: (id: WeaponId) => void;
  onOpenPlanetSelector: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  planet,
  integrity,
  targetInfo,
  activeWeaponId,
  onSelectWeapon,
  onOpenPlanetSelector,
  onOpenSettings,
  onReset,
  onToggleFullscreen,
}) => {
  // Compute integrity color
  const hpPercent = integrity.percentage;
  let hpColor = '#00ffcc';
  if (hpPercent < 30) {
    hpColor = '#ff3344';
  } else if (hpPercent < 65) {
    hpColor = '#ff9922';
  }

  return (
    <>
      {/* Top Header */}
      <div className="hud-top">
        {/* Brand Logo */}
        <div className="hud-brand">
          <span className="brand-title">PLANETARY</span>
          <span className="brand-badge">SIMULATION V1.0</span>
        </div>

        {/* Planet Status & Integrity */}
        <div className="hud-planet-status">
          <div className="planet-header-row">
            <span className="planet-name">{planet.name}</span>
            <div className="integrity-bar-wrap">
              <div
                className="integrity-bar-fill"
                style={{
                  width: `${hpPercent}%`,
                  backgroundColor: hpColor,
                }}
              />
            </div>
            <span className="integrity-text" style={{ color: hpColor }}>
              {integrity.isBroken ? 'CATASTROPHIC FAILURE' : `${hpPercent}% INTEGRITY`}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="hud-actions">
          <button className="hud-btn btn-cyan" onClick={onOpenPlanetSelector} title="Select Planet">
            <Globe size={16} />
            <span>Planets</span>
          </button>
          <button className="hud-btn btn-danger" onClick={onReset} title="Reset Planet (R)">
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
          <button className="hud-btn" onClick={onOpenSettings} title="Settings">
            <Sliders size={16} />
            <span>Settings</span>
          </button>
          <button className="hud-btn" onClick={onToggleFullscreen} title="Toggle Fullscreen (F)">
            <Maximize size={16} />
          </button>
        </div>
      </div>

      {/* Target Coordinates Telemetry */}
      {targetInfo && !integrity.isBroken && (
        <div className="hud-target-info">
          <div className="target-row">
            <span className="target-label">LAT:</span>
            <span className="target-val">{targetInfo.lat.toFixed(1)}°</span>
          </div>
          <div className="target-row">
            <span className="target-label">LON:</span>
            <span className="target-val">{targetInfo.lon.toFixed(1)}°</span>
          </div>
          <div className="target-row">
            <span className="target-label">RANGE:</span>
            <span className="target-val">{targetInfo.distance.toFixed(2)} AU</span>
          </div>
        </div>
      )}

      {/* Weapon Arsenal Toolbar */}
      <WeaponToolbar activeWeaponId={activeWeaponId} onSelectWeapon={onSelectWeapon} />

      {/* Bottom Cheatsheet Help */}
      <ControlsHelp />
    </>
  );
};
