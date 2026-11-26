import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AcademyLogo from '../../components/branding/AcademyLogo';
import type { Database } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import styles from './ParticipantPages.module.scss';
import { educationSchema, parentSchema, personalSchema } from './registration.schemas';

type Participant = Database['public']['Tables']['participants']['Row'];
type Details = {
  first_name: string;
  last_name: string;
  age: number | null;
  biography: string;
  school: string;
  grade: string;
  teacher_name: string;
  parent_contact_name: string;
  parent_contact_phone: string;
  parent_contact_email: string;
};

const emptyDetails: Details = {
  first_name: '',
  last_name: '',
  age: null,
  biography: '',
  school: '',
  grade: '',
  teacher_name: '',
  parent_contact_name: '',
  parent_contact_phone: '',
  parent_contact_email: '',
};

function detailsFrom(participant: Participant | null): Details {
  if (!participant) return emptyDetails;
  return {
    first_name: participant.first_name ?? '',
    last_name: participant.last_name ?? '',
    age: participant.age,
    biography: participant.biography ?? '',
    school: participant.school ?? '',
    grade: participant.grade ?? '',
    teacher_name: participant.teacher_name ?? '',
    parent_contact_name: participant.parent_contact_name ?? '',
    parent_contact_phone: participant.parent_contact_phone ?? '',
    parent_contact_email: participant.parent_contact_email ?? '',
  };
}

function isComplete(value: Details) {
  return (
    personalSchema.safeParse(value).success &&
    educationSchema.safeParse(value).success &&
    parentSchema.safeParse(value).success
  );
}

