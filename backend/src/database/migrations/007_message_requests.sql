-- Declining a message request hides the conversation for the person who declined it; a later message from the same sender stays hidden.
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS declined_at timestamptz;
