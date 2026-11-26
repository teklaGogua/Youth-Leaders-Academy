import { Outlet } from 'react-router-dom';
import AcademyLogo from '../../components/branding/AcademyLogo';
import LineIcon from '../../components/ui/LineIcon';
import styles from './AuthLayout.module.scss';

const benefits = [
  'რეგისტრაცია რამდენიმე წუთში',
  'შეავსე მონაწილის პროფილი უსაფრთხოდ',
  'შეინახე პროგრესი და გააგრძელე მოგვიანებით',
];

export default function AuthLayout() {
  const { user, role, registrationComplete } = useAuth();
  const location = useLocation();
  if (location.pathname === '/register' && user && role === 'participant' && !registrationComplete)
    return <Outlet />;
  return (
    <div className={styles.page}>
      <aside className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brand}>
            <AcademyLogo />
            <span>ახალგაზრდა ლიდერთა აკადემია</span>
          </div>
          <h1>გახდი ახალგაზრდა ლიდერი</h1>
          <p className={styles.intro}>
            შექმენი ანგარიში და შეავსე მონაწილის პროფილი ერთ სივრცეში.
          </p>
          <ul className={styles.benefits}>
            {benefits.map((benefit) => (
              <li key={benefit}>
                <LineIcon name="check-circle" size={20} />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.photoPlaceholder}>
          <LineIcon name="camera" size={32} />
          <strong>ფოტო · აკადემიის ავთენტური ფოტო</strong>
          <span>ჩასანაცვლებელია რეალური ფოტოთი · 2:1</span>
        </div>
      </aside>
      <section className={styles.formArea}>
        <Outlet />
      </section>
    </div>
  );
}
