import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import AcademyLogo from '../branding/AcademyLogo';
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

  function closeMenu() {
    setMenuOpen(false);
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
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
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

            <Link className={styles.loginButton} to="/login" onClick={closeMenu}>
              შესვლა
            </Link>
            <Link className={styles.registrationButton} to="/registration" onClick={closeMenu}>
              რეგისტრაცია
            </Link>
          </nav>
        </div>
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
