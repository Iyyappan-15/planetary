import React from 'react';

interface LandingScreenProps {
  onEnter: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onEnter }) => {
  return (
    <div className="landing-overlay">
      <h1 className="landing-title">PLANETARY</h1>
      <p className="landing-tagline">How far can you push a world?</p>
      <button className="btn-enter-simulation" onClick={onEnter}>
        ENTER SIMULATION
      </button>
    </div>
  );
};
