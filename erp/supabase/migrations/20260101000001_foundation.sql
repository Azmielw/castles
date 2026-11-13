-- =====================================================================
-- Al-Mohandes HVAC ERP — 0001 Foundation
-- Tenancy, users, roles & permissions, settings, audit log (append-only),
-- document numbering, idempotency, notifications.
-- All business logic that mutates financial / inventory state lives in
-- SECURITY DEFINER functions that check permissions server-side.
-- =====================================================================

create extension if not exists pgcrypto;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  legal_name  text,
  phone       text,
  address     text,
  tax_number  text,
  logo_url    text,
  currency    text not null default 'EGP',
  timezone    text not null default 'Africa/Cairo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Permissions (global catalogue) & roles (per company)
-- ---------------------------------------------------------------------
create table public.permissions (
  code        text primary key,
  module      text not null,
  name_ar     text not null,
  description text,
  is_financial boolean not null default false,
  sort_order  int not null default 0
);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  key         text not null,
  name_ar     text not null,
  description text,
  is_owner    boolean not null default false,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, key)
);

create table public.role_permissions (
  role_id         uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code),
  primary key (role_id, permission_code)
);

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id),
  company_id    uuid not null references public.companies(id),
  role_id       uuid not null references public.roles(id),
  full_name     text not null,
  phone         text,
  email         text,
  job_title     text,
  default_warehouse_id uuid,
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.profiles(company_id);

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function app.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function app.company_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select company_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function app.is_owner() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select r.is_owner from public.profiles p join public.roles r on r.id = p.role_id
                   where p.id = auth.uid() and p.is_active), false)
$$;

create or replace function app.has_perm(p_code text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active
      and (r.is_owner or exists (select 1 from public.role_permissions rp
                                  where rp.role_id = r.id and rp.permission_code = p_code))
  )
$$;

-- Raise a permission error (Arabic message, stable SQLSTATE for the client)
create or replace function app.require_perm(p_code text) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'يجب تسجيل الدخول أولاً' using errcode = '28000';
  end if;
  v_company := app.company_id();
  if v_company is null then
    raise exception 'الحساب غير مفعل أو غير مرتبط بشركة' using errcode = '42501';
  end if;
  if not app.has_perm(p_code) then
    raise exception 'ليس لديك صلاحية لتنفيذ هذه العملية (%)', p_code using errcode = '42501';
  end if;
  return v_company;
end $$;

create or replace function app.actor_name() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select full_name from public.profiles where id = auth.uid()),
                  case when auth.uid() is null then 'النظام' else 'مستخدم' end)
$$;

-- Generic updated_at trigger
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create trigger trg_companies_touch before update on public.companies for each row execute function app.touch_updated_at();
create trigger trg_roles_touch before update on public.roles for each row execute function app.touch_updated_at();
create trigger trg_profiles_touch before update on public.profiles for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- Company settings
-- ---------------------------------------------------------------------
create table public.company_settings (
  company_id            uuid primary key references public.companies(id),
  allow_negative_stock  boolean not null default false,
  allow_negative_cash   boolean not null default false,
  default_warehouse_id  uuid,
  default_cash_account_id uuid,
  invoice_footer        text default 'شكراً لتعاملكم مع المهندس للتكييفات',
  invoice_terms         text,
  low_stock_notifications boolean not null default true,
  ai_enabled            boolean not null default true,
  ai_provider           text,   -- overrides env AI_PROVIDER when set (never stores keys)
  ai_model              text,   -- overrides env AI_MODEL when set
  opening_date          date,
  updated_at            timestamptz not null default now()
);
create trigger trg_settings_touch before update on public.company_settings for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- Document numbering (gap-free per company/type/year, row-locked)
-- ---------------------------------------------------------------------
create table public.document_sequences (
  company_id uuid not null references public.companies(id),
  doc_type   text not null,
  year       int  not null,
  next_value bigint not null default 1,
  primary key (company_id, doc_type, year)
);

