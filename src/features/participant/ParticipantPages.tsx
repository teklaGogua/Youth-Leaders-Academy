import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  first_name: '', last_name: '', age: null, biography: '', school: '', grade: '',
  teacher_name: '', parent_contact_name: '', parent_contact_phone: '', parent_contact_email: '',
};
const labels = ['პირადი ინფორმაცია', 'განათლება', 'მშობლის / მეურვის ინფორმაცია'];

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
  return personalSchema.safeParse(value).success &&
    educationSchema.safeParse(value).success &&
    parentSchema.safeParse(value).success;
}

function PageShell({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  async function logout() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('სისტემიდან გამოსვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    }
  }
  return <>
    <header className={styles.formHeader}>
      <Link to="/" className={styles.brand} aria-label="ახალგაზრდა ლიდერთა აკადემია — მთავარი">
        <AcademyLogo variant="compact" /><span>ახალგაზრდა ლიდერთა აკადემია</span>
      </Link>
      <div className={styles.headerActions}>
        {logoutError && <span role="alert">{logoutError}</span>}
        <button type="button" className={styles.ghostButton} onClick={() => void logout()}>გასვლა</button>
      </div>
    </header>
    <main className={styles.container}>{children}</main>
  </>;
}

function Field({ label, name, value, onChange, error, type = 'text' }: {
  label: string; name: keyof Details; value: string | number | null;
  onChange: (name: keyof Details, value: string | number | null) => void;
  error?: string; type?: string;
}) {
  const id = 'participant-' + name;
  return <label className={styles.field} htmlFor={id}>
    <span>{label}</span>
    <input id={id} name={name} type={type} value={value ?? ''}
      onChange={event => onChange(name, type === 'number' ? (event.target.value ? Number(event.target.value) : null) : event.target.value)}
      aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} />
    {error && <small id={id + '-error'} role="alert">{error}</small>}
  </label>;
}

export function ParticipantOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editing = location.pathname === '/profile/edit';
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !user) { setLoading(false); return; }
      const { data, error } = await supabase.from('participants').select('*').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (error) setMessage('პირადი ინფორმაციის ჩატვირთვა ვერ მოხერხდა.');
      else {
        const current = detailsFrom(data);
        setDetails(current);
        if (!editing && data && isComplete(current)) navigate('/dashboard', { replace: true });
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user, editing, navigate]);

  function update(name: keyof Details, value: string | number | null) {
    setDetails(current => ({ ...current, [name]: value }));
    setErrors(current => { const next = { ...current }; delete next[name]; return next; });
  }

  async function persist(complete: boolean) {
    if (!supabase) throw new Error('Supabase unavailable');
    const { error } = await supabase.rpc('save_participant_profile', {
      p_participant: details,
      p_complete: complete,
    });
    if (error) throw error;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const schema = step === 0 ? personalSchema : step === 1 ? educationSchema : parentSchema;
    const result = schema.safeParse(details);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      return;
    }
    setErrors({});
    setMessage('');
    setSaving(true);
    try {
      await persist(step === 2);
      if (step < 2) setStep(current => current + 1);
      else navigate(editing ? '/dashboard' : '/registration/confirmation', { replace: true });
    } catch {
      setMessage('ინფორმაციის შენახვა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ ხელახლა.');
    } finally { setSaving(false); }
  }

  if (loading) return <PageShell><p role="status">მონაცემები იტვირთება…</p></PageShell>;
  if (!user || !supabase) return <PageShell><section className={styles.card}><p role="alert">გთხოვთ, შეხვიდეთ ანგარიშში.</p><Link to="/login">შესვლა</Link></section></PageShell>;

  return <PageShell>
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <h1>{editing ? 'პირადი ინფორმაციის რედაქტირება' : 'პროფილის შევსება'}</h1>
        <p>შეავსეთ თქვენი პროფილი ოთხ ეტაპად. შუალედური ინფორმაცია ავტომატურად შეინახება და მოგვიანებით გაგრძელებას შეძლებთ.</p>
      </header>
      <nav className={styles.progress} aria-label="რეგისტრაციის ეტაპები">
        {labels.map((label, index) => <div className={styles.stepItem} key={label}>
          <span className={step === index ? styles.currentStep : step > index ? styles.doneStep : styles.futureStep}>
            <span className={styles.stepCircle}>{index + 2}</span><span className={styles.stepLabel}>{label}</span>
          </span>
          {index < labels.length - 1 && <span className={styles.connector} />}
        </div>)}
      </nav>
      <form className={styles.card} onSubmit={submit} noValidate>
        {step === 0 && <>
          <div className={styles.stepHeading}><h2>პირადი ინფორმაცია</h2><p>მიუთითეთ თქვენი ძირითადი ინფორმაცია.</p></div>
          <div className={styles.grid}>
            <Field label="სახელი" name="first_name" value={details.first_name} onChange={update} error={errors.first_name} />
            <Field label="გვარი" name="last_name" value={details.last_name} onChange={update} error={errors.last_name} />
            <Field label="ასაკი" name="age" type="number" value={details.age} onChange={update} error={errors.age} />
          </div>
          <label className={styles.field} htmlFor="participant-biography"><span>მოკლე ბიოგრაფია</span>
            <textarea id="participant-biography" rows={4} maxLength={500} value={details.biography}
              onChange={event => update('biography', event.target.value)} aria-invalid={Boolean(errors.biography)} />
            {errors.biography && <small role="alert">{errors.biography}</small>}
          </label>
        </>}
        {step === 1 && <>
          <div className={styles.stepHeading}><h2>განათლება</h2><p>მიუთითეთ თქვენი ამჟამინდელი სასწავლო ინფორმაცია.</p></div>
          <div className={styles.grid}>
            <Field label="სკოლა" name="school" value={details.school} onChange={update} error={errors.school} />
            <Field label="კლასი" name="grade" value={details.grade} onChange={update} error={errors.grade} />
            <Field label="მასწავლებელი" name="teacher_name" value={details.teacher_name} onChange={update} error={errors.teacher_name} />
          </div>
        </>}
        {step === 2 && <>
          <div className={styles.stepHeading}><h2>მშობლის ან მეურვის ინფორმაცია</h2><p>საკონტაქტო ინფორმაცია პროფილისთვის.</p></div>
          <div className={styles.grid}>
            <Field label="სახელი და გვარი" name="parent_contact_name" value={details.parent_contact_name} onChange={update} error={errors.parent_contact_name} />
            <Field label="ტელეფონი" name="parent_contact_phone" value={details.parent_contact_phone} onChange={update} error={errors.parent_contact_phone} />
            <Field label="ელფოსტა (არასავალდებულო)" name="parent_contact_email" type="email" value={details.parent_contact_email} onChange={update} error={errors.parent_contact_email} />
          </div>
        </>}
        {message && <p className={styles.error} role="alert">{message}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={() => step === 0 ? navigate(editing ? '/dashboard' : '/register') : setStep(current => current - 1)}>უკან</button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? 'ინახება…' : step === 2 ? 'დასრულება' : 'შემდეგი'}</button>
        </div>
      </form>
    </div>
  </PageShell>;
}

