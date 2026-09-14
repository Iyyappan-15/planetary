import React from 'react';
import { GameSettings, QualityLevel } from '../types/game';
import { X, Volume2, VolumeX } from 'lucide-react';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdateSettings, onClose }) => {
  const updateGraphics = (partial: Partial<GameSettings['graphics']>) => {
    onUpdateSettings({
      ...settings,
      graphics: { ...settings.graphics, ...partial },
    });
  };

  const updateAudio = (partial: Partial<GameSettings['audio']>) => {
    onUpdateSettings({
      ...settings,
      audio: { ...settings.audio, ...partial },
    });
  };

  const setQuality = (q: QualityLevel) => {
    let pixelRatio = 1;
    let maxParticles = 600;

    switch (q) {
      case 'low':
        pixelRatio = 1;
        maxParticles = 300;
        break;
      case 'medium':
        pixelRatio = 1.25;
        maxParticles = 500;
        break;
      case 'high':
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        maxParticles = 800;
        break;
      case 'ultra':
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
        maxParticles = 1200;
        break;
    }

    updateGraphics({ quality: q, pixelRatio, maxParticles });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Simulation Settings</div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Graphics Settings */}
          <div className="settings-section">
            <div className="settings-section-title">Visual Quality</div>

            <div className="settings-row">
              <span className="settings-label">Graphics Preset</span>
              <div className="segmented-group">
                {(['low', 'medium', 'high', 'ultra'] as QualityLevel[]).map((q) => (
                  <button
                    key={q}
                    className={`segmented-btn ${settings.graphics.quality === q ? 'active' : ''}`}
                    onClick={() => setQuality(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <span className="settings-label">Atmosphere Shell</span>
              <button
                className={`toggle-btn ${settings.graphics.atmosphere ? 'active' : ''}`}
                onClick={() => updateGraphics({ atmosphere: !settings.graphics.atmosphere })}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            <div className="settings-row">
              <span className="settings-label">Dynamic Cloud Layer</span>
              <button
                className={`toggle-btn ${settings.graphics.clouds ? 'active' : ''}`}
                onClick={() => updateGraphics({ clouds: !settings.graphics.clouds })}
              >
                <div className="toggle-knob" />
              </button>
            </div>

            <div className="settings-row">
              <span className="settings-label">Camera Screen Shake</span>
              <button
                className={`toggle-btn ${settings.graphics.screenShake ? 'active' : ''}`}
                onClick={() => updateGraphics({ screenShake: !settings.graphics.screenShake })}
              >
                <div className="toggle-knob" />
              </button>
            </div>
          </div>

          {/* Audio Settings */}
          <div className="settings-section">
            <div className="settings-section-title">Audio Synthesizer</div>

            <div className="settings-row">
              <span className="settings-label">Mute All Audio</span>
              <button
                className="hud-btn"
                style={{ padding: '4px 10px' }}
                onClick={() => updateAudio({ muted: !settings.audio.muted })}
              >
                {settings.audio.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                <span>{settings.audio.muted ? 'Muted' : 'Enabled'}</span>
              </button>
            </div>

            <div className="settings-row">
              <span className="settings-label">Master Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.audio.masterVolume}
                className="slider-input"
                onChange={(e) => updateAudio({ masterVolume: parseFloat(e.target.value) })}
              />
            </div>

            <div className="settings-row">
              <span className="settings-label">Impact Effects</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.audio.effectsVolume}
                className="slider-input"
                onChange={(e) => updateAudio({ effectsVolume: parseFloat(e.target.value) })}
              />
            </div>

            <div className="settings-row">
              <span className="settings-label">Space Ambience</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.audio.ambienceVolume}
                className="slider-input"
                onChange={(e) => updateAudio({ ambienceVolume: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          {/* Gameplay Settings */}
          <div className="settings-section">
            <div className="settings-section-title">Controls</div>
            <div className="settings-row">
              <span className="settings-label">Camera Sensitivity</span>
              <input
                type="range"
                min="0.4"
                max="2.5"
                step="0.1"
                value={settings.cameraSensitivity}
                className="slider-input"
                onChange={(e) => onUpdateSettings({ ...settings, cameraSensitivity: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
