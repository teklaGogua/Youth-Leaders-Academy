import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const integrationEnabled = Boolean(url && anonKey && serviceKey);
const admin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
const password = 'Synthetic-Integration-Password-123!';
const createdUsers: string[] = [];

async function createAccount(
  email: string,
  confirmed: boolean,
  role: 'participant' | 'administrator' = 'participant',
) {
  if (!admin) throw new Error('Local Supabase service role is required for auth integration tests');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: confirmed,
  });
  if (error || !data.user) throw error ?? new Error('Synthetic account creation failed');
  createdUsers.push(data.user.id);
  if (role === 'administrator') {
    const { error: roleError } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', data.user.id);
    if (roleError) throw roleError;
  }
  return data.user;
}

test.describe.serial('real Supabase authentication integration', () => {
  test.skip(!integrationEnabled, 'requires the local Supabase integration environment');
  test.afterAll(async () => {
    if (admin) {
      for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
    }
  });

  test('a valid email confirmation link succeeds on its first visit', async ({ page }) => {
    if (!admin || !url) throw new Error('Supabase integration environment is missing');
    const email = `confirmation-${Date.now()}@example.test`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { redirectTo: 'http://127.0.0.1:5173/auth/callback' },
    });
    if (error || !data.properties?.action_link)
      throw error ?? new Error('Confirmation link was not generated');
    if (data.user?.id) createdUsers.push(data.user.id);

    await page.goto(data.properties.action_link);
    await expect(page).toHaveURL(/\/register(?:\?step=2)?$/);
    await expect(page.getByRole('heading', { name: 'მონაწილის რეგისტრაცია' })).toBeVisible();
    await expect(page.getByText(/დადასტურების ბმული არასწორია/)).toHaveCount(0);
    await expect(page.getByText('ნაბიჯი 1 / 4')).toHaveCount(0);
  });

  test('a persistent participant session survives refresh and public-page navigation', async ({
    page,
  }) => {
    if (!admin) throw new Error('Supabase integration environment is missing');
    const user = await createAccount(`persistent-${Date.now()}@example.test`, true);
    const { error: profileError } = await admin
      .from('profiles')
      .update({ registration_completed_at: new Date().toISOString() })
      .eq('id', user.id);
    if (profileError) throw profileError;
    const { error: participantError } = await admin.from('participants').insert({
      user_id: user.id,
      first_name: 'Synthetic',
      last_name: 'Participant',
      age: 17,
      biography: 'Synthetic integration profile',
      school: 'Synthetic School',
      grade: '11',
      teacher_name: 'Synthetic Teacher',
      parent_contact_name: 'Synthetic Guardian',
      parent_contact_phone: '+995555000001',
      parent_contact_email: 'guardian@example.test',
      parent_contact_email_verified_at: new Date().toISOString(),
    });
    if (participantError) throw participantError;

    await page.goto('/login');
    await page.getByLabel('ელფოსტა').fill(user.email!);
    await page.getByLabel('პაროლი', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'შესვლა' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Synthetic Participant')).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'პირადი კაბინეტი' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'პირადი კაბინეტი' })).toBeVisible();

    // Simulate closing and reopening the website in a fresh browser context.
    const browser = page.context().browser();
    if (!browser) throw new Error('Browser context is unavailable');
    const reopenedContext = await browser.newContext({
      storageState: await page.context().storageState(),
    });
    const reopenedPage = await reopenedContext.newPage();
    await reopenedPage.goto('/');
    await expect(reopenedPage.getByRole('link', { name: 'პირადი კაბინეტი' })).toBeVisible();
    await reopenedPage.reload();
    await expect(reopenedPage.getByRole('link', { name: 'პირადი კაბინეტი' })).toBeVisible();
    await reopenedPage.getByRole('link', { name: 'პირადი კაბინეტი' }).click();
    await expect(reopenedPage).toHaveURL(/\/dashboard$/);
    await reopenedContext.close();

    await page.getByRole('link', { name: 'პირადი კაბინეტი' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('button', { name: 'გასვლა' }).click();
    await expect(page.getByRole('link', { name: 'შესვლა' })).toBeVisible();
  });

  test('incomplete participants cannot bypass completion through direct REST writes', async () => {
    if (!url || !anonKey) throw new Error('Supabase integration environment is missing');
    const user = await createAccount(`api-bypass-${Date.now()}@example.test`, true);
    const participantClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await participantClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });
    if (signInError) throw signInError;

    const { error: insertError } = await participantClient.from('participants').insert({
      user_id: user.id,
      first_name: 'Bypass',
    });
    expect(insertError).not.toBeNull();

    const { data: sessionData } = await participantClient.auth.getSession();
    if (!sessionData.session) throw new Error('Participant API session was not restored');
    const profileWriteResponse = await fetch(`${url}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        apikey: anonKey!,
        Authorization: `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ registration_completed_at: new Date().toISOString() }),
    });
    expect(profileWriteResponse.ok).toBe(false);

    const { error: completionRpcError } = await participantClient.rpc(
      'complete_participant_registration',
      { p_terms_version: 'unapproved', p_privacy_version: 'unapproved' },
    );
    expect(completionRpcError).not.toBeNull();
    await participantClient.auth.signOut();
  });

  test('incomplete participants resume the first unfinished step and cannot open the dashboard', async ({
    page,
  }) => {
    if (!admin) throw new Error('Supabase integration environment is missing');
    const user = await createAccount(`incomplete-${Date.now()}@example.test`, true);
    const { error: draftError } = await admin.from('participants').insert({
      user_id: user.id,
      first_name: 'Resume',
      last_name: 'Test',
      age: 16,
      biography: 'Synthetic saved draft',
    });
    if (draftError) throw draftError;

    await page.goto('/login');
    await page.getByLabel('ელფოსტა').fill(user.email!);
    await page.getByLabel('პაროლი', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'შესვლა' }).click();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/register\?step=3$/);
    await expect(page.getByRole('heading', { name: 'მონაწილის რეგისტრაცია' })).toBeVisible();
    await expect(page.getByLabel('სკოლა')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/register\?step=3$/);

    await page.getByRole('button', { name: 'გასვლა' }).click();
    await page.getByLabel('ელფოსტა').fill(user.email!);
    await page.getByLabel('პაროლი', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'შესვლა' }).click();
    await expect(page).toHaveURL(/\/register\?step=3$/);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'პირადი კაბინეტი' })).toBeVisible();
    await page.getByRole('button', { name: 'გასვლა' }).click();
    await expect(page.getByRole('link', { name: 'შესვლა' })).toBeVisible();
    await page.goto('/competition');
    await expect(page.getByRole('heading', { name: /კონკურსი/ })).toBeVisible();
  });

  test('administrator access is independent of participant registration completion', async ({
    page,
  }) => {
    const user = await createAccount(
      `administrator-${Date.now()}@example.test`,
      true,
      'administrator',
    );
    await page.goto('/login');
    await page.getByLabel('ელფოსტა').fill(user.email!);
    await page.getByLabel('პაროლი', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'შესვლა' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'ადმინისტრირება' })).toBeVisible();
  });
});
