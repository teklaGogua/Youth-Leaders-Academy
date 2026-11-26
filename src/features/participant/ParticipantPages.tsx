import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import type { ApplicationStatus, Database } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import styles from './ParticipantPages.module.scss';

type Participant = Database['public']['Tables']['participants']['Row'];
type Competition = Database['public']['Tables']['competitions']['Row'];
type Application = Database['public']['Tables']['applications']['Row'];
type Details = Omit<Participant, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
const emptyDetails: Details = {
  first_name: '', last_name: '', age: null, biography: '', school: '', grade: '',
  teacher_name: '', parent_contact_name: '', parent_contact_phone: '', parent_contact_email: '',
};
const personalSchema = z.object({
  first_name: z.string().trim().min(1, 'შეიყვანეთ სახელი'),
  last_name: z.string().trim().min(1, 'შეიყვანეთ გვარი'),
  age: z.number().int().positive().nullable(),
  biography: z.string().trim().max(1000, 'მაქსიმუმ 1000 სიმბოლო'),
});
const educationSchema = z.object({
  school: z.string().trim().min(1, 'შეიყვანეთ სკოლის დასახელება'),
  grade: z.string().trim().min(1, 'მიუთითეთ კლასი'),
  teacher_name: z.string().trim().min(1, 'შეიყვანეთ მასწავლებლის სახელი'),
});
const parentSchema = z.object({
  parent_contact_name: z.string().trim().min(1, 'შეიყვანეთ საკონტაქტო პირის სახელი'),
  parent_contact_phone: z.string().trim().min(1, 'შეიყვანეთ ტელეფონის ნომერი'),
  parent_contact_email: z.union([z.literal(''), z.string().email('შეიყვანეთ სწორი ელფოსტა')]),
});
const statusLabels: Record<ApplicationStatus, string> = {
  registered: 'მიღებულია',
  pending: 'განხილვაშია',
  approved: 'დადასტურებულია',
  rejected: 'უარყოფილია',
};
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'მოთხოვნის შესრულება ვერ მოხერხდა. სცადეთ ხელახლა.';
}
function Field({ label, name, value, onChange, error, type = 'text' }: {
  label: string; name: keyof Details; value: string | number | null;
  onChange: (name: keyof Details, value: string | number | null) => void;
  error?: string; type?: string;
}) {
  return <label className={styles.field}>{label}
    <input name={name} type={type} value={value ?? ''} onChange={event => onChange(name, type === 'number' ? (event.target.value ? Number(event.target.value) : null) : event.target.value)} aria-invalid={Boolean(error)} />
    {error && <small role="alert">{error}</small>}
  </label>;
}

