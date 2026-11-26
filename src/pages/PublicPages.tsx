import { Link } from 'react-router-dom';
import styles from './PublicPages.module.scss';

const competitionFacts = [
  { label: 'რეგისტრაციის ბოლო ვადა', value: 'დასაზუსტებელია' },
  { label: 'მონაწილეები', value: 'დასაზუსტებელია' },
  { label: 'ჩატარების ფორმატი', value: 'დასაზუსტებელია' },
  { label: 'ხანგრძლივობა', value: 'დასაზუსტებელია' },
];

const participationRequirements = [
  'კლასისა და ასაკის მოთხოვნები — დასაზუსტებელია',
  'ასაკობრივი შეზღუდვა — დასაზუსტებელია',
  'მშობლის ან მეურვის თანხმობის წესი — დასაზუსტებელია',
  'ადგილზე მონაწილეობის პირობები — დასაზუსტებელია',
];

const competitionStages = [
  {
    title: 'რეგისტრაცია',
    description: 'ონლაინ განაცხადის შევსება და გაგზავნა.',
  },
  {
    title: 'განაცხადების განხილვა',
    description: 'განაცხადების განხილვის პროცედურა დასაზუსტებელია.',
  },
  {
    title: 'შერჩევის ეტაპი',
    description: 'შერჩევის კრიტერიუმები და ფორმატი დასაზუსტებელია.',
  },
  {
    title: 'შედეგების გამოცხადება',
    description: 'შედეგების გამოქვეყნების თარიღი დასაზუსტებელია.',
  },
];

const requiredInformation = [
  {
    title: 'პირადი მონაცემები',
    description: 'სახელი, გვარი, ასაკი და მოკლე ბიოგრაფია.',
  },
  {
    title: 'სასწავლო ინფორმაცია',
    description: 'სკოლა, კლასი და მასწავლებლის სახელი.',
  },
  {
    title: 'მშობლის კონტაქტი',
    description: 'ტელეფონი, ელფოსტა და თანხმობა.',
  },
];

const competitionQuestions = [
  {
    question: 'ვის შეუძლია კონკურსში მონაწილეობა?',
    answer: 'მონაწილეობის ოფიციალური კრიტერიუმები ჯერ არ არის დადასტურებული.',
  },
  {
    question: 'როგორ გავიგო განაცხადის შედეგი?',
    answer: 'შედეგების მიღების არხი და თარიღი დაზუსტდება.',
  },
  {
    question: 'როდის გაიხსნება რეგისტრაცია?',
    answer: 'რეგისტრაციის დაწყების თარიღი დასაზუსტებელია.',
  },
];

const academyQuestions = [
  {
    question: 'რა არის ახალგაზრდა ლიდერთა აკადემია?',
    answer:
      'აკადემიის ოფიციალური აღწერა, მისია და ღირებულებები დაემატება ორგანიზაციისგან ინფორმაციის მიღების შემდეგ.',
  },
  {
    question: 'როგორ დავუკავშირდე ორგანიზატორებს?',
    answer: 'საკონტაქტო არხები დაემატება მათი დადასტურების შემდეგ.',
  },
];

function SectionHeading({ children }: { children: string }) {
  return <h2 className={styles.sectionHeading}>{children}</h2>;
}

