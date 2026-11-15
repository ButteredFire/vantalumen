import { expect, test } from '@playwright/test';

async function enterFreeExploration(page: import('@playwright/test').Page) {
  const exploreBtn = page.getByTestId('explore-freely-btn');
  await expect(exploreBtn).toBeVisible({ timeout: 20000 });
  const pressed = await exploreBtn.getAttribute('aria-pressed');
  if (pressed !== 'true') {
    await exploreBtn.click();
  }
  await expect(page.getByTestId('free-exploration-catalog')).toBeVisible({ timeout: 10000 });
}

async function launchToOverview(
  page: import('@playwright/test').Page,
  options: { freeExplore?: boolean } = {},
) {
  await page.goto('/');
  const launchBtn = page.locator('.preloader-launch-btn');
  await expect(launchBtn).toBeEnabled({ timeout: 45000 });
  await launchBtn.click();
  await expect(page.locator('.hud-top-bar')).toBeVisible({ timeout: 40000 });
  if (options.freeExplore !== false) {
    await enterFreeExploration(page);
  }
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
  if (text && /Open/i.test(text)) {
    await toggle.click();
  }
  await expect(page.getByTestId('view-mode-pov')).toBeVisible({ timeout: 15000 });
}

async function collapseRightDrawerOnMobile(page: import('@playwright/test').Page) {
  const toggle = page.getByTestId('subscene-drawer-toggle');
  if (await toggle.isVisible()) {
    const text = await toggle.textContent();
    if (text && /Collapse/i.test(text)) {
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
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1440, height: 960 });
  const pageErrors: string[] = [];
  const shaderConsoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      /(Shader Error|THREE\.WebGLProgram|WebGL: INVALID|SyntaxError)/i.test(msg.text())
    ) {
      shaderConsoleErrors.push(msg.text());
    }
  });

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
  await expect(page.getByTestId('pov-wheel-contact-readout')).toContainText(/Wheels on ground:\s*[456]\/6/i);

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
  await expect(page.getByTestId('pov-wheel-contact-readout')).toContainText(/Wheels on ground:\s*[456]\/6/i);

  expect(pageErrors).toEqual([]);
  expect(shaderConsoleErrors).toEqual([]);
});

test('Desktop Ingenuity helicopter takeoff & Viking stationary vs simulated mobility toggle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const pageErrors: string[] = [];
  const shaderConsoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      /(Shader Error|THREE\.WebGLProgram|WebGL: INVALID|SyntaxError)/i.test(msg.text())
    ) {
      shaderConsoleErrors.push(msg.text());
    }
  });

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
  expect(shaderConsoleErrors).toEqual([]);
});

test('Desktop Orbital Cupola POV pause/time-warp, Moon body switch & Apollo LRV drive', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1440, height: 960 });
  const pageErrors: string[] = [];
  const shaderConsoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      /(Shader Error|THREE\.WebGLProgram|WebGL: INVALID|SyntaxError)/i.test(msg.text())
    ) {
      shaderConsoleErrors.push(msg.text());
    }
  });

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
  await expect(page.getByTestId('pov-orbital-pause-btn')).toContainText(/Resume orbit/i);

  // Switch body to Moon -> resets active POV -> Apollo LRV POV + region + quality tier switching
  await page.locator('nav.body-selector').getByRole('button', { name: /Moon/i }).click();
  await expect(page.getByTestId('control-room-hud')).toHaveCount(0);

  const apolloBtn = page.getByTestId('device-btn-apollo_lrv');
  await apolloBtn.scrollIntoViewIfNeeded();
  await apolloBtn.click();
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
  await selectLeftDockButton(page, /Orbital overview/i);
  await expect(page.getByTestId('control-room-hud')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
  expect(shaderConsoleErrors).toEqual([]);
});

