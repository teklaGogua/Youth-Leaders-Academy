import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import AcademyLogo from '../../components/branding/AcademyLogo';
import type { ApplicationStatus, Database } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import styles from './ParticipantPages.module.scss';

type Participant = Database['public']['Tables']['participants']['Row'];
type Competition = Database['public']['Tables']['competitions']['Row'];
type Application = Database['public']['Tables']['applications']['Row'];
type ParticipantDetails = Omit<Participant, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const emptyDetails: ParticipantDetails = {
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

const personalSchema = z.object({
  first_name: z.string().trim().min(1, 'შეიყვანეთ სახელი'),
  last_name: z.string().trim().min(1, 'შეიყვანეთ გვარი'),
  age: z.number().int().positive('მიუთითეთ ასაკი ციფრებით'),
  biography: z.string().trim().min(1, 'შეავსეთ მოკლე ბიოგრაფია').max(500, 'მაქსიმუმ 500 სიმბოლო'),
});

const educationSchema = z.object({
  school: z.string().trim().min(1, 'შეიყვანეთ სკოლის დასახელება'),
  grade: z.string().trim().min(1, 'მიუთითეთ კლასი'),
  teacher_name: z.string().trim().min(1, 'შეიყვანეთ მასწავლებლის სახელი'),
});

const parentSchema = z.object({
  parent_contact_name: z.string().trim().min(1, 'შეიყვანეთ საკონტაქტო პირის სახელი'),
  parent_contact_phone: z.string().trim().min(1, 'შეიყვანეთ ტელეფონის ნომერი'),
  parent_contact_email: z.union([
    z.literal(''),
    z.string().email('შეიყვანეთ სწორი ელფოსტა'),
  ]),
});

const statusLabels: Record<ApplicationStatus, string> = {
  registered: 'მიღებულია',
  pending: 'განხილვაშია',
  approved: 'დადასტურებულია',
  rejected: 'უარყოფილია',
};

const stepLabels = ['პირადი ინფორმაცია', 'განათლება', 'მშობლის კონტაქტი', 'გადახედვა'];

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'მოთხოვნის შესრულება ვერ მოხერხდა. სცადეთ ხელახლა.';
}

function FormHeader() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function logout() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setError('სისტემიდან გამოსვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    }
  }

  return (
    <header className={styles.formHeader}>
      <Link to="/" className={styles.brand} aria-label="ახალგაზრდა ლიდერთა აკადემია — მთავარი">
        <AcademyLogo variant="compact" />
        <span>ახალგაზრდა ლიდერთა აკადემია</span>
      </Link>
      <div className={styles.headerActions}>
        {error && <span role="alert">{error}</span>}
        <button type="button" className={styles.ghostButton} onClick={logout}>
          გასვლა
        </button>
      </div>
    </header>
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
  name: keyof ParticipantDetails;
  value: string | number | null;
  onChange: (name: keyof ParticipantDetails, value: string | number | null) => void;
  error?: string;
  type?: string;
}) {
  const id = `participant-${name}`;

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
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <small id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FormHeader />
      <main className={styles.container}>{children}</main>
    </>
  );
}

