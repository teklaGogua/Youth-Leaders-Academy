import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import styles from './PublicLayout.module.scss';

const links = [
  { to: '/', label: 'მთავარი' },
  { to: '/competition', label: 'კონკურსი' },
  { to: '/about', label: 'აკადემიის შესახებ' },
  { to: '/faq', label: 'ხშირად დასმული კითხვები' },
];

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link className={styles.brand} to="/" onClick={() => setMenuOpen(false)}>
            <span className={styles.mark}>YL</span>
            <span>ახალგაზრდა ლიდერთა აკადემია</span>
          </Link>
          <button className={styles.menuButton} type="button" aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? 'დახურვა' : 'მენიუ'}
          </button>
          <nav id="public-navigation" aria-label="მთავარი ნავიგაცია" className={menuOpen ? styles.navOpen : styles.nav}>
            {links.map((link) => <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? styles.activeLink : styles.navLink}>{link.label}</NavLink>)}
            <Link className={styles.cta} to="/apply" onClick={() => setMenuOpen(false)}>განაცხადის შევსება</Link>
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <strong>ახალგაზრდა ლიდერთა აკადემია</strong>
          <span>განვითარება · შესაძლებლობები · ლიდერობა</span>
          <nav aria-label="დამატებითი ნავიგაცია"><Link to="/competition">კონკურსი</Link><Link to="/about">ჩვენ შესახებ</Link><Link to="/faq">FAQ</Link></nav>
        </div>
      </footer>
      <button className={styles.chat} type="button" aria-label="ჩატის დემო — ჯერ მიუწვდომელია" title="ჩატის ფუნქცია მოგვიანებით დაემატება" onClick={() => window.alert('ჩატის ფუნქცია მოგვიანებით დაემატება.')}>?</button>
    </>
  );
}
