import { test, expect } from '@playwright/test';
import { testIds } from '../src/data-test-ids';

test.describe('pulse', () => {
  test('landing hero loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId(testIds.landingHero)).toBeVisible();
  });
});
