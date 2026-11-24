-- PDPA: separate the privacy-notice acknowledgement and the explicit consent for
-- allergy (health) data from marketing consent, each stored with the notice version.
alter table public.customer_consents drop constraint if exists customer_consents_consent_type_check;
alter table public.customer_consents add constraint customer_consents_consent_type_check
  check (consent_type in ('data_processing','privacy_notice','health_data','marketing_email','marketing_sms','marketing_line','birthday_offers'));