function PageShell({
  children,
  showHeader = false,
}: {
  children: ReactNode;
  showHeader?: boolean;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  async function logout() {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch {
      setLogoutError('სისტემიდან გამოსვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    }
  }
  return (
    <>
      {showHeader && (
        <header className={styles.formHeader}>
          <Link to="/" className={styles.brand} aria-label="ახალგაზრდა ლიდერთა აკადემია — მთავარი">
            <AcademyLogo variant="compact" />
            <span>ახალგაზრდა ლიდერთა აკადემია</span>
          </Link>
          <div className={styles.headerActions}>
            {logoutError && <span role="alert">{logoutError}</span>}
            <button type="button" className={styles.ghostButton} onClick={() => void logout()}>
              გასვლა
            </button>
          </div>
        </header>
      )}
      {showHeader ? <main className={styles.container}>{children}</main> : children}
    </>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
}: {
  label: string;
  name: keyof Details;
  value: string | number | null;
  onChange: (name: keyof Details, value: string | number | null) => void;
  error?: string;
  type?: string;
}) {
  const id = 'participant-' + name;
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            name,
            type === 'number'
              ? event.target.value
                ? Number(event.target.value)
                : null
              : event.target.value,
          )
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
      />
      {error && (
        <small id={id + '-error'} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

export function RegistrationProgress({ currentStep }: { currentStep: number }) {
  const labels = [
    'ანგარიშის მონაცემები',
    'პირადი ინფორმაცია',
    'განათლება',
    'მშობლის / მეურვის ინფორმაცია',
  ];
  return (
    <nav className={styles.progress} aria-label="რეგისტრაციის ეტაპები">
      {labels.map((label, index) => (
        <div className={styles.stepItem} key={label}>
          <span
            className={
              index + 1 === currentStep
                ? styles.currentStep
                : index + 1 < currentStep
                  ? styles.doneStep
                  : styles.futureStep
            }
            aria-current={index + 1 === currentStep ? 'step' : undefined}
          >
            <span className={styles.stepCircle}>{index + 1}</span>
            <span className={styles.stepLabel}>{label}</span>
          </span>
          {index < labels.length - 1 && <span className={styles.connector} />}
        </div>
      ))}
    </nav>
  );
}

export function ParticipantOnboardingPage() {
  const { user, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  const editing = location.pathname === '/profile/edit' || searchParams.get('edit') === '1';
  const requestedStepValue = Number(searchParams.get('step') ?? '2');
  const requestedStep = Number.isInteger(requestedStepValue) ? requestedStepValue : 2;
  const [step, setStep] = useState(Math.min(2, Math.max(0, requestedStep - 2)));
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [verifiedParentEmail, setVerifiedParentEmail] = useState('');
  const [termsVersion, setTermsVersion] = useState('');
  const [privacyVersion, setPrivacyVersion] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !user) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('get_participant_registration_profile');
        if (error) throw error;
        if (!active) return;
        const participant = data?.[0] ?? null;
        if (participant) {
          const current = detailsFrom(participant);
          const parentVerified = Boolean(participant.parent_contact_email_verified_at);
          setDetails(current);
          setVerifiedParentEmail(parentVerified ? (participant.parent_contact_email ?? '') : '');
          if (!editing) {
            const resumeStep = !personalSchema.safeParse(current).success
              ? 0
              : !educationSchema.safeParse(current).success
                ? 1
                : 2;
            setStep(resumeStep);
            setSearchParamsRef.current({ step: String(resumeStep + 2) }, { replace: true });
          }
        } else if (!editing) {
          setStep(0);
          setSearchParamsRef.current({ step: '2' }, { replace: true });
        }
        const { data: documents, error: documentError } = await supabase
          .from('registration_documents')
          .select('slug,version,is_published')
          .eq('is_published', true);
        if (!active) return;
        if (!documentError) {
          const publishedDocuments = documents ?? [];
          setTermsVersion(publishedDocuments.find((item) => item.slug === 'terms')?.version ?? '');
          setPrivacyVersion(
            publishedDocuments.find((item) => item.slug === 'privacy')?.version ?? '',
          );
        }
      } catch {
        if (active) setMessage('შენახული ინფორმაციის ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user, editing, navigate]);

  function update(name: keyof Details, value: string | number | null) {
    setDetails((current) => ({ ...current, [name]: value }));
    if (
      name === 'parent_contact_email' &&
      String(value ?? '')
        .trim()
        .toLowerCase() !== verifiedParentEmail.toLowerCase()
    ) {
      setVerifiedParentEmail('');
      setVerificationSent(false);
      setTermsAccepted(false);
    }
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function persist() {
    if (!supabase) throw new Error('Supabase unavailable');
    const { error } = await supabase.rpc('save_participant_profile', {
      p_participant: details,
      p_complete: false,
    });
    if (error) throw error;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const schema = step === 0 ? personalSchema : step === 1 ? educationSchema : parentSchema;
    const result = schema.safeParse(details);
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    setMessage('');
    setSaving(true);
    try {
      await persist();
      if (step < 2) {
        const nextStep = step + 1;
        setStep(nextStep);
        setSearchParams({ step: String(nextStep + 2) }, { replace: true });
      } else if (
        verifiedParentEmail.toLowerCase() !== details.parent_contact_email.trim().toLowerCase()
      ) {
        const { data: sessionData } = await supabase!.auth.getSession();
        const { data, error } = await supabase!.functions.invoke('parent-email-verification', {
          body: { action: 'send', email: details.parent_contact_email.trim() },
          headers: sessionData.session
            ? { Authorization: 'Bearer ' + sessionData.session.access_token }
            : undefined,
        });
        if (error || data?.sent !== true)
          throw new Error(data?.error ?? error?.message ?? 'Email send failed');
        setVerificationSent(true);
        setMessage(
          'დადასტურების წერილი გაიგზავნა. გახსენით წერილში მოცემული ბმული; ის 30 წუთის განმავლობაში მოქმედებს.',
        );
      } else {
        setMessage('ელფოსტა უკვე დადასტურებულია. გაეცანით დოკუმენტებს და მონიშნეთ თანხმობა.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.includes('rate limit')
          ? 'მოთხოვნების ლიმიტი ამოიწურა. სცადეთ მოგვიანებით.'
          : 'ინფორმაციის შენახვა ან წერილის გაგზავნა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ ხელახლა.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function completeRegistration() {
    if (
      !supabase ||
      !termsAccepted ||
      !termsVersion ||
      !privacyVersion ||
      verifiedParentEmail.toLowerCase() !== details.parent_contact_email.trim().toLowerCase()
    )
      return;
    setSaving(true);
    setMessage('');
    try {
      const { error } = await supabase.rpc('complete_participant_registration', {
        p_terms_version: termsVersion,
        p_privacy_version: privacyVersion,
        p_terms_accepted: true,
        p_privacy_accepted: true,
      });
      if (error) throw error;
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch {
      setMessage(
        'რეგისტრაციის დასრულება ვერ მოხერხდა. გადაამოწმეთ ყველა სავალდებულო ეტაპი და დოკუმენტების ვერსია.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <PageShell>
        <p role="status">მონაცემები იტვირთება…</p>
      </PageShell>
    );
  if (!user || !supabase)
    return (
      <PageShell>
        <section className={styles.card}>
          <p role="alert">გთხოვთ, შეხვიდეთ ანგარიშში.</p>
          <Link to="/login">შესვლა</Link>
        </section>
      </PageShell>
    );

  return (
    <PageShell>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div className={styles.registrationToolbar}>
            <h1>{editing ? 'პირადი ინფორმაციის რედაქტირება' : 'მონაწილის რეგისტრაცია'}</h1>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={async () => {
                try {
                  await signOut();
                  navigate('/login', { replace: true });
                } catch {
                  setLogoutError('სისტემიდან გამოსვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
                }
              }}
            >
              გასვლა
            </button>
          </div>
          {logoutError && (
            <p role="alert" className={styles.error}>
              {logoutError}
            </p>
          )}
          <p>
            შეავსეთ ოთხსაფეხურიანი რეგისტრაცია. თქვენი ინფორმაცია ავტომატურად შეინახება და
            მოგვიანებით გაგრძელებას შეძლებთ.
          </p>
        </header>
        <RegistrationProgress currentStep={step + 2} />
        <form className={styles.card} onSubmit={submit} noValidate>
          {step === 0 && (
            <>
              <div className={styles.stepHeading}>
                <h2>პირადი ინფორმაცია</h2>
                <p>მიუთითეთ თქვენი ძირითადი ინფორმაცია.</p>
              </div>
              <div className={styles.grid}>
                <Field
                  label="სახელი"
                  name="first_name"
                  value={details.first_name}
                  onChange={update}
                  error={errors.first_name}
                />
                <Field
                  label="გვარი"
                  name="last_name"
                  value={details.last_name}
                  onChange={update}
                  error={errors.last_name}
                />
                <Field
                  label="ასაკი"
                  name="age"
                  type="number"
                  value={details.age}
                  onChange={update}
                  error={errors.age}
                />
              </div>
              <label className={styles.field} htmlFor="participant-biography">
                <span>მოკლე ბიოგრაფია</span>
                <textarea
                  id="participant-biography"
                  rows={4}
                  maxLength={500}
                  value={details.biography}
                  onChange={(event) => update('biography', event.target.value)}
                  aria-invalid={Boolean(errors.biography)}
                />
                {errors.biography && <small role="alert">{errors.biography}</small>}
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <div className={styles.stepHeading}>
                <h2>განათლება</h2>
                <p>მიუთითეთ თქვენი ამჟამინდელი სასწავლო ინფორმაცია.</p>
              </div>
              <div className={styles.grid}>
                <Field
                  label="სკოლა"
                  name="school"
                  value={details.school}
                  onChange={update}
                  error={errors.school}
                />
                <Field
                  label="კლასი"
                  name="grade"
                  value={details.grade}
                  onChange={update}
                  error={errors.grade}
                />
                <Field
                  label="მასწავლებელი"
                  name="teacher_name"
                  value={details.teacher_name}
                  onChange={update}
                  error={errors.teacher_name}
                />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className={styles.stepHeading}>
                <h2>მშობლის ან მეურვის ინფორმაცია</h2>
                <p>მშობლის / მეურვის ელფოსტა სავალდებულოა და ცალკე უნდა დადასტურდეს.</p>
              </div>
              <div className={styles.grid}>
                <Field
                  label="სახელი და გვარი"
                  name="parent_contact_name"
                  value={details.parent_contact_name}
                  onChange={update}
                  error={errors.parent_contact_name}
                />
                <Field
                  label="ტელეფონი"
                  name="parent_contact_phone"
                  value={details.parent_contact_phone}
                  onChange={update}
                  error={errors.parent_contact_phone}
                />
                <Field
                  label="მშობლის / მეურვის ელფოსტა"
                  name="parent_contact_email"
                  type="email"
                  value={details.parent_contact_email}
                  onChange={update}
                  error={errors.parent_contact_email}
                />
              </div>
              {verifiedParentEmail.toLowerCase() ===
                details.parent_contact_email.trim().toLowerCase() && verifiedParentEmail ? (
                <p className={styles.info} role="status">
                  მშობლის / მეურვის ელფოსტა დადასტურებულია.
                </p>
              ) : (
                <p className={styles.info}>
                  შეინახეთ ინფორმაცია და გამოგიგზავნით ერთჯერად დადასტურების ბმულს, რომელიც 30 წუთში
                  იწურება.
                </p>
              )}
              {verificationSent && (
                <p className={styles.info} role="status">
                  წერილი გაგზავნილია. თუ ვერ იპოვეთ, შეამოწმეთ Spam ან ხელახლა მოითხოვეთ წერილი.
                </p>
              )}
              <div className={styles.documentLinks}>
                <Link to="/terms" target="_blank" rel="noreferrer">
                  წესები და პირობები
                </Link>
                <Link to="/privacy" target="_blank" rel="noreferrer">
                  კონფიდენციალურობის პოლიტიკა
                </Link>
              </div>
              {verifiedParentEmail.toLowerCase() ===
                details.parent_contact_email.trim().toLowerCase() &&
                verifiedParentEmail && (
                  <div className={styles.termsAcceptance}>
                    <h3>რეგისტრაციის დასრულება</h3>
                    <p>
                      მშობლის / მეურვის ელფოსტა დადასტურებულია. რეგისტრაციის დასასრულებლად გაეცანით
                      ქვემოთ მოცემულ დოკუმენტებს და დაადასტურეთ მათი მიღება.
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(event) => setTermsAccepted(event.target.checked)}
                      />
                      <span>
                        წავიკითხე და ვეთანხმები წესებსა და პირობებს და კონფიდენციალურობის პოლიტიკას.
                      </span>
                    </label>
                    {(!termsVersion || !privacyVersion) && (
                      <p role="alert">
                        დოკუმენტების ოფიციალური, დამტკიცებული ვერსიები ჯერ არ არის გამოქვეყნებული.
                        რეგისტრაციის დასრულება დროებით შეუძლებელია.
                      </p>
                    )}
                  </div>
                )}
            </>
          )}
          {message && (
            <p className={styles.error} role="alert">
              {message}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                if (step === 0) navigate(editing ? '/dashboard' : '/register');
                else {
                  const previous = step - 1;
                  setStep(previous);
                  setSearchParams({ step: String(previous + 2) }, { replace: true });
                }
              }}
            >
              უკან
            </button>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving
                ? 'ინახება…'
                : step === 2
                  ? verifiedParentEmail
                    ? 'ინფორმაციის შენახვა'
                    : verificationSent
                      ? 'წერილის ხელახლა გაგზავნა'
                      : 'შენახვა და დადასტურების წერილის გაგზავნა'
                  : 'შემდეგი'}
            </button>
            {step === 2 &&
              verifiedParentEmail.toLowerCase() ===
                details.parent_contact_email.trim().toLowerCase() &&
              verifiedParentEmail && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={saving || !termsAccepted || !termsVersion || !privacyVersion}
                  onClick={() => void completeRegistration()}
                >
                  {saving ? 'მოწმდება…' : 'რეგისტრაციის დასრულება'}
                </button>
              )}
          </div>
        </form>
      </div>
    </PageShell>
  );
}

export function RegistrationDocumentPage({ slug }: { slug: 'terms' | 'privacy' }) {
  const [document, setDocument] = useState<{
    title: string;
    version: string;
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('registration_documents')
        .select('title,version,content')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (!active) return;
      if (!error && data) setDocument(data);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [slug]);
  return (
    <div className={styles.container}>
      <article className={styles.card + ' ' + styles.documentPage}>
        <h1>
          {document?.title ??
            (slug === 'terms' ? 'წესები და პირობები' : 'კონფიდენციალურობის პოლიტიკა')}
        </h1>
        {loading ? (
          <p role="status">დოკუმენტი იტვირთება…</p>
        ) : document ? (
          <>
            <p className={styles.documentVersion}>ვერსია: {document.version}</p>
            <div className={styles.documentContent}>{document.content}</div>
          </>
        ) : (
          <p role="status">
            ოფიციალური დოკუმენტი ჯერ არ არის გამოქვეყნებული. ორგანიზაციამ უნდა დაამტკიცოს და
            გამოაქვეყნოს ტექსტი რეგისტრაციის დასრულების ჩართვამდე.
          </p>
        )}
        <Link className={styles.primaryLink} to="/register?step=4">
          რეგისტრაციაზე დაბრუნება
        </Link>
      </article>
    </div>
  );
}

export function RegistrationConfirmationPage() {
  return (
    <PageShell showHeader>
      <section className={styles.confirmation}>
        <span className={styles.successIcon} aria-hidden="true">
          ✓
        </span>
        <h1>რეგისტრაცია წარმატებით დასრულდა!</h1>
        <p>
          თქვენი ანგარიში და მონაწილის პროფილი მზად არის. პირადი ინფორმაციის შეცვლა ნებისმიერ დროს
          შეგიძლიათ.
        </p>
        <Link to="/dashboard" className={styles.primaryLink}>
          პირად კაბინეტში გადასვლა
        </Link>
      </section>
    </PageShell>
  );
}

export function ParticipantDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !user) {
        setLoading(false);
        return;
      }
      const { data, error: queryError } = await supabase
        .from('participants')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (queryError) setError('პროფილის ჩატვირთვა ვერ მოხერხდა.');
      else if (!data || !isComplete(detailsFrom(data))) navigate('/onboarding', { replace: true });
      else setParticipant(data);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  return (
    <PageShell showHeader>
      <div className={styles.dashboard}>
        <header className={styles.dashboardHeader}>
          <div>
            <h1>გამარჯობა, {participant?.first_name ?? user?.email ?? 'მონაწილე'}</h1>
            <p>მოგესალმებით თქვენს პირად კაბინეტში.</p>
          </div>
          {participant && (
            <Link to="/register?step=2" className={styles.primaryLink}>
              პროფილის რედაქტირება
            </Link>
          )}
        </header>
        {loading ? (
          <section className={styles.card} role="status">
            მონაცემები იტვირთება…
          </section>
        ) : error ? (
          <section className={styles.card} role="alert">
            {error}
          </section>
        ) : (
          participant && (
            <div className={styles.dashboardGrid}>
              <section className={styles.card}>
                <h2>პირადი ინფორმაცია</h2>
                <p>
                  {participant.first_name} {participant.last_name}
                </p>
                <p>ასაკი: {participant.age ?? '—'}</p>
                <p>{participant.biography}</p>
                <h3>განათლება</h3>
                <p>{participant.school}</p>
                <p>კლასი: {participant.grade}</p>
                <p>მასწავლებელი: {participant.teacher_name}</p>
                <h3>მშობლის / მეურვის კონტაქტი</h3>
                <p>{participant.parent_contact_name}</p>
                <p>{participant.parent_contact_phone}</p>
                <p>{participant.parent_contact_email || '—'}</p>
              </section>
              <section className={styles.card}>
                <h2>კონკურსის განაცხადები</h2>
                <p>ჯერ არ გაქვთ კონკურსზე განაცხადები.</p>
                <p>
                  კონკურსებში მონაწილეობაზე განაცხადის ფუნქცია ხელმისაწვდომი გახდება მომავალ ეტაპზე.
                </p>
              </section>
            </div>
          )
        )}
      </div>
    </PageShell>
  );
}
