import { WeaponInfo } from '../types/game';

export const WEAPONS: WeaponInfo[] = [
  {
    id: 'small_hammer',
    name: 'Small Hammer',
    tagline: 'One solid whack',
    description: 'Smashes a single obstacle on contact, then needs 10 seconds to recharge. Cheap, honest street hardware — perfect for learning the swing.',
    uses: 1,
    cooldown: 10,
    rarity: 'COMMON',
    emoji: '🔨',
    color: '#f59e0b',
    swingSound: 'hammer',
    price: 300,
    unlocked: false,
  },
  {
    id: 'baseball_bat',
    name: 'Baseball Bat',
    tagline: 'Two strikes per swing cycle',
    description: 'Breaks through 2 obstacles before the 10 second cooldown. Classic township stickball — wide swing arc, satisfying crack.',
    uses: 2,
    cooldown: 10,
    rarity: 'COMMON',
    emoji: '🏏',
    color: '#d97706',
    swingSound: 'bat',
    price: 600,
    unlocked: false,
  },
  {
    id: 'crowbar',
    name: 'Crowbar',
    tagline: 'Three for one pull',
    description: 'Pries apart 3 obstacles per cycle with a 10 second cooldown. Scrapyard favourite — heavy steel, brutal leverage.',
    uses: 3,
    cooldown: 10,
    rarity: 'RARE',
    emoji: '🛠️',
    color: '#dc2626',
    swingSound: 'crowbar',
    price: 1200,
    unlocked: false,
  },
  {
    id: 'chainsaw',
    name: 'Chainsaw',
    tagline: 'Rip through four',
    description: 'Shreds 4 obstacles per cycle — the most destructive tool on the street. Needs a longer 15 second cooldown to refuel and restart the engine.',
    uses: 4,
    cooldown: 15,
    rarity: 'EPIC',
    emoji: '🪚',
    color: '#16a34a',
    swingSound: 'chainsaw',
    price: 2500,
    unlocked: false,
  },
];

/** The "no weapon" option: always unlocked, costs nothing. */
export const NO_WEAPON: WeaponInfo = {
  id: 'none',
  name: 'No Weapon',
  tagline: 'Run bare-knuckled',
  description: 'No tool, no problem — dodge and jump like the original streets intended. Unlocked from the start.',
  uses: 0,
  cooldown: 0,
  rarity: 'FREE',
  emoji: '🚫',
  color: '#64748b',
  swingSound: '',
  price: 0,
  unlocked: true,
};

export const ALL_WEAPON_OPTIONS = [NO_WEAPON, ...WEAPONS];

export function getWeaponById(id: string): WeaponInfo {
  return ALL_WEAPON_OPTIONS.find((w) => w.id === id) || NO_WEAPON;
}

/** Persistent unlocked-weapon ids stored in localStorage. */
export function getUnlockedWeapons(): string[] {
  try {
    const raw = localStorage.getItem('mzansi_unlocked_weapons');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// DEV TESTING FLAG: set to false before shipping to production.
// When true, all weapons are unlocked for development testing.
import { DEV_UNLOCK_ALL } from './constants';

export function isWeaponUnlocked(id: string): boolean {
  return DEV_UNLOCK_ALL || id === 'none' || getUnlockedWeapons().includes(id);
}

export function unlockWeapon(id: string): void {
  const list = getUnlockedWeapons();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem('mzansi_unlocked_weapons', JSON.stringify(list));
  }
}
