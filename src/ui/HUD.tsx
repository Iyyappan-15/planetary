import React, { useState, useEffect } from 'react';
import { PlanetConfig } from '../types/planet';
import { WeaponId, TargetInfo } from '../types/weapon';
import { PlanetIntegrity } from '../types/game';
import { RotateCcw, Sliders, Globe, Maximize, Users, AlertTriangle, Skull, Activity, Satellite } from 'lucide-react';
import { WeaponToolbar } from './WeaponToolbar';
import { ControlsHelp } from './ControlsHelp';

interface HUDProps {
  planet: PlanetConfig;
  integrity: PlanetIntegrity;
  targetInfo: TargetInfo | null;
  activeWeaponId: WeaponId | null;
  isRotationPaused: boolean;
  onToggleRotation: () => void;
  onSelectWeapon: (id: WeaponId | null) => void;
  onOpenPlanetSelector: () => void;
  onOpenSatelliteMap: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  planet,
  integrity,
  targetInfo,
  activeWeaponId,
  isRotationPaused,
  onToggleRotation,
  onSelectWeapon,
  onOpenPlanetSelector,
  onOpenSatelliteMap,
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

  const pop = integrity.population;
  const [recentCasualtyFlash, setRecentCasualtyFlash] = useState<number | null>(null);

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

          {/* Orbital Satellite Map Reconnaissance */}
          <button className="hud-btn btn-cyan" onClick={onOpenSatelliteMap} title="Open Satellite Reconnaissance Map (M)">
            <Satellite size={16} />
            <span>Satellite Map</span>
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

      {/* Right Side Telemetry & Demographics Monitor */}
      <div className="hud-right-panel">
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

      {/* Weapon Arsenal Toolbar */}
      <WeaponToolbar activeWeaponId={activeWeaponId} onSelectWeapon={onSelectWeapon} />

      {/* Bottom Cheatsheet Help */}
      <ControlsHelp />
    </>
  );
};
