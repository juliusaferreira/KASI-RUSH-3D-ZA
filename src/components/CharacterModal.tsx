import { useState } from 'react';
import type { ReactElement } from 'react';
import { CHARACTERS, isCharacterUnlocked, unlockCharacter } from '../game/constants';
import { CharacterInfo } from '../types/game';
import { CharacterPreview } from './CharacterPreview';
import { User, Check, X, Lock, Coins, Heart, Zap, Sword } from 'lucide-react';

/** Character powers as compact badges — shown whether locked or unlocked. */
const CharacterPowers: React.FC<{ char: CharacterInfo; compact?: boolean }> = ({ char, compact }) => {
  const badges: { icon: ReactElement; label: string; color: string }[] = [];
  if ((char.extraLives ?? 0) > 0) {
    badges.push({
      icon: <Heart className="w-3 h-3" />,
      label: `+${char.extraLives} ${char.extraLives === 1 ? 'life' : 'lives'}`,
      color: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
    });
  }
  if ((char.sneakerDurationMult ?? 1) > 1) {
    badges.push({
      icon: <Zap className="w-3 h-3" />,
      label: `+${Math.round(((char.sneakerDurationMult ?? 1) - 1) * 100)}% kicks`,
      color: 'bg-lime-500/15 text-lime-300 border-lime-400/40',
    });
  }
  if ((char.weaponExtraUses ?? 0) > 0) {
    badges.push({
      icon: <Sword className="w-3 h-3" />,
      label: `+${char.weaponExtraUses} weapon hit`,
      color: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40',
    });
  }
  if (badges.length === 0) {
    return compact ? (
      <div className="text-[9px] text-slate-400">No powers</div>
    ) : (
      <div className="text-[11px] text-slate-400">Balanced baseline — no special powers.</div>
    );
  }
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1 justify-center' : 'gap-1.5'}`}>
      {badges.map((b, i) => (
        <span key={i} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black tracking-wide ${b.color}`}>
          {b.icon}
          {b.label}
        </span>
      ))
      }
    </div>
  );
};

interface CharacterModalProps {
  totalCoins: number;
  currentCharacter: string;
  onSelectCharacter: (char: CharacterInfo) => void;
  onCoinsSpent: (amount: number) => void;
  onClose: () => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  totalCoins,
  currentCharacter,
  onSelectCharacter,
  onCoinsSpent,
  onClose,
}) => {
  const [previewChar, setPreviewChar] = useState<CharacterInfo>(
    () => CHARACTERS.find((c) => c.id === currentCharacter) || CHARACTERS[0]
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full font-arcade text-xs sm:text-sm bg-amber-500 text-slate-950 font-black shadow-md">
              <User className="w-4 h-4" />
              <span>SURFERS</span>
            </div>
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

        {/* Surfers */}
        <div className="flex flex-col gap-4">
            {/* Live 3D Character Preview (drag to rotate) */}
            <CharacterPreview character={previewChar} />

            {/* Powers of the character being previewed — shown for locked ones
                too so the player knows what they're buying */}
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-3.5">
              <div className="font-arcade text-base text-white mb-1">{previewChar.name}</div>
              <div className="text-[11px] font-semibold text-amber-300 mb-2">{previewChar.nickname}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black mb-1.5">Powers</div>
              <CharacterPowers char={previewChar} />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {CHARACTERS.map((char) => {
                const unlocked = isCharacterUnlocked(char.id);
                const isSelected = char.id === currentCharacter;
                return (
                  <button
                    key={char.id}
                    onClick={() => {
                      setPreviewChar(char);
                      if (unlocked) onSelectCharacter(char);
                    }}
                    className={`flex flex-col items-center p-4 rounded-2xl border-2 text-center transition-all active:scale-95 relative ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 shadow-lg'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}

                    {/* Character Avatar Icon (locked = silhouette) */}
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 border-2 shadow-inner overflow-hidden text-3xl ${unlocked ? '' : 'grayscale opacity-50'}`}
                      style={{ backgroundColor: char.outfitColor, borderColor: char.accentColor }}
                    >
                      {unlocked ? (
                        char.avatarImage ? (
                          <img src={char.avatarImage} alt={char.name} className="w-full h-full object-cover object-top scale-110" />
                        ) : (
                          <span>{char.avatarEmoji || '🏃'}</span>
                        )
                      ) : (
                        <Lock className="w-6 h-6 text-slate-600" />
                      )}
                    </div>

                    <div className="font-arcade text-base text-white stroke-arcade-sm">
                      {unlocked ? char.name : '???'}
                    </div>
                    <div className="text-[11px] font-semibold text-amber-300 mb-1">
                      {unlocked ? char.nickname : 'LOCKED'}
                    </div>
                    <div className="text-[10px] text-slate-300 font-medium px-2 py-0.5 rounded bg-slate-950/40 line-clamp-2">
                      {unlocked ? char.comicTagline : `Unlock with ${char.cost} coins`}
                    </div>
                    {/* Powers — visible even when locked, so the player can
                        decide which character is worth their coins */}
                    <CharacterPowers char={char} compact />
                    {!unlocked && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (totalCoins >= char.cost) {
                            unlockCharacter(char.id);
                            onCoinsSpent(char.cost);
                          }
                        }}
                        className={`mt-1.5 flex items-center justify-center gap-1.5 w-full px-2 py-1.5 rounded-xl font-arcade text-[11px] transition ${
                          totalCoins >= char.cost
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        {char.cost}
                        {totalCoins < char.cost && <span className="text-[9px]">(need {char.cost - totalCoins})</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
        </div>

        <div className="text-center text-xs text-slate-400 border-t border-slate-800 pt-3 flex justify-between items-center">
          <span>Tap to equip your runner</span>
          <span className="text-amber-400 font-bold">Total Coins: {totalCoins}</span>
        </div>
      </div>
    </div>
  );
};
