import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isGuardianAction,
  isGuardianDecision,
  isGuardianToken,
  isValidGuardianEmail,
} from './logic.ts';

const siteUrl = Deno.env.get('SITE_URL');
const corsHeaders = {
  'Access-Control-Allow-Origin': siteUrl ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

function randomToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Invalid request body' }, 400);
  }
  const body = payload as Record<string, unknown>;

  const { action, token, decision } = body;
  if (!isGuardianAction(action)) {
    return json({ error: 'Unsupported action' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Server configuration is incomplete' }, 500);

  const admin = createClient(url, key, { auth: { persistSession: false } });

  if (action === 'validate' || action === 'decide') {
    if (!isGuardianToken(token)) {
      return json({ error: 'Invalid verification token' }, 400);
    }
    if (action === 'decide' && !isGuardianDecision(decision)) {
      return json({ error: 'A valid guardian decision is required' }, 400);
    }

    const tokenHash = await sha256(token);
    if (action === 'validate') {
      const { data, error } = await admin.rpc('validate_guardian_decision_token', {
        p_token_hash: tokenHash,
      });
      if (error) return json({ error: 'Guardian decision could not be processed' }, 500);
      if (!data) return json({ error: 'This link is invalid, expired or already used' }, 400);
      return json({ valid: true });
    }

    const versions = {
      p_terms_version: body.termsVersion,
      p_privacy_version: body.privacyVersion,
      p_guardian_consent_version: body.guardianConsentVersion,
    };
    if (
      decision === 'agree' &&
      Object.values(versions).some(
        (version) => typeof version !== 'string' || !version.trim(),
      )
    ) {
      return json({ error: 'Review all current legal documents before agreeing' }, 400);
    }
    const { data, error } = await admin.rpc('confirm_guardian_decision', {
      p_token_hash: tokenHash,
      p_agree: decision === 'agree',
      ...versions,
    });
    if (error) return json({ error: 'Guardian decision could not be processed' }, 500);
    if (data === 'stale') {
      return json({ stale: true, error: 'Legal documents changed. Review the current versions.' });
    }
    if (data !== 'success') {
      return json({ error: 'This link is invalid, expired or already used' }, 400);
    }
    return json({ success: true, decision });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'Authentication required' }, 401);
  }

  const { data: authData, error: authError } = await admin.auth.getUser(
    authorization.slice('Bearer '.length),
  );
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);
  const userId = authData.user.id;

  if (body.participantId !== userId || body.registrationId !== userId) {
    return json(
      { error: 'Participant or registration does not match the authenticated user' },
      403,
    );
  }

  const { data: registration, error: registrationError } = await admin
    .from('participant_registrations')
    .select(
      'guardian_full_name, guardian_phone, guardian_email, guardian_verified_at, ' +
        'guardian_verified_email, parental_consent_at, parental_consent_terms_version, ' +
        'parental_consent_privacy_version, parental_consent_version, step_3_completed_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (registrationError) return json({ error: 'Could not read guardian information' }, 500);
  if (
    !registration?.step_3_completed_at ||
    !registration.guardian_full_name ||
    registration.guardian_full_name.trim().length < 3 ||
    !registration.guardian_phone ||
    registration.guardian_phone.trim().length < 6 ||
    !isValidGuardianEmail(registration.guardian_email)
  ) {
    return json({ error: 'Save valid guardian information before requesting a link' }, 400);
  }

  const { data: currentDocuments, error: documentsError } = await admin
    .from('legal_documents')
    .select('document_type, version')
    .eq('is_current', true)
    .in('document_type', ['terms', 'privacy', 'guardian_consent']);
  if (documentsError) return json({ error: 'Could not verify current legal documents' }, 500);
  const currentVersions = new Map(
    (currentDocuments ?? []).map((document) => [document.document_type, document.version]),
  );
  const consentIsCurrent =
    registration.parental_consent_at &&
    registration.parental_consent_terms_version === currentVersions.get('terms') &&
    registration.parental_consent_privacy_version === currentVersions.get('privacy') &&
    registration.parental_consent_version === currentVersions.get('guardian_consent');

  if (
    registration.guardian_verified_at &&
    registration.guardian_verified_email === registration.guardian_email &&
    consentIsCurrent
  ) {
    return json({ sent: false, alreadyCompleted: true });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('GUARDIAN_VERIFICATION_FROM');
  if (!resendKey || !from || !siteUrl) {
    return json({ error: 'Guardian email delivery is not configured on the server' }, 503);
  }

  let link: URL;
  try {
    link = new URL('/guardian-verification', siteUrl);
    if (link.protocol !== 'https:' && link.protocol !== 'http:') {
      return json({ error: 'SITE_URL must use HTTP or HTTPS' }, 503);
    }
  } catch {
    return json({ error: 'SITE_URL is invalid' }, 503);
  }

  const { count, error: countError } = await admin
    .from('guardian_verification_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

  if (countError) return json({ error: 'Could not check email request limits' }, 500);
  if ((count ?? 0) >= 3) {
    return json({ error: 'Too many requests. Try again in 15 minutes.' }, 429);
  }

  const newToken = randomToken();
  const tokenHash = await sha256(newToken);
  link.hash = new URLSearchParams({ token: newToken }).toString();

  const { error: revokeError } = await admin
    .from('guardian_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null);

  if (revokeError) return json({ error: 'Could not prepare a new link' }, 500);

  const { error: insertError } = await admin.from('guardian_verification_tokens').insert({
    user_id: userId,
    guardian_email: registration.guardian_email,
    token_hash: tokenHash,
    purpose: 'verification',
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  if (insertError) return json({ error: 'Could not create guardian link' }, 500);

  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from,
        to: [registration.guardian_email],
        subject: 'Youth Leaders Academy — confirm your guardian decision',
        text: [
          'A participant entered this address as their parent or guardian contact.',
          'Review the documents, then choose Agree or Reject using this link:',
          link.toString(),
          'This single-use link expires in 30 minutes. Opening it does not record consent.',
        ].join('\n\n'),
      }),
    });

    if (emailResponse.ok) {
      return json({ sent: true });
    }
  } catch {
    console.error('Guardian email delivery request failed');
  }

  const { error: cleanupError } = await admin
    .from('guardian_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('used_at', null);

  if (cleanupError) console.error('Could not revoke guardian link after delivery failure');
  return json({ error: 'The guardian email could not be sent' }, 502);
});
