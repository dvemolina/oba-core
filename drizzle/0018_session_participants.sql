CREATE TABLE "session_participants" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "name" text NOT NULL,
  "notes" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "session_participants_session_id_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id")
    ON DELETE cascade ON UPDATE no action
);
