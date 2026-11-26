import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import AcademyLogo from '../branding/AcademyLogo';
import { useAuth } from '../../features/auth/AuthProvider';
import styles from './PublicLayout.module.scss';

const navigationLinks = [
  { to: '/', label: 'მთავარი', end: true },
  { to: '/competition', label: 'კონკურსი', end: false },
  { to: '/about', label: 'შესახებ', end: false },
  { to: '/#faq', label: 'კითხვები', end: false },
  { to: '/#contact', label: 'კონტაქტი', end: false },
];

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, role, registrationComplete, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const accountPath =
    role === 'administrator' ? '/admin' : registrationComplete ? '/dashboard' : '/register?step=2';
  function closeMenu() {
    setMenuOpen(false);
  }
  async function logout() {
    try {
      await signOut();
      closeMenu();
      navigate('/', { replace: true });
    } catch {
      setLogoutError('გასვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
    }
  }
  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link className={styles.brand} to="/" onClick={closeMenu}>
            <AcademyLogo variant="compact" />
            <span>ახალგაზრდა ლიდერთა აკადემია</span>
          </Link>
          <button
            className={styles.menuButton}
            type="button"
            aria-label={menuOpen ? 'მენიუს დახურვა' : 'ნავიგაციის მენიუს გახსნა'}
            aria-expanded={menuOpen}
            aria-controls="public-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav
            id="public-navigation"
            aria-label="მთავარი ნავიგაცია"
            className={menuOpen ? styles.navOpen : styles.nav}
          >
            {navigationLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={closeMenu}
                className={({ isActive }) => (isActive ? styles.activeLink : styles.navLink)}
              >
                {link.label}
              </NavLink>
            ))}
            {!loading && user ? (
              <>
                <Link className={styles.loginButton} to={accountPath} onClick={closeMenu}>
                  პირადი კაბინეტი
                </Link>
                <button
                  className={styles.registrationButton}
                  type="button"
                  onClick={() => void logout()}
                >
                  გასვლა
                </button>
              </>
            ) : (
              <>
                <Link className={styles.loginButton} to="/login" onClick={closeMenu}>
                  შესვლა
                </Link>
                <Link className={styles.registrationButton} to="/register" onClick={closeMenu}>
                  ანგარიშის შექმნა
                </Link>
              </>
            )}
          </nav>
        </div>
        {logoutError && (
          <p role="alert" className={styles.logoutError}>
            {logoutError}
          </p>
        )}
      </header>
      <main>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <strong>ახალგაზრდა ლიდერთა აკადემია</strong>
          <nav aria-label="დამატებითი ნავიგაცია">
            <Link to="/competition">კონკურსი</Link>
            <Link to="/about">აკადემიის შესახებ</Link>
            <Link to="/#contact">კონტაქტი</Link>
          </nav>
          <span>© დროებითი ტექსტი</span>
        </div>
      </footer>
      <button
        className={styles.chatLauncher}
        type="button"
        aria-label="დახმარება — ჩატბოტი მოგვიანებით დაემატება"
        title="ჩატბოტის ფუნქცია მოგვიანებით დაემატება"
        disabled
      >
        <span aria-hidden="true" />
        დახმარება
      </button>
    </>
  );
}
