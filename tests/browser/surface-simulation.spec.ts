import { expect, test } from '@playwright/test';

async function launchToOverview(page: import('@playwright/test').Page) {
  await page.goto('/');
  const launchBtn = page.locator('.preloader-launch-btn');
  await expect(launchBtn).toBeEnabled({ timeout: 45000 });
  await launchBtn.click();
  await expect(page.locator('.hud-top-bar')).toBeVisible({ timeout: 40000 });
}

async function selectLeftDockButton(
  page: import('@playwright/test').Page,
  namePattern: RegExp,
) {
  const btn = page.locator('.hud-left-dock').getByRole('button', { name: namePattern });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}

async function ensureRightDrawerOpen(page: import('@playwright/test').Page) {
  const toggle = page.getByTestId('subscene-drawer-toggle');
  await expect(toggle).toBeVisible({ timeout: 30000 });
  const text = await toggle.textContent();
  if (text && /Mở/i.test(text)) {
    await toggle.click();
  }
  await expect(page.getByTestId('view-mode-pov')).toBeVisible({ timeout: 15000 });
}

async function collapseRightDrawerOnMobile(page: import('@playwright/test').Page) {
  const toggle = page.getByTestId('subscene-drawer-toggle');
  if (await toggle.isVisible()) {
    const text = await toggle.textContent();
    if (text && /Thu gọn/i.test(text)) {
      await toggle.click();
    }
  }
}

function parseOdometerM(text: string | null): number {
  if (!text) return 0;
  const kmMatch = /([\d.]+)\s*km/i.exec(text);
  if (kmMatch) return Number.parseFloat(kmMatch[1]) * 1000;
  const mMatch = /([\d.]+)\s*m\b/i.exec(text);
  return mMatch ? Number.parseFloat(mMatch[1]) : 0;
}

test('Desktop Mars rovers retain gravity, drive & steer without levitating or HUD clipping', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await launchToOverview(page);

  // Curiosity Option 1 -> Option 2 POV and idle gravity check (regression for Mars levitation/tip-over)
  await selectLeftDockButton(page, /Curiosity/i);
  await ensureRightDrawerOpen(page);
  await page.getByTestId('view-mode-pov').click();

  await expect(page.getByTestId('control-room-hud')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('pov-speed-readout')).toBeVisible();
  await expect(page.getByTestId('pov-minimap')).toBeVisible();

  await page.waitForTimeout(2500);
  await expect(page.getByTestId('pov-stability-warning')).toHaveCount(0);
  await expect(page.getByTestId('pov-wheel-contact-readout')).toContainText(/Bánh tiếp đất:\s*[456]\/6/i);

  // Confirm telemetry readout clears top navigation bar without hiding underneath it
  const topBarBox = await page.locator('.hud-top-bar').boundingBox();
  const speedBox = await page.getByTestId('pov-speed-readout').boundingBox();
  expect(topBarBox).not.toBeNull();
  expect(speedBox).not.toBeNull();
  if (topBarBox && speedBox) {
    expect(speedBox.y).toBeGreaterThanOrEqual(topBarBox.y + topBarBox.height - 2);
  }

  // Drive Curiosity forward + steer, brake, toggle camera mount & recover
  const beforeOdo = parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent());
  await page.keyboard.down('w');
  await expect
    .poll(async () => parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent()), {
      timeout: 12000,
    })
    .toBeGreaterThan(beforeOdo + 0.5);
  await page.keyboard.down('a');
  await page.waitForTimeout(600);
  await page.keyboard.up('a');
  await page.keyboard.up('w');
  await page.keyboard.press('Space');

  const camMountBtn = page.getByTestId('pov-camera-mount-btn');
  const mountBefore = await camMountBtn.textContent();
  await camMountBtn.click();
  const mountAfter = await camMountBtn.textContent();
  expect(mountAfter).not.toBe(mountBefore);
  await page.getByTestId('pov-recover-btn').click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('pov-stability-warning')).toHaveCount(0);

  // Switch to Perseverance and verify Mars gravity holds cleanly too
  await selectLeftDockButton(page, /Perseverance/i);
  await ensureRightDrawerOpen(page);
  await page.getByTestId('view-mode-pov').click();
  await expect(page.getByTestId('control-room-hud')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1800);
  await expect(page.getByTestId('pov-stability-warning')).toHaveCount(0);
  await expect(page.getByTestId('pov-wheel-contact-readout')).toContainText(/Bánh tiếp đất:\s*[456]\/6/i);

  expect(pageErrors).toEqual([]);
});