export function CompetitionRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<ParticipantDetails>(emptyDetails);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabase || !user) {
        setLoading(false);
        return;
      }

      const [competitionResult, participantResult] = await Promise.all([
        supabase
          .from('competitions')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.from('participants').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!active) return;

      if (competitionResult.error || participantResult.error) {
        setMessage('მონაცემების ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.');
      } else {
        const now = Date.now();
        setCompetitions(
          (competitionResult.data ?? []).filter((competition) => {
            const startsAt = competition.registration_start
              ? new Date(competition.registration_start).getTime()
              : Number.NEGATIVE_INFINITY;
            const endsAt = competition.registration_end
              ? new Date(competition.registration_end).getTime()
              : Number.POSITIVE_INFINITY;

            return startsAt <= now && endsAt >= now;
          }),
        );

        if (participantResult.data) {
          const {
            id: _id,
            user_id: _userId,
            created_at: _createdAt,
            updated_at: _updatedAt,
            ...participantDetails
          } = participantResult.data;
          setDetails(participantDetails);
        }
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user]);

  function update(name: keyof ParticipantDetails, value: string | number | null) {
    setDetails((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function validateCurrentStep() {
    const schema =
      step === 0 ? personalSchema : step === 1 ? educationSchema : parentSchema;
    const result = schema.safeParse(details);

    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
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
      if (!validateCurrentStep()) return;
      setStep((current) => current + 1);
      return;
    }

    if (!competitionId) {
      setErrors({ competitionId: 'აირჩიეთ კონკურსი' });
      return;
    }

    if (!supabase || !user) {
      setMessage('განაცხადის გასაგზავნად საჭიროა ავტორიზაცია.');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('submit_competition_application', {
        p_competition_id: competitionId,
        p_participant: details,
      });

      if (error) throw error;

      const application = data?.[0];
      if (!application) throw new Error('განაცხადის პასუხი ვერ მივიღეთ.');

      const competitionTitle =
        competitions.find((competition) => competition.id === competitionId)?.title ?? '';

      navigate('/application/confirmation', {
        replace: true,
        state: {
          applicationId: application.application_id,
          competitionTitle,
        },
      });
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <p role="status">მონაცემები იტვირთება…</p>
      </PageShell>
    );
  }

  if (!supabase || !user) {
    return (
      <PageShell>
        <section className={styles.card}>
          <p role="alert">განაცხადის შესავსებად შედით თქვენს ანგარიშში.</p>
          <Link to="/login" className={styles.primaryLink}>
            შესვლა
          </Link>
        </section>
      </PageShell>
    );
  }

  const selectedCompetition = competitions.find(
    (competition) => competition.id === competitionId,
  );

  return (
    <PageShell>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <h1>კონკურსზე რეგისტრაცია</h1>
          <p>
            ფორმის ველები და მშობლის თანხმობის პროცედურა წინასწარია და კლიენტის მიერ ჯერ არ არის
            დადასტურებული.
          </p>
        </header>

        <nav className={styles.progress} aria-label="რეგისტრაციის ეტაპები">
          {stepLabels.map((label, index) => (
            <div className={styles.stepItem} key={label}>
              <button
                type="button"
                aria-current={step === index ? 'step' : undefined}
                className={
                  step === index
                    ? styles.currentStep
                    : step > index
                      ? styles.doneStep
                      : styles.futureStep
                }
                onClick={() => {
                  if (index < step) {
                    setErrors({});
                    setMessage('');
                    setStep(index);
                  }
                }}
                disabled={index > step}
              >
                <span className={styles.stepCircle}>{index + 1}</span>
                <span className={styles.stepLabel}>{label}</span>
              </button>
              {index < stepLabels.length - 1 && <span className={styles.connector} />}
            </div>
          ))}
        </nav>

        <form className={styles.card} onSubmit={submit} noValidate>
          {step === 0 && (
            <>
              <div className={styles.stepHeading}>
                <h2>პირადი ინფორმაცია</h2>
                <p>ყველა ველი სავალდებულოა, თუ სხვაგვარად არ არის მითითებული.</p>
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
                  value={details.biography ?? ''}
                  onChange={(event) => update('biography', event.target.value)}
                  rows={4}
                  maxLength={500}
                  aria-invalid={Boolean(errors.biography)}
                />
                <small>მაქსიმუმ 500 სიმბოლო (დროებითი ლიმიტი)</small>
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
                <h2>მშობლის ან მეურვის საკონტაქტო ინფორმაცია</h2>
                <p>ამ მონაცემებით ადმინისტრაცია დაგიკავშირდებათ განაცხადთან დაკავშირებით.</p>
              </div>
              <div className={styles.grid}>
                <Field
                  label="საკონტაქტო პირის სახელი"
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
                  label="ელფოსტა (არასავალდებულო)"
                  name="parent_contact_email"
                  type="email"
                  value={details.parent_contact_email}
                  onChange={update}
                  error={errors.parent_contact_email}
                />
              </div>
              <aside className={styles.info}>
                პერსონალური მონაცემების დამუშავებისა და მშობლის თანხმობის პროცედურა ორგანიზაციის
                მიერ დასადასტურებელია. ამ ეტაპზე თანხმობის სავალდებულო ველი არ გამოიყენება.
              </aside>
            </>
          )}

          {step === 3 && (
            <>
              <div className={styles.stepHeading}>
                <h2>გადახედვა და გაგზავნა</h2>
                <p>გადაამოწმეთ ინფორმაცია და აირჩიეთ კონკურსი.</p>
              </div>
              <label className={styles.field} htmlFor="participant-competition">
                <span>კონკურსი</span>
                <select
                  id="participant-competition"
                  value={competitionId}
                  onChange={(event) => {
                    setCompetitionId(event.target.value);
                    setErrors({});
                  }}
                >
                  <option value="">აირჩიეთ კონკურსი</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.title}
                    </option>
                  ))}
                </select>
                {errors.competitionId && <small role="alert">{errors.competitionId}</small>}
              </label>
              {competitions.length === 0 && (
                <p className={styles.info}>ამჟამად რეგისტრაციისთვის ღია კონკურსი არ არის.</p>
              )}
              {selectedCompetition && <p>{selectedCompetition.description}</p>}
              <div className={styles.review}>
                <h3>პირადი ინფორმაცია</h3>
                <p>
                  {details.first_name} {details.last_name} · {details.age}
                </p>
                <p>{details.biography}</p>
                <h3>განათლება</h3>
                <p>
                  {details.school} · {details.grade} · {details.teacher_name}
                </p>
                <h3>მშობლის კონტაქტი</h3>
                <p>
                  {details.parent_contact_name} · {details.parent_contact_phone} ·{' '}
                  {details.parent_contact_email || '—'}
                </p>
              </div>
            </>
          )}

          {message && (
            <p className={styles.error} role="alert">
              {message}
            </p>
          )}

          <div className={styles.actions}>
            {step === 0 ? (
              <Link to="/dashboard" className={styles.secondaryButton}>
                გაუქმება
              </Link>
            ) : (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setErrors({});
                  setMessage('');
                  setStep((current) => current - 1);
                }}
              >
                უკან
              </button>
            )}
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting || (step === 3 && competitions.length === 0)}
            >
              {submitting ? 'იგზავნება…' : step === 3 ? 'განაცხადის გაგზავნა' : 'შემდეგი'}
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}

