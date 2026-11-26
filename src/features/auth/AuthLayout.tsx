import { Outlet } from 'react-router-dom';
import AcademyLogo from '../../components/branding/AcademyLogo';
import LineIcon from '../../components/ui/LineIcon';
import styles from './AuthLayout.module.scss';

const benefits = [
  'რეგისტრაცია რამდენიმე წუთში',
  'განაცხადის სტატუსი რეალურ დროში',
  'ჩატბოტი — პასუხი კითხვებზე',
];

export default function AuthLayout() {
  return (
    <main className={styles.page}>
      <aside className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brand}>
            <AcademyLogo />
            <span>ახალგაზრდა ლიდერთა აკადემია</span>
          </div>
          <h1>გახდი ახალგაზრდა ლიდერი</h1>
          <p className={styles.intro}>
            შექმენი ანგარიში, გაგზავნე განაცხადი და თვალი ადევნე სტატუსს ერთ სივრცეში.
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
    </main>
  );
}