test('WebGL denial fallback preserves navigation, status vocabulary, and source links', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.addInitScript(() => {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return null;
      }
      return origGetContext.apply(this, [type, ...rest] as never);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto('/');
  const textModeBtn = page.getByTestId('preloader-text-mode-btn');
  await expect(textModeBtn).toBeVisible({ timeout: 20000 });
  await textModeBtn.click();

  await expect(page.locator('.hud-top-bar')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('renderer-fallback-panel')).toBeVisible();
  await expect(page.getByTestId('overview-unavailable-datasets')).toBeVisible();
  await expect(page.getByTestId('overview-unavailable-datasets')).toContainText(/MOLA/);

  await enterFreeExploration(page);
  await expect(page.getByTestId('unavailable-datasets-box')).toBeVisible();
  await expect(page.getByTestId('unavailable-datasets-box')).toContainText(/MOLA/);

  // Non-Mars craft stay outside Mars surface dock and live inside reference group
  const leftDockText = await page.locator('.hud-left-dock').textContent();
  expect(leftDockText).toContain('Off-world reference spacecraft');
  const refGroup = page.getByTestId('reference-spacecraft-group');
  await expect(refGroup).toBeVisible();
  await expect(refGroup).not.toHaveAttribute('open', '');

  // Switch body and inspect Curiosity + Jezero + Apollo LRV without 3D WebGL
  await selectLeftDockButton(page, /Curiosity/i);
  await expect(page.getByTestId('status-vocabulary-badges')).toContainText(/Source 3D model/i);
  await expect(page.getByTestId('renderer-fallback-context')).toContainText(/Curiosity/i);

  await selectLeftDockButton(page, /Jezero/i);
  await expect(page.getByTestId('status-vocabulary-badges')).toContainText(/Record only/i);
  await expect(page.getByTestId('renderer-fallback-context')).toContainText(/Jezero/i);

  await page.locator('nav.body-selector').getByRole('button', { name: /Moon/i }).click();
  await expect(page.locator('.hud-brand-title')).toContainText(/Moon/i, { timeout: 10000 });
  const moonLrvBtn = page.getByTestId('device-btn-apollo_lrv');
  await moonLrvBtn.scrollIntoViewIfNeeded();
  await moonLrvBtn.click();
  await expect(page.getByTestId('status-vocabulary-badges')).toContainText(/Illustrative reconstruction/i);

  await page.getByTestId('renderer-text-mode-btn').click();
  await expect(page.getByTestId('renderer-status-banner')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('WebGL context loss triggers containment panel and recovers via Basic 3D mode', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const pageErrors: string[] = [];
  const shaderConsoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      /(Shader Error|THREE\.WebGLProgram|WebGL: INVALID|SyntaxError)/i.test(msg.text())
    ) {
      shaderConsoleErrors.push(msg.text());
    }
  });

  await launchToOverview(page);
  const canvas = page.locator('.mars-canvas-wrapper canvas').first();
  await expect(canvas).toBeVisible({ timeout: 20000 });

  await canvas.evaluate((el) => {
    el.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });

  await expect(page.getByTestId('renderer-fallback-panel')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('renderer-fallback-panel')).toContainText(/Context Lost/i);

  await page.getByTestId('renderer-basic-mode-btn').click();
  await expect(page.getByTestId('renderer-fallback-panel')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator('.mars-canvas-wrapper canvas').first()).toBeVisible({ timeout: 15000 });
  expect(pageErrors).toEqual([]);
  expect(shaderConsoleErrors).toEqual([]);
});

test('Mobile viewport (390x844) collapsible drawers, virtual joystick drive & zero overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors: string[] = [];
  const shaderConsoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      /(Shader Error|THREE\.WebGLProgram|WebGL: INVALID|SyntaxError)/i.test(msg.text())
    ) {
      shaderConsoleErrors.push(msg.text());
    }
  });

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
  expect(shaderConsoleErrors).toEqual([]);
});

