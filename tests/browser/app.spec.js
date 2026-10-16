import { test, expect } from '@playwright/test';
import { frame } from '../fixtures.js';

async function fakeSerial(page) {
  await page.addInitScript(() => {
    window.sentBytes = []; window.portRequests = 0;
    Object.defineProperty(navigator, 'serial', { configurable: true, value: {
      requestPort: async () => {
        window.portRequests++;
        return {
          readable: new ReadableStream({ start(c) { window.serialInput = c; } }),
          writable: new WritableStream({ write(b) { if (window.failWrite) throw new Error('Write failed'); window.sentBytes.push([...b]); } }),
          open: async () => {}, close: async () => {},
        };
      },
    } });
  });
}
const nav = (page, name) => page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
const input = (page, bytes) => page.evaluate(b => window.serialInput.enqueue(new Uint8Array(b)), bytes);
function packets(length, dsg, chg) {
  return [1, 1].flatMap(id => { const b = frame(length, id); b[39] = dsg; b[40] = chg; return [...b]; });
}

test('English default, exclusive views, mode, deep links, keyboard and responsive layouts', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fakeSerial(page); await page.goto('/');
  await expect(page.getByRole('heading', {name:'24S battery console'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Start acquisition',exact:true})).toBeDisabled();
  await expect(page.getByRole('region',{name:'Connection settings',exact:true})).toHaveCount(0);
  await nav(page, 'Connection settings');
  await expect(page.getByTestId('pack-1')).toHaveCount(0);
  await page.getByLabel('Battery configuration').selectOption('36');
  await expect(page.getByLabel('Frame format')).toHaveValue('50');
  await expect(page.getByLabel('Frame format')).toBeDisabled();
  await expect(page.getByRole('link',{name:'Download macOS driver (.dmg)'})).toBeVisible();
  await nav(page, 'Run log');
  await expect(page.getByLabel('Battery configuration')).toHaveCount(0);
  await page.goBack(); await expect(page.getByLabel('Battery configuration')).toHaveValue('36');
  await page.goForward(); await expect(page.getByRole('heading',{name:'Run log',exact:true}).first()).toBeVisible();
  await nav(page, 'Battery monitor 36S');
  await expect(page.getByTestId('pack-3')).toBeVisible();
  await expect(page.getByText('C36',{exact:true})).toBeVisible();
  await expect(page.locator('nav [aria-current="page"]')).toHaveCount(1);
  await page.getByLabel('Language').selectOption('zh');
  await expect(page.getByRole('heading',{name:'36S 电池监控台'})).toBeVisible();
  await page.getByLabel('界面语言').selectOption('en');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  for (const width of [1440,390,768]) {
    await page.setViewportSize({width,height:1000});
    for (const [route,name] of [['monitor','Battery monitor 36S'],['settings','Connection settings'],['logs','Run log']]) {
      await nav(page,name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path:`docs/web-factory/evidence/local-${route}-${width}.png`,fullPage:true});
    }
  }
  await page.goto('/#settings'); await page.reload();
  await expect(page.getByLabel('Battery configuration')).toBeVisible();
  await page.goto('/#invalid'); await expect(page.getByTestId('pack-1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('24S single controls send six commands, preserve state across navigation and await telemetry', async ({ page }) => {
  await fakeSerial(page); await page.goto('/');
  await page.getByRole('button',{name:'Connect device',exact:true}).click();
  await nav(page,'Connection settings');
  await expect(page.getByLabel('Battery configuration')).toBeDisabled();
  await expect(page.getByLabel('Frame format')).toBeDisabled();
  await page.getByRole('link',{name:'Run log',exact:true}).click();
  await input(page,packets(46,0,0));
  await nav(page,'Battery monitor 24S');
  await expect(page.getByTestId('total-voltage')).toHaveText('79,332');
  for(const name of ['Start acquisition','Stop acquisition','Open discharge']) await page.getByRole('button',{name,exact:true}).click();
  await expect(page.getByRole('button',{name:'Open discharge',exact:true})).toBeDisabled();
  await input(page,packets(46,1,0));
  await page.getByRole('button',{name:'Close discharge',exact:true}).click();
  await input(page,packets(46,0,0));
  await page.getByRole('button',{name:'Open charge',exact:true}).click();
  await input(page,packets(46,0,1));
  await page.getByRole('button',{name:'Close charge',exact:true}).click();
  expect(await page.evaluate(()=>window.sentBytes)).toEqual([2,3,4,5,6,7].map(n=>[1,n,85]));
  expect(await page.evaluate(()=>window.portRequests)).toBe(1);
  await page.waitForTimeout(6100);
  await expect(page.getByTestId('pack-1').getByText('Data is stale',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'State unavailable',exact:true})).toHaveCount(2);
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await page.getByRole('button',{name:'Connect device',exact:true}).click();
  await expect(page.getByTestId('total-voltage')).toHaveText('—');
  await expect(page.getByRole('button',{name:'Start acquisition',exact:true})).toBeEnabled();
});

test('36S maps third pack, reports unknown MOS and preserves request state through views', async ({ page }) => {
  await fakeSerial(page); await page.goto('/#settings');
  await page.getByLabel('Battery configuration').selectOption('36');
  await page.getByRole('button',{name:'Connect device',exact:true}).click();
  await input(page,[...frame(50,1),...frame(50,2),...frame(50,3)]);
  await nav(page,'Battery monitor 36S');
  await expect(page.getByTestId('total-voltage')).toHaveText('118,998');
  await expect(page.getByTestId('pack-3').getByText('3,311',{exact:true}).first()).toBeVisible();
  await expect(page.getByTestId('pack-3').getByText('Discharge MOS —',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Start acquisition',exact:true}).click();
  await nav(page,'Run log'); await nav(page,'Battery monitor 36S');
  await expect(page.getByRole('button',{name:'Stop acquisition',exact:true})).toBeEnabled();
  for(const name of ['Stop acquisition','Open discharge','Close discharge','Open charge','Close charge']) await page.getByRole('button',{name,exact:true}).click();
  expect(await page.evaluate(()=>window.sentBytes)).toEqual([2,3,4,5,6,7].map(n=>[1,n,85]));
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();
  await nav(page,'Connection settings'); await page.getByLabel('Battery configuration').selectOption('24');
  await nav(page,'Battery monitor 24S');
  await expect(page.getByTestId('pack-3')).toHaveCount(0);
  await expect(page.getByTestId('total-voltage')).toHaveText('—');
});

test('write failure does not flip acquisition request', async ({ page }) => {
  await fakeSerial(page); await page.goto('/');
  await page.getByRole('button',{name:'Connect device',exact:true}).click();
  await page.evaluate(()=>{window.failWrite=true;});
  await page.getByRole('button',{name:'Start acquisition',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Write failed');
  await expect(page.getByRole('button',{name:'Start acquisition',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Stop acquisition',exact:true})).toHaveCount(0);
});
test('unsupported browser and cancelled chooser never claim a connection', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator,'serial',{configurable:true,value:undefined}));
  await page.goto('/');
  await expect(page.getByText(/Serial is unavailable/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Connect device',exact:true})).toBeDisabled();
  await page.addInitScript(() => Object.defineProperty(navigator,'serial',{configurable:true,value:{requestPort:async()=>{throw new DOMException('Cancelled','NotFoundError');}}}));
  await page.reload(); await page.getByRole('button',{name:'Connect device',exact:true}).click();
  await nav(page,'Run log'); await expect(page.getByText('Device selection cancelled',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Connect device',exact:true})).toBeEnabled();
});

test('24S unknown and mixed MOS are disabled; unconfirmed action can be retried', async ({page}) => {
  await fakeSerial(page); await page.goto('/');
  await page.getByRole('button',{name:'Connect device',exact:true}).click();
  await expect(page.getByRole('button',{name:'State unavailable',exact:true})).toHaveCount(2);
  const a=frame(46,1), b=frame(46,1); a[39]=0; b[39]=1;
  await input(page,[...a,...b]);
  await expect(page.getByRole('region',{name:'Discharge MOS',exact:true}).getByText('Pack states differ')).toBeVisible();
  await input(page,packets(46,0,0));
  await page.getByRole('button',{name:'Open discharge',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open discharge',exact:true})).toBeDisabled();
  await page.waitForTimeout(5100);
  await input(page,packets(46,0,0));
  await expect(page.getByRole('region',{name:'Discharge MOS',exact:true}).getByText('Request unconfirmed; check device')).toBeVisible();
  await expect(page.getByRole('button',{name:'Open discharge',exact:true})).toBeEnabled();
});
