import React from 'react';

export const ControlsHelp: React.FC = () => {
  return (
    <div className="hud-bottom">
      <div className="control-item">
        <span className="control-key">Drag</span>
        <span>Rotate</span>
      </div>
      <div className="control-item">
        <span className="control-key">Scroll</span>
        <span>Zoom</span>
      </div>
      <div className="control-item">
        <span className="control-key">L-Click</span>
        <span>Fire</span>
      </div>
      <div className="control-item">
        <span className="control-key">Space</span>
        <span>Pause Spin</span>
      </div>
      <div className="control-item">
        <span className="control-key">M</span>
        <span>Satellite Map</span>
      </div>
      <div className="control-item">
        <span className="control-key">R</span>
        <span>Reset</span>
      </div>
      <div className="control-item">
        <span className="control-key">F</span>
        <span>Fullscreen</span>
      </div>
      <div className="control-item">
        <span className="control-key">1-9</span>
        <span>Arsenal</span>
      </div>
    </div>
  );
};
