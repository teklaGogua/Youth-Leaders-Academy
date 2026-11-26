-- Synthetic local-development records only. No official dates, fees, eligibility or contact details.
insert into public.competitions (slug, title, description, status)
values (
  'sample-draft',
  'სადემონსტრაციო კონკურსი (სინთეზური მონაცემი)',
  'ადგილობრივი განვითარებისათვის განკუთვნილი სატესტო ჩანაწერი.',
  'draft'
)
on conflict (slug) do nothing;

insert into public.faq_entries (question, answer, category, is_published)
select
  'სად ვიპოვო კონკურსის ოფიციალური პირობები?',
  'ოფიციალური პირობები დაემატება ორგანიზაციის მიერ დადასტურების შემდეგ.',
  'სადემონსტრაციო',
  false
where not exists (
  select 1 from public.faq_entries where question = 'სად ვიპოვო კონკურსის ოფიციალური პირობები?'
);
