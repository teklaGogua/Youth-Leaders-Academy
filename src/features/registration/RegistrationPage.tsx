import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Json, LegalDocument, ParticipantRegistration } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import {
  educationSchema,
  emptyRegistrationForm,
  guardianSchema,
  legalAgreementsSchema,
  personalInformationSchema,
  type RegistrationFormValues,
} from './registration.schemas';
import styles from './RegistrationPage.module.scss';

const steps = ['პირადი ინფორმაცია', 'განათლება', 'მშობელი / მეურვე', 'სამართლებრივი შეთანხმებები'];

function Field({
  name, label, value, onChange, type = 'text', multiline = false,
}: {
  name: string; label: string; value: string; onChange: (value: string) => void;
  type?: string; multiline?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {multiline ? (
        <textarea name={name} value={value} onChange={(event) => onChange(event.target.value)} rows={4} required />
      ) : (
        <input name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
      )}
    </label>
  );
}

function Checkbox({
  checked, onChange, children,
}: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function mapRegistration(row: ParticipantRegistration): RegistrationFormValues {
  return {
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    age: row.age?.toString() ?? '',
    biography: row.biography ?? '',
    school: row.school ?? '',
    grade: row.grade ?? '',
    teacherName: row.teacher_name ?? '',
    guardianFullName: row.guardian_full_name ?? '',
    guardianPhone: row.guardian_phone ?? '',
    guardianEmail: row.guardian_email ?? '',
    termsAccepted: Boolean(row.terms_accepted_at),
    privacyAccepted: Boolean(row.privacy_accepted_at),
  };
}

export function RegistrationPage() {
  const { step: stepParam } = useParams();
  const navigate = useNavigate();
  const step = Number(stepParam);
  const [form, setForm] = useState<RegistrationFormValues>(emptyRegistrationForm);
  const [registration, setRegistration] = useState<ParticipantRegistration | null>(null);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      const [registrationResult, documentsResult] = await Promise.all([
        supabase.from('participant_registrations').select('*').maybeSingle(),
        supabase.from('legal_documents')
          .select('*')
          .eq('is_current', true)
          .order('document_type'),
      ]);
      if (!active) return;
      if (registrationResult.error || documentsResult.error) {
        setError('რეგისტრაციის მონაცემების ჩატვირთვა ვერ მოხერხდა.');
      } else {
        const row = registrationResult.data;
        if (row) {
          setRegistration(row);
          setForm(mapRegistration(row));
        }
        setDocuments(documentsResult.data ?? []);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const terms = useMemo(() => documents.find((document) => document.document_type === 'terms'), [documents]);
  const privacy = useMemo(() => documents.find((document) => document.document_type === 'privacy'), [documents]);
  const legalDocumentsApproved = Boolean(terms?.approved_at && privacy?.approved_at);

  function update<K extends keyof RegistrationFormValues>(key: K, value: RegistrationFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) {
      setError('სისტემასთან კავშირი ამჟამად მიუწვდომელია.');
      return;
    }

    const schema = step === 1
      ? personalInformationSchema
      : step === 2
        ? educationSchema
        : step === 3
          ? guardianSchema
          : legalAgreementsSchema;
    const result = schema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'შეამოწმეთ შეყვანილი ინფორმაცია.');
      return;
    }

    let payload: Json;
    if (step === 1) {
      payload = {
        firstName: form.firstName, lastName: form.lastName,
        age: Number(form.age), biography: form.biography,
      };
    } else if (step === 2) {
      payload = { school: form.school, grade: form.grade, teacherName: form.teacherName };
    } else if (step === 3) {
      payload = {
        guardianFullName: form.guardianFullName,
        guardianPhone: form.guardianPhone,
        guardianEmail: form.guardianEmail,
      };
    } else {
      if (!terms || !privacy) {
        setError('სამართლებრივი დოკუმენტები ამჟამად მიუწვდომელია.');
        return;
      }
      payload = {
        termsAccepted: form.termsAccepted,
        privacyAccepted: form.privacyAccepted,
        termsVersion: terms.version,
        privacyVersion: privacy.version,
      };
    }

    setSaving(true);
    try {
      const { error: saveError } = await supabase.rpc('save_participant_registration_step', {
        p_step: step,
        p_payload: payload,
      });
      if (saveError) throw saveError;

      if (step < 3) {
        navigate('/registration/' + (step + 1));
        return;
      }
      if (step === 3) {
        setMessage('მონაცემები შენახულია. ახლა მშობელმა/მეურვემ უნდა დაადასტუროს ელფოსტა და ცალკე გამოხატოს თანხმობა.');
        const { data } = await supabase.from('participant_registrations').select('*').maybeSingle();
        if (data) setRegistration(data);
        return;
      }
      const { error: completeError } = await supabase.rpc('complete_participant_registration');
      if (completeError) throw completeError;
      navigate('/dashboard', { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'მონაცემების შენახვა ვერ მოხერხდა.');
    } finally {
      setSaving(false);
    }
  }

  async function sendGuardianEmail() {
    if (!supabase) return;
    setError('');
    setMessage('');
    setSaving(true);
    const { error: sendError } = await supabase.functions.invoke('guardian-verification', {
      body: { action: 'send' },
    });
    if (sendError) setError('დადასტურების წერილის გაგზავნა ვერ მოხერხდა. შეამოწმეთ ელფოსტა და სცადეთ მოგვიანებით.');
    else setMessage('მშობლის/მეურვის ელფოსტაზე გაიგზავნა ბმული. ელფოსტის დადასტურება და მშობლის თანხმობა ცალ-ცალკე ფიქსირდება.');
    setSaving(false);
  }

  if (loading) return <p role="status">რეგისტრაციის მონაცემები იტვირთება…</p>;
  if (!supabase) return <p role="alert">სისტემასთან კავშირი ამჟამად მიუწვდომელია.</p>;
  if (step < 1 || step > 4) return <p role="alert">რეგისტრაციის ნაბიჯი არასწორია.</p>;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.back} to="/dashboard">პირად კაბინეტზე დაბრუნება</Link>
        <p className={styles.eyebrow}>რეგისტრაცია · ნაბიჯი {step} / 4</p>
        <h1>{steps[step - 1]}</h1>
        <div className={styles.progress} aria-label="რეგისტრაციის პროგრესი">
          {steps.map((label, index) => (
            <span key={label} className={index + 1 <= step ? styles.active : ''} />
          ))}
        </div>

        <form onSubmit={(event) => void saveStep(event)}>
          {step === 1 && (
            <>
              <Field name="firstName" label="სახელი" value={form.firstName} onChange={(value) => update('firstName', value)} />
              <Field name="lastName" label="გვარი" value={form.lastName} onChange={(value) => update('lastName', value)} />
              <Field name="age" label="ასაკი" type="number" value={form.age} onChange={(value) => update('age', value)} />
              <Field name="biography" label="მოკლე ბიოგრაფია" multiline value={form.biography} onChange={(value) => update('biography', value)} />
            </>
          )}
          {step === 2 && (
            <>
              <Field name="school" label="სკოლა" value={form.school} onChange={(value) => update('school', value)} />
              <Field name="grade" label="კლასი" value={form.grade} onChange={(value) => update('grade', value)} />
              <Field name="teacherName" label="მასწავლებლის სახელი და გვარი" value={form.teacherName} onChange={(value) => update('teacherName', value)} />
            </>
          )}
          {step === 3 && (
            <>
              <p className={styles.hint}>მშობლის ან მეურვის მითითება სავალდებულოა ყველა მონაწილისთვის, ასაკის მიუხედავად.</p>
              <Field name="guardianFullName" label="მშობლის / მეურვის სრული სახელი" value={form.guardianFullName} onChange={(value) => update('guardianFullName', value)} />
              <Field name="guardianPhone" label="ტელეფონის ნომერი" type="tel" value={form.guardianPhone} onChange={(value) => update('guardianPhone', value)} />
              <Field name="guardianEmail" label="ელფოსტა" type="email" value={form.guardianEmail} onChange={(value) => update('guardianEmail', value)} />
              {registration?.guardian_verified_at && (
                <p className={styles.success}>მშობლის ელფოსტა დადასტურებულია.</p>
              )}
              {registration?.parental_consent_at && (
                <p className={styles.success}>მშობლის/მეურვის ცალკე თანხმობა მიღებულია.</p>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <p className={styles.hint}>ელფოსტის დადასტურება თავისთავად არ ნიშნავს მშობლის თანხმობას. მშობლის თანხმობა ცალკე უნდა დაადასტუროს მშობელმა/მეურვემ.</p>
              {[terms, privacy].map((document) => document && (
                <article className={styles.document} key={document.document_type}>
                  <h2>{document.title}</h2>
                  <p className={styles.version}>ვერსია: {document.version}</p>
                  {!document.approved_at && <p className={styles.warning}>ორგანიზაციის მიერ ჯერ არ არის დამტკიცებული — დროებითი placeholder.</p>}
                  <p>{document.content}</p>
                </article>
              ))}
              <Checkbox checked={form.termsAccepted} onChange={(value) => update('termsAccepted', value)}>
                ვადასტურებ Terms and Conditions-ის გაცნობას და ვეთანხმები მითითებულ ვერსიას.
              </Checkbox>
              <Checkbox checked={form.privacyAccepted} onChange={(value) => update('privacyAccepted', value)}>
                ვადასტურებ Privacy Policy-ის გაცნობას და ვეთანხმები მითითებულ ვერსიას.
              </Checkbox>
              {!registration?.parental_consent_at && (
                <p className={styles.warning}>დასრულებამდე მშობელმა/მეურვემ უნდა გამოხატოს ცალკე, მკაფიო თანხმობა ელფოსტით მიღებულ ბმულზე.</p>
              )}
              {!legalDocumentsApproved && (
                <p className={styles.warning}>რეგისტრაციის დასრულება შეუძლებელია, სანამ ორგანიზაცია არ დაამტკიცებს სამართლებრივ დოკუმენტებს.</p>
              )}
            </>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && <p className={styles.success} role="status">{message}</p>}
          {step === 3 && (
            <button className={styles.secondary} type="button" onClick={() => void sendGuardianEmail()} disabled={saving || !form.guardianEmail}>
              {saving ? 'იგზავნება…' : 'მშობლისთვის დადასტურების ბმულის გაგზავნა / ხელახლა გაგზავნა'}
            </button>
          )}
          <div className={styles.actions}>
            {step > 1 && <button type="button" className={styles.secondary} onClick={() => navigate('/registration/' + (step - 1))}>უკან</button>}
            <button className={styles.primary} type="submit" disabled={saving || (step === 4 && !legalDocumentsApproved)}>
              {saving ? 'ინახება…' : step === 4 ? 'რეგისტრაციის დასრულება' : 'შენახვა და გაგრძელება'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export function GuardianVerificationPage() {
  const navigate = useNavigate();
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token || !supabase) {
      setError('დადასტურების ბმული არასწორია ან ვადაგასულია.');
    }
    setLoading(false);
  }, []);

  async function confirm() {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token || !supabase) return;
    setSubmitting(true);
    setError('');
    const { data, error: verifyError } = await supabase.functions.invoke('guardian-verification', {
      body: { action: 'verify', token, parentalConsent: consent },
    });
    if (verifyError || !data?.verified) {
      setError('ბმული არასწორია, ვადაგასულია ან უკვე გამოყენებულია. სთხოვეთ მონაწილეს ახალი ბმულის გამოგზავნა.');
    } else {
      setVerified(true);
    }
    setSubmitting(false);
  }

  if (loading) return <p role="status">ბმული მოწმდება…</p>;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Youth Leaders Academy</p>
        <h1>მშობლის / მეურვის დადასტურება</h1>
        {verified ? (
          <>
            <p className={styles.success}>ელფოსტა დადასტურებულია{consent ? ' და მშობლის/მეურვის თანხმობაც დაფიქსირდა.' : '. მშობლის/მეურვის თანხმობა ჯერ არ არის გაცემული.'}</p>
            <button className={styles.primary} onClick={() => navigate(consent ? '/registration/4' : '/login')}>გაგრძელება</button>
          </>
        ) : (
          <>
            <p>ამ ბმულით დადასტურდება მშობლის/მეურვის ელფოსტის მისამართი. ეს თავისთავად არ ნიშნავს თანხმობას.</p>
            <Checkbox checked={consent} onChange={setConsent}>
              მე ვარ მითითებული მონაწილის მშობელი/კანონიერი მეურვე და ცალკე, მკაფიოდ ვადასტურებ თანხმობას მის Youth Leaders Academy-ში მონაწილეობაზე.
            </Checkbox>
            <p className={styles.hint}>თუ მხოლოდ ელფოსტის დადასტურება გსურთ, დატოვეთ ველი მონიშნულის გარეშე. თანხმობის გაცემა შესაძლებელია მოგვიანებით ახალი ბმულის მოთხოვნით.</p>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={styles.primary} onClick={() => void confirm()} disabled={submitting}>
              {submitting ? 'მუშავდება…' : consent ? 'ელფოსტის დადასტურება და თანხმობის გაცემა' : 'მხოლოდ ელფოსტის დადასტურება'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
