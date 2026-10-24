-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0006 · WhatsApp as the "Speak to us" destination                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- The "Speak to us" buttons open a WhatsApp conversation with the firm rather
-- than scrolling to the contact form. The number lives here, with every other
-- piece of contact detail, so it is changed from Site settings → Contact and
-- never from the code.
--
-- Two rows:
--
--   contact.whatsapp          the number itself
--   contact.whatsapp_message  the text the chat opens with, which saves the
--                             enquirer typing and tells whoever answers where
--                             the conversation came from
--
-- Stored as the number a person would read. The frontend strips everything
-- that is not a digit before building the wa.me link, because that is what
-- WhatsApp expects, so the spaces and the leading + here are purely for the
-- benefit of whoever edits this in the dashboard.
--
-- Safe to run more than once. Existing values are left alone: if the firm has
-- already changed the number from the dashboard, this must not put the
-- original back.

INSERT INTO public.site_settings
  (key, value, value_type, group_name, label, description, is_public, sort_order)
VALUES
  ('contact.whatsapp',
   $txt$"+234 701 576 2269"$txt$::jsonb,
   'string', 'contact', 'WhatsApp number',
   $txt$Where the "Speak to us" buttons go. Include the country code. Spaces and brackets are ignored.$txt$,
   true, 9),

  ('contact.whatsapp_message',
   $txt$"Hello, I would like to speak with M. A Mustapha & Co. about a legal matter."$txt$::jsonb,
   'text', 'contact', 'WhatsApp opening message',
   $txt$Pre-filled in the chat so the enquirer only has to press send. Leave blank for an empty message.$txt$,
   true, 10)
ON CONFLICT (key) DO NOTHING;

-- ── Check ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  number text;
BEGIN
  SELECT value #>> '{}' INTO number
    FROM public.site_settings WHERE key = 'contact.whatsapp';

  IF number IS NULL THEN
    RAISE EXCEPTION 'contact.whatsapp was not created';
  END IF;

  RAISE NOTICE 'Speak to us now opens WhatsApp on %', number;
END $$;
