import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

export const OrientationPrompt: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isVertical = window.innerWidth < window.innerHeight;
      const isMobileSize = window.innerWidth <= 950;

      // Only prompt when in portrait on touch / mobile devices
      setIsPortrait(isVertical && (isTouch || isMobileSize));
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortrait || dismissed) return null;

  return (
    <div className="orientation-overlay">
      <div className="orientation-modal">
        <div className="orientation-icon-wrapper">
          <Smartphone size={54} className="phone-icon-animated" />
          <RotateCw size={26} className="rotate-icon-pulse" />
        </div>

        <div className="orientation-badge">ORBITAL COMMAND ADVISORY</div>
        <h2 className="orientation-title">PLEASE ROTATE DEVICE</h2>
        <p className="orientation-desc">
          For the full cinematic planetary destruction simulation and dual-thumb gamepad controls, please rotate your screen to <strong>Landscape</strong>.
        </p>

        <div className="orientation-tip">
          <span>💡 Tip: Ensure <strong>Auto-Rotate</strong> is unlocked in your phone settings.</span>
        </div>

        <button
          className="orientation-bypass-btn"
          onClick={() => setDismissed(true)}
        >
          Continue in Portrait Anyway
        </button>
      </div>
    </div>
  );
};
