import { test, expect } from '@playwright/test';

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

test('customer can register, book a car, and cancel the reservation', async ({ page }) => {
  const email = `e2e-${Date.now()}@nexorarent.test`;
  await page.goto('/auth/register');
  await page.getByPlaceholder('John').fill('Browser');
  await page.getByPlaceholder('Doe').fill('Customer');
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('+383 44 ...').fill('+38344123456');
  await page.getByPlaceholder('At least 12 characters').fill('BrowserTestPassword!2026');
  await page.getByPlaceholder(/repeat password/i).fill('BrowserTestPassword!2026');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('navigation').getByRole('link', { name: /reserve now/i }).click();
  await page.locator('select').first().selectOption({ index: 1 });
  await page.locator('select').nth(1).selectOption({ index: 1 });
  await page.locator('input[type="date"]').nth(0).fill(dateOffset(40));
  await page.locator('input[type="date"]').nth(1).fill(dateOffset(42));
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  const carChoice = page.locator('button.text-left.rounded-xl.border-2').first();
  await expect(carChoice).toBeVisible();
  await carChoice.click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /confirm reservation/i }).click();
  await expect(page.getByRole('heading', { name: /reservation confirmed/i })).toBeVisible();
  await page.getByRole('button', { name: /browser/i }).hover();
  await page.getByRole('link', { name: /my bookings/i }).click();
  await expect(page.locator('button').filter({ hasText: /cancel/i }).first()).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /cancel/i }).first().click();
  await expect(page.getByText(/cancelled/i).first()).toBeVisible();
});

test('admin can sign in and open reservation management', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByPlaceholder('your@email.com').fill(process.env.E2E_ADMIN_EMAIL || 'e2e-admin@nexorarent.test');
  await page.getByPlaceholder(/password/i).fill(process.env.E2E_ADMIN_PASSWORD || 'TestAdminPassword!2026');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('button', { name: /e2e/i }).hover();
  await page.getByRole('link', { name: /dashboard/i }).click();
  await page.locator('a[href="/admin/reservations"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
});
