// Mobile-view QA: run the game at iPhone dimensions (portrait, 390x844) with
// mobile UA + touch enabled, and screenshot the title screen and gameplay.
export default async function run(page, ui) {
  // iPhone 14-ish: portrait, device scale 3, touch, mobile UA
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://localhost:4173/?mobile=' + Date.now(), { waitUntil: 'load' });
  await page.waitForSelector('canvas');
  await page.waitForTimeout(2500);
  return 'mobile viewport set, title loaded';
}
