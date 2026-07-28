-- Migration: recreate contact_messages INSERT policy to allow anon/authenticated inserts with validation

DROP POLICY IF EXISTS "Anyone can submit a message" ON public.contact_messages;

CREATE POLICY "Anyone can submit a message"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) BETWEEN 1 AND 200
    AND length(email) BETWEEN 3 AND 320
    AND length(message) BETWEEN 1 AND 5000
  );

-- Ensure INSERT grant exists for anon and authenticated (idempotent)
GRANT INSERT ON public.contact_messages TO anon, authenticated;
