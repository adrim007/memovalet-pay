// Run against a local production build with ENABLE_PRODUCT_PREVIEW=1.
// API mutations are intercepted: this never changes an account's tasks.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://localhost:3006';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, timezoneId: 'Pacific/Auckland', locale: 'en-AU' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/preview/calendar?date=2026-09-21`);
    await page.getByRole('heading', { name: 'Your calendar' }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Selected day', exact: true }).getByRole('link').count(), 2);
    await page.getByRole('combobox', { name: 'Filter calendar' }).selectOption('task');
    assert.equal(await page.getByRole('region', { name: 'Selected day', exact: true }).getByRole('link').count(), 1);
    await page.getByRole('combobox', { name: 'Filter calendar' }).selectOption('all');
    await page.getByRole('button', { name: '7 September 2026, 2 items', exact: true }).click();
    await page.getByRole('link', { name: /Ideas for the next launch/ }).waitFor();
    assert.match(page.url(), /date=2026-09-07/);
    await page.reload();
    await page.getByRole('link', { name: /Ideas for the next launch/ }).waitFor();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('heading', { name: 'August 2026', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2024');
    await page.getByRole('combobox', { name: 'Month', exact: true }).selectOption('2');
    await page.getByRole('button', { name: '29 February 2024, 0 items', exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'Day', exact: true }).selectOption('29');
    assert.match(page.url(), /date=2024-02-29/);
    await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2025');
    assert.match(page.url(), /date=2025-02-28/);
    const day28 = page.getByRole('button', { name: '28 February 2025, 0 items', exact: true });
    await day28.focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('heading', { name: 'March 2025', exact: true }).waitFor();
    assert.match(page.url(), /date=2025-03-01/);
    assert.equal(await page.locator('[data-calendar-date="2025-03-01"]').evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
    assert.match(page.url(), /date=2025-02-28/);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.getByRole('heading', { name: 'Your calendar' }).waitFor();
    await page.goto(`${base}/preview/calendar?date=2026-09-21`);
    await page.getByRole('link', { name: /Send the updated proposal/ }).waitFor();
    await page.screenshot({ path: '/tmp/memovalet-calendar-desktop-full.png', fullPage: true });

    // Exercise the same request/retry code used by the authenticated calendar.
    let failing = true;
    await page.route('**/api/calendar/work?*', async route => {
      const month = new URL(route.request().url()).searchParams.get('month');
      if (failing) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      return route.fulfill({ json: { entries: [{ id: 'notes:n1', kind: 'note', title: `Work from ${month}`, date: `${month}-01`, detail: 'Saved', href: '/notes?note=n1#note-n1' }], warnings: [] } });
    });
    await page.goto(`${base}/preview/calendar?source=api&date=2026-09-01`);
    await page.getByRole('alert').filter({ hasText: 'could not be loaded' }).waitFor();
    assert.equal(await page.getByText('A little breathing room', { exact: true }).count(), 0);
    failing = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('link', { name: /Work from 2026-09/ }).waitFor();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('link', { name: /Work from 2026-08/ }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Work from 2026-09/ }).count(), 0);
    await page.unroute('**/api/calendar/work?*');

    await page.goto(`${base}/preview/tasks`);
    const firstTask = page.locator('[id^="task-"]').first();
    await firstTask.waitFor();
    const id = await firstTask.getAttribute('id');
    let succeed = false;
    let writes = 0;
    await page.route('**/api/action-items/*', async route => {
      writes++;
      await new Promise(resolve => setTimeout(resolve, 100));
      return route.fulfill({ status: succeed ? 200 : 403, json: succeed ? { status: 'done' } : { error: 'Not allowed' } });
    });
    await firstTask.getByRole('button', { name: 'Toggle done' }).click();
    await page.getByRole('alert').filter({ hasText: "Couldn't save that change" }).waitFor();
    assert.equal(await page.locator(`[id="${id}"]`).count(), 1);
    assert.equal(writes, 1);
    succeed = true;
    await firstTask.getByRole('button', { name: 'Toggle done' }).click();
    await page.locator(`[id="${id}"]`).waitFor({ state: 'detached' });
    assert.equal(writes, 2);
    await page.unroute('**/api/action-items/*');

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark', timezoneId: 'America/Los_Angeles', locale: 'en-AU' });
    const mobile = await phone.newPage();
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(`${base}/preview/calendar?date=2026-09-14`);
    await mobile.getByRole('link', { name: /Review the first draft/ }).waitFor();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal overflow on phone');
    await mobile.getByRole('button', { name: 'Next month' }).click();
    await mobile.getByRole('heading', { name: 'October 2026', exact: true }).waitFor();
    await mobile.getByRole('combobox', { name: 'Day', exact: true }).selectOption('21');
    await mobile.getByRole('button', { name: '21 October 2026, 2 items', exact: true }).click();
    await mobile.getByRole('link', { name: /Send the updated proposal/ }).waitFor();
    await mobile.waitForTimeout(500);
    assert.ok(await mobile.getByRole('region', { name: 'Selected day', exact: true }).evaluate(el => el.getBoundingClientRect().top < window.innerHeight / 2), 'selected activity scrolls into view on phone');
    assert.ok(await mobile.getByRole('link', { name: /Send the updated proposal/ }).evaluate(el => el.getBoundingClientRect().bottom <= window.innerHeight), 'selected work is visible without another scroll');
    await mobile.screenshot({ path: '/tmp/memovalet-calendar-phone.png', fullPage: true });
    await mobile.setViewportSize({ width: 320, height: 740 });
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no overflow on narrow phone');
    assert.deepEqual(errors, []);
    console.log('PASS: calendar navigation, filters, leap month, date persistence, retry, source links, failed/successful task save, desktop and dark phone layouts; no browser exceptions.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
