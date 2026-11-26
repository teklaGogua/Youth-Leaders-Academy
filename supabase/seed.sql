-- Local seed data contains no synthetic competition records.

insert into public.faq_entries (question, answer, category, is_published)
select
  'სად ვიპოვო კონკურსის ოფიციალური პირობები?',
  'ოფიციალური პირობები დაემატება ორგანიზაციის მიერ დადასტურების შემდეგ.',
  'სადემონსტრაციო',
  false
where not exists (
  select 1 from public.faq_entries where question = 'სად ვიპოვო კონკურსის ოფიციალური პირობები?'
);
