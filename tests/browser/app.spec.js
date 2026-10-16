import { test, expect } from '@playwright/test';
import { frame } from '../fixtures.js';

async function fakeSerial(page) {
  await page.addInitScript(() => {
    window.sentBytes = [];
    window.portRequests = 0;
    Object.defineProperty(navigator, 'serial', { configurable: true, value: {
      requestPort: async () => {
        window.portRequests++;
        return {
          readable: new ReadableStream({ start(c) { window.serialInput = c; } }),
          writable: new WritableStream({ write(b) { window.sentBytes.push([...b]); } }),
          open: async () => {}, close: async () => {},
        };
      },
    } });
  });
}
test('empty dashboard, language, settings, keyboard and responsive views', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fakeSerial(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '24 串电池监控台' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始采集', exact: true })).toBeDisabled();
  await expect(page.getByTestId('total-voltage')).toHaveText('—');
  await page.screenshot({ path: 'docs/web-factory/evidence/desktop-empty.png', fullPage: true });
  await page.getByLabel('界面语言').selectOption('en');
  await expect(page.getByRole('heading', { name: '24S battery console' })).toBeVisible();
  await page.getByLabel('Frame format').selectOption('40');
  await page.getByLabel('Language').selectOption('zh');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  await page.locator('h1').click();
  for (const width of [390, 375, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/web-factory/evidence/mobile-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
test('mock serial integration: telemetry, six commands, stale, clear and reconnect', async ({ page }) => {
  await fakeSerial(page);
  await page.goto('/');
  await page.getByRole('button', { name: '连接设备', exact: true }).click();
  await expect(page.getByRole('button', { name: '断开连接' })).toBeEnabled();
  await expect(page.getByLabel('数据帧格式')).toBeDisabled();
  expect(await page.evaluate(() => window.sentBytes)).toEqual([]);
  const bytes = [...frame(46, 1), ...frame(46, 1)];
  await page.evaluate(b => window.serialInput.enqueue(new Uint8Array(b)), bytes);
  await expect(page.getByTestId('total-voltage')).toHaveText('79,332');
  await expect(page.getByTestId('pack-1').getByText('-2.00', { exact: true })).toBeVisible();
  await expect(page.getByTestId('pack-2').getByText('3,311', { exact: true }).first()).toBeVisible();
  const names = ['开始采集', '停止采集', '打开放电', '关闭放电', '打开充电', '关闭充电'];
  for (const name of names) await page.getByRole('button', { name, exact: true }).click();
  expect(await page.evaluate(() => window.sentBytes)).toEqual([2, 3, 4, 5, 6, 7].map(n => [1, n, 85]));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/web-factory/evidence/desktop-mock-data.png', fullPage: true });
  await page.waitForTimeout(5600);
  await expect(page.getByTestId('pack-1').getByText('数据已过期', { exact: true })).toBeVisible();
  await page.evaluate(b => window.serialInput.enqueue(new Uint8Array(b)), [...frame(46, 2)]);
  await expect(page.getByTestId('pack-2').getByText('数据已更新', { exact: true })).toBeVisible();
  await expect(page.getByTestId('pack-1').getByText('数据已过期', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '断开连接', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始采集', exact: true })).toBeDisabled();
  await expect(page.getByTestId('pack-1').getByText('上次读数', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '连接设备', exact: true }).click();
  await expect(page.getByTestId('total-voltage')).toHaveText('—');
  await page.evaluate(b => window.serialInput.enqueue(new Uint8Array(b)), [...frame(46, 1)]);
  await expect(page.getByTestId('pack-1').getByText('数据已更新', { exact: true })).toBeVisible();
  await expect(page.getByTestId('pack-2').getByText('等待数据', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清空参数', exact: true }).click();
  await expect(page.getByTestId('pack-1').getByText('等待数据', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '断开连接', exact: true }).click();
});
test('unsupported browser explains limitations', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'serial', { configurable: true, value: undefined }));
  await page.goto('/');
  await expect(page.getByText(/此浏览器无法使用串口/)).toBeVisible();
  await expect(page.getByRole('button', { name: '连接设备', exact: true })).toBeDisabled();
});
test('chooser cancellation is recoverable and does not claim a connection', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'serial', { value: { requestPort: async () => { throw new DOMException('Cancelled', 'NotFoundError'); } } }));
  await page.goto('/');
  await page.getByRole('button', { name: '连接设备', exact: true }).click();
  await expect(page.getByText('已取消设备选择', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '连接设备', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '开始采集', exact: true })).toBeDisabled();
});
