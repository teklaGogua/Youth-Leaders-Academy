import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
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
import { useAuth } from '../auth/AuthProvider';
import { registrationSchema } from '../auth/auth.schemas';
import { getNextRegistrationStep } from './registration.progress';
import {
  getGuardianDocumentVersions,
  saveGuardianBeforeVerification,
} from './guardian-verification';

const steps = ['პირადი ინფორმაცია', 'განათლება', 'მშობელი / მეურვე', 'სამართლებრივი შეთანხმებები'];

function Field({
  name,
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          required
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
      )}
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
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
  const navigate = useNavigate();
  const { user, role, loading: authLoading, profileError, configured, signUp, signOut } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [accountFirstName, setAccountFirstName] = useState('');
  const [accountLastName, setAccountLastName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirmation, setAccountPasswordConfirmation] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [form, setForm] = useState<RegistrationFormValues>(emptyRegistrationForm);
  const [registration, setRegistration] = useState<ParticipantRegistration | null>(null);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refreshRegistration() {
    if (!supabase) return;
    const { data, error: loadError } = await supabase
      .from('participant_registrations')
      .select('*')
      .maybeSingle();
    if (loadError) {
      setError('რეგისტრაციის მონაცემების განახლება ვერ მოხერხდა.');
      return;
    }
    if (data) {
      setRegistration(data);
      setForm(mapRegistration(data));
      setStep(getNextRegistrationStep(data));
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user || !supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [registrationResult, documentsResult] = await Promise.all([
        supabase.from('participant_registrations').select('*').maybeSingle(),
        supabase.from('legal_documents').select('*').eq('is_current', true).order('document_type'),
      ]);
      if (!active) return;
      if (registrationResult.error || documentsResult.error) {
        setError('რეგისტრაციის მონაცემების ჩატვირთვა ვერ მოხერხდა.');
      } else {
        if (registrationResult.data) {
          setRegistration(registrationResult.data);
          setForm(mapRegistration(registrationResult.data));
          setStep(getNextRegistrationStep(registrationResult.data));
        } else {
          const fullName = String(user.user_metadata.full_name ?? '')
            .trim()
            .split(/\s+/);
          setForm({
            ...emptyRegistrationForm,
            firstName: fullName[0] ?? '',
            lastName: fullName.slice(1).join(' '),
          });
          setStep(1);
        }
        setDocuments(documentsResult.data ?? []);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const terms = useMemo(
    () => documents.find((document) => document.document_type === 'terms'),
    [documents],
  );
  const privacy = useMemo(
    () => documents.find((document) => document.document_type === 'privacy'),
    [documents],
  );
  const legalDocumentsAvailable = Boolean(terms && privacy);
  const guardianDetailsSaved = Boolean(
    registration?.step_3_completed_at &&
      registration.guardian_full_name === form.guardianFullName.trim() &&
      registration.guardian_phone === form.guardianPhone.trim() &&
      registration.guardian_email === form.guardianEmail.trim().toLowerCase(),
  );

  function update<K extends keyof RegistrationFormValues>(
    key: K,
    value: RegistrationFormValues[K],
  ) {
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

    const schema =
      step === 1
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
        firstName: form.firstName,
        lastName: form.lastName,
        age: Number(form.age),
        biography: form.biography,
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
        setStep((step + 1) as 1 | 2 | 3 | 4);
        await refreshRegistration();
        return;
      }
      await refreshRegistration();
      if (step === 3) {
        setMessage(
          'მონაცემები შენახულია. მშობელს/მეურვეს გაეგზავნება ერთი ბმული, სადაც შეძლებს ელფოსტის დადასტურებას და თანხმობის ან უარის გამოხატვას.',
        );
        return;
      }

      const { data: saved } = await supabase
        .from('participant_registrations')
        .select('*')
        .maybeSingle();
      if (
        saved?.parental_consent_at &&
        terms &&
        privacy &&
        saved.parental_consent_terms_version === terms.version &&
        saved.parental_consent_privacy_version === privacy.version
      ) {
        const { error: completeError } = await supabase.rpc('complete_participant_registration');
        if (completeError) throw completeError;
        navigate('/dashboard', { replace: true });
      } else {
        setMessage(
          'თქვენი შეთანხმებები შენახულია. რეგისტრაციის დასასრულებლად საჭიროა მშობლის/მეურვის თანხმობა ერთი ელფოსტის ბმულიდან.',
        );
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'მონაცემების შენახვა ვერ მოხერხდა.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendGuardianEmail() {
    const client = supabase;
    if (!client || !user) return;
    setError('');
    setMessage('');
    setSaving(true);
    const result = await saveGuardianBeforeVerification(form, {
      participantId: user.id,
      saveGuardian: async (guardian) => {
        const { error: saveError } = await client.rpc('save_participant_registration_step', {
          p_step: 3,
          p_payload: guardian,
        });
        return { error: saveError?.message ?? null };
      },
      loadRegistration: async () => {
        const { data, error: loadError } = await client
          .from('participant_registrations')
          .select(
            'user_id, guardian_full_name, guardian_phone, guardian_email, step_3_completed_at',
          )
          .eq('user_id', user.id)
          .maybeSingle();
        return { data, error: loadError?.message ?? null };
      },
      requestVerification: async (identifiers) => {
        const { error: requestError } = await client.functions.invoke('guardian-verification', {
          body: { action: 'send', ...identifiers },
        });
        return { error: requestError?.message ?? null };
      },
    });
    if (result.status === 'sent' || result.status === 'request_failed') await refreshRegistration();
    if (result.status === 'sent') {
      setMessage(
        'მშობლის/მეურვის ელფოსტაზე გაიგზავნა ერთი ბმული ელფოსტის დასადასტურებლად და თანხმობის ან უარის გამოსახატავად.',
      );
    } else if (result.status === 'invalid') {
      setError(result.message);
    } else if (result.status === 'save_failed') {
      setError(
        'მშობლის/მეურვის მონაცემების შენახვა ვერ მოხერხდა. გადაამოწმეთ ველები და სცადეთ ხელახლა.',
      );
    } else if (result.status === 'read_failed' || result.status === 'saved_record_mismatch') {
      setError(
        'შენახული მშობლის/მეურვის მონაცემების დადასტურება ვერ მოხერხდა. ხელახლა სცადეთ შენახვა.',
      );
    } else {
      setError('დადასტურების წერილის გაგზავნა ვერ მოხერხდა. სცადეთ მოგვიანებით.');
    }
    setSaving(false);
  }

  async function leaveUnavailableProfile() {
    try {
      await signOut();
      navigate('/registration', { replace: true });
    } catch {
      setAccountError('სესიიდან გამოსვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountError('');
    setAccountMessage('');
    const result = registrationSchema.safeParse({
      firstName: accountFirstName,
      lastName: accountLastName,
      email: accountEmail,
      password: accountPassword,
      passwordConfirmation: accountPasswordConfirmation,
    });
    if (!result.success) {
      setAccountError(result.error.issues[0]?.message ?? 'შეამოწმეთ შეყვანილი ინფორმაცია.');
      return;
    }
    setAccountSubmitting(true);
    try {
      const requiresConfirmation = await signUp(
        result.data.firstName + ' ' + result.data.lastName,
        result.data.email,
        result.data.password,
      );
      setAccountMessage(
        requiresConfirmation
          ? 'ანგარიში შეიქმნა. რეგისტრაციის გასაგრძელებლად შეამოწმეთ ელფოსტა და დაადასტურეთ მისამართი. ' +
              'ბმული დაგაბრუნებთ ამავე რეგისტრაციის გვერდზე.'
          : 'ანგარიში შეიქმნა. იტვირთება თქვენი რეგისტრაცია…',
      );
    } catch (createError) {
      setAccountError(
        createError instanceof Error
          ? createError.message
          : 'ანგარიშის შექმნა ვერ მოხერხდა. სცადეთ ხელახლა.',
      );
    } finally {
      setAccountSubmitting(false);
    }
  }

  if (authLoading) return <p role="status">მონაცემები იტვირთება…</p>;
  if (!user) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>Youth Leaders Academy · რეგისტრაცია</p>
          <h1>ანგარიშის შექმნა</h1>
          <p className={styles.hint}>
            შექმენით ანგარიში. ელფოსტის დადასტურების შემდეგ ამავე გვერდზე გააგრძელებთ მონაწილის
            რეგისტრაციას.
          </p>
          {!configured && (
            <p className={styles.error} role="alert">
              სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.
            </p>
          )}
          <form onSubmit={(event) => void createAccount(event)}>
            <Field
              name="firstName"
              label="სახელი"
              value={accountFirstName}
              onChange={setAccountFirstName}
            />
            <Field
              name="lastName"
              label="გვარი"
              value={accountLastName}
              onChange={setAccountLastName}
            />
            <Field
              name="email"
              label="ელფოსტა"
              type="email"
              value={accountEmail}
              onChange={setAccountEmail}
            />
            <Field
              name="password"
              label="პაროლი"
              type="password"
              value={accountPassword}
              onChange={setAccountPassword}
            />
            <Field
              name="passwordConfirmation"
              label="გაიმეორეთ პაროლი"
              type="password"
              value={accountPasswordConfirmation}
              onChange={setAccountPasswordConfirmation}
            />
            {accountError && (
              <p className={styles.error} role="alert">
                {accountError}
              </p>
            )}
            {accountMessage && (
              <p className={styles.success} role="status">
                {accountMessage}
              </p>
            )}
            <div className={styles.actions}>
              <button
                className={styles.primary}
                type="submit"
                disabled={!configured || accountSubmitting}
              >
                {accountSubmitting ? 'მიმდინარეობს რეგისტრაცია…' : 'ანგარიშის შექმნა'}
              </button>
              <Link className={styles.secondary} to="/login">
                უკვე გაქვთ ანგარიში? შესვლა
              </Link>
            </div>
          </form>
        </section>
      </main>
    );
  }
  if (!configured) return <p role="alert">სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.</p>;
  if (role === 'administrator') return <Navigate to="/admin" replace />;
  if (profileError || !role) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>Youth Leaders Academy · ანგარიშის აღდგენა</p>
          <h1>პროფილის აღდგენა საჭიროა</h1>
          <p className={styles.hint} role="alert">
            ეს ანგარიში ავტორიზებულია, მაგრამ მისი მომხმარებლის პროფილი ვერ მოიძებნა ან დროებით
            მიუწვდომელია. უსაფრთხოების მიზნით სისტემას არ შეუძლია როლის გამოცნობა ან ახალი პროფილის
            ავტომატურად შექმნა. რეგისტრაციის გასაგრძელებლად გამოდით ამ სესიიდან და სცადეთ სხვა
            ანგარიში, ან დაუკავშირდით მხარდაჭერას არსებული ანგარიშის აღსადგენად.
          </p>
          {accountError && (
            <p className={styles.error} role="alert">
              {accountError}
            </p>
          )}
          <div className={styles.actions}>
            <button
              className={styles.primary}
              type="button"
              onClick={() => void leaveUnavailableProfile()}
            >
              სესიიდან გამოსვლა
            </button>
            <Link className={styles.secondary} to="/login">
              შესვლის გვერდი
            </Link>
          </div>
        </section>
      </main>
    );
  }
  if (!supabase) return <p role="alert">სისტემასთან კავშირი ამჟამად მიუწვდომელია.</p>;
  if (loading) return <p role="status">რეგისტრაციის მონაცემები იტვირთება…</p>;
  if (registration?.completed_at) return <Navigate to="/dashboard" replace />;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
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
              <Field
                name="firstName"
                label="სახელი"
                value={form.firstName}
                onChange={(value) => update('firstName', value)}
              />
              <Field
                name="lastName"
                label="გვარი"
                value={form.lastName}
                onChange={(value) => update('lastName', value)}
              />
              <Field
                name="age"
                label="ასაკი"
                type="number"
                value={form.age}
                onChange={(value) => update('age', value)}
              />
              <Field
                name="biography"
                label="მოკლე ბიოგრაფია"
                multiline
                value={form.biography}
                onChange={(value) => update('biography', value)}
              />
            </>
          )}
          {step === 2 && (
            <>
              <Field
                name="school"
                label="სკოლა"
                value={form.school}
                onChange={(value) => update('school', value)}
              />
              <Field
                name="grade"
                label="კლასი"
                value={form.grade}
                onChange={(value) => update('grade', value)}
              />
              <Field
                name="teacherName"
                label="მასწავლებლის სახელი და გვარი"
                value={form.teacherName}
                onChange={(value) => update('teacherName', value)}
              />
            </>
          )}
          {step === 3 && (
            <>
              <p className={styles.hint}>
                მშობლის ან მეურვის მითითება სავალდებულოა ყველა მონაწილისთვის, ასაკის მიუხედავად.
              </p>
              <Field
                name="guardianFullName"
                label="მშობლის / მეურვის სრული სახელი"
                value={form.guardianFullName}
                onChange={(value) => update('guardianFullName', value)}
              />
              <Field
                name="guardianPhone"
                label="ტელეფონის ნომერი"
                type="tel"
                value={form.guardianPhone}
                onChange={(value) => update('guardianPhone', value)}
              />
              <Field
                name="guardianEmail"
                label="ელფოსტა"
                type="email"
                value={form.guardianEmail}
                onChange={(value) => update('guardianEmail', value)}
              />
              {registration?.guardian_verified_at ? (
                <p className={styles.success}>
                  {registration.parental_consent_at
                    ? 'მშობლის/მეურვის თანხმობა მიღებულია.'
                    : registration.parental_consent_rejected_at
                      ? 'მშობელმა/მეურვემ უარი განაცხადა. საჭიროების შემთხვევაში შეგიძლიათ ხელახლა გაუგზავნოთ გადაწყვეტილების ბმული.'
                      : 'მშობლის ელფოსტა დადასტურებულია; საჭიროა მისი მკაფიო თანხმობა ან უარი ელფოსტაზე გაგზავნილი ბმულიდან.'}
                </p>
              ) : registration?.step_3_completed_at ? (
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={() => void refreshRegistration()}
                  disabled={saving}
                >
                  მშობლის ელფოსტის დადასტურების სტატუსის შემოწმება
                </button>
              ) : null}
              {registration?.guardian_verified_at && !registration.parental_consent_at && (
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={() => void refreshRegistration()}
                  disabled={saving}
                >
                  მშობლის გადაწყვეტილების სტატუსის განახლება
                </button>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <p className={styles.hint}>
                მშობლის/მეურვის თანხმობა გაიცემა ერთი ბმულიდან, რომელიც ელფოსტაზე იგზავნება. ამ
                ნაბიჯზე თქვენ ეთანხმებით Terms and Conditions-სა და Privacy Policy-ს.
              </p>
              {[terms, privacy].map(
                (document) =>
                  document && (
                    <article className={styles.document} key={document.document_type}>
                      <h2>{document.title}</h2>
                      <p className={styles.version}>ვერსია: {document.version}</p>
                      {!document.approved_at && (
                        <p className={styles.warning}>
                          ორგანიზაციის მიერ ჯერ არ არის დამტკიცებული — დროებითი placeholder.
                        </p>
                      )}
                      <p>{document.content}</p>
                    </article>
                  ),
              )}
              <Checkbox
                checked={form.termsAccepted}
                onChange={(value) => update('termsAccepted', value)}
              >
                ვადასტურებ Terms and Conditions-ის გაცნობას და ვეთანხმები მითითებულ ვერსიას.
              </Checkbox>
              <Checkbox
                checked={form.privacyAccepted}
                onChange={(value) => update('privacyAccepted', value)}
              >
                ვადასტურებ Privacy Policy-ის გაცნობას და ვეთანხმები მითითებულ ვერსიას.
              </Checkbox>
              {registration?.parental_consent_at ? (
                <p className={styles.success}>მშობლის/მეურვის თანხმობა მიღებულია.</p>
              ) : (
                <p className={styles.warning}>
                  მშობლის/მეურვის პასუხი ჯერ არ მიუღია. რეგისტრაცია დასრულდება თანხმობის მიღების
                  შემდეგ.
                </p>
              )}
              {!terms?.approved_at || !privacy?.approved_at ? (
                <p className={styles.warning}>
                  სამართლებრივი დოკუმენტები დროებითი placeholder-ებია (ვერსია 0.1-placeholder) და
                  ორგანიზაციის მიერ ჯერ არ არის დამტკიცებული. დემო რეგისტრაცია ხელმისაწვდომია;
                  წარმოებაში გამოყენებამდე საჭიროა დამტკიცებული ტექსტები.
                </p>
              ) : null}
            </>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className={styles.success} role="status">
              {message}
            </p>
          )}
          {step === 3 && (
            <button
              className={styles.secondary}
              type="button"
              onClick={() => void sendGuardianEmail()}
              disabled={
                saving ||
                (Boolean(registration?.guardian_verified_at && registration?.parental_consent_at) &&
                  guardianDetailsSaved)
              }
            >
              {saving
                ? 'იგზავნება…'
                : 'მშობლისთვის დადასტურებისა და თანხმობის ბმულის გაგზავნა / ხელახლა გაგზავნა'}
            </button>
          )}
          <div className={styles.actions}>
            {step > 1 && (
              <button
                className={styles.secondary}
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
              >
                უკან
              </button>
            )}
            <button
              className={styles.primary}
              type="submit"
              disabled={saving || (step === 4 && !legalDocumentsAvailable)}
            >
              {saving
                ? 'ინახება…'
                : step === 4
                  ? 'რეგისტრაციის დასრულება'
                  : 'შენახვა და გაგრძელება'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export function GuardianVerificationPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<'agree' | 'reject' | null>(null);
  const [documentsNeedReview, setDocumentsNeedReview] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (!token || token.length < 32 || !supabase) {
        setError('ბმული არასწორია ან ვადაგასულია.');
        setLoading(false);
        return;
      }
      const [{ data: validation, error: validationError }, docs] = await Promise.all([
        supabase.functions.invoke('guardian-verification', { body: { action: 'validate', token } }),
        supabase.from('legal_documents').select('*').eq('is_current', true).order('document_type'),
      ]);
      if (!active) return;
      if (validationError || !validation?.valid) {
        setError('ბმული არასწორია, ვადაგასულია ან უკვე გამოყენებულია.');
      } else if (docs.error) {
        setError('სამართლებრივი დოკუმენტების ჩატვირთვა ვერ მოხერხდა.');
      } else {
        setDocuments(docs.data ?? []);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function submitDecision(value: 'agree' | 'reject') {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token || !supabase) return;
    setSubmitting(true);
    setError('');
    setDocumentsNeedReview(false);
    const { data, error: decisionError } = await supabase.functions.invoke(
      'guardian-verification',
      {
        body: {
          action: 'decide',
          token,
          decision: value,
          ...getGuardianDocumentVersions(documents),
        },
      },
    );
    if (data?.stale) {
      const { data: refreshedDocuments, error: refreshError } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('is_current', true)
        .order('document_type');
      if (refreshError) {
        setError('განახლებული სამართლებრივი დოკუმენტების ჩატვირთვა ვერ მოხერხდა.');
      } else {
        setDocuments(refreshedDocuments ?? []);
        setDocumentsNeedReview(true);
      }
    } else if (decisionError || !data?.success) {
      setError('ბმული არასწორია, ვადაგასულია ან უკვე გამოყენებულია.');
    } else {
      setDecision(value);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setSubmitting(false);
  }

  if (loading) return <p role="status">ბმული მოწმდება…</p>;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Youth Leaders Academy</p>
        <h1>მშობლის / მეურვის დადასტურება და თანხმობა</h1>
        {decision ? (
          <p className={decision === 'agree' ? styles.success : styles.warning} role="status">
            {decision === 'agree'
              ? 'ელფოსტა დადასტურდა და თქვენი თანხმობა დაფიქსირდა. მონაწილეს შეუძლია რეგისტრაციის გაგრძელება.'
              : 'თქვენი უარი დაფიქსირდა. მონაწილეს რეგისტრაციის დასრულება თანხმობის გარეშე არ შეუძლია.'}
          </p>
        ) : (
          <>
            <p>
              გთხოვთ, გაეცნოთ დოკუმენტებს. ამ ბმულით ერთდროულად დადასტურდება თქვენი ელფოსტა და
              დაფიქსირდება თქვენი მკაფიო გადაწყვეტილება.
            </p>
            {documents
              .filter(
                (document) =>
                  document.document_type === 'terms' ||
                  document.document_type === 'privacy' ||
                  document.document_type === 'guardian_consent',
              )
              .map((document) => (
                <article className={styles.document} key={document.document_type}>
                  <h2>{document.title}</h2>
                  <p className={styles.version}>ვერსია: {document.version}</p>
                  {!document.approved_at && (
                    <p className={styles.warning}>
                      დროებითი placeholder — ორგანიზაციის მიერ ჯერ არ არის დამტკიცებული.
                    </p>
                  )}
                  <p>{document.content}</p>
                </article>
              ))}
            {documentsNeedReview && (
              <p className={styles.warning} role="status">
                დოკუმენტების ვერსიები შეიცვალა. ბმული კვლავ მოქმედია. გთხოვთ, ხელახლა გაეცნოთ
                განახლებულ დოკუმენტებს და მხოლოდ ამის შემდეგ დაადასტუროთ გადაწყვეტილება.
              </p>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={() => void submitDecision('agree')}
                disabled={submitting || Boolean(error)}
              >
                {submitting
                  ? 'მუშავდება…'
                  : documentsNeedReview
                    ? 'განახლებული დოკუმენტების შემდეგ ვეთანხმები'
                    : 'ვეთანხმები'}
              </button>
              <button
                className={styles.secondary}
                onClick={() => void submitDecision('reject')}
                disabled={submitting || Boolean(error)}
              >
                უარს ვაცხადებ
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
