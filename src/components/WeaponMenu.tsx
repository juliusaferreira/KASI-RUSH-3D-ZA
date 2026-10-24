import React, { useState } from 'react';
import { ALL_WEAPON_OPTIONS, isWeaponUnlocked, unlockWeapon } from '../game/weaponData';
import { WeaponInfo } from '../types/game';
import { WeaponPreview } from './WeaponPreview';
import { X, Check, Swords, Zap, Timer, Repeat2, Lock, Coins } from 'lucide-react';

interface WeaponMenuProps {
  currentWeapon: string;
  totalCoins: number;
  onSelectWeapon: (weapon: WeaponInfo) => void;
  onCoinsSpent: (amount: number) => void;
  onClose: () => void;
}

const RARITY_STYLES: Record<string, string> = {
  FREE: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  COMMON: 'bg-slate-500/20 text-slate-300 border-slate-400/40',
  RARE: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
  EPIC: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
};

/** Chainsaw icon (matches the in-game model: red body, dark guide bar, chain teeth). */
const ChainsawIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* rear pull handle ring */}
    <circle cx="7.5" cy="12" r="3" stroke="#1e2126" strokeWidth="1.6" />
    {/* top handle bar */}
    <rect x="7" y="6.5" width="12" height="2.4" rx="1.2" fill="#1e2126" />
    {/* red engine body */}
    <rect x="8" y="8" width="14" height="9" rx="2" fill="#e23b32" />
    <rect x="8" y="8" width="14" height="3" rx="1.5" fill="#b72a24" />
    {/* clutch cover */}
    <circle cx="13" cy="14" r="2.4" fill="#1e2126" />
    <circle cx="13" cy="14" r="1.1" fill="#3a3f47" />
    {/* pale guide bar */}
    <rect x="21" y="11.4" width="9" height="2.6" rx="1" fill="#c9ced4" />
    {/* dark chain with teeth */}
    <rect x="21" y="11" width="9.6" height="1" fill="#2b2f36" />
    <rect x="21" y="13.4" width="9.6" height="1" fill="#2b2f36" />
    {[21.5, 23, 24.5, 26, 27.5, 29].map((tx) => (
      <rect key={tx} x={tx} y="10.2" width="0.8" height="1" fill="#565c66" />
    ))}
  </svg>
);

