# Kasi Rush

A fast-paced endless runner set in South Africa's townships. Ride the rails
(or the neon streets), dodge traffic, grab coins and smash obstacles — all in
a comic low-poly art style.

## Routes

- **Soweto** — township rail yards with the Orlando Towers on the horizon,
  a temporary bonus side lane that appears now and then
- **Cape Town** — mountain-pass curves beneath Table Mountain
- **Neon City** — five-lane asphalt night run with school buses, traffic and
  glowing skyline

## Features

- 5-lane wide road mode on Neon City (3 lanes elsewhere)
- Occasional bonus lane with its own gold rails on Soweto
- Character powers: extra lives (Mr. Bones, Skullface), longer super-kicks and
  bonus weapon hits (Sting Ray)
- Weapons arsenal: baseball bat, crowbar, chainsaw and more, with smash counts
  and cooldowns
- Power-ups: jetpack skyway, magnet, super sneakers, 2x multiplier
- Fully playable on mobile (portrait), swipe gestures for movement

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open http://localhost:3000

## Production Build

```bash
npm run build
npm run preview   # serves the built game on port 4173
```

## Deploying

Any static host works (Vercel, Netlify, GitHub Pages via a workflow). Build
with `npm run build` and publish the `dist/` folder.
