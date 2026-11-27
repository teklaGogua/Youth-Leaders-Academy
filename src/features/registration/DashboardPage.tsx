import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { ParticipantRegistration, ApplicationStatus } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import styles from './RegistrationPage.module.scss';

type ApplicationSummary = {
  id: string;
  competition_id: string;
  status: ApplicationStatus;
  created_at: string;
};

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<ParticipantRegistration | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      const { data: row, error: registrationError } = await supabase
        .from('participant_registrations').select('*').maybeSingle();
      if (!active) return;
      if (registrationError || !row) {
        setError('რეგისტრაციის მონაცემების ჩატვირთვა ვერ მოხერხდა.');
        setLoading(false);
        return;
      }
      setRegistration(row);
      const { data: participant } = await supabase.from('participants')
        .select('id').eq('user_id', user?.id ?? '').maybeSingle();
      if (participant) {
        const { data, error: applicationsError } = await supabase.from('applications')
          .select('id,competition_id,status,created_at')
          .eq('participant_id', participant.id)
          .order('created_at', { ascending: false });
        if (applicationsError) setError('განაცხადების ჩატვირთვა ვერ მოხერხდა.');
        else setApplications(data ?? []);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user?.id]);

  async function logout() {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch {
      setError('სისტემიდან გასვლა ვერ მოხერხდა.');
    }
  }

  if (loading) return <p role="status">პირადი კაბინეტი იტვირთება…</p>;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Youth Leaders Academy</p>
        <h1>პირადი კაბინეტი</h1>
        <p>{user?.email}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {registration && (
          <>
            <h2>რეგისტრაციის სტატუსი</h2>
            <p className={styles.success}>რეგისტრაცია დასრულებულია</p>
            <dl>
              <dt>მონაწილე</dt><dd>{registration.first_name} {registration.last_name}</dd>
              <dt>ასაკი</dt><dd>{registration.age}</dd>
              <dt>სკოლა / კლასი</dt><dd>{registration.school} · {registration.grade}</dd>
              <dt>მშობელი / მეურვე</dt><dd>{registration.guardian_full_name}</dd>
              <dt>მშობლის ელფოსტა</dt><dd>{registration.guardian_email}</dd>
              <dt>ელფოსტა დადასტურებულია</dt><dd>{registration.guardian_verified_at ? 'დიახ' : 'არა'}</dd>
              <dt>მშობლის თანხმობა</dt><dd>{registration.parental_consent_at ? 'მიღებულია' : 'არ არის მიღებული'}</dd>
              <dt>Terms ვერსია</dt><dd>{registration.terms_version}</dd>
              <dt>Privacy ვერსია</dt><dd>{registration.privacy_version}</dd>
              <dt>მშობლის თანხმობის Terms ვერსია</dt><dd>{registration.parental_consent_terms_version}</dd>
              <dt>მშობლის თანხმობის Privacy ვერსია</dt><dd>{registration.parental_consent_privacy_version}</dd>
            </dl>
          </>
        )}
        <h2>კონკურსის განაცხადები</h2>
        {applications.length ? (
          <ul>{applications.map((application) => (
            <li key={application.id}>კონკურსი: {application.competition_id} — სტატუსი: {application.status}</li>
          ))}</ul>
        ) : <p>განაცხადები ჯერ არ არის.</p>}
        <button className={styles.primary} onClick={() => void logout()}>გასვლა</button>
      </section>
    </main>
  );
}