export const WeaponMenu: React.FC<WeaponMenuProps> = ({ currentWeapon, totalCoins, onSelectWeapon, onCoinsSpent, onClose }) => {
  const [, forceTick] = useState(0);
  const [selected, setSelected] = useState<WeaponInfo>(
    () => ALL_WEAPON_OPTIONS.find((w) => w.id === currentWeapon) || ALL_WEAPON_OPTIONS[0]
  );

  const selectedUnlocked = isWeaponUnlocked(selected.id);

  const handleEquip = (w: WeaponInfo) => {
    if (!isWeaponUnlocked(w.id)) return;
    onSelectWeapon(w);
  };

  const handleBuy = (w: WeaponInfo) => {
    if (isWeaponUnlocked(w.id) || totalCoins < w.price) return;
    unlockWeapon(w.id);
    onCoinsSpent(w.price);
    forceTick((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-rose-400" />
            <span className="font-arcade text-sm sm:text-base text-rose-300 stroke-arcade-sm">ARSENAL</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="font-arcade text-sm text-amber-300">{totalCoins}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D Preview */}
        <WeaponPreview weapon={selected} dimmed={!selectedUnlocked} />

        {/* Stats panel */}
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-arcade text-base text-white flex items-center gap-2">
              {!selectedUnlocked && <Lock className="w-4 h-4 text-slate-400" />}
              {selectedUnlocked ? selected.name : '???'}
            </div>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black tracking-wider ${RARITY_STYLES[selected.rarity]}`}>
              {selected.rarity}
            </span>
          </div>
          <div className="text-[11px] font-semibold" style={{ color: selected.color }}>{selected.tagline}</div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{selected.description}</p>

          {/* Stats are shown even when locked, so the player can weigh the
              purchase. The buy button itself stays gated below. */}
          {
            <>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2 flex flex-col items-center gap-0.5">
                  <Repeat2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-arcade text-sm text-white">{selected.uses}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Smashes</span>
                </div>
                <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2 flex flex-col items-center gap-0.5">
                  <Timer className="w-4 h-4 text-amber-400" />
                  <span className="font-arcade text-sm text-white">{selected.cooldown}s</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Cooldown</span>
                </div>
                <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2 flex flex-col items-center gap-0.5">
                  <Zap className="w-4 h-4 text-rose-400" />
                  <span className="font-arcade text-[11px] text-white mt-0.5">NO</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Train Damage</span>
                </div>
              </div>
            </>
          }

          {selectedUnlocked ? (
            <>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2 flex flex-col items-center gap-0.5">
                  <Repeat2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-arcade text-sm text-white">{selected.uses}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Smashes</span>
                </div>
                <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2 flex flex-col items-center gap-0.5">
                  <Timer className="w-4 h-4 text-amber-400" />
                  <span className="font-arcade text-sm text-white">{selected.cooldown}s</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Cooldown</span>
                </div>
                <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-2 flex flex-col items-center gap-0.5">
                  <Zap className="w-4 h-4 text-rose-400" />
                  <span className="font-arcade text-[11px] text-white mt-0.5">NO</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Train Damage</span>
                </div>
              </div>
              {selected.id !== currentWeapon && (
                <button
                  onClick={() => handleEquip(selected)}
                  className="mt-1 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-arcade text-sm font-black transition active:scale-95"
                >
                  EQUIP
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => handleBuy(selected)}
              disabled={totalCoins < selected.price}
              className={`mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-arcade text-sm transition active:scale-95 ${
                totalCoins >= selected.price
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Coins className="w-4 h-4" />
              {selected.price === 0 ? 'FREE' : `UNLOCK — ${selected.price}`}
              {totalCoins < selected.price && <span className="text-[10px]">(need {selected.price - totalCoins} more)</span>}
            </button>
          )}
        </div>

        {/* Weapon cards */}
        <div className="grid grid-cols-2 gap-3">
          {ALL_WEAPON_OPTIONS.map((w) => {
            const unlocked = isWeaponUnlocked(w.id);
            const isSelected = w.id === currentWeapon;
            const isViewing = w.id === selected.id;
            return (
              <button
                key={w.id}
                onClick={() => setSelected(w)}
                className={`flex flex-col items-center p-3.5 rounded-2xl border-2 text-center transition-all active:scale-95 relative ${
                  isViewing
                    ? 'bg-slate-700/70 border-rose-400/70'
                    : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700'
                }`}
              >
                {isSelected && unlocked && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-400 text-slate-950 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
                {unlocked ? (
                  w.id === 'chainsaw' ? (
                    <ChainsawIcon className="w-9 h-9 mb-1" />
                  ) : (
                    <span className="text-3xl mb-1">{w.emoji}</span>
                  )
                ) : (
                  <span className="w-8 h-10 mb-1 flex items-center justify-center rounded-lg bg-slate-950/60 border border-slate-600">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </span>
                )}
                <div className={`font-arcade text-sm ${unlocked ? 'text-white' : 'text-slate-400'}`}>{w.name}</div>
                {unlocked ? (
                  <div className="text-[10px] font-bold mt-0.5" style={{ color: w.color }}>
                    {w.uses > 0 ? `${w.uses}× smash · ${w.cooldown}s` : 'run clean'}
                  </div>
                ) : (
                  <div className="text-[10px] font-bold mt-0.5 text-amber-300 flex items-center gap-1">
                    <Coins className="w-3 h-3" /> {w.price}
                    <span className="text-slate-400">· {w.uses > 0 ? `${w.uses}×` : '∞'}</span>
                  </div>
                )}
                <span className={`mt-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black tracking-wider ${RARITY_STYLES[w.rarity]}`}>
                  {w.rarity}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-center text-xs text-slate-400 border-t border-slate-800 pt-3">
          Tap to inspect · Unlock with Rand coins · Equip your tools
        </div>
      </div>
    </div>
  );
};