function QuestionList({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <div className={styles.questionList}>
      {items.map((item, index) => (
        <details className={styles.questionItem} key={item.question} open={index === 0}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function CompetitionPage() {
  return (
    <>
      <section className={styles.competitionHero}>
        <div className={styles.competitionHeroInner}>
          <nav className={styles.breadcrumbs} aria-label="პურის ნამცეცების ნავიგაცია">
            <Link to="/">მთავარი</Link>
            <span aria-hidden="true">›</span>
            <Link to="/competition">კონკურსი</Link>
            <span aria-hidden="true">›</span>
            <span>კონკურსის დეტალები</span>
          </nav>

          <div className={styles.competitionHeroGrid}>
            <div className={styles.competitionHeroCopy}>
              <span className={styles.statusChip}>რეგისტრაციის სტატუსი დასაზუსტებელია</span>
              <h1>ახალგაზრდა ლიდერთა კონკურსი</h1>
              <p>
                კონკურსის აღწერა და მიზანი დაემატება კლიენტისგან ინფორმაციის მიღების შემდეგ. ეს
                ტექსტი დროებითია.
              </p>

              <div className={styles.competitionActions}>
                <Link className={styles.accentButton} to="/apply">
                  კონკურსზე რეგისტრაცია
                </Link>
                <span className={styles.rulesButton} aria-disabled="true">
                  წესების ჩამოტვირთვა — მიუწვდომელია
                </span>
              </div>

              <div className={styles.heroMeta}>
                <span>ბოლო ვადა: დასაზუსტებელია</span>
                <span>ფორმატი: დასაზუსტებელია</span>
              </div>
            </div>

            <div className={styles.photoPlaceholder}>
              <span aria-hidden="true">▧</span>
              <strong>ფოტო · კონკურსის მონაწილეები</strong>
              <small>ჩასანაცვლებელია აკადემიის რეალური ფოტოთი · 3:2</small>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.factsStrip} aria-label="კონკურსის ძირითადი ინფორმაცია">
        <div className={styles.factsGrid}>
          {competitionFacts.map((fact, index) => (
            <article className={styles.factCard} key={fact.label}>
              <span className={styles.factIcon} aria-hidden="true">
                {['▦', '♧', '⌖', '◷'][index]}
              </span>
              <div>
                <h2>{fact.label}</h2>
                <p>{fact.value}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.competitionContent}>
        <div className={styles.competitionMain}>
          <section className={styles.detailSection}>
            <SectionHeading>კონკურსის შესახებ</SectionHeading>
            <p>
              კონკურსის აღწერა, მიზანი და ფორმატი დაემატება კლიენტისგან ინფორმაციის მიღების შემდეგ.
              ეს ტექსტი დროებითია და მხოლოდ განლაგების დემონსტრაციისთვისაა გამოყენებული.
            </p>
          </section>

          <section className={styles.detailSection}>
            <SectionHeading>ვის შეუძლია მონაწილეობა</SectionHeading>
            <ul className={styles.requirementList}>
              {participationRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </section>

          <section className={styles.detailSection}>
            <SectionHeading>კონკურსის ეტაპები</SectionHeading>
            <ol className={styles.timeline}>
              {competitionStages.map((stage, index) => (
                <li key={stage.title}>
                  <span className={styles.timelineNumber}>{index + 1}</span>
                  <div>
                    <div className={styles.timelineTitle}>
                      <h3>{stage.title}</h3>
                      <span>დასაზუსტებელია</span>
                    </div>
                    <p>{stage.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.detailSection}>
            <SectionHeading>რა ინფორმაცია დაგჭირდებათ</SectionHeading>
            <div className={styles.requiredGrid}>
              {requiredInformation.map((item) => (
                <article className={styles.requiredCard} key={item.title}>
                  <span aria-hidden="true">▤</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.detailSection}>
            <SectionHeading>აკადემიის ცხოვრება</SectionHeading>
            <div className={styles.galleryGrid}>
              {[1, 2, 3].map((number) => (
                <div className={styles.galleryPlaceholder} key={number}>
                  <span aria-hidden="true">▧</span>
                  <small>ფოტო {number}</small>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.detailSection}>
            <SectionHeading>ხშირად დასმული კითხვები</SectionHeading>
            <QuestionList items={competitionQuestions} />
          </section>
        </div>

        <aside className={styles.competitionSidebar}>
          <section className={styles.registrationCard}>
            <h2>რეგისტრაცია</h2>
            <p className={styles.deadlineLabel}>რეგისტრაციის ბოლო ვადა</p>
            <strong>დასაზუსტებელია</strong>
            <ul>
              <li>შექმენით ანგარიში</li>
              <li>შეავსეთ განაცხადი</li>
              <li>თვალი ადევნეთ სტატუსს</li>
            </ul>
            <Link className={styles.sidebarButton} to="/apply">
              კონკურსზე რეგისტრაცია
            </Link>
          </section>

          <section className={styles.chatCard}>
            <h2>გაქვთ კითხვა?</h2>
            <p>ჩატბოტის ფუნქცია დაემატება ცალკე ეტაპზე.</p>
            <span>დაგვისვით კითხვა ჩატში — მიუწვდომელია</span>
          </section>
        </aside>
      </div>

      <section className={styles.finalCallout}>
        <div>
          <h2>მზად ხართ განაცხადის გასაგზავნად?</h2>
          <p>რეგისტრაციის დაწყების დრო და პირობები ჯერ დასაზუსტებელია.</p>
        </div>
        <Link className={styles.accentButton} to="/apply">
          კონკურსზე რეგისტრაცია
        </Link>
      </section>

    </>
  );
}

export function AboutPage() {
  return (
    <section className={styles.simplePage}>
      <div className={styles.simpleContainer}>
        <p className={styles.eyebrow}>ჩვენ შესახებ</p>
        <h1>ახალგაზრდა ლიდერთა აკადემია</h1>
        <p className={styles.simpleLead}>
          აკადემიის ოფიციალური აღწერა, მისია და ღირებულებები დაემატება ორგანიზაციისგან ინფორმაციის
          მიღების შემდეგ.
        </p>
      </div>
    </section>
  );
}

export function FAQPage() {
  return (
    <section className={styles.simplePage} id="faq">
      <div className={styles.simpleContainer}>
        <p className={styles.eyebrow}>დახმარება</p>
        <h1>ხშირად დასმული კითხვები</h1>
        <QuestionList items={academyQuestions} />
      </div>
    </section>
  );
}

export function TemporaryPage({ title }: { title: string }) {
  return (
    <section className={styles.simplePage}>
      <div className={styles.simpleContainer}>
        <div className={styles.temporaryCard}>
          <p className={styles.eyebrow}>მალე</p>
          <h1>{title}</h1>
          <p className={styles.simpleLead}>
            ეს გვერდი ამ ეტაპზე მხოლოდ ვიზუალური მონახაზია. ფუნქციონალი დაემატება ცალკე დამტკიცებულ
            ეტაპზე.
          </p>
          <Link className={styles.sidebarButton} to="/">
            მთავარ გვერდზე დაბრუნება
          </Link>
        </div>
      </div>
    </section>
  );
}
