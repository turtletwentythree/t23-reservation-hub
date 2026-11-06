-- Add French ('fr') as a supported guest language.

alter table public.users drop constraint if exists users_preferred_language_check;
alter table public.users add constraint users_preferred_language_check check (preferred_language in ('en','th','ja','fr'));
alter table public.customers drop constraint if exists customers_preferred_language_check;
alter table public.customers add constraint customers_preferred_language_check check (preferred_language in ('en','th','ja','fr'));
alter table public.reservations drop constraint if exists reservations_language_check;
alter table public.reservations add constraint reservations_language_check check (language in ('en','th','ja','fr'));
alter table public.notification_templates drop constraint if exists notification_templates_locale_check;
alter table public.notification_templates add constraint notification_templates_locale_check check (locale in ('en','th','ja','fr'));

-- Existing data: add French text where it is still the default English text. Custom text is left alone
-- (the booking page falls back to English when a French version is missing).
update public.booking_policies
set cancellation_policy = cancellation_policy || jsonb_build_object('fr',
      'Annulation gratuite jusqu''à 24 heures avant votre réservation. En cas d''annulation tardive ou d''absence, l''acompte peut être conservé.')
where not cancellation_policy ? 'fr'
  and cancellation_policy->>'en' = 'Free cancellation up to 24 hours before your reservation. Late cancellations and no-shows may forfeit the deposit.';

update public.booking_policies
set booking_terms = booking_terms || jsonb_build_object('fr', 'Merci d''arriver à l''heure. Les tables sont réservées pendant 15 minutes.')
where not booking_terms ? 'fr'
  and booking_terms->>'en' = 'Please arrive on time. Tables are held for 15 minutes.';

update public.booking_types set name = name || '{"fr":"À la carte"}' where not name ? 'fr' and name->>'en' = 'À la carte';
update public.booking_types set name = name || '{"fr":"Menu omakase"}' where not name ? 'fr' and name->>'en' = 'Omakase course';
update public.booking_types set description = description || '{"fr":"Menu de saison du chef"}'
where description is not null and not description ? 'fr' and description->>'en' = 'Chef''s seasonal course';

-- French email templates for each organisation that does not have them yet.
insert into public.notification_templates (organization_id, event, channel, locale, subject, body)
select o.id, v.event::public.notification_event, 'email'::public.notification_channel, 'fr', v.subject, v.body
from public.organizations o
cross join (values
  ('booking_confirmation', 'Votre réservation chez {{restaurant_name}} est confirmée',
   'Bonjour {{customer_name}},\n\nMerci d''avoir réservé chez {{restaurant_name}}.\nRéférence : {{reference}}\nDate : {{date}} à {{time}}\nConvives : {{party_size}}\n\nGérer votre réservation : {{manage_url}}\n\nNous avons hâte de vous accueillir.'),
  ('booking_reminder', 'Rappel : {{restaurant_name}} demain',
   'Bonjour {{customer_name}},\n\nNous vous rappelons votre réservation chez {{restaurant_name}} le {{date}} à {{time}} pour {{party_size}} convives.\nRéférence : {{reference}}\nGérer : {{manage_url}}'),
  ('booking_modification', 'Votre réservation chez {{restaurant_name}} a été modifiée',
   'Bonjour {{customer_name}},\n\nVotre réservation {{reference}} est désormais prévue le {{date}} à {{time}} pour {{party_size}} convives.\nGérer : {{manage_url}}'),
  ('booking_cancellation', 'Votre réservation chez {{restaurant_name}} a été annulée',
   'Bonjour {{customer_name}},\n\nVotre réservation {{reference}} du {{date}} à {{time}} a été annulée.\nNous espérons vous accueillir une prochaine fois.')
) as v(event, subject, body)
where not exists (
  select 1 from public.notification_templates t
  where t.organization_id = o.id and t.restaurant_id is null and t.event::text = v.event and t.channel = 'email' and t.locale = 'fr'
);
