import { Link } from 'react-router-dom';
import AcademyLogo from '../components/branding/AcademyLogo';
import LineIcon from '../components/ui/LineIcon';
import styles from './HomePage.module.scss';

const informationCards = [
  {
    title: 'ვის შეუძლია მონაწილეობა',
    description: 'მონაწილეობის პირობები და ასაკობრივი მოთხოვნები დაზუსტდება.',
  },
  {
    title: 'მშობლის თანხმობა',
    description: 'მშობლის ან მეურვის თანხმობის პროცედურა ჯერ არ არის დადასტურებული.',
  },
  {
    title: 'კონკურსი ადგილზე ტარდება',
    description: 'კონკურსის ჩატარების ფორმატი და დეტალები ორგანიზატორების მიერ დაზუსტდება.',
  },
];

const registrationSteps = [
  {
    title: 'ანგარიშის შექმნა',
    description: 'შექმენით ანგარიში და დაადასტურეთ ელფოსტა.',
  },
  {
    title: 'ფორმის შევსება',
    description: 'შეავსეთ პირადი, სასწავლო და მშობლის საკონტაქტო ინფორმაცია.',
  },
  {
    title: 'განაცხადის გაგზავნა',
    description: 'გადაამოწმეთ მონაცემები და გააგზავნეთ განაცხადი.',
  },
  {
    title: 'სტატუსის თვალყურის დევნება',
    description: 'კაბინეტში ნახავთ განაცხადის სტატუსს და შეტყობინებებს.',
  },
];

const frequentlyAskedQuestions = [
  {
    question: 'როგორ გავიარო რეგისტრაცია?',
    answer: 'რეგისტრაციის პროცესი და მისი დაწყების თარიღი დაზუსტდება.',
  },
  {
    question: 'ვის შეუძლია კონკურსში მონაწილეობა?',
    answer: 'მონაწილეობის ოფიციალური კრიტერიუმები ჯერ არ არის დადასტურებული.',
  },
  {
    question: 'როგორ ვნახო ჩემი განაცხადი?',
    answer: 'განაცხადის სტატუსის ნახვის ფუნქცია დაემატება შესაბამის ეტაპზე.',
  },
  {
    question: 'როგორ დავუკავშირდე ადმინისტრაციას?',
    answer: 'საკონტაქტო ინფორმაცია დაემატება ორგანიზატორების დადასტურების შემდეგ.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>ახალგაზრდა ლიდერთა აკადემია</p>
            <h1>ახალგაზრდა ლიდერთა აკადემიის კონკურსი</h1>
            <p className={styles.heroDescription}>
              დარეგისტრირდით ონლაინ, თვალი ადევნეთ განაცხადის სტატუსს და მიიღეთ მნიშვნელოვანი
              ინფორმაცია ერთ სივრცეში.
            </p>

            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} to="/apply">
                კონკურსზე რეგისტრაცია
              </Link>
              <Link className={styles.secondaryButton} to="/competition">
                დეტალურად
              </Link>
            </div>

            <p className={styles.disclaimer}>
              რეგისტრაციის ბოლო ვადა: დასაზუსტებელია (დროებითი ტექსტი)
            </p>
          </div>

          <div className={styles.heroEmblem}>
            <AcademyLogo variant="hero" />
          </div>
        </div>
      </section>

      <section className={styles.featuredCompetition} aria-labelledby="featured-title">
        <div className={styles.sectionInner}>
          <h2 id="featured-title">მიმდინარე კონკურსი</h2>

          <article className={styles.competitionCard}>
            <div className={styles.competitionDescription}>
              <h3>კონკურსის დასახელება — დასაზუსტებელია</h3>
              <p>
                კონკურსის აღწერა და მიზანი დაემატება კლიენტისგან ინფორმაციის მიღების შემდეგ. ეს
                ტექსტი დროებითია.
              </p>
              <Link className={styles.primaryButton} to="/competition">
                კონკურსის დეტალები
              </Link>
            </div>

            <dl className={styles.competitionFacts}>
              <div>
                <dt>რეგისტრაციის ბოლო ვადა</dt>
                <dd>დასაზუსტებელია</dd>
              </div>
              <div>
                <dt>მონაწილეები</dt>
                <dd>მოსწავლეები (დასაზუსტებელია)</dd>
              </div>
              <div>
                <dt>ჩატარების ფორმატი</dt>
                <dd>დასაზუსტებელია</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section className={styles.importantInformation} aria-labelledby="information-title">
        <div className={styles.sectionInner}>
          <h2 id="information-title">მნიშვნელოვანი ინფორმაცია</h2>

          <div className={styles.informationGrid}>
            {informationCards.map((card) => (
              <article className={styles.informationCard} key={card.title}>
                <span className={styles.informationIcon}>
                  <LineIcon name="user" size={20} />
                </span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.registrationProcess} aria-labelledby="registration-title">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <h2 id="registration-title">რეგისტრაციის პროცესი</h2>
            <p>ოთხი მარტივი ნაბიჯი განაცხადის გასაგზავნად</p>
          </div>

          <ol className={styles.steps}>
            {registrationSteps.map((step, index) => (
              <li className={styles.step} key={step.title}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.aboutSection} aria-labelledby="about-title">
        <div className={styles.aboutInner}>
          <div className={styles.aboutImagePlaceholder} aria-label="აკადემიის ფოტო დაემატება">
            ფოტო · placeholder
          </div>

          <div className={styles.aboutCopy}>
            <h2 id="about-title">აკადემიის შესახებ</h2>
            <p>
              აკადემიის ოფიციალური აღწერა, მისია და ღირებულებები დაემატება კლიენტისგან ინფორმაციის
              მიღების შემდეგ. ეს ტექსტი დროებითია.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.faqSection} id="faq" aria-labelledby="faq-title">
        <div className={styles.sectionInner}>
          <h2 id="faq-title">ხშირად დასმული კითხვები</h2>

          <div className={styles.faqList}>
            {frequentlyAskedQuestions.map((item, index) => (
              <details className={styles.faqItem} key={item.question} open={index === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.contactSection} id="contact" aria-labelledby="contact-title">
        <div className={styles.sectionInner}>
          <h2 id="contact-title">კონტაქტი</h2>

          <div className={styles.contactGrid}>
            <article className={styles.contactCard}>
              <h3>ტელეფონი</h3>
              <p>დასაზუსტებელია</p>
            </article>
            <article className={styles.contactCard}>
              <h3>ელფოსტა</h3>
              <p>დასაზუსტებელია</p>
            </article>
            <article className={styles.contactCard}>
              <h3>მისამართი</h3>
              <p>დასაზუსტებელია</p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