export function RegistrationConfirmationPage() {
  const location = useLocation();
  const state = location.state as
    | { applicationId?: string; competitionTitle?: string }
    | null;

  return (
    <PageShell>
      <section className={styles.confirmation}>
        <span className={styles.successIcon} aria-hidden="true">
          ✓
        </span>
        <h1>თქვენი განაცხადი წარმატებით გაიგზავნა!</h1>
        <p>გმადლობთ რეგისტრაციისთვის. განაცხადის სტატუსის ნახვა შეგიძლიათ პირად კაბინეტში.</p>
        {state?.competitionTitle && <p>{state.competitionTitle}</p>}
        {state?.applicationId && (
          <p className={styles.applicationReference}>
            განაცხადის ნომერი: {state.applicationId}
          </p>
        )}
        <Link to="/dashboard" className={styles.primaryLink}>
          პირად კაბინეტში გადასვლა
        </Link>
      </section>
    </PageShell>
  );
}

export function ParticipantDashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabase || !user) {
        setError('საჭიროა ავტორიზაცია.');
        setLoading(false);
        return;
      }

      const participantResult = await supabase
        .from('participants')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;

      if (participantResult.error) {
        setError('მონაწილის ინფორმაციის ჩატვირთვა ვერ მოხერხდა.');
        setLoading(false);
        return;
      }

      setParticipant(participantResult.data);

      if (!participantResult.data) {
        setApplications([]);
        setLoading(false);
        return;
      }

      const applicationResult = await supabase
        .from('applications')
        .select('*')
        .eq('participant_id', participantResult.data.id)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (applicationResult.error) {
        setError('განაცხადების ჩატვირთვა ვერ მოხერხდა.');
        setLoading(false);
        return;
      }

      const rows = applicationResult.data ?? [];
      setApplications(rows);

      const competitionIds = [...new Set(rows.map((application) => application.competition_id))];
      if (competitionIds.length > 0) {
        const competitionResult = await supabase
          .from('competitions')
          .select('*')
          .in('id', competitionIds);

        if (!active) return;

        if (competitionResult.error) {
          setError('კონკურსების ინფორმაციის ჩატვირთვა ვერ მოხერხდა.');
        } else {
          setCompetitions(competitionResult.data ?? []);
        }
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user]);

  async function logout() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setError('სისტემიდან გამოსვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    }
  }

  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));

  return (
    <PageShell>
      <div className={styles.dashboard}>
        <header className={styles.dashboardHeader}>
          <div>
            <h1>გამარჯობა, {participant?.first_name || user?.email || 'მონაწილე'}</h1>
            <p>თვალი ადევნეთ თქვენი განაცხადების სტატუსს.</p>
          </div>
          <div className={styles.actions}>
            {applications.length === 0 && (
              <Link to="/apply" className={styles.primaryLink}>
                კონკურსზე რეგისტრაცია
              </Link>
            )}
            <button type="button" className={styles.secondaryButton} onClick={logout}>
              გასვლა
            </button>
          </div>
        </header>

        {loading ? (
          <section className={styles.card} role="status">
            მონაცემები იტვირთება…
          </section>
        ) : error ? (
          <section className={styles.card} role="alert">
            {error}
          </section>
        ) : !participant ? (
          <section className={styles.card}>
            <h2>პირადი ინფორმაცია ჯერ არ გაქვთ შევსებული</h2>
            <p>კონკურსზე განაცხადის გაგზავნისას შეავსებთ თქვენს პროფილს.</p>
            <Link to="/apply" className={styles.primaryLink}>
              რეგისტრაციის დაწყება
            </Link>
          </section>
        ) : (
          <div className={styles.dashboardGrid}>
            <section className={styles.card}>
              <h2>ჩემი განაცხადები</h2>
              {applications.length === 0 ? (
                <p>განაცხადი ჯერ არ გაქვთ გაგზავნილი.</p>
              ) : (
                <div className={styles.applicationList}>
                  {applications.map((application) => (
                    <article className={styles.applicationCard} key={application.id}>
                      <div>
                        <h3>
                          {competitionById.get(application.competition_id)?.title ?? 'კონკურსი'}
                        </h3>
                        <p>
                          გაგზავნის თარიღი:{' '}
                          {new Date(application.created_at).toLocaleDateString('ka-GE')}
                        </p>
                      </div>
                      <span className={styles.status}>{statusLabels[application.status]}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

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
              <h3>მშობლის კონტაქტი</h3>
              <p>{participant.parent_contact_name}</p>
              <p>{participant.parent_contact_phone}</p>
              <p>{participant.parent_contact_email || '—'}</p>
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
