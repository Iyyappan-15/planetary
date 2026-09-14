import React, { useState } from 'react';
import { PlanetConfig } from '../types/planet';
import { TargetInfo } from '../types/weapon';
import { X, Crosshair, MapPin, ZoomIn, ZoomOut, Compass, Satellite, Eye, Globe } from 'lucide-react';

interface SatelliteMapModalProps {
  planet: PlanetConfig;
  targetInfo: TargetInfo | null;
  onClose: () => void;
  onJumpToCoordinates: (lat: number, lon: number) => void;
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
  { name: 'Point Nemo', region: 'South Pacific', lat: -48.87, lon: -123.39, pop: '0 (Maritime)', desc: 'Oceanic Pole of Inaccessibility, furthest from any land' },
];

export const SatelliteMapModal: React.FC<SatelliteMapModalProps> = ({
  planet,
  targetInfo,
  onClose,
  onJumpToCoordinates,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);

  // Convert lat/lon to percentage coordinates on equirectangular 2:1 projection
  const getMapPercent = (lat: number, lon: number) => {
    // lon: -180..180 -> 0%..100%
    const x = ((lon + 180) / 360) * 100;
    // lat: 90..-90 -> 0%..100%
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  const handleLandmarkClick = (lm: Landmark) => {
    setSelectedLandmark(lm);
  };

  const handleDeployOrbit = (lat: number, lon: number) => {
    onJumpToCoordinates(lat, lon);
    onClose();
  };

  const isEarth = planet.id === 'earth';
  const targetPos = targetInfo ? getMapPercent(targetInfo.lat, targetInfo.lon) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card satellite-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <Satellite className="satellite-pulse-icon" size={20} />
            <span className="modal-title">ORBITAL SATELLITE RECONNAISSANCE: {planet.name.toUpperCase()}</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Satellite Map Container */}
        <div className="satellite-modal-content">
          <div className="satellite-viewport">
            {/* Control HUD Bar */}
            <div className="satellite-hud-overlay top-left">
              <div className="sat-hud-badge">
                <Compass size={14} />
                <span>GEOSPATIAL ORBITAL SCAN</span>
              </div>
              <div className="sat-hud-spec">
                PROJECTION: EQUIRECTANGULAR 2:1 WGS84
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
                }}
              >
                {/* Genuine NASA Satellite Surface Image */}
                <img
                  src={isEarth ? './earth_day.jpg' : undefined}
                  alt={`${planet.name} Satellite Surface`}
                  className="satellite-surface-img"
                  style={!isEarth ? { background: `radial-gradient(circle, ${planet.surface.primaryColor}, #050b14)` } : {}}
                />

                {/* Scanline Grid Overlay */}
                <div className="satellite-grid-overlay" />

                {/* Major Equator & Meridian Crosshairs */}
                <div className="sat-equator-line" />
                <div className="sat-prime-meridian" />

                {/* Target Telemetry Marker */}
                {targetPos && (
                  <div
                    className="sat-target-crosshair"
                    style={{ left: `${targetPos.x}%`, top: `${targetPos.y}%` }}
                    title={`Current Aim Point: Lat ${targetInfo?.lat.toFixed(1)}°, Lon ${targetInfo?.lon.toFixed(1)}°`}
                  >
                    <Crosshair size={28} className="sat-crosshair-reticle" />
                    <span className="sat-crosshair-tag">AIM TARGET</span>
                  </div>
                )}

                {/* Interactive Landmarks on Earth */}
                {isEarth &&
                  EARTH_LANDMARKS.map((lm) => {
                    const pos = getMapPercent(lm.lat, lm.lon);
                    const isSelected = selectedLandmark?.name === lm.name;

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

          {/* Bottom Satellite Intelligence Panel */}
          <div className="satellite-intel-panel">
            {selectedLandmark ? (
              <div className="intel-card">
                <div className="intel-info">
                  <div className="intel-title-row">
                    <span className="intel-name">{selectedLandmark.name}</span>
                    <span className="intel-region">{selectedLandmark.region}</span>
                  </div>
                  <div className="intel-stats-row">
                    <span><strong>Coordinates:</strong> {selectedLandmark.lat.toFixed(2)}° N, {selectedLandmark.lon.toFixed(2)}° E</span>
                    <span><strong>Est. Population:</strong> {selectedLandmark.pop}</span>
                  </div>
                  <p className="intel-desc">{selectedLandmark.desc}</p>
                </div>
                <div className="intel-action">
                  <button
                    className="hud-btn btn-cyan deploy-btn"
                    onClick={() => handleDeployOrbit(selectedLandmark.lat, selectedLandmark.lon)}
                  >
                    <Eye size={16} />
                    <span>Lock Orbit Over Target</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="intel-prompt">
                <Globe size={18} className="text-cyan" />
                <span>Select any strategic region or pin on the satellite map to inspect telemetry and lock orbit.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};