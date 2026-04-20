-- Wally Gastos — schema
-- Aplicar en: Supabase Dashboard → SQL Editor → pegar este archivo → Run
-- Es idempotente: podés ejecutarlo múltiples veces sin romper.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- users
-- ─────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  tz text default 'America/Argentina/Buenos_Aires',
  telegram_chat_id text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- accounts (gmail + telegram conectados)
-- ─────────────────────────────────────────
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null check (type in ('gmail','telegram')),
  account text not null,
  oauth_refresh_token text,
  status text default 'ok' check (status in ('ok','expired','revoked','error')),
  last_scan_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists accounts_user_idx on public.accounts(user_id);

-- ─────────────────────────────────────────
-- categories (servicios, tarjeta, suscrip, etc)
-- id es un slug estable (ej: 'servicios'), no uuid, para que se referencie fácil en código
-- ─────────────────────────────────────────
create table if not exists public.categories (
  id text not null,
  user_id uuid references public.users(id) on delete cascade not null,
  label text not null,
  icon text,
  color text,
  soft_color text,
  sort_order int default 0,
  created_at timestamptz default now(),
  primary key (id, user_id)
);

-- ─────────────────────────────────────────
-- rules (parser rules por remitente)
-- ─────────────────────────────────────────
create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  sender_pattern text not null,
  provider text,
  category_id text,
  auto_approve boolean default false,
  active boolean default true,
  hits int default 0,
  created_at timestamptz default now()
);
create index if not exists rules_user_active_idx on public.rules(user_id, active);

-- ─────────────────────────────────────────
-- budgets (presupuestos mensuales por categoría)
-- ─────────────────────────────────────────
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  category_id text,
  period text default 'month' check (period in ('month','year')),
  amount_cents bigint not null,
  currency text default 'ARS',
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- expenses (el core: gastos detectados + pagados)
-- ─────────────────────────────────────────
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete set null,
  rule_id uuid references public.rules(id) on delete set null,
  provider text not null,
  concept text,
  amount_cents bigint not null,
  currency text default 'ARS' check (currency in ('ARS','USD')),
  category_id text,
  due_at date,
  paid_at timestamptz,
  detected_at timestamptz default now(),
  status text default 'pending_approval' check (status in ('pending_approval','paid','postponed','ignored','auto_approved')),
  paid_via text,
  confidence_provider int,
  confidence_amount int,
  confidence_due int,
  source_message_id text,
  source_from text,
  raw_extract_json jsonb,
  created_at timestamptz default now()
);
create index if not exists expenses_user_status_idx on public.expenses(user_id, status);
create index if not exists expenses_user_detected_idx on public.expenses(user_id, detected_at desc);
create index if not exists expenses_user_due_idx on public.expenses(user_id, due_at);
create index if not exists expenses_user_paid_idx on public.expenses(user_id, paid_at desc);

-- ─────────────────────────────────────────
-- reminders (snooze + jobs)
-- ─────────────────────────────────────────
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references public.expenses(id) on delete cascade not null,
  fire_at timestamptz not null,
  fired boolean default false,
  created_at timestamptz default now()
);
create index if not exists reminders_fire_idx on public.reminders(fire_at) where fired = false;

-- ─────────────────────────────────────────
-- insights (alertas automáticas del bot)
-- ─────────────────────────────────────────
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null check (type in ('alerta','insight','recordatorio','descubierto')),
  title text not null,
  detail text,
  color text default 'yellow' check (color in ('red','green','yellow','blue')),
  severity text default 'info',
  created_at timestamptz default now(),
  read_at timestamptz
);
create index if not exists insights_user_created_idx on public.insights(user_id, created_at desc);

-- ─────────────────────────────────────────
-- RLS — preparada para auth multi-user futura
-- Por ahora operamos con service_role (bypass completo)
-- ─────────────────────────────────────────
alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.rules enable row level security;
alter table public.budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.reminders enable row level security;
alter table public.insights enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'accounts' and policyname = 'own rows') then
    create policy "own rows" on public.accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'categories' and policyname = 'own rows') then
    create policy "own rows" on public.categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'rules' and policyname = 'own rows') then
    create policy "own rows" on public.rules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'budgets' and policyname = 'own rows') then
    create policy "own rows" on public.budgets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'expenses' and policyname = 'own rows') then
    create policy "own rows" on public.expenses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'insights' and policyname = 'own rows') then
    create policy "own rows" on public.insights for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
