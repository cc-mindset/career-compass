import { test, expect } from '@playwright/test';
import { testIds } from '../src/data-test-ids';

test.describe('smoke', () => {
  test('tools section and try CTA are reachable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId(testIds.toolsSection)).toBeVisible();
    await page.getByTestId(testIds.toolCard('job')).click();
    await expect(page.getByTestId(testIds.startToolCta)).toBeVisible();
  });
});
