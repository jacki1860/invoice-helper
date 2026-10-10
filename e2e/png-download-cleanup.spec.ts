import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const fault of ['click', 'create-anchor'] as const) {
  test(`PNG export cleans up after ${fault} fails and permits a real retry`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('quote/');
    await page.getByRole('button', { name: '載入文件範例', exact: true }).click();
    await page.evaluate((selectedFault) => {
      const probe = { created: [] as string[], revoked: [] as string[], failures: 0 };
      const host = window as typeof window & { pngCleanupProbe: typeof probe };
      host.pngCleanupProbe = probe;
      const createUrl = URL.createObjectURL.bind(URL);
      const revokeUrl = URL.revokeObjectURL.bind(URL);
      const click = HTMLAnchorElement.prototype.click;
      const createElement = document.createElement.bind(document);
      URL.createObjectURL = (blob) => {
        const url = createUrl(blob);
        probe.created.push(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        probe.revoked.push(url);
        revokeUrl(url);
      };
      if (selectedFault === 'click') {
        HTMLAnchorElement.prototype.click = function () {
          if (this.download.endsWith('.png') && probe.failures === 0) {
            probe.failures += 1;
            throw new Error('Controlled PNG download click failure');
          }
          click.call(this);
        };
      } else {
        document.createElement = ((tag: string, options?: ElementCreationOptions) => {
          if (tag === 'a' && probe.created.length > 0 && probe.failures === 0) {
            probe.failures += 1;
            throw new Error('Controlled PNG anchor creation failure');
          }
          return createElement(tag, options);
        }) as typeof document.createElement;
      }
    }, fault);

    const downloadButton = page.getByRole('button', { name: '下載文件 PNG', exact: true });
    await downloadButton.click();
    await expect(
      page.getByText('圖片製作失敗，請稍後重試，或使用列印／另存 PDF。', { exact: true }),
    ).toBeVisible();
    await expect(downloadButton).toBeEnabled();
    await expect(page.locator('body > .export-surface')).toHaveCount(0);
    await expect(page.locator('a[download$=".png"]')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const probe = (
            window as typeof window & {
              pngCleanupProbe: { created: string[]; revoked: string[]; failures: number };
            }
          ).pngCleanupProbe;
          return {
            created: probe.created.length,
            revoked: probe.revoked,
            failures: probe.failures,
          };
        }),
      )
      .toEqual({ created: 1, revoked: [expect.stringMatching(/^blob:/)], failures: 1 });
    await page.screenshot({ path: info.outputPath(`png-${fault}-error.png`), fullPage: true });

    const pendingDownload = page.waitForEvent('download');
    await downloadButton.click();
    const download = await pendingDownload;
    expect(await download.failure()).toBeNull();
    const path = info.outputPath(`png-${fault}-recovered.png`);
    await download.saveAs(path);
    const png = await readFile(path);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBeGreaterThan(500);
    expect(png.readUInt32BE(20)).toBeGreaterThan(500);
    await expect(
      page.getByText('PNG 已產生，請查看瀏覽器下載項目。', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('body > .export-surface')).toHaveCount(0);
    await expect(page.locator('a[download$=".png"]')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const probe = (
            window as typeof window & {
              pngCleanupProbe: { created: string[]; revoked: string[] };
            }
          ).pngCleanupProbe;
          return (
            probe.created.length === 2 && probe.created.every((url) => probe.revoked.includes(url))
          );
        }),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
}
