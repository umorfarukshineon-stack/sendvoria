-- Pin the trigger function to a trusted search path.
-- All application objects referenced by this function are schema-qualified.
alter function public.prevent_contact_consent_event_mutation() set search_path = '';
