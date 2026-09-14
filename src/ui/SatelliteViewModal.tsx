import React, { useState } from 'react';
import { PlanetConfig } from '../types/planet';
import { TargetInfo, WeaponId } from '../types/weapon';
import { WEAPON_DEFINITIONS } from '../data/weapons';
import {
  X,
  Crosshair,
  MapPin,
  ZoomIn,
  ZoomOut,
  Compass,
  Satellite,
  Eye,
  Globe,
  Flame,
  Moon,
  Sun,
  Radio,
} from 'lucide-react';

interface SatelliteMapModalProps {
  planet: PlanetConfig;
  targetInfo: TargetInfo | null;
  activeWeaponId: WeaponId | null;
  onClose: () => void;
  onJumpToCoordinates: (lat: number, lon: number) => void;
  onFireAtCoordinates: (lat: number, lon: number, weaponId: WeaponId) => void;
}

interface Landmark {
  name: string;
  region: string;
  lat: number;
  lon: number;
  pop: string;
  desc: string;
}

const EARTH_LANDMARKS: Landmark[] = [
  { name: 'Tokyo Metropolis', region: 'East Asia', lat: 35.67, lon: 139.65, pop: '37.4 Million', desc: 'Highest density urban megalopolis on Earth' },
  { name: 'Mumbai Coast', region: 'South Asia', lat: 19.07, lon: 72.87, pop: '21.3 Million', desc: 'High-density commercial hub and coastal peninsula' },
  { name: 'Greater London', region: 'Europe', lat: 51.50, lon: -0.12, pop: '9.0 Million', desc: 'Historic financial capital and European cultural center' },
  { name: 'New York City', region: 'North America', lat: 40.71, lon: -74.00, pop: '19.8 Million', desc: 'Dense metropolitan Atlantic coastline hub' },
  { name: 'Cairo & Nile Valley', region: 'North Africa', lat: 30.04, lon: 31.23, pop: '22.1 Million', desc: 'Densely populated agricultural ribbon on the Nile' },
  { name: 'São Paulo', region: 'South America', lat: -23.55, lon: -46.63, pop: '22.6 Million', desc: 'Largest metropolis in the Southern Hemisphere' },
  { name: 'Sydney Harbour', region: 'Oceania', lat: -33.86, lon: 151.20, pop: '5.3 Million', desc: 'Southeastern coastal harbor capital' },
  { name: 'Paris Capital', region: 'Europe', lat: 48.85, lon: 2.35, pop: '11.1 Million', desc: 'Historic European cultural and economic epicenter' },
  { name: 'Beijing Metropolis', region: 'East Asia', lat: 39.90, lon: 116.40, pop: '21.8 Million', desc: 'Northern capital and high-density urban core' },
  { name: 'Moscow Center', region: 'Eurasia', lat: 55.75, lon: 37.61, pop: '13.1 Million', desc: 'Major northern Eurasian metropolitan hub' },
  { name: 'Point Nemo', region: 'South Pacific', lat: -48.87, lon: -123.39, pop: '0 (Maritime)', desc: 'Oceanic Pole of Inaccessibility, furthest from any land' },
];

function getGeographicalContext(lat: number, lon: number): { name: string; region: string; pop: string; desc: string } {
  // Check for nearby landmark within 3.5 degrees
  const nearbyLandmark = EARTH_LANDMARKS.find(
    (lm) => Math.abs(lm.lat - lat) < 3.5 && Math.abs(lm.lon - lon) < 3.5
  );
  if (nearbyLandmark) {
    return nearbyLandmark;
  }

  // Polar
  if (lat < -60) return { name: 'Antarctic Glacial Plateau', region: 'South Pole', pop: '1,100 (Research Crew)', desc: 'Perpetually glaciated polar ice cap and continent.' };
  if (lat > 75) return { name: 'Arctic Ice Pack Basin', region: 'North Pole', pop: '0 (Maritime)', desc: 'Perpetual Arctic marine pack ice.' };

  // Oceans
  if ((lon < -115 || lon > 150) && lat < 55 && lat > -50) {
    return { name: 'Pacific Ocean Basin', region: 'Maritime Sector', pop: '< 30,000 (Vessels)', desc: 'Vast planetary oceanic expanse covering a third of Earth.' };
  }
  if (lon >= -50 && lon <= -15 && lat >= -45 && lat <= 45) {
    return { name: 'Atlantic Ocean Corridor', region: 'Maritime Sector', pop: '< 50,000 (Maritime)', desc: 'Major transatlantic global shipping trade corridor.' };
  }
  if (lon >= 55 && lon <= 95 && lat >= -45 && lat <= 0) {
    return { name: 'Indian Ocean Basin', region: 'Maritime Sector', pop: '< 25,000 (Maritime)', desc: 'Warm equatorial ocean connecting Africa and Asia.' };
  }

  // Continents
  if (lat >= 8 && lat <= 36 && lon >= 68 && lon <= 92) {
    return { name: 'South Asian Subcontinent', region: 'High Density Zone', pop: '1.9+ Billion', desc: 'Indo-Gangetic Basin and coastal megalopolises.' };
  }
  if (lat >= 20 && lat <= 45 && lon >= 100 && lon <= 142) {
    return { name: 'East Asian Pacific Rim', region: 'Industrial Megaregion', pop: '1.6+ Billion', desc: 'Dense industrial, technological, and coastal capitals.' };
  }
  if (lat >= 35 && lat <= 62 && lon >= -10 && lon <= 40) {
    return { name: 'European Plain', region: 'Eurasian Continent', pop: '750+ Million', desc: 'Historic urban hubs, infrastructure, and agricultural heartland.' };
  }
  if (lat >= 25 && lat <= 52 && lon >= -125 && lon <= -65) {
    return { name: 'North American Continent', region: 'Continental Zone', pop: '370+ Million', desc: 'Vast economic heartland, coastlines, and mountain ranges.' };
  }
  if (lat >= -35 && lat <= 12 && lon >= -80 && lon <= -34) {
    return { name: 'South American Continent', region: 'Pan-American Zone', pop: '430+ Million', desc: 'Amazon basin, Andes mountain range, and coastal metropolises.' };
  }
  if (lat >= -35 && lat <= 35 && lon >= -18 && lon <= 52) {
    return { name: 'African Continent', region: 'Pan-African Zone', pop: '1.4+ Billion', desc: 'Sahara desert, African rift valley, and major population centers.' };
  }
  if (lat >= -40 && lat <= -10 && lon >= 112 && lon <= 155) {
    return { name: 'Australian Landmass', region: 'Oceania', pop: '27 Million', desc: 'Arid continental outback with dense coastal urban belts.' };
  }

  return {
    name: `Sector Target (${lat.toFixed(1)}°, ${lon.toFixed(1)}°)`,
    region: 'Geospatial Grid',
    pop: 'Active Demographic',
    desc: 'Target coordinates acquired via orbital satellite telemetry.'
  };
}

