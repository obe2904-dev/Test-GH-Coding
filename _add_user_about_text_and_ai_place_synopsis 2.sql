-- Split user-facing Om os text from AI-facing synopsis fields.
-- business_profile.long_description remains AI-facing website summary for existing consumers.
-- business_profile.user_about_text is the editable UI field shown to users.
-- business_profile.ai_place_synopsis stores compact factual place synopsis from menu signal.

alter table public.business_profile
  add column if not exists user_about_text text;

alter table public.business_profile
  add column if not exists ai_place_synopsis text;

-- Backfill once so existing businesses still show Om os text in the new UI field.
update public.business_profile
set user_about_text = long_description
where user_about_text is null
  and long_description is not null;