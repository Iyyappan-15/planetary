import React from 'react';
import { PLANET_PRESETS } from '../data/planets';
import { X } from 'lucide-react';

interface PlanetSelectorProps {
  activePlanetId: string;
  onSelectPlanet: (id: string) => void;
  onClose: () => void;
}

export const PlanetSelector: React.FC<PlanetSelectorProps> = ({ activePlanetId, onSelectPlanet, onClose }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Select Celestial Target</div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="planet-grid">
            {PLANET_PRESETS.map((planet) => {
              const isActive = activePlanetId === planet.id;

              return (
                <div
                  key={planet.id}
                  className={`planet-card ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectPlanet(planet.id);
                    onClose();
                  }}
                >
                  <div className="planet-card-header">
                    <span className="planet-card-name">{planet.name}</span>
                    <span className="planet-card-tag">{planet.category.replace('_', ' ')}</span>
                  </div>
                  <div style={{ color: 'var(--hud-cyan)', fontSize: '11px', fontWeight: 600 }}>
                    {planet.tagline}
                  </div>
                  <p className="planet-card-desc">{planet.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
