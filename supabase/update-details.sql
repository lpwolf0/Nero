-- Run ONCE in Supabase > SQL Editor > New query > Run.
-- Updates the details already saved in your database to the new company details,
-- so they do not override the new website files.

insert into public.settings (key, value) values
  ('whatsapp_number', '2349134399522'),
  ('phone',           '+2349134399522')
on conflict (key) do update set value = excluded.value;

update public.settings
   set value = replace(value, 'Xclusive Rent A Car', 'Perfect Hand Integrated Services')
 where value like '%Xclusive Rent A Car%';

update public.faqs
   set question = replace(question, 'Xclusive Rent A Car', 'Perfect Hand Integrated Services'),
       answer   = replace(answer,   'Xclusive Rent A Car', 'Perfect Hand Integrated Services');
