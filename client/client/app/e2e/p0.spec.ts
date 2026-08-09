import { test, expect } from '@playwright/test';
import { testIds } from '../src/data-test-ids';

const SAMPLE_POSTING =
  'Senior Product Manager — Own roadmap, align cross-functional teams, and deliver measurable outcomes in a regulated environment with clear stakeholder communication.';

test.describe('p0 critical journeys', () => {
  test('guest market report reaches market input and generate CTA', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(testIds.toolCard('market')).click();
    await page.getByTestId(testIds.startToolCta).click();
    await expect(page.getByTestId(testIds.marketWorkspace)).toBeVisible();
    await expect(page.getByTestId(testIds.marketGenerateCta)).toBeVisible();
  });

  test('guest job analyze paste continues to review', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(testIds.toolCard('job')).click();
    await page.getByTestId(testIds.startToolCta).click();
    await expect(page.getByTestId(testIds.jobWorkspace)).toBeVisible();
    await page.getByTestId(testIds.jobSource('paste')).click();
    await page.getByTestId(testIds.jobPasteTextarea).fill(SAMPLE_POSTING);
    await page.getByTestId(testIds.jobReviewContinue).click();
    await expect(page.getByText(/review/i).first()).toBeVisible();
  });

  test('job upload source shows clickable drop zone', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(testIds.toolCard('job')).click();
    await page.getByTestId(testIds.jobSource('upload')).click();
    const zone = page.getByTestId(testIds.jobUploadDropzone);
    await expect(zone).toBeVisible();
    await expect(zone).toBeEnabled();
  });
});