export function CompetitionRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !user) { setLoading(false); return; }
      const [competitionResult, participantResult] = await Promise.all([
        supabase.from('competitions').select('*').eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('participants').select('*').eq('user_id', user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (competitionResult.error || participantResult.error) setMessage('მონაცემების ჩატვირთვა ვერ მოხერხდა.');
      else {
        setCompetitions(competitionResult.data ?? []);
        if (participantResult.data) {
          const { id: _id, user_id: _user, created_at: _created, updated_at: _updated, ...rest } = participantResult.data;
          setDetails(rest);
        }
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user]);
  function update(name: keyof Details, value: string | number | null) {
    setDetails(current => ({ ...current, [name]: value }));
  }
  function validateCurrent() {
    const schema = step === 0 ? personalSchema : step === 1 ? educationSchema : parentSchema;
    const result = schema.safeParse(details);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      return false;
    }
    setErrors({});
    return true;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setMessage('');
    if (step < 3) {
      if (step < 2 && !validateCurrent()) return;
      if (step === 2 && !validateCurrent()) return;
      if (step === 3 && !competitionId) setErrors({ competitionId: 'აირჩიეთ კონკურსი' });
      setStep(current => current + 1);
      return;
    }
    if (!competitionId) { setErrors({ competitionId: 'აირჩიეთ კონკურსი' }); return; }
    if (!supabase || !user) { setMessage('განაცხადის გასაგზავნად საჭიროა ავტორიზაცია.'); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_competition_application', {
        p_competition_id: competitionId,
        p_participant: details,
      });
      if (error) throw error;
      const application = data?.[0];
      if (!application) throw new Error('განაცხადის პასუხი ვერ მივიღეთ.');
      setSubmittedId(application.application_id);
      navigate('/dashboard', { replace: true, state: { submitted: true } });
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setSubmitting(false);
    }
  }
  if (loading) return <main className={styles.container}><p role="status">მონაცემები იტვირთება…</p></main>;
  if (!supabase || !user) return <main className={styles.container}><p role="alert">განაცხადის შესავსებად შედით თქვენს ანგარიშში.</p><Link to="/login">შესვლა</Link></main>;
  const selectedCompetition = competitions.find(item => item.id === competitionId);
  return <main className={styles.container}>
    <header className={styles.pageHeader}><span>ახალგაზრდა ლიდერთა აკადემია</span><h1>კონკურსზე რეგისტრაცია</h1><p>შეავსეთ განაცხადი ეტაპობრივად. შეგიძლიათ წინა ეტაპზე დაბრუნება.</p></header>
    <nav className={styles.progress} aria-label="რეგისტრაციის ეტაპები">
      {['პირადი ინფორმაცია', 'განათლება', 'მშობლის კონტაქტი', 'გადახედვა'].map((label, index) =>
        <button key={label} type="button" aria-current={step === index ? 'step' : undefined} className={step === index ? styles.currentStep : step > index ? styles.doneStep : ''} onClick={() => index < step && setStep(index)}>{index + 1}. {label}</button>)}
    </nav>
    <form className={styles.card} onSubmit={submit} noValidate>
      {step === 0 && <><h2>პირადი ინფორმაცია</h2><div className={styles.grid}>
        <Field label="სახელი" name="first_name" value={details.first_name} onChange={update} error={errors.first_name}/>
        <Field label="გვარი" name="last_name" value={details.last_name} onChange={update} error={errors.last_name}/>
        <Field label="ასაკი" name="age" type="number" value={details.age} onChange={update} error={errors.age}/>
        <label className={styles.field}>მოკლე ბიოგრაფია<textarea value={details.biography ?? ''} onChange={e => update('biography', e.target.value)} rows={4}/>{errors.biography && <small>{errors.biography}</small>}</label>
      </div></>}
      {step === 1 && <><h2>განათლება</h2><div className={styles.grid}>
        <Field label="სკოლა" name="school" value={details.school} onChange={update} error={errors.school}/>
        <Field label="კლასი" name="grade" value={details.grade} onChange={update} error={errors.grade}/>
        <Field label="მასწავლებელი" name="teacher_name" value={details.teacher_name} onChange={update} error={errors.teacher_name}/>
      </div></>}
      {step === 2 && <><h2>მშობლის ან მეურვის საკონტაქტო ინფორმაცია</h2><p>ამ მონაცემებით ადმინისტრაცია დაგიკავშირდებათ განაცხადთან დაკავშირებით.</p><div className={styles.grid}>
        <Field label="საკონტაქტო პირის სახელი" name="parent_contact_name" value={details.parent_contact_name} onChange={update} error={errors.parent_contact_name}/>
        <Field label="ტელეფონი" name="parent_contact_phone" value={details.parent_contact_phone} onChange={update} error={errors.parent_contact_phone}/>
        <Field label="ელფოსტა (არასავალდებულო)" name="parent_contact_email" type="email" value={details.parent_contact_email} onChange={update} error={errors.parent_contact_email}/>
      </div><aside className={styles.info}>პერსონალური მონაცემების დამუშავებისა და მშობლის თანხმობის პროცედურა ორგანიზაციის მიერ დასადასტურებელია. ამ ეტაპზე თანხმობის სავალდებულო ველი არ გამოიყენება.</aside></>}
      {step === 3 && <><h2>გადახედვა და გაგზავნა</h2><label className={styles.field}>კონკურსი<select value={competitionId} onChange={e => setCompetitionId(e.target.value)}><option value="">აირჩიეთ კონკურსი</option>{competitions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>{errors.competitionId && <small>{errors.competitionId}</small>}</label>
        {selectedCompetition && <p>{selectedCompetition.description}</p>}
        <div className={styles.review}><h3>პირადი ინფორმაცია</h3><p>{details.first_name} {details.last_name} · {details.age ?? '—'}</p><p>{details.biography || '—'}</p><h3>განათლება</h3><p>{details.school} · {details.grade} · {details.teacher_name}</p><h3>მშობლის კონტაქტი</h3><p>{details.parent_contact_name} · {details.parent_contact_phone} · {details.parent_contact_email || '—'}</p></div>
      </>}
      {message && <p className={styles.error} role="alert">{message}</p>}
      <div className={styles.actions}>{step > 0 && <button type="button" className={styles.secondary} onClick={() => { setErrors({}); setMessage(''); setStep(current => current - 1); }}>უკან</button>}
        <button type="submit" disabled={submitting || competitions.length === 0}>{submitting ? 'იგზავნება…' : step === 3 ? 'განაცხადის გაგზავნა' : 'შემდეგი'}</button></div>
      {submittedId && <span className={styles.srOnly}>განაცხადი გაგზავნილია: {submittedId}</span>}
    </form>
  </main>;
}

