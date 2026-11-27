import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Server configuration is incomplete' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let body: { action?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (body.action === 'verify') {
    if (!body.token || body.token.length < 32 || body.token.length > 256) {
      return json({ error: 'Invalid verification token' }, 400);
    }
    const { data, error } = await admin.rpc('confirm_guardian_verification', {
      p_token_hash: await sha256(body.token),
    });
    if (error) return json({ error: 'Verification could not be completed' }, 500);
    if (!data) return json({ error: 'This verification link is invalid, expired or already used' }, 400);
    return json({ verified: true });
  }

  if (body.action !== 'send') return json({ error: 'Unsupported action' }, 400);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

  const jwt = authorization.slice('Bearer '.length);
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);
  const userId = authData.user.id;

  const { data: registration, error: registrationError } = await admin
    .from('participant_registrations')
    .select('guardian_email, guardian_verified_at, step_3_completed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (registrationError || !registration?.guardian_email || !registration.step_3_completed_at) {
    return json({ error: 'Save valid guardian information before requesting verification' }, 400);
  }
  if (registration.guardian_verified_at) return json({ verified: true, alreadyVerified: true });

  const { count, error: countError } = await admin
    .from('guardian_verification_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
  if (countError) return json({ error: 'Could not check verification limits' }, 500);
  if ((count ?? 0) >= 3) return json({ error: 'Too many requests. Try again in 15 minutes.' }, 429);

  const token = randomToken();
  const tokenHash = await sha256(token);
  const { error: revokeError } = await admin
    .from('guardian_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null);
  if (revokeError) return json({ error: 'Could not prepare a new verification link' }, 500);

  const { error: insertError } = await admin.from('guardian_verification_tokens').insert({
    user_id: userId,
    guardian_email: registration.guardian_email,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (insertError) return json({ error: 'Could not create verification link' }, 500);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('GUARDIAN_VERIFICATION_FROM');
  const siteUrl = Deno.env.get('SITE_URL');
  if (!resendKey || !from || !siteUrl) {
    await admin.from('guardian_verification_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash);
    return json({ error: 'Guardian email delivery is not configured on the server' }, 503);
  }

  const verifyUrl = new URL('/guardian-verification', siteUrl);
  verifyUrl.searchParams.set('token', token);
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [registration.guardian_email],
      subject: 'Youth Leaders Academy — guardian email verification',
      html: '<p>A participant has entered this address as their parent/guardian contact.</p>' +
        '<p>Open this link within 30 minutes to verify the email address:</p>' +
        '<p><a href="' + verifyUrl.toString() + '">Verify guardian email</a></p>' +
        '<p>Email verification is not parental consent. Consent is collected separately during registration.</p>',
    }),
  });
  if (!emailResponse.ok) {
    await admin.from('guardian_verification_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash);
    return json({ error: 'The verification email could not be sent' }, 502);
  }
  return json({ sent: true });
});
