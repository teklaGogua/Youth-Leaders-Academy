import { Link } from 'react-router-dom';
import styles from './HomePage.module.scss';

const benefits = [
  { title: 'განვითარება', text: 'შეიძინე ცოდნა და განავითარე მნიშვნელოვანი უნარები.' },
  { title: 'თანამშრომლობა', text: 'გაიცანი თანატოლები და იმუშავე საერთო მიზნებზე.' },
  { title: 'ლიდერობა', text: 'აღმოაჩინე შენი შესაძლებლობები და გადადგი შემდეგი ნაბიჯი.' },
];

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>YOUTH LEADERS ACADEMY</p>
          <h1>შენი შესაძლებლობები. შენი მომავალი. შენი ლიდერობა.</h1>
          <p className={styles.intro}>აღმოაჩინე ახალი შესაძლებლობები, განავითარე საკუთარი უნარები და გახდი ცვლილებების ნაწილი.</p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} to="/competition">გაიგე მეტი</Link>
            <Link className={styles.secondaryButton} to="/about">აკადემიის შესახებ</Link>
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true"><span>YL</span><div className={styles.orbit} /></div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.kicker}>რატომ აკადემია?</p>
          <h2>შექმენი შენი შემდეგი შესაძლებლობა</h2>
          <div className={styles.benefits}>
            {benefits.map((benefit, index) => <article className={styles.benefit} key={benefit.title}><span className={styles.number}>0{index + 1}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}
          </div>
        </div>
      </section>
      <section className={styles.callout}>
        <div><p className={styles.kicker}>შემდეგი ნაბიჯი</p><h2>გაეცანი კონკურსის ინფორმაციას</h2><p>ოფიციალური პირობები და ვადები გამოქვეყნდება დადასტურების შემდეგ.</p></div>
        <Link className={styles.primaryButton} to="/competition">კონკურსის შესახებ</Link>
      </section>
    </>
  );
}