export const SatelliteMapModal: React.FC<SatelliteMapModalProps> = ({
  planet,
  targetInfo,
  activeWeaponId,
  onClose,
  onJumpToCoordinates,
  onFireAtCoordinates,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [mapLayer, setMapLayer] = useState<'day' | 'night'>('day');
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>(activeWeaponId || 'nuclear_blast');

  // Active targeted location
  const [targetLocation, setTargetLocation] = useState<{
    lat: number;
    lon: number;
    name: string;
    region: string;
    pop: string;
    desc: string;
  }>(() => {
    if (targetInfo) {
      const info = getGeographicalContext(targetInfo.lat, targetInfo.lon);
      return { lat: targetInfo.lat, lon: targetInfo.lon, ...info };
    }
    return {
      ...EARTH_LANDMARKS[0],
    };
  });

  // Convert lat/lon to percentage coordinates on equirectangular 2:1 projection
  const getMapPercent = (lat: number, lon: number) => {
    const x = ((lon + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    const lon = Math.max(-180, Math.min(180, xRatio * 360 - 180));
    const lat = Math.max(-90, Math.min(90, 90 - yRatio * 180));

    const info = getGeographicalContext(lat, lon);
    setTargetLocation({ lat, lon, ...info });
  };

  const handleLandmarkClick = (lm: Landmark) => {
    setTargetLocation({ ...lm });
  };

  const handleLockCamera = () => {
    onJumpToCoordinates(targetLocation.lat, targetLocation.lon);
    onClose();
  };

  const handleLaunchStrike = (weaponIdToUse?: WeaponId) => {
    const weapon = weaponIdToUse || selectedWeapon;
    onFireAtCoordinates(targetLocation.lat, targetLocation.lon, weapon);
    onClose();
  };

  const isEarth = planet.id === 'earth';
  const targetPos = getMapPercent(targetLocation.lat, targetLocation.lon);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card satellite-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <Satellite className="satellite-pulse-icon" size={20} />
            <span className="modal-title">ORBITAL SATELLITE RECONNAISSANCE: {planet.name.toUpperCase()}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Layer Switcher */}
            {isEarth && (
              <div className="segmented-group">
                <button
                  className={`segmented-btn ${mapLayer === 'day' ? 'active' : ''}`}
                  onClick={() => setMapLayer('day')}
                  title="Daytime High-Contrast True Color"
                >
                  <Sun size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                  True Color
                </button>
                <button
                  className={`segmented-btn ${mapLayer === 'night' ? 'active' : ''}`}
                  onClick={() => setMapLayer('night')}
                  title="Night Human Activity & City Lights"
                >
                  <Moon size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                  City Lights
                </button>
              </div>
            )}

            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Satellite Map Container */}
        <div className="satellite-modal-content">
          <div className="satellite-viewport">
            {/* Control HUD Bar */}
            <div className="satellite-hud-overlay top-left">
              <div className="sat-hud-badge">
                <Compass size={14} />
                <span>GEOSPATIAL SATELLITE RECONNAISSANCE</span>
              </div>
              <div className="sat-hud-spec">
                PROJECTION: WGS84 EQUIRECTANGULAR | RESOLUTION: HIGH-CLARITY
              </div>
            </div>

            <div className="satellite-zoom-controls">
              <button
                className="sat-zoom-btn"
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.35))}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <span className="sat-zoom-label">{(zoomLevel * 100).toFixed(0)}%</span>
              <button
                className="sat-zoom-btn"
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.35))}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
            </div>

            {/* Scrollable Viewport Wrapper */}
            <div className="satellite-image-wrapper">
              <div
                className="satellite-map-container"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  cursor: 'crosshair',
                }}
                onClick={handleMapClick}
                onDoubleClick={() => handleLaunchStrike()}
                title="Click anywhere to lock target coordinates. Double click to launch orbital strike."
              >
                {/* NASA Satellite Surface Image */}
                <img
                  src={
                    isEarth
                      ? mapLayer === 'day'
                        ? './earth_day.jpg'
                        : './earth_lights.png'
                      : undefined
                  }
                  alt={`${planet.name} Satellite Surface`}
                  className="satellite-surface-img"
                  style={
                    !isEarth
                      ? { background: `radial-gradient(circle, ${planet.surface.primaryColor}, #050b14)` }
                      : mapLayer === 'night'
                      ? { filter: 'brightness(1.2) contrast(1.15)', background: '#030712' }
                      : { filter: 'contrast(1.08) saturate(1.12)' }
                  }
                />

                {/* Scanline Grid Overlay */}
                <div className="satellite-grid-overlay" />

                {/* Major Equator & Prime Meridian Crosshairs */}
                <div className="sat-equator-line" />
                <div className="sat-prime-meridian" />

                {/* Active Target Reticle Marker */}
                <div
                  className="sat-target-crosshair"
                  style={{ left: `${targetPos.x}%`, top: `${targetPos.y}%` }}
                  title={`Target: Lat ${targetLocation.lat.toFixed(1)}°, Lon ${targetLocation.lon.toFixed(1)}°`}
                >
                  <Crosshair size={32} className="sat-crosshair-reticle" />
                  <span className="sat-crosshair-tag">
                    {targetLocation.lat.toFixed(1)}°, {targetLocation.lon.toFixed(1)}°
                  </span>
                </div>

                {/* Major Global Landmarks */}
                {isEarth &&
                  EARTH_LANDMARKS.map((lm) => {
                    const pos = getMapPercent(lm.lat, lm.lon);
                    const isSelected = targetLocation.name === lm.name;

                    return (
                      <div
                        key={lm.name}
                        className={`sat-landmark-pin ${isSelected ? 'active' : ''}`}
                        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLandmarkClick(lm);
                        }}
                      >
                        <MapPin size={16} className="pin-icon" />
                        <span className="pin-label">{lm.name}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Bottom Satellite Intelligence & Weapon Strike Panel */}
          <div className="satellite-intel-panel" style={{ flexDirection: 'column', gap: '10px' }}>
            <div className="intel-card">
              <div className="intel-info" style={{ flex: 1 }}>
                <div className="intel-title-row">
                  <span className="intel-name">{targetLocation.name}</span>
                  <span className="intel-region">{targetLocation.region}</span>
                  <span className="control-key" style={{ fontSize: '10px', background: 'rgba(0, 255, 204, 0.1)', color: 'var(--hud-cyan)' }}>
                    TARGET ACQUIRED
                  </span>
                </div>
                <div className="intel-stats-row">
                  <span>
                    <strong>Coordinates:</strong> {Math.abs(targetLocation.lat).toFixed(2)}°{' '}
                    {targetLocation.lat >= 0 ? 'N' : 'S'}, {Math.abs(targetLocation.lon).toFixed(2)}°{' '}
                    {targetLocation.lon >= 0 ? 'E' : 'W'}
                  </span>
                  <span><strong>Demographic:</strong> {targetLocation.pop}</span>
                </div>
                <p className="intel-desc">{targetLocation.desc}</p>
              </div>

              {/* Action Buttons */}
              <div className="intel-action" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="hud-btn btn-cyan"
                  onClick={handleLockCamera}
                  title="Pivot camera over this location"
                >
                  <Eye size={16} />
                  <span>Lock Orbit Cam</span>
                </button>

                <button
                  className="hud-btn"
                  style={{
                    background: 'linear-gradient(135deg, #ff3344, #ff7700)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    boxShadow: '0 0 16px rgba(255, 51, 68, 0.5)',
                  }}
                  onClick={() => handleLaunchStrike()}
                  title="Launch selected orbital weapon visually at this exact target"
                >
                  <Flame size={16} />
                  <span>Launch Orbital Strike</span>
                </button>
              </div>
            </div>

            {/* Weapon Selector Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                overflowX: 'auto',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--hud-text-dim)', whiteSpace: 'nowrap' }}>
                PAYLOAD:
              </span>
              {WEAPON_DEFINITIONS.map((w) => {
                const isSelected = selectedWeapon === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWeapon(w.id)}
                    style={{
                      background: isSelected ? 'rgba(255, 51, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      border: isSelected ? '1px solid #ff4444' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#ff6666' : 'var(--hud-text-dim)',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{w.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};