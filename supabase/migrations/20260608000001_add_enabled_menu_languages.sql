-- Add enabled_menu_languages to business_operations
-- NULL = default (local language only, derived from country)
-- TEXT[] e.g. ['da','en'] = explicitly enabled languages (Pro feature)

ALTER TABLE business_operations
  ADD COLUMN IF NOT EXISTS enabled_menu_languages TEXT[] DEFAULT NULL;

COMMENT ON COLUMN business_operations.enabled_menu_languages IS
  'Pro feature: list of ISO 639-1 language codes enabled for menu generation. '
  'NULL = Smart default (local language only). '
  'Set by business owner in settings. Requires subscription_tier = ''pro''.';