export function ParticipantDashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !user) { setError('საჭიროა ავტორიზაცია.'); setLoading(false); return; }
      const [participantResult, applicationResult] = await Promise.all([
        supabase.from('participants').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('applications').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!active) return;
      if (participantResult.error || applicationResult.error) setError('მონაცემების ჩატვირთვა ვერ მოხერხდა.');
      else {
        setParticipant(participantResult.data);
        setApplication(applicationResult.data);
        if (applicationResult.data) {
          const result = await supabase.from('competitions').select('*').eq('id', applicationResult.data.competition_id).maybeSingle();
          if (!active) return;
          if (result.error) setError('კონკურსის ინფორმაციის ჩატვირთვა ვერ მოხერხდა.');
          else setCompetition(result.data);
        }
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user]);
  async function logout() {
    try { await signOut(); navigate('/login', { replace: true }); }
    catch { setError('სისტემიდან გამოსვლა ვერ მოხერხდა. სცადეთ ხელახლა.'); }
  }
  return <main className={styles.container}>
    <header className={styles.dashboardHeader}><div><h1>გამარჯობა, {participant?.first_name || user?.email || 'მონაწილე'}</h1><p>თვალი ადევნეთ თქვენი განაცხადის სტატუსს.</p></div><div className={styles.actions}><Link to="/apply" className={styles.secondary}>განაცხადის გაგრძელება</Link><button type="button" className={styles.secondary} onClick={logout}>გასვლა</button></div></header>
    {loading ? <section className={styles.card} role="status">მონაცემები იტვირთება…</section> : error ? <section className={styles.card} role="alert">{error}</section> : !application ? <section className={styles.card}><h2>განაცხადი ჯერ არ გაქვთ</h2><p>შეგიძლიათ დაიწყოთ კონკურსზე რეგისტრაცია.</p><Link to="/apply" className={styles.primaryLink}>რეგისტრაციის დაწყება</Link></section> : <div className={styles.dashboardGrid}>
      <section className={styles.card}><h2>განაცხადის სტატუსი</h2><p className={styles.status}>{statusLabels[application.status]}</p><p>გაგზავნის თარიღი: {new Date(application.created_at).toLocaleDateString('ka-GE')}</p><h3>{competition?.title ?? 'კონკურსი'}</h3><p>{competition?.description}</p></section>
      <section className={styles.card}><h2>პირადი ინფორმაცია</h2><p>{participant?.first_name} {participant?.last_name}</p><p>{participant?.school} · {participant?.grade}</p><p>{participant?.teacher_name}</p><h3>მშობლის კონტაქტი</h3><p>{participant?.parent_contact_name}</p><p>{participant?.parent_contact_phone}</p><p>{participant?.parent_contact_email}</p><p className={styles.info}>განაცხადის გაგზავნის შემდეგ მონაცემების რედაქტირება დროებით მიუწვდომელია.</p></section>
    </div>}
  </main>;
}
