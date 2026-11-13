-- A SECURITY DEFINER trigger must not resolve objects through writable schemas.
alter function public.capture_contact_consent_event() set search_path = '';
