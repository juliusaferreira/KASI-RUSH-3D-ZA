// Mobile in-run HUD check: 390x844 portrait, start a run, screenshot the HUD.
export default async function run(page, ui) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4173/?hud=' + Date.now(), { waitUntil: 'load' });
  await page.waitForSelector('canvas');
  await page.waitForTimeout(2000);
  await page.getByText('TAP TO RUN').click();
  await page.waitForTimeout(900);
  return 'in-run captured';
}
