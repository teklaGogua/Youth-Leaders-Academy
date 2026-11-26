import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './PublicPages.module.scss';

const questions = [
  { q: 'რა არის ახალგაზრდა ლიდერთა აკადემია?', a: 'აკადემიის მიზანია ახალგაზრდებისთვის განვითარების, სწავლისა და ლიდერული უნარების გაძლიერების შესაძლებლობების შექმნა.' },
  { q: 'როგორ გავიგო კონკურსის პირობები?', a: 'კონკურსის ოფიციალური პირობები და ვადები გამოქვეყნდება აკადემიის მიერ დადასტურების შემდეგ.' },
  { q: 'როგორ დავუკავშირდე ორგანიზატორებს?', a: 'საკონტაქტო არხები დაემატება მას შემდეგ, რაც ორგანიზაცია დაადასტურებს მათ გამოქვეყნებას.' },
];

export function CompetitionPage() {
  return <section className={styles.page}><div className={styles.container}><p className={styles.eyebrow}>კონკურსი</p><h1>შენი ლიდერული გზა აქ იწყება</h1><p className={styles.lead}>გაეცანი აკადემიის პროგრამას და მოემზადე მონაწილეობის მისაღებად.</p><div className={styles.card}><h2>კონკურსის შესახებ</h2><p>კონკურსის თარიღები, მონაწილეობის პირობები და სხვა ოფიციალური დეტალები გამოქვეყნდება ორგანიზატორების დადასტურების შემდეგ.</p><p className={styles.note}>ამ გვერდზე მოცემული ინფორმაცია საინფორმაციო ხასიათისაა.</p><Link className={styles.button} to="/apply">განაცხადის გვერდი</Link></div></div></section>;
}
export function AboutPage() {
  return <section className={styles.page}><div className={styles.container}><p className={styles.eyebrow}>ჩვენ შესახებ</p><h1>ახალგაზრდა ლიდერთა აკადემია</h1><p className={styles.lead}>სივრცე ახალგაზრდებისთვის, რომ ისწავლონ, განვითარდნენ და აღმოაჩინონ საკუთარი შესაძლებლობები.</p><div className={styles.card}><h2>ჩვენი მიმართულება</h2><p>აკადემიის შესახებ დამატებითი ოფიციალური ინფორმაცია და პროგრამის დეტალები დაემატება ორგანიზაციის მიერ დადასტურების შემდეგ.</p></div></div></section>;
}
export function FAQPage() {
  const [expanded, setExpanded] = useState<number | null>(0);
  return <section className={styles.page}><div className={styles.container}><p className={styles.eyebrow}>დახმარება</p><h1>ხშირად დასმული კითხვები</h1><p className={styles.lead}>მოკლე პასუხები აკადემიის შესახებ გავრცელებულ კითხვებზე.</p><div className={styles.faq}>{questions.map((item,index)=><article className={styles.faqItem} key={item.q}><h2><button type="button" aria-expanded={expanded===index} onClick={()=>setExpanded(expanded===index?null:index)}>{item.q}<span aria-hidden="true">{expanded===index?'−':'+'}</span></button></h2>{expanded===index&&<p>{item.a}</p>}</article>)}</div></div></section>;
}
export function TemporaryPage({ title }: { title: string }) {
  return <section className={styles.page}><div className={styles.container}><div className={styles.card}><p className={styles.eyebrow}>მალე</p><h1>{title}</h1><p className={styles.lead}>ეს გვერდი ამ ეტაპზე მხოლოდ ვიზუალური მონახაზია. ფუნქციონალი დაემატება ცალკე დამტკიცებულ ეტაპზე.</p><Link className={styles.button} to="/">მთავარ გვერდზე დაბრუნება</Link></div></div></section>;
}