create or replace function app.next_number(p_company uuid, p_type text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_year int := extract(year from (now() at time zone 'Africa/Cairo'))::int; v_n bigint;
begin
  insert into public.document_sequences(company_id, doc_type, year, next_value)
  values (p_company, p_type, v_year, 2)
  on conflict (company_id, doc_type, year)
  do update set next_value = public.document_sequences.next_value + 1
  returning next_value - 1 into v_n;
  return p_type || '-' || v_year || '-' || lpad(v_n::text, 5, '0');
end $$;

-- ---------------------------------------------------------------------
-- Idempotency (duplicate-submission protection)
-- ---------------------------------------------------------------------
create table public.idempotency_keys (
  company_id  uuid not null references public.companies(id),
  key         text not null,
  operation   text not null,
  user_id     uuid,
  result      jsonb,
  created_at  timestamptz not null default now(),
  primary key (company_id, key)
);

-- Returns NULL when the caller should proceed; returns the stored result when
-- the same key was already processed (a concurrent duplicate waits on the
-- unique index until the first transaction commits).
create or replace function app.idem_begin(p_company uuid, p_key text, p_operation text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_res jsonb; v_op text; v_inserted boolean;
begin
  if p_key is null or length(p_key) = 0 then return null; end if;
  insert into public.idempotency_keys(company_id, key, operation, user_id)
  values (p_company, p_key, p_operation, auth.uid())
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted then return null; end if;
  select result, operation into v_res, v_op from public.idempotency_keys where company_id = p_company and key = p_key;
  if v_op <> p_operation then
    raise exception 'مفتاح منع التكرار مستخدم لعملية أخرى' using errcode = '23505';
  end if;
  return coalesce(v_res, jsonb_build_object('duplicate', true));
end $$;

create or replace function app.idem_finish(p_company uuid, p_key text, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_key is not null and length(p_key) > 0 then
    update public.idempotency_keys set result = p_result || jsonb_build_object('replayed', true)
     where company_id = p_company and key = p_key;
  end if;
  return p_result;
end $$;

-- ---------------------------------------------------------------------
-- Audit log — append-only
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies(id),
  user_id         uuid,
  actor_name      text,
  action          text not null,            -- insert | update | approve | cancel | receive | ...
  module          text not null,            -- sales | inventory | finance | ...
  table_name      text,
  record_id       uuid,
  reference_number text,
  old_values      jsonb,
  new_values      jsonb,
  changed_fields  text[],
  reason          text,
  approval        jsonb,
  warehouse_id    uuid,
  customer_id     uuid,
  supplier_id     uuid,
  product_id      uuid,
  source          text not null default 'app',  -- app | ai | system | import
  ai_action_id    uuid,
  created_at      timestamptz not null default now()
);
create index audit_logs_company_created on public.audit_logs(company_id, created_at desc);
create index audit_logs_record on public.audit_logs(record_id);
create index audit_logs_ref on public.audit_logs(company_id, reference_number);
create index audit_logs_user on public.audit_logs(company_id, user_id, created_at desc);
create index audit_logs_module on public.audit_logs(company_id, module, action);
create index audit_logs_customer on public.audit_logs(customer_id) where customer_id is not null;
create index audit_logs_product on public.audit_logs(product_id) where product_id is not null;
create index audit_logs_warehouse on public.audit_logs(warehouse_id) where warehouse_id is not null;

create or replace function app.audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'سجل التدقيق غير قابل للتعديل أو الحذف' using errcode = '42501';
end $$;
create trigger trg_audit_no_update before update or delete on public.audit_logs
  for each row execute function app.audit_immutable();
create trigger trg_audit_no_truncate before truncate on public.audit_logs
  for each statement execute function app.audit_immutable();

-- Context helpers: business functions set these transaction-local values
-- p_table: the primary table of the operation; its row-audit entries get p_action
create or replace function app.set_context(p_action text, p_reason text default null, p_table text default null) returns void
language plpgsql as $$
begin
  perform set_config('app.action', coalesce(p_action, ''), true);
  perform set_config('app.reason', coalesce(p_reason, ''), true);
  perform set_config('app.table', coalesce(p_table, ''), true);
end $$;

create or replace function app.ctx(p_name text) returns text
language sql stable as $$ select nullif(current_setting('app.' || p_name, true), '') $$;

-- Explicit (semantic) audit event
create or replace function app.log_event(
  p_company uuid, p_action text, p_module text, p_record uuid, p_reference text,
  p_new jsonb default null, p_old jsonb default null, p_reason text default null,
  p_extra jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.audit_logs(company_id, user_id, actor_name, action, module, record_id, reference_number,
    old_values, new_values, reason, approval, warehouse_id, customer_id, supplier_id, product_id, source, ai_action_id, table_name)
  values (p_company, auth.uid(), app.actor_name(), p_action, p_module, p_record, p_reference,
    p_old, p_new, coalesce(p_reason, app.ctx('reason')),
    p_extra->'approval',
    nullif(p_extra->>'warehouse_id','')::uuid, nullif(p_extra->>'customer_id','')::uuid,
    nullif(p_extra->>'supplier_id','')::uuid, nullif(p_extra->>'product_id','')::uuid,
    coalesce(app.ctx('source'), 'app'), nullif(app.ctx('ai_action_id'),'')::uuid, p_extra->>'table')
  returning id into v_id;
  return v_id;
end $$;

-- Generic row-level audit trigger (database-level auditing)
create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old jsonb; v_new jsonb; v_row jsonb; v_changed text[]; v_action text; v_module text := tg_argv[0];
  v_ref text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_row := v_new; v_action := 'create';
    if tg_table_name = 'stock_movements' then v_action := 'stock_' || (v_new->>'movement_type'); end if;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_row := v_new;
    select array_agg(k) into v_changed from jsonb_object_keys(v_new) k
     where k not in ('updated_at','last_seen_at') and (v_new->k) is distinct from (v_old->k);
    if v_changed is null then return new; end if;
    -- keep only changed keys (plus identifiers) to keep the log readable
    select jsonb_object_agg(k, v_old->k) into v_old from unnest(v_changed) k;
    select jsonb_object_agg(k, v_new->k) into v_new from unnest(v_changed) k;
    v_action := 'update';
  else
    v_old := to_jsonb(old); v_row := v_old; v_action := 'delete';
  end if;
  if app.ctx('table') = tg_table_name and app.ctx('action') is not null then v_action := app.ctx('action'); end if;
  v_ref := coalesce(v_row->>'number', v_row->>'reference', v_row->>'model_number', v_row->>'code',
                    v_row->>'name', v_row->>'full_name', v_row->>'name_ar');
  insert into public.audit_logs(company_id, user_id, actor_name, action, module, table_name, record_id,
    reference_number, old_values, new_values, changed_fields, reason, warehouse_id, customer_id, supplier_id,
    product_id, source, ai_action_id)
  values (
    coalesce(nullif(v_row->>'company_id','')::uuid, case when tg_table_name = 'companies' then (v_row->>'id')::uuid end),
    auth.uid(), app.actor_name(), v_action, v_module, tg_table_name,
    case when tg_table_name = 'company_settings' then (v_row->>'company_id')::uuid
         when tg_table_name = 'role_permissions' then (v_row->>'role_id')::uuid
         else nullif(v_row->>'id','')::uuid end,
    v_ref, v_old, v_new, v_changed, app.ctx('reason'),
    coalesce(nullif(v_row->>'warehouse_id','')::uuid, nullif(v_row->>'source_warehouse_id','')::uuid),
    nullif(v_row->>'customer_id','')::uuid, nullif(v_row->>'supplier_id','')::uuid,
    coalesce(nullif(v_row->>'product_id','')::uuid, case when tg_table_name = 'products' then (v_row->>'id')::uuid end),
    coalesce(app.ctx('source'), 'app'), nullif(app.ctx('ai_action_id'),'')::uuid);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create or replace function app.attach_audit(p_table regclass, p_module text) returns void
language plpgsql as $$
begin
  execute format('create trigger trg_audit after insert or update or delete on %s for each row execute function app.audit_row(%L)',
                 p_table, p_module);
end $$;

select app.attach_audit('public.companies', 'settings');
select app.attach_audit('public.company_settings', 'settings');
select app.attach_audit('public.profiles', 'employees');
select app.attach_audit('public.roles', 'permissions');

-- role_permissions has no id/company: dedicated trigger
create or replace function app.audit_role_permissions() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role public.roles;
begin
  select * into v_role from public.roles where id = coalesce(new.role_id, old.role_id);
  insert into public.audit_logs(company_id, user_id, actor_name, action, module, table_name, record_id, reference_number,
    old_values, new_values, reason, source)
  values (v_role.company_id, auth.uid(), app.actor_name(),
    case when tg_op = 'INSERT' then 'permission_grant' else 'permission_revoke' end,
    'permissions', 'role_permissions', v_role.id, v_role.name_ar,
    case when tg_op = 'DELETE' then jsonb_build_object('permission', old.permission_code) end,
    case when tg_op = 'INSERT' then jsonb_build_object('permission', new.permission_code) end,
    app.ctx('reason'), coalesce(app.ctx('source'), 'app'));
  return coalesce(new, old);
end $$;
create trigger trg_audit after insert or delete on public.role_permissions
  for each row execute function app.audit_role_permissions();

-- ---------------------------------------------------------------------
-- Notifications (per recipient)
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  user_id     uuid not null references public.profiles(id),
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  dedupe_key  text,
  created_at  timestamptz not null default now()
);
create index on public.notifications(user_id, is_read, created_at desc);
create unique index notifications_dedupe on public.notifications(user_id, dedupe_key) where dedupe_key is not null and not is_read;

create or replace function app.notify(p_company uuid, p_perm text, p_type text, p_title text, p_body text,
                                      p_link text, p_dedupe text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications(company_id, user_id, type, title, body, link, dedupe_key)
  select p_company, p.id, p_type, p_title, p_body, p_link, p_dedupe
    from public.profiles p join public.roles r on r.id = p.role_id
   where p.company_id = p_company and p.is_active
     and (r.is_owner or exists (select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission_code = p_perm))
  on conflict do nothing;
end $$;