test('Desktop Ingenuity helicopter takeoff & Viking stationary vs simulated mobility toggle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await launchToOverview(page);

  // Ingenuity coaxial flight takeoff
  await selectLeftDockButton(page, /Ingenuity/i);
  await ensureRightDrawerOpen(page);
  await page.getByTestId('view-mode-pov').click();
  await expect(page.getByTestId('pov-btn-ascend')).toBeVisible({ timeout: 30000 });
  const ascendBox = await page.getByTestId('pov-btn-ascend').boundingBox();
  expect(ascendBox).not.toBeNull();
  if (ascendBox) {
    await page.mouse.move(ascendBox.x + ascendBox.width / 2, ascendBox.y + ascendBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
  }
  await expect(page.getByTestId('pov-stability-warning')).toHaveCount(0);

  // Viking stationary lander: stays locked by default, moves only when "Di chuyển giả lập" enabled
  await selectLeftDockButton(page, /Viking/i);
  await ensureRightDrawerOpen(page);
  await page.getByTestId('view-mode-pov').click();
  await expect(page.getByTestId('pov-static-lander-banner')).toBeVisible({ timeout: 30000 });
  const vikingStart = parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent());
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  const vikingAnchored = parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent());
  expect(vikingAnchored - vikingStart).toBeLessThan(0.15);

  await page.getByTestId('pov-toggle-simulated-mobility').click();
  await page.keyboard.down('w');
  await expect
    .poll(async () => parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent()), {
      timeout: 12000,
    })
    .toBeGreaterThan(vikingStart + 0.4);
  await page.keyboard.up('w');

  expect(pageErrors).toEqual([]);
});

test('Desktop Orbital Cupola POV pause/time-warp, Moon body switch & Apollo LRV drive', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await launchToOverview(page);

  // Orbital Cupola POV (MRO) with Pause & 5000x Time Warp
  const mroActor = page.getByTestId('orbital-actor-mro_orbiter');
  await mroActor.scrollIntoViewIfNeeded();
  await mroActor.click();
  await ensureRightDrawerOpen(page);
  await page.getByTestId('view-mode-pov').click();
  await expect(page.getByTestId('pov-orbital-altitude')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('pov-orbital-warp-5000').click();
  await page.getByTestId('pov-orbital-pause-btn').click();
  await expect(page.getByTestId('pov-orbital-pause-btn')).toContainText(/Tiếp tục/i);

  // Switch body to Moon -> resets active POV -> Apollo LRV POV + region + quality tier switching
  await page.locator('nav.body-selector').getByRole('button', { name: /Mặt Trăng/i }).click();
  await expect(page.getByTestId('control-room-hud')).toHaveCount(0);

  await selectLeftDockButton(page, /Apollo LRV/i);
  await ensureRightDrawerOpen(page);
  await page.getByTestId('view-mode-pov').click();
  await expect(page.getByTestId('control-room-hud')).toBeVisible({ timeout: 30000 });

  await page.getByTestId('region-size-16').click();
  await page.getByTestId('quality-tier-medium').click();
  const lrvBefore = parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent());
  await page.keyboard.down('w');
  await expect
    .poll(async () => parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent()), {
      timeout: 12000,
    })
    .toBeGreaterThan(lrvBefore + 0.5);
  await page.keyboard.up('w');

  // Rapid closeup / POV / return cycles without WebGL crash
  await page.getByTestId('view-mode-closeup').click();
  await expect(page.getByTestId('control-room-hud')).toHaveCount(0);
  await page.getByTestId('view-mode-pov').click();
  await expect(page.getByTestId('control-room-hud')).toBeVisible();
  await selectLeftDockButton(page, /Toàn cảnh quỹ đạo/i);
  await expect(page.getByTestId('control-room-hud')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test('Mobile viewport (390x844) collapsible drawers, virtual joystick drive & zero overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await launchToOverview(page);

  await selectLeftDockButton(page, /Perseverance/i);
  await ensureRightDrawerOpen(page);
  await page.getByTestId('view-mode-pov').click();
  await expect(page.getByTestId('control-room-hud')).toBeVisible({ timeout: 30000 });

  await collapseRightDrawerOnMobile(page);

  const joy = page.getByTestId('pov-virtual-joystick');
  await expect(joy).toBeVisible();
  await expect(page.getByTestId('pov-minimap')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);

  // Drag virtual joystick straight upward (forward throttle)
  const beforeOdo = parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent());
  const box = await joy.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 32, { steps: 6 });
    await expect
      .poll(async () => parseOdometerM(await page.getByTestId('pov-odometer-readout').textContent()), {
        timeout: 10000,
      })
      .toBeGreaterThan(beforeOdo + 0.25);
    await page.mouse.up();
  }

  expect(pageErrors).toEqual([]);
});
