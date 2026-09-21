import React, { useState, useEffect } from 'react';
import { PlanetConfig } from '../types/planet';
import { WeaponId, TargetInfo } from '../types/weapon';
import { ShieldType, ActiveShieldState } from '../types/shield';
import { PlanetIntegrity } from '../types/game';
import { RotateCcw, Sliders, Globe, Maximize, Users, AlertTriangle, Skull, Activity, Satellite, Shield, Orbit, Moon, Flame, MoveUpRight } from 'lucide-react';
import { WeaponToolbar } from './WeaponToolbar';
import { ControlsHelp } from './ControlsHelp';
import type { MoonState } from '../planets/MoonSystem';
import { PLANET_MOONS } from '../data/moons';

interface HUDProps {
  planet: PlanetConfig;
  integrity: PlanetIntegrity;
  targetInfo: TargetInfo | null;
  activeWeaponId: WeaponId | null;
  isRotationPaused: boolean;
  onToggleRotation: () => void;
  isCloudsVisible: boolean;
  onToggleClouds: () => void;
  onSelectWeapon: (id: WeaponId | null) => void;
  activeShield: ActiveShieldState | null;
  onDeployShield: (type: ShieldType) => void;
  onRemoveShield: () => void;
  onOpenPlanetSelector: () => void;
  onOpenSatelliteMap: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
  moonState: MoonState | null;
  onSlingshotMoon: () => void;
  onDeorbitMoon: () => void;
  onResetMoon: () => void;
  isSolarView: boolean;
  onToggleSolarView: () => void;
  onStartMobileFire?: () => void;
  onStopMobileFire?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  planet,
  integrity,
  targetInfo,
  activeWeaponId,
  isRotationPaused,
  onToggleRotation,
  isCloudsVisible,
  onToggleClouds,
  onSelectWeapon,
  activeShield,
  onDeployShield,
  onRemoveShield,
  onOpenPlanetSelector,
  onOpenSatelliteMap,
  onOpenSettings,
  onReset,
  onToggleFullscreen,
  moonState,
  onSlingshotMoon,
  onDeorbitMoon,
  onResetMoon,
  isSolarView,
  onToggleSolarView,
  onStartMobileFire,
  onStopMobileFire,
}) => {
  // Compute integrity color
  const hpPercent = integrity.percentage;
  let hpColor = '#00ffcc';
  if (hpPercent < 30) {
    hpColor = '#ff3344';
  } else if (hpPercent < 65) {
    hpColor = '#ff9922';
  }

  const pop = integrity.population;
  const [recentCasualtyFlash, setRecentCasualtyFlash] = useState<number | null>(null);
  const [isMobileTelemetryOpen, setIsMobileTelemetryOpen] = useState<boolean>(false);

  // Trigger brief alert flash when new casualties occur
  useEffect(() => {
    if (pop && pop.lastCasualties > 0) {
      setRecentCasualtyFlash(pop.lastCasualties);
      const timer = setTimeout(() => {
        setRecentCasualtyFlash(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [pop?.lastCasualties, pop?.current]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

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

          {/* Active Planetary Shield Health Status */}
          {activeShield && (
            <div className="shield-header-row" style={{ borderColor: activeShield.color }}>
              <div className="shield-title-wrap">
                <Shield size={12} style={{ color: activeShield.color }} />
                <span className="shield-name-text" style={{ color: activeShield.color }}>
                  {activeShield.name.toUpperCase()}
                </span>
              </div>
              <div className="shield-bar-wrap">
                <div
                  className="shield-bar-fill"
                  style={{
                    width: `${activeShield.percentage}%`,
                    backgroundColor: activeShield.color,
                    boxShadow: `0 0 8px ${activeShield.color}`,
                  }}
                />
              </div>
              <span className="shield-hp-text" style={{ color: activeShield.color }}>
                {activeShield.currentHp.toLocaleString()} / {activeShield.maxHp.toLocaleString()} HP ({activeShield.percentage}%)
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="hud-actions">
          {/* Pause / Resume Rotation Checkbox Button */}
          <button
            className={`hud-btn hud-toggle-btn ${isRotationPaused ? 'active-warning' : ''}`}
            onClick={onToggleRotation}
            title={isRotationPaused ? 'Resume Planet Rotation (Space)' : 'Stop Planet Rotation (Space)'}
          >
            <div className={`hud-checkbox ${isRotationPaused ? 'checked' : ''}`}>
              {isRotationPaused && <div className="hud-checkbox-inner" />}
            </div>
            <span>{isRotationPaused ? 'Rotation Paused' : 'Rotate Planet'}</span>
          </button>

          {/* Cloud Layer Toggle Checkbox Button */}
          {planet.clouds?.enabled && (
            <button
              className={`hud-btn hud-toggle-btn ${isCloudsVisible ? 'active-cyan' : ''}`}
              onClick={onToggleClouds}
              title={isCloudsVisible ? 'Hide Atmospheric Clouds' : 'Show Atmospheric Clouds'}
            >
              <div className={`hud-checkbox ${isCloudsVisible ? 'checked' : ''}`}>
                {isCloudsVisible && <div className="hud-checkbox-inner" />}
              </div>
              <span>Clouds</span>
            </button>
          )}

          {/* Orbital Satellite Map Reconnaissance */}
          <button className="hud-btn btn-cyan" onClick={onOpenSatelliteMap} title="Open Satellite Reconnaissance Map (M)">
            <Satellite size={16} />
            <span>Satellite Map</span>
          </button>

          {/* Solar System Orrery Overview */}
          <button
            className={`hud-btn ${isSolarView ? 'active-cyan' : 'btn-cyan'}`}
            onClick={onToggleSolarView}
            title={isSolarView ? 'Return to Close Planetary Orbit' : 'Zoom Out to Solar System Orrery View'}
          >
            <Orbit size={16} />
            <span>{isSolarView ? 'Planet View' : 'Solar View'}</span>
          </button>

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

      {/* Mobile Telemetry Quick Pill (Visible in mobile landscape) */}
      <button
        className={`mobile-telemetry-toggle ${isMobileTelemetryOpen ? 'active' : ''}`}
        onClick={() => setIsMobileTelemetryOpen((prev) => !prev)}
        title="Toggle Planetary Telemetry"
      >
        <Activity size={13} style={{ color: '#00f0ff' }} />
        <span>
          {pop && pop.initial > 0
            ? pop.current > 0
              ? `${(pop.current / 1e9).toFixed(2)}B`
              : 'EXTINCT'
            : 'TELEMETRY'}
        </span>
        {PLANET_MOONS[planet.id]?.length > 0 && (
          <span className="telemetry-pill-moon">🌕 {PLANET_MOONS[planet.id].length}</span>
        )}
      </button>

      {/* Right Side Telemetry & Demographics Monitor */}
      <div className={`hud-right-panel ${isMobileTelemetryOpen ? 'mobile-expanded' : ''}`}>
        {/* Moon Orbital Physics & Gravitational Weapons Card */}
        {(() => {
          const planetMoons = PLANET_MOONS[planet.id] || [];
          if (planetMoons.length === 0 || moonState === null) return null;

          return (
            <div className="hud-moon-card">
              <div className="moon-header">
                <div className="moon-title-wrap">
                  <Moon size={14} style={{ color: '#66ccff' }} />
                  <span>{planetMoons.length === 1 ? 'MOON ORBIT' : `MOONS (${planetMoons.length})`}</span>
                </div>
                <span className={`moon-status-tag ${moonState}`}>
                  {moonState === 'orbiting'
                    ? 'STABLE'
                    : moonState === 'deorbiting'
                    ? 'COLLISION'
                    : moonState === 'slingshot'
                    ? 'ESCAPING'
                    : 'DESTROYED'}
                </span>
              </div>

              {/* Badges for each orbiting moon */}
              <div className="moon-chips-row">
                {planetMoons.map((m) => (
                  <div key={m.id} className="moon-badge" title={`${m.name}: ${m.description}`}>
                    <span className="moon-dot" style={{ backgroundColor: m.accentColor || m.baseColor }} />
                    <span className="moon-badge-name">{m.name.split(' (')[0]}</span>
                  </div>
                ))}
              </div>

              <div className="moon-actions-grid">
                <button
                  className="moon-action-btn btn-crash"
                  onClick={onDeorbitMoon}
                  disabled={moonState === 'deorbiting' || moonState === 'destroyed'}
                  title="De-orbit Moon on a catastrophic collision course"
                >
                  <Flame size={13} />
                  <span>{planetMoons.length > 1 ? 'Crash Moons' : 'Crash Moon'}</span>
                </button>
                <button
                  className="moon-action-btn btn-sling"
                  onClick={onSlingshotMoon}
                  disabled={moonState === 'slingshot' || moonState === 'destroyed'}
                  title="Slingshot Moon out of orbit into deep space"
                >
                  <MoveUpRight size={13} />
                  <span>Slingshot</span>
                </button>
                <button
                  className="moon-action-btn btn-reset"
                  onClick={onResetMoon}
                  title="Restore Moons to stable orbits"
                >
                  <RotateCcw size={13} />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Population & Demographics Card */}
        {pop && pop.initial > 0 && (
          <div className={`hud-population-card ${pop.current === 0 ? 'extinction' : ''}`}>
            <div className="pop-card-header">
              <div className="pop-title-wrap">
                <Users size={15} className="pop-header-icon" />
                <span className="pop-title">SURFACE POPULATION</span>
              </div>
              <span className={`pop-status-badge ${pop.current === 0 ? 'extinct' : pop.survivalRate < 40 ? 'critical' : 'stable'}`}>
                {pop.current === 0 ? 'EXTINCT' : pop.survivalRate < 40 ? 'COLLAPSING' : 'ACTIVE'}
              </span>
            </div>

            <div className="pop-count-main">
              <span className="pop-number">{formatNumber(pop.current)}</span>
              <span className="pop-total-denom">/ {formatNumber(pop.initial)}</span>
            </div>

            {/* Recent Casualties Notification Badge */}
            {recentCasualtyFlash !== null && recentCasualtyFlash > 0 && (
              <div className="pop-casualty-alert animate-shake">
                <Skull size={13} className="casualty-icon" />
                <span>-{formatNumber(recentCasualtyFlash)} CASUALTIES</span>
              </div>
            )}

            {/* Survival Bar */}
            <div className="pop-survival-section">
              <div className="pop-survival-info">
                <span className="survival-label">
                  <Activity size={12} /> Survival Rate
                </span>
                <span className="survival-val">{pop.survivalRate.toFixed(1)}%</span>
              </div>
              <div className="survival-bar-wrap">
                <div
                  className="survival-bar-fill"
                  style={{
                    width: `${pop.survivalRate}%`,
                    backgroundColor: pop.survivalRate < 25 ? '#ff2a4b' : pop.survivalRate < 60 ? '#ff8c1a' : '#00ffcc',
                  }}
                />
              </div>
            </div>

            {/* Total Killed Metric */}
            {pop.casualties > 0 && (
              <div className="pop-total-casualties">
                <span className="total-cas-label">Total Losses:</span>
                <span className="total-cas-val">{formatNumber(pop.casualties)}</span>
              </div>
            )}
          </div>
        )}

        {/* Uninhabited Indicator if world has 0 initial population */}
        {pop && pop.initial === 0 && (
          <div className="hud-population-card uninhabited">
            <div className="pop-card-header">
              <div className="pop-title-wrap">
                <AlertTriangle size={15} className="pop-header-icon text-dim" />
                <span className="pop-title">DEMOGRAPHICS</span>
              </div>
              <span className="pop-status-badge barren">UNINHABITED</span>
            </div>
            <div className="uninhabited-text">0 Sentient Lifeforms Detected</div>
          </div>
        )}

        {/* Target Coordinates Telemetry */}
        {targetInfo && !integrity.isBroken && (
          <div className="hud-target-info">
            <div className="target-card-header">
              <span>TARGET LOCK TELEMETRY</span>
            </div>
            <div className="target-row">
              <span className="target-label">LATITUDE</span>
              <span className="target-val">{targetInfo.lat.toFixed(2)}°</span>
            </div>
            <div className="target-row">
              <span className="target-label">LONGITUDE</span>
              <span className="target-val">{targetInfo.lon.toFixed(2)}°</span>
            </div>
            <div className="target-row">
              <span className="target-label">ORBITAL RANGE</span>
              <span className="target-val">{targetInfo.distance.toFixed(2)} AU</span>
            </div>
          </div>
        )}
      </div>

      {/* Weapon Arsenal & Shield Toolbar */}
      <WeaponToolbar
        activeWeaponId={activeWeaponId}
        onSelectWeapon={onSelectWeapon}
        activeShield={activeShield}
        onDeployShield={onDeployShield}
        onRemoveShield={onRemoveShield}
      />

      {/* Bottom Cheatsheet Help */}
      <ControlsHelp />

      {/* Mobile Gamepad Glowing Fire Trigger (Right Thumb) */}
      {activeWeaponId && (
        <div className="mobile-gamepad-controls">
          <button
            className="mobile-fire-btn"
            onTouchStart={(e) => {
              e.preventDefault();
              onStartMobileFire?.();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onStopMobileFire?.();
            }}
            onMouseDown={() => onStartMobileFire?.()}
            onMouseUp={() => onStopMobileFire?.()}
            title="Deploy Active Weapon"
          >
            <div className="fire-btn-glow-ring" />
            <Flame size={26} className="fire-btn-icon" />
            <span className="fire-btn-label">FIRE</span>
          </button>
        </div>
      )}
    </>
  );
};