test('P1 guided mission entry, orbit suppression, URL fallback & history, and 390px mobile flow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });

  // Invalid cross-body deep link falls back cleanly to Mars overview with dismissible notice
  await page.goto('/?v=1&body=mars&mission=hadley-geology');
  await expect(page.getByTestId('url-validation-notice')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('mission-entry')).toBeVisible();
  await expect(page.getByTestId('journey-panel')).toBeVisible();
  await expect(page.getByTestId('orbital-callout-strip')).toHaveCount(0);

  // Advance to Jezero & Perseverance stops, then use Back/Forward browser history
  await page.getByTestId('journey-step-investigate').click();
  await expect(page).toHaveURL(/mission=jezero-evidence/);
  await expect(page).toHaveURL(/stop=investigate/);
  await expect(page.getByTestId('view-mode-closeup')).toContainText(/Inspect model/i);
  await expect(page.getByTestId('view-mode-pov')).toContainText(/Explore viewpoints/i);

  await page.goBack();
  await expect(page).toHaveURL(/stop=observe/);

  await page.goForward();
  await expect(page).toHaveURL(/stop=investigate/);

  // Explore freely reveals full catalog & orbital tracks while guided hides them again
  await enterFreeExploration(page);
  await expect(page.getByTestId('toggle-orbits-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('mode-guided-btn').click();
  await expect(page.getByTestId('journey-panel')).toBeVisible();

  // Moon guided Lunar Module stop renders real NASA GLB in view-only static mode (no drive toggle)
  await page.goto('/?v=1&body=moon&mission=hadley-geology&stop=lunar_module');
  await expect(page.getByTestId('journey-step-lunar_module')).toHaveAttribute('aria-current', 'step', {
    timeout: 20000,
  });
  await ensureRightDrawerOpen(page);
  await expect(page.getByTestId('status-vocabulary-badges')).toContainText(/Source 3D model/i);
  await page.getByTestId('view-mode-pov').click();
  await expect(page.getByTestId('pov-static-lander-banner')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('pov-toggle-simulated-mobility')).toHaveCount(0);

  // Narrow viewport places header -> globe -> story task panel -> details drawer in vertical flow
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?v=1&body=mars&mission=jezero-evidence&stop=observe');
  await expect(page.getByTestId('left-task-panel')).toBeVisible({ timeout: 20000 });
  const layoutBoxes = await page.evaluate(() => {
    const header = document.querySelector('.hud-top-bar')?.getBoundingClientRect();
    const globe = document.querySelector('.mars-canvas-wrapper')?.getBoundingClientRect();
    const story = document.querySelector('.hud-left-dock')?.getBoundingClientRect();
    const details = document.querySelector('.hud-right-panel')?.getBoundingClientRect();
    return {
      headerY: header?.y ?? -1,
      globeY: globe?.y ?? -1,
      globeHeight: globe?.height ?? 0,
      storyY: story?.y ?? -1,
      detailsY: details?.y ?? -1,
    };
  });
  expect(layoutBoxes.headerY).toBeGreaterThanOrEqual(0);
  expect(layoutBoxes.globeY).toBeGreaterThan(layoutBoxes.headerY);
  expect(layoutBoxes.globeHeight).toBeGreaterThanOrEqual(240);
  expect(layoutBoxes.storyY).toBeGreaterThanOrEqual(layoutBoxes.globeY + layoutBoxes.globeHeight - 2);
  expect(layoutBoxes.detailsY).toBeGreaterThanOrEqual(layoutBoxes.storyY);
});

test('ProjectChatWidget drag/click separation, keyboard focus, Escape restore & 390px layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  const pageErrors: string[] = [];
  const shaderConsoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      /(Shader Error|THREE\.WebGLProgram|WebGL: INVALID|SyntaxError)/i.test(msg.text())
    ) {
      shaderConsoleErrors.push(msg.text());
    }
  });

  await page.route('**/api/chat', async (route) => {
    const reqBody = route.request().postDataJSON() as { message?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: `Verified for: ${reqBody?.message ?? ''} [S1].`,
        citations: [
          {
            id: 'S1',
            title: 'Sources and asset provenance',
            sourcePath: 'docs/SOURCES.md',
            section: 'Moon GLB Addition',
            evidenceType: 'source_verified',
            sourceUrls: ['https://science.nasa.gov/3d-resources/apollo-lunar-module/'],
          },
        ],
        evidenceNotice: 'Values verified against NASA/USGS sources in the project.',
        retrievalSufficient: true,
        groundedOnly: true,
        model: 'gemini-3.8-flash',
      }),
    });
  });

  await launchToOverview(page);

  const launcher = page.getByTestId('project-chat-launcher');
  await expect(launcher).toBeVisible({ timeout: 20000 });

  const startBox = await launcher.boundingBox();
  expect(startBox).not.toBeNull();
  if (startBox) {
    const cx = startBox.x + startBox.width / 2;
    const cy = startBox.y + startBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 56, cy - 42, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('project-chat-dialog')).toHaveCount(0);

    const movedBox = await launcher.boundingBox();
    expect(movedBox).not.toBeNull();
    if (movedBox) {
      expect(Math.abs(movedBox.x - startBox.x)).toBeGreaterThan(20);
    }
  }

  await launcher.focus();
  const beforeKeyBox = await launcher.boundingBox();
  await page.keyboard.press('ArrowLeft');
  const afterKeyBox = await launcher.boundingBox();
  if (beforeKeyBox && afterKeyBox) {
    expect(afterKeyBox.x).toBeLessThan(beforeKeyBox.x);
  }

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('project-chat-dialog')).toBeVisible();
  const chatInput = page.getByTestId('project-chat-input');
  await expect(chatInput).toBeFocused();

  await chatInput.fill('Which source is used for the Apollo Lunar Module?');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('project-chat-citations')).toContainText('docs/SOURCES.md');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('project-chat-dialog')).toHaveCount(0);
  await expect(launcher).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(launcher).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);

  expect(pageErrors).toEqual([]);
  expect(shaderConsoleErrors).toEqual([]);
});