export function RegistrationConfirmationPage() {
  return <PageShell><section className={styles.confirmation}>
    <span className={styles.successIcon} aria-hidden="true">✓</span>
    <h1>რეგისტრაცია წარმატებით დასრულდა!</h1>
    <p>თქვენი ანგარიში და მონაწილის პროფილი მზად არის. პირადი ინფორმაციის შეცვლა ნებისმიერ დროს შეგიძლიათ.</p>
    <Link to="/dashboard" className={styles.primaryLink}>პირად კაბინეტში გადასვლა</Link>
  </section></PageShell>;
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
      if (!supabase || !user) { setLoading(false); return; }
      const { data, error: queryError } = await supabase.from('participants').select('*').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (queryError) setError('პროფილის ჩატვირთვა ვერ მოხერხდა.');
      else if (!data || !isComplete(detailsFrom(data))) navigate('/onboarding', { replace: true });
      else setParticipant(data);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user, navigate]);

  return <PageShell><div className={styles.dashboard}>
    <header className={styles.dashboardHeader}>
      <div><h1>გამარჯობა, {participant?.first_name ?? user?.email ?? 'მონაწილე'}</h1><p>მოგესალმებით თქვენს პირად კაბინეტში.</p></div>
      {participant && <Link to="/profile/edit" className={styles.primaryLink}>პროფილის რედაქტირება</Link>}
    </header>
    {loading ? <section className={styles.card} role="status">მონაცემები იტვირთება…</section>
      : error ? <section className={styles.card} role="alert">{error}</section>
      : participant && <div className={styles.dashboardGrid}>
        <section className={styles.card}><h2>პირადი ინფორმაცია</h2>
          <p>{participant.first_name} {participant.last_name}</p><p>ასაკი: {participant.age ?? '—'}</p><p>{participant.biography}</p>
          <h3>განათლება</h3><p>{participant.school}</p><p>კლასი: {participant.grade}</p><p>მასწავლებელი: {participant.teacher_name}</p>
          <h3>მშობლის / მეურვის კონტაქტი</h3><p>{participant.parent_contact_name}</p><p>{participant.parent_contact_phone}</p><p>{participant.parent_contact_email || '—'}</p>
        </section>
        <section className={styles.card}><h2>კონკურსის განაცხადები</h2><p>ჯერ არ გაქვთ კონკურსზე განაცხადები.</p><p>კონკურსებში მონაწილეობაზე განაცხადის ფუნქცია ხელმისაწვდომი გახდება მომავალ ეტაპზე.</p></section>
      </div>}
  </div></PageShell>;
}
