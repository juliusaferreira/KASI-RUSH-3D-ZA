// Verify side-lane visibility on Android portrait: start a run, swipe to the
// left lane, screenshot, then right lane, screenshot.
export default async function run(page, ui) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4173/?lanes=' + Date.now(), { waitUntil: 'load' });
  await page.waitForSelector('canvas');
  await page.waitForTimeout(2000);
  await page.getByText('TAP TO RUN').click();
  await page.waitForTimeout(800);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1200);
  return 'in left lane';
}
