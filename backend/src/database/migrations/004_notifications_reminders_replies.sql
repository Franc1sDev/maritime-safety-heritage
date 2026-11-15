-- Notifications (pop-ups, counts and actions that stay until done), reminders, and replies to enquiries.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  -- Actions stay on screen until the action is done (for example a submission is reviewed).
  requires_action boolean NOT NULL DEFAULT false,
  action_key text,
  action_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  done_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_open_action_idx ON notifications (action_key) WHERE done_at IS NULL;

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_at timestamptz NOT NULL,
  fired_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders (due_at) WHERE fired_at IS NULL AND done_at IS NULL;
CREATE INDEX IF NOT EXISTS reminders_user_idx ON reminders (user_id, due_at);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS replied_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS replied_by_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_seen_at timestamptz;
