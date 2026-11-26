import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import LineIcon from '../../components/ui/LineIcon';
import Button from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import {
  isSafeRedirectPath,
  loginSchema,
  passwordResetSchema,
  recoverySchema,
  registrationSchema,
} from './auth.schemas';
import { useAuth } from './AuthProvider';
import styles from './AuthPages.module.scss';
import { getGeorgianAuthError } from './auth.errors';

function Field({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
        required
      />
      {error && (
        <span className={styles.fieldError} id={id + '-error'}>
          {error}
        </span>
      )}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.passwordField}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? id + '-error' : undefined}
          required
        />
        <button
          className={styles.visibilityButton}
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'}
          aria-pressed={visible}
        >
          <LineIcon name="eye" size={18} />
        </button>
      </div>
      {error && (
        <span className={styles.fieldError} id={id + '-error'}>
          {error}
        </span>
      )}
    </div>
  );
}

function FormCard({
  title,
  description,
  children,
  registration = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  registration?: boolean;
}) {
  return (
    <section className={registration ? styles.card + ' ' + styles.registerCard : styles.card}>
      <header className={styles.header}>
        {registration && <span className={styles.step}>ნაბიჯი 1 / 4</span>}
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

function getValidationErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

export function LoginPage() {
  const { user, role, loading, profileError, configured, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && role) navigate(role === 'administrator' ? '/admin' : '/onboarding', { replace: true });
  }, [loading, user, role, navigate]);

  if (user && role) return <Navigate to={role === 'administrator' ? '/admin' : '/onboarding'} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(getValidationErrors(result.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await signIn(result.data.email, result.data.password);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(isSafeRedirectPath(from) ? from : '/dashboard', { replace: true });
    } catch (error) {
      setMessage(getGeorgianAuthError(error, 'login'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormCard title="შესვლა" description="შედით თქვენს პირად კაბინეტში.">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {!configured && (
          <p className={styles.error}>სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.</p>
        )}
        {profileError && (
          <p className={styles.error} role="alert">
            მომხმარებლის პროფილის ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.
          </p>
        )}
        {message && (
          <p className={styles.error} role="alert">
            {message}
          </p>
        )}
        <Field
          id="login-email"
          label="ელფოსტა"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="name@example.com"
          error={errors.email}
          autoComplete="email"
        />
        <PasswordField
          id="login-password"
          label="პაროლი"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className={styles.options}>
          <Link to="/forgot-password">დაგავიწყდათ პაროლი?</Link>
        </div>
        <button className={styles.submit} type="submit" disabled={!configured || submitting}>
          {submitting ? 'მიმდინარეობს შესვლა…' : 'შესვლა'}
        </button>
      </form>
      <div className={styles.footer}>
        <span>არ გაქვთ ანგარიში?</span>
        <Link to="/register">რეგისტრაცია</Link>
      </div>
    </FormCard>
  );
}

export function RegisterPage() {
  const { user, role, loading, profileError, configured, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && role) navigate(role === 'administrator' ? '/admin' : '/onboarding', { replace: true });
  }, [loading, user, role, navigate]);

  if (user && role) return <Navigate to={role === 'administrator' ? '/admin' : '/onboarding'} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const result = registrationSchema.safeParse({ email, password, passwordConfirmation });
    if (!result.success) {
      setErrors(getValidationErrors(result.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const requiresConfirmation = await signUp('', result.data.email, result.data.password);
      if (requiresConfirmation) {
        setMessage('ანგარიშის გასააქტიურებლად შეამოწმეთ ელფოსტა და დაადასტურეთ მისამართი. დადასტურების შემდეგ პროფილის შევსებას გააგრძელებთ.');
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch (error) {
      setMessage(getGeorgianAuthError(error, 'register'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormCard title="ანგარიშის შექმნა" description="შექმენით ანგარიში და შემდეგ შეავსეთ მონაწილის პროფილი." registration>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {!configured && <p className={styles.error}>სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.</p>}
        {profileError && <p className={styles.error} role="alert">მომხმარებლის პროფილის ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.</p>}
        {message && <p className={styles.notice} role="status">{message}</p>}
        <Field id="register-email" label="ელფოსტა" type="email" value={email} onChange={setEmail}
          placeholder="name@example.com" error={errors.email} autoComplete="email" />
        <PasswordField id="register-password" label="პაროლი" value={password} onChange={setPassword}
          error={errors.password} autoComplete="new-password" />
        <PasswordField id="register-password-confirmation" label="გაიმეორეთ პაროლი" value={passwordConfirmation}
          onChange={setPasswordConfirmation} error={errors.passwordConfirmation} autoComplete="new-password" />
        <button className={styles.submit} type="submit" disabled={!configured || submitting}>
          {submitting ? 'მიმდინარეობს რეგისტრაცია…' : 'ანგარიშის შექმნა'}
        </button>
      </form>
      <div className={styles.footer}><span>უკვე გაქვთ ანგარიში?</span><Link to="/login">შესვლა</Link></div>
    </FormCard>
  );
}

export function ForgotPasswordPage() {
  const { configured, sendPasswordRecovery } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    const result = recoverySchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'შეამოწმეთ ელფოსტის მისამართი.');
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordRecovery(result.data.email);
      setMessage('თუ ამ ელფოსტაზე ანგარიში არსებობს, პაროლის აღდგენის ბმულს მიიღებთ.');
    } catch (error) {
      setError(getGeorgianAuthError(error, 'recovery'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormCard
      title="პაროლის აღდგენა"
      description="მიუთითეთ ელფოსტა პაროლის აღდგენის ბმულის მისაღებად."
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {message && (
          <p className={styles.notice} role="status">
            {message}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Field
          id="recovery-email"
          label="ელფოსტა"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <button className={styles.submit} type="submit" disabled={!configured || submitting}>
          {submitting ? 'იგზავნება…' : 'ბმულის გაგზავნა'}
        </button>
      </form>
      <Link className={styles.backLink} to="/login">
        შესვლის გვერდზე დაბრუნება
      </Link>
    </FormCard>
  );
}

export function ResetPasswordPage() {
  const { updatePassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const processedCode = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function prepareSession() {
      if (loading) return;

      if (!supabase) {
        if (active) {
          setError('სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.');
          setReady(true);
        }
        return;
      }

      const code = new URLSearchParams(window.location.search).get('code');

      if (code) {
        if (processedCode.current === code) {
          if (active) setReady(true);
          return;
        }

        processedCode.current = code;

        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            if (active) setError('აღდგენის ბმული არასწორია ან ვადაგასულია.');
          } else {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch {
          if (active) setError('აღდგენის ბმულის შემოწმება ვერ მოხერხდა.');
        }
      } else if (!user) {
        setError('პაროლის აღდგენის ბმული არ მოიძებნა. მოითხოვეთ ახალი ბმული.');
      }

      if (active) setReady(true);
    }

    void prepareSession();
    return () => {
      active = false;
    };
  }, [loading, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const result = passwordResetSchema.safeParse({ password, passwordConfirmation });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'შეამოწმეთ პაროლი.');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(result.data.password);
      setMessage('პაროლი წარმატებით შეიცვალა.');
      navigate('/onboarding', { replace: true });
    } catch (error) {
      setError(getGeorgianAuthError(error, 'password'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormCard title="ახალი პაროლი" description="შექმენით ახალი პაროლი თქვენი ანგარიშისთვის.">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {!ready && <p role="status">ბმული მოწმდება…</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className={styles.notice} role="status">
            {message}
          </p>
        )}
        <PasswordField
          id="new-password"
          label="ახალი პაროლი"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordField
          id="new-password-confirmation"
          label="გაიმეორეთ ახალი პაროლი"
          value={passwordConfirmation}
          onChange={setPasswordConfirmation}
          autoComplete="new-password"
        />
        <button className={styles.submit} type="submit" disabled={!ready || !user || submitting}>
          {submitting ? 'მიმდინარეობს შენახვა…' : 'პაროლის შეცვლა'}
        </button>
      </form>
      <Link className={styles.backLink} to="/login">
        შესვლის გვერდზე დაბრუნება
      </Link>
    </FormCard>
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function verifyEmail() {
      try {
        if (!supabase) {
          setError('სისტემა ჯერ არ არის დაკავშირებული Supabase პროექტთან.');
          return;
        }

        const code = new URLSearchParams(window.location.search).get('code');
        if (!code) {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (!active) return;

          if (sessionError) {
            setError('სესიის შემოწმება ვერ მოხერხდა.');
          } else if (data.session) {
            navigate('/dashboard', { replace: true });
          } else {
            setError('დადასტურების ბმული არასწორია ან ვადაგასულია.');
          }
          return;
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;

        if (exchangeError) {
          setError('ელფოსტის დადასტურება ვერ მოხერხდა. მოითხოვეთ ახალი ბმული.');
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch {
        if (active) setError('ელფოსტის დადასტურება ვერ მოხერხდა. სცადეთ მოგვიანებით.');
      }
    }

    void verifyEmail();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <FormCard
      title="ელფოსტის დადასტურება"
      description="თქვენი ანგარიშის დადასტურების პროცესი მიმდინარეობს."
    >
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p role="status">მიმდინარეობს დადასტურება…</p>
      )}
      <Link className={styles.backLink} to="/login">
        შესვლის გვერდზე დაბრუნება
      </Link>
    </FormCard>
  );
}

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch {
      setError('გასვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    }
  }

  return (
    <section className={styles.dashboard}>
      <h1>პირადი კაბინეტი</h1>
      <p>ანგარიში წარმატებით არის დაკავშირებული.</p>
      <p>{user?.email}</p>
      <p>პირადი კაბინეტისა და კონკურსზე განაცხადის ფუნქციები დაემატება შემდეგ ეტაპზე.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void handleSignOut()}>გასვლა</Button>
    </section>
  );
}

export function AdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch {
      setError('გასვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    }
  }

  return (
    <section className={styles.dashboard}>
      <h1>ადმინისტრირება</h1>
      <p>ადმინისტრატორის ანგარიში აქტიურია.</p>
      <p>{user?.email}</p>
      <p>ადმინისტრირების ფუნქციები დაემატება შემდეგ ეტაპზე.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void handleSignOut()}>გასვლა</Button>
    </section>
  );
}
