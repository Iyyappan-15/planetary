import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from './game/Game';
import { HUD } from './ui/HUD';
import { PlanetSelector } from './ui/PlanetSelector';
import { SettingsModal } from './ui/SettingsModal';
import { LandingScreen } from './ui/LandingScreen';
import { PLANET_PRESETS } from './data/planets';
import { WEAPON_DEFINITIONS } from './data/weapons';
import { PlanetConfig } from './types/planet';
import { WeaponId, TargetInfo } from './types/weapon';
import { PlanetIntegrity, GameSettings } from './types/game';
import { loadStoredSettings, saveStoredSettings } from './utils/storage';
import './styles/hud.css';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [settings, setSettings] = useState<GameSettings>(loadStoredSettings());
  const [activePlanet, setActivePlanet] = useState<PlanetConfig>(PLANET_PRESETS[0]);
  const [activeWeaponId, setActiveWeaponId] = useState<WeaponId>('meteor');
  const [integrity, setIntegrity] = useState<PlanetIntegrity>({
    currentHp: 100,
    maxHp: 100,
    percentage: 100,
    isBroken: false,
    impactCount: 0,
  });
  const [targetInfo, setTargetInfo] = useState<TargetInfo | null>(null);

  // Modals
  const [isPlanetSelectorOpen, setIsPlanetSelectorOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Initialize Game on Mount
  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new Game(canvasRef.current, settings, {
      onIntegrityChange: (integ) => setIntegrity(integ),
      onTargetChange: (target) => setTargetInfo(target),
      onActiveWeaponChange: (wId) => setActiveWeaponId(wId),
    });

    gameRef.current = game;
    game.start();

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const handleSelectWeapon = useCallback((id: WeaponId) => {
    setActiveWeaponId(id);
    gameRef.current?.setWeapon(id);
  }, []);

  const handleSelectPlanet = useCallback((id: string) => {
    const config = PLANET_PRESETS.find((p) => p.id === id);
    if (config) {
      setActivePlanet(config);
      gameRef.current?.setPlanet(id);
    }
  }, []);

  const handleResetPlanet = useCallback(() => {
    gameRef.current?.resetPlanet();
  }, []);

  const handleUpdateSettings = useCallback((newSettings: GameSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
    gameRef.current?.updateSettings(newSettings);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleEnterSimulation = useCallback(() => {
    setHasStarted(true);
    gameRef.current?.audioManager.unlock();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        handleResetPlanet();
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFullscreen();
      } else if (e.key === 'Escape') {
        setIsPlanetSelectorOpen(false);
        setIsSettingsOpen(false);
      } else if (e.key >= '1' && e.key <= '9') {
        const weaponIndex = parseInt(e.key, 10) - 1;
        if (weaponIndex < WEAPON_DEFINITIONS.length) {
          handleSelectWeapon(WEAPON_DEFINITIONS[weaponIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetPlanet, handleToggleFullscreen, handleSelectWeapon]);

  return (
    <div className="planetary-container">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="webgl-canvas" />

      {/* Entry Landing Screen */}
      {!hasStarted && <LandingScreen onEnter={handleEnterSimulation} />}

      {/* Main HUD */}
      {hasStarted && (
        <HUD
          planet={activePlanet}
          integrity={integrity}
          targetInfo={targetInfo}
          activeWeaponId={activeWeaponId}
          onSelectWeapon={handleSelectWeapon}
          onOpenPlanetSelector={() => setIsPlanetSelectorOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onReset={handleResetPlanet}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* Planet Selector Modal */}
      {isPlanetSelectorOpen && (
        <PlanetSelector
          activePlanetId={activePlanet.id}
          onSelectPlanet={handleSelectPlanet}
          onClose={() => setIsPlanetSelectorOpen(false)}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
