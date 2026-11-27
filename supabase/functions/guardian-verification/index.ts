import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Server configuration is incomplete' }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  let body: { action?: string; token?: string; decision?: string; participantId?: string; registrationId?: string };
  try { body = await request.json(); } catch { return json({ error: 'Invalid request body' }, 400); }

  if (body.action === 'validate' || body.action === 'decide') {
    if (!body.token || body.token.length < 32 || body.token.length > 256) return json({ error: 'Invalid verification token' }, 400);
    if (body.action === 'decide' && body.decision !== 'agree' && body.decision !== 'reject') return json({ error: 'A valid guardian decision is required' }, 400);
    const tokenHash = await sha256(body.token);
    const rpc = body.action === 'validate' ? 'validate_guardian_decision_token' : 'confirm_guardian_decision';
    const args = body.action === 'validate' ? { p_token_hash: tokenHash } : { p_token_hash: tokenHash, p_agree: body.decision === 'agree' };
    const { data, error } = await admin.rpc(rpc, args);
    if (error) return json({ error: 'Guardian decision could not be processed' }, 500);
    if (!data) return json({ error: 'This link is invalid, expired or already used' }, 400);
    return json(body.action === 'validate' ? { valid: true } : { success: true, decision: body.decision });
  }

  if (body.action !== 'send') return json({ error: 'Unsupported action' }, 400);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);
  const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice('Bearer '.length));
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);
  const userId = authData.user.id;
  if (!body.participantId || !body.registrationId || body.participantId !== userId || body.registrationId !== userId)
    return json({ error: 'Participant or registration does not match the authenticated user' }, 403);

  const { data: registration, error: registrationError } = await admin.from('participant_registrations')
    .select('user_id, guardian_full_name, guardian_phone, guardian_email, guardian_verified_at, guardian_verified_email, parental_consent_at, parental_consent_rejected_at, step_3_completed_at')
    .eq('user_id', userId).maybeSingle();
  const valid = Boolean(registration && registration.user_id === userId && registration.step_3_completed_at &&
    registration.guardian_full_name && registration.guardian_full_name.trim().length >= 3 && registration.guardian_phone && registration.guardian_phone.trim().length >= 6 &&
    registration.guardian_email && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$/i.test(registration.guardian_email));
  if (registrationError || !valid) return json({ error: 'Save valid guardian information before requesting a link' }, 400);
  if (registration.guardian_verified_at && registration.guardian_verified_email === registration.guardian_email && registration.parental_consent_at)
    return json({ sent: false, alreadyCompleted: true });

  const { count, error: countError } = await admin.from('guardian_verification_tokens')
    .select('id', { count: 'exact', head: true }).eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
  if (countError) return json({ error: 'Could not check email request limits' }, 500);
  if ((count ?? 0) >= 3) return json({ error: 'Too many requests. Try again in 15 minutes.' }, 429);

  const token = randomToken();
  const tokenHash = await sha256(token);
  const { error: revokeError } = await admin.from('guardian_verification_tokens').update({ used_at: new Date().toISOString() }).eq('user_id', userId).is('used_at', null);
  if (revokeError) return json({ error: 'Could not prepare a new link' }, 500);
  const { error: insertError } = await admin.from('guardian_verification_tokens').insert({
    user_id: userId, guardian_email: registration.guardian_email, token_hash: tokenHash,
    purpose: 'verification', expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (insertError) return json({ error: 'Could not create guardian link' }, 500);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('GUARDIAN_VERIFICATION_FROM');
  const siteUrl = Deno.env.get('SITE_URL');
  if (!resendKey || !from || !siteUrl) {
    await admin.from('guardian_verification_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash);
    return json({ error: 'Guardian email delivery is not configured on the server' }, 503);
  }
  const link = new URL('/guardian-verification', siteUrl);
  link.hash = new URLSearchParams({ token }).toString();
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [registration.guardian_email],
      subject: 'Youth Leaders Academy — confirm your email and guardian decision',
      html: '<p>A participant has entered this address as their parent/guardian contact.</p>' +
        '<p>Please review the current Terms and Conditions and Privacy Policy, then explicitly agree or reject participation:</p>' +
        '<p><a href="' + link.toString() + '">Review and make your guardian decision</a></p>' +
        '<p>This secure link is single-use and expires in 30 minutes. Opening the link does not record consent; only selecting Agree does.</p>',
    }),
  });
  if (!emailResponse.ok) {
    await admin.from('guardian_verification_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash);
    return json({ error: 'The guardian email could not be sent' }, 502);
  }
  return json({ sent: true });
});
