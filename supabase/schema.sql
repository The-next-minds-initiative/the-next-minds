-- THE NEXT MIND — initial schema for Supabase (Postgres)
--
-- Paste this whole file into the Supabase SQL Editor (Project > SQL Editor >
-- New query) and run it once against a fresh project. It creates every
-- table `drizzle/schema.ts` defines, plus the triggers that replace
-- MySQL's `.onUpdateNow()` behaviour (Postgres has no built-in equivalent).
--
-- This is a hand-written, one-time bootstrap — an alternative to running
-- `pnpm drizzle-kit generate && pnpm drizzle-kit migrate` locally. Use
-- either path, not both, on a given database. If you later change
-- `drizzle/schema.ts` and want to keep using drizzle-kit for migrations
-- from here on, run `pnpm drizzle-kit generate` once against this database
-- first so drizzle-kit's local snapshot matches what's actually deployed.
--
-- Note: this connects with the Postgres connection string directly (via
-- Drizzle), not through Supabase's PostgREST/anon-key API, so Row Level
-- Security does not apply and the Supabase dashboard's "RLS disabled"
-- warnings on these tables are expected and not a problem here.

create type "role" as enum ('user', 'admin');
create type "registration_status" as enum ('PENDING', 'ACCEPTED', 'REJECTED');
create type "email_template_category" as enum ('ACCEPTANCE', 'GENERAL');
create type "email_media_placement" as enum ('INLINE', 'ATTACHMENT');
create type "email_log_status" as enum ('PENDING', 'SENDING', 'SENT', 'FAILED');

create table "users" (
  "id" serial primary key,
  "openId" varchar(64) not null unique,
  "name" text,
  "email" varchar(320),
  "passwordHash" text,
  "loginMethod" varchar(64) default 'local',
  "role" "role" not null default 'user',
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now(),
  "lastSignedIn" timestamp not null default now()
);

create table "registrations" (
  "id" serial primary key,
  "firstName" varchar(120) not null,
  "lastName" varchar(120) not null,
  "country" varchar(80) not null,
  "countryCode" varchar(8) not null,
  "whatsappNumber" varchar(40) not null,
  "normalizedWhatsapp" varchar(40) not null unique,
  "classLevel" varchar(120) not null,
  "school" varchar(240) not null,
  "email" varchar(320) not null unique,
  "status" "registration_status" not null default 'PENDING',
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now(),
  "reviewedAt" timestamp,
  "reviewedBy" integer,
  "rejectionReason" text
);

create table "adminInvites" (
  "id" serial primary key,
  "tokenHash" varchar(128) not null unique,
  "createdBy" integer not null,
  "createdAt" timestamp not null default now(),
  "expiresAt" timestamp not null,
  "usedAt" timestamp,
  "usedBy" integer,
  "revokedAt" timestamp
);

create table "emailConfig" (
  "id" serial primary key,
  "senderName" varchar(160) not null,
  "senderEmail" varchar(320) not null,
  "replyTo" varchar(320),
  "gmailClientIdEncrypted" text,
  "gmailClientSecretEncrypted" text,
  "gmailRefreshTokenEncrypted" text,
  "enabled" boolean not null default false,
  "updatedBy" integer,
  "updatedAt" timestamp not null default now()
);

create table "emailTemplates" (
  "id" serial primary key,
  "category" "email_template_category" not null default 'ACCEPTANCE',
  "subject" varchar(240) not null,
  "body" text not null,
  "htmlBody" text,
  "groupLink" varchar(500),
  "channelLink" varchar(500),
  "updatedBy" integer,
  "updatedAt" timestamp not null default now()
);

create table "emailMedia" (
  "id" serial primary key,
  "templateId" integer,
  "fileKey" varchar(500) not null,
  "fileUrl" varchar(700) not null,
  "filename" varchar(240) not null,
  "mimeType" varchar(120) not null,
  "contentId" varchar(120),
  "placement" "email_media_placement" not null,
  "createdBy" integer not null,
  "createdAt" timestamp not null default now()
);

create table "emailLogs" (
  "id" serial primary key,
  "recipient" varchar(320) not null,
  "emailType" varchar(80) not null,
  "subject" varchar(240),
  "registrationId" integer,
  "status" "email_log_status" not null,
  "failureReason" text,
  "providerMessageId" varchar(240),
  "idempotencyKey" varchar(200),
  "retryOf" integer,
  "sentBy" integer,
  "createdAt" timestamp not null default now()
);

create table "notifications" (
  "id" serial primary key,
  "title" varchar(160) not null,
  "body" text not null,
  "registrationId" integer,
  "createdAt" timestamp not null default now(),
  "readAt" timestamp
);

create table "notificationPreferences" (
  "id" serial primary key,
  "masterEnabled" boolean not null default true,
  "newRegistration" boolean not null default true,
  "emailFailure" boolean not null default true,
  "adminEvents" boolean not null default true,
  "updatedBy" integer,
  "updatedAt" timestamp not null default now()
);

create table "auditLogs" (
  "id" serial primary key,
  "action" varchar(160) not null,
  "adminId" integer not null,
  "registrationId" integer,
  "createdAt" timestamp not null default now()
);

-- Replaces MySQL's `timestamp(...).onUpdateNow()`: stamps "updatedAt" on
-- every UPDATE, for the five tables that had it in the original schema.
create or replace function set_updated_at()
returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on "users"
  for each row execute function set_updated_at();
create trigger set_updated_at before update on "registrations"
  for each row execute function set_updated_at();
create trigger set_updated_at before update on "emailConfig"
  for each row execute function set_updated_at();
create trigger set_updated_at before update on "emailTemplates"
  for each row execute function set_updated_at();
create trigger set_updated_at before update on "notificationPreferences"
  for each row execute function set_updated_at();
