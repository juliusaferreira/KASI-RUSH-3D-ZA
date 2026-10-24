/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameEngine } from './game/GameEngine';
import { SouthAfricanCity, RunStats, PowerupState, CharacterInfo, CharacterId, HoverboardInfo, GameStatus, WeaponId, WeaponInfo } from './types/game';
import { CHARACTERS, HOVERBOARDS, isCharacterUnlocked } from './game/constants';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { OnScreenControls } from './components/OnScreenControls';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';
import { CitySelectorModal } from './components/CitySelectorModal';
import { CharacterModal } from './components/CharacterModal';
import { WeaponMenu } from './components/WeaponMenu';
import { getUnlockedWeapons } from './game/weaponData';
import { sound } from './audio/soundManager';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Game UI State Machine
  const [gameState, setGameState] = useState<GameStatus>('title');
  const [city, setCity] = useState<SouthAfricanCity>('soweto');
  const [character, setCharacter] = useState<string>('kasikid');
  const [hoverboard, setHoverboard] = useState<string>('mzansi_rainbow');
  const [weapon, setWeapon] = useState<string>('none');
  const [showWeaponMenu, setShowWeaponMenu] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Modals
  const [showCityModal, setShowCityModal] = useState<boolean>(false);
  const [showCharModal, setShowCharModal] = useState<boolean>(false);

  // Run Stats
  const [stats, setStats] = useState<RunStats>({
    score: 0,
    coins: 0,
    distance: 0,
    multiplier: 10,
    highScore: parseInt(localStorage.getItem('mzansi_high_score') || '0', 10),
    totalCoins: parseInt(localStorage.getItem('mzansi_total_coins') || '0', 10),
  });

  // Powerups State
  const [powerups, setPowerups] = useState<PowerupState>({
    sneakers: 0,
    magnet: 0,
    jetpack: 0,
    multiplier: 0,
  });
  const [hasHoverboard, setHasHoverboard] = useState<boolean>(false);
  const [hoverboardTimer, setHoverboardTimer] = useState<number>(0);
  const [weaponState, setWeaponState] = useState({ usesLeft: 2, usesMax: 2, cooldownLeft: 0, drawn: false });

  // Sync state to body dataset
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Handle Score and Powerup Updates from Engine
  const handleScoreUpdate = useCallback((newStats: RunStats) => {
    setStats(newStats);
  }, []);

  const handlePowerupUpdate = useCallback((newPowerups: PowerupState, boardActive: boolean, boardTime: number) => {
    setPowerups(newPowerups);
    setHasHoverboard(boardActive);
    setHoverboardTimer(boardTime);
    const ws = engineRef.current?.getWeaponState();
    if (ws) setWeaponState({ usesLeft: ws.usesLeft, usesMax: ws.usesMax, cooldownLeft: ws.cooldownLeft, drawn: ws.drawn });
  }, []);

  const handleGameOver = useCallback((finalStats: RunStats) => {
    setStats(finalStats);
    setGameState('gameover');
  }, []);

  // Initialize GameEngine once
  useEffect(() => {
    if (!mountRef.current) return;

    // Defend against double-mount (React strict/HMR remounts): a stale engine
    // leaves its full-screen canvas in the container and it stacks invisibly
    // ON TOP of the live one — the old scene then shadows all visual updates.
    // Remove any leftover canvases before creating the fresh engine.
    mountRef.current.querySelectorAll('canvas').forEach((c) => c.remove());

    const engine = new GameEngine(mountRef.current, city, {
      onScoreUpdate: handleScoreUpdate,
      onPowerupUpdate: handlePowerupUpdate,
      onGameOver: handleGameOver,
    });
    engineRef.current = engine;

    const savedChar = localStorage.getItem('mzansi_character');
    // Only restore a saved character if it is currently unlocked (default: Kasi Kid)
    const initialChar: CharacterId = (savedChar && isCharacterUnlocked(savedChar)
      ? savedChar
      : 'kasikid') as CharacterId;
    const charInfo = CHARACTERS.find((c) => c.id === initialChar);
    engine.setCharacter(initialChar, charInfo?.outfitColor);

    const initialBoard = localStorage.getItem('mzansi_hoverboard') || 'kasi_cruiser';
    engine.setHoverboard(initialBoard);

    const initialWeapon = (localStorage.getItem('mzansi_weapon') || 'none') as WeaponId;
    // Guard against a stored weapon that is no longer unlocked (e.g. cleared save)
    const weaponOk = initialWeapon === 'none' || getUnlockedWeapons().includes(initialWeapon);
    engine.setWeapon(weaponOk ? initialWeapon : 'none');

    // Check autostart query parameter (Ultra Mode requirement)
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setGameState('playing');
      engine.start();
    } else {
      engine.renderTitleFrame();
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []); // Run once on mount

  // Update city if changed
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCity(city);
    }
  }, [city]);

  // Handle Start Run
  const handleStartRun = useCallback(() => {
    setGameState('playing');
    if (engineRef.current) {
      engineRef.current.start();
    }
  }, []);

  // Handle Pause
  const handlePause = useCallback(() => {
    setGameState('paused');
    if (engineRef.current) {
      engineRef.current.pause();
    }
  }, []);

  // Handle Resume
  const handleResume = useCallback(() => {
    setGameState('playing');
    if (engineRef.current) {
      engineRef.current.resume();
    }
  }, []);

  // Handle Restart
  const handleRestart = useCallback(() => {
    setGameState('playing');
    if (engineRef.current) {
      engineRef.current.start();
    }
  }, []);

  // Handle Return to Main Menu
  const handleReturnToMainMenu = useCallback(() => {
    setGameState('title');
    if (engineRef.current) {
      engineRef.current.returnToMainMenu();
    }
  }, []);

  // Keyboard Handlers for global shortcuts (Space/Enter to start, Esc/P to pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartRun();
        }
      } else if (gameState === 'playing') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          handlePause();
        }
      } else if (gameState === 'paused') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          handleResume();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleStartRun, handlePause, handleResume]);

  const handleToggleMute = useCallback(() => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleSelectCharacter = useCallback((char: CharacterInfo) => {
    setCharacter(char.id);
    localStorage.setItem('mzansi_character', char.id);
    if (engineRef.current) {
      engineRef.current.setCharacter(char.id as any, char.outfitColor);
    }
  }, []);

  const handleImportCustomModel = useCallback(
    (gltfScene: THREE.Group, animations: THREE.AnimationClip[], name: string) => {
      setCharacter('custom' as any);
      if (engineRef.current) {
        engineRef.current.setCustomGltfModel(gltfScene, animations, name);
      }
    },
    []
  );

  const handleSelectHoverboard = useCallback((board: HoverboardInfo) => {
    setHoverboard(board.id);
    localStorage.setItem('mzansi_hoverboard', board.id);
    if (engineRef.current) {
      engineRef.current.setHoverboard(board.id);
    }
  }, []);

  const handleSelectWeapon = useCallback((w: WeaponInfo) => {
    setWeapon(w.id);
    localStorage.setItem('mzansi_weapon', w.id);
    engineRef.current?.setWeapon(w.id);
  }, []);

  /** Deduct spent coins from the persistent bank (weapon/character unlocks). */
  const handleCoinsSpent = useCallback((amount: number) => {
    setStats((prev) => {
      const newTotal = Math.max(0, prev.totalCoins - amount);
      localStorage.setItem('mzansi_total_coins', newTotal.toString());
      return { ...prev, totalCoins: newTotal };
    });
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          city={city}
          highScore={stats.highScore}
          totalCoins={stats.totalCoins}
          isMuted={isMuted}
          onStart={handleStartRun}
          onOpenCitySelector={() => setShowCityModal(true)}
          onOpenCharacterModal={() => setShowCharModal(true)}
          onOpenWeaponMenu={() => setShowWeaponMenu(true)}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Live In-Game HUD */}
      {gameState === 'playing' && (
        <>
          <GameHUD
            stats={stats}
            powerups={powerups}
            city={city}
            isMuted={isMuted}
            weaponId={weapon}
            weaponUsesLeft={weaponState.usesLeft}
            weaponUsesMax={weaponState.usesMax}
            weaponCooldownLeft={weaponState.cooldownLeft}
            weaponDrawn={weaponState.drawn}
            onToggleMute={handleToggleMute}
            onPause={handlePause}
            onUseWeapon={() => engineRef.current?.useWeapon()}
          />
          {/* Mobile is swipe-driven (touch gestures handled by the engine) —
              the on-screen arrow buttons are desktop vestiges and are disabled. */}
          {/* <OnScreenControls
            onLeft={() => engineRef.current?.moveLane(-1)}
            onRight={() => engineRef.current?.moveLane(1)}
            onJump={() => engineRef.current?.jump()}
            onSlide={() => engineRef.current?.roll()}
          /> */}
        </>
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          city={city}
          currentCharacter={character}
          isMuted={isMuted}
          onResume={handleResume}
          onRestart={handleRestart}
          onMainMenu={handleReturnToMainMenu}
          onChangeCharacter={() => setShowCharModal(true)}
          onChangeCity={() => setShowCityModal(true)}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Game Over Modal */}
      {gameState === 'gameover' && (
        <GameOverModal
          stats={stats}
          city={city}
          onPlayAgain={handleStartRun}
          onMainMenu={handleReturnToMainMenu}
          onChangeCharacter={() => setShowCharModal(true)}
          onChangeCity={() => setShowCityModal(true)}
        />
      )}

      {/* South Africa City Selector Modal */}
      {showCityModal && (
        <CitySelectorModal
          currentCity={city}
          onSelectCity={(newCity) => setCity(newCity)}
          onClose={() => setShowCityModal(false)}
        />
      )}

      {/* Character Customization Modal */}
      {showCharModal && (
        <CharacterModal
          totalCoins={stats.totalCoins}
          currentCharacter={character}
          onSelectCharacter={handleSelectCharacter}
          onCoinsSpent={handleCoinsSpent}
          onClose={() => setShowCharModal(false)}
        />
      )}

      {/* Weapon Arsenal Modal */}
      {showWeaponMenu && (
        <WeaponMenu
          currentWeapon={weapon}
          totalCoins={stats.totalCoins}
          onSelectWeapon={handleSelectWeapon}
          onCoinsSpent={handleCoinsSpent}
          onClose={() => setShowWeaponMenu(false)}
        />
      )}
    </div>
  );
}
