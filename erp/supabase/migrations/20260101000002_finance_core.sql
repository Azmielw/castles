-- =====================================================================
-- 0002 Finance core: chart of accounts, double-entry journal, cash accounts
-- =====================================================================

create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  code        text not null,
  name_ar     text not null,
  type        text not null check (type in ('asset','liability','equity','revenue','expense')),
  normal_side text not null check (normal_side in ('debit','credit')),
  is_control  boolean not null default false,  -- subledger-controlled (AR, AP, inventory, cash): no manual entries
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, code)
);

create table public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id),
  number       text not null,
  entry_date   date not null default (now() at time zone 'Africa/Cairo')::date,
  description  text not null,
  source_type  text not null,     -- sales_invoice | sales_return | shipment_receipt | customer_payment | ...
  source_id    uuid,
  reference    text,
  is_opening   boolean not null default false,
  reverses_id  uuid references public.journal_entries(id),
  reversed_by_id uuid references public.journal_entries(id),
  total_debit  numeric(18,2) not null default 0,
  total_credit numeric(18,2) not null default 0,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  unique (company_id, number)
);
create index on public.journal_entries(company_id, entry_date);
create index on public.journal_entries(source_type, source_id);

create table public.journal_entry_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.journal_entries(id),
  company_id  uuid not null references public.companies(id),
  account_id  uuid not null references public.accounts(id),
  debit       numeric(18,2) not null default 0 check (debit >= 0),
  credit      numeric(18,2) not null default 0 check (credit >= 0),
  party_type  text check (party_type in ('customer','supplier')),
  party_id    uuid,
  warehouse_id uuid,
  memo        text,
  check (debit = 0 or credit = 0),
  check (debit > 0 or credit > 0)
);
create index on public.journal_entry_lines(entry_id);
create index on public.journal_entry_lines(company_id, account_id);
create index on public.journal_entry_lines(party_type, party_id);

-- Journal is immutable: corrections are made by reversing entries.
create or replace function app.journal_immutable() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'journal_entries' and tg_op = 'UPDATE'
     and old.reversed_by_id is null and new.reversed_by_id is not null
     and (to_jsonb(old) - 'reversed_by_id') = (to_jsonb(new) - 'reversed_by_id') then
    return new;   -- only allowed change: linking to its reversal
  end if;
  raise exception 'القيود المحاسبية لا يمكن تعديلها أو حذفها — استخدم قيد عكسي' using errcode = '42501';
end $$;
create trigger trg_je_immutable before update or delete on public.journal_entries for each row execute function app.journal_immutable();
create trigger trg_jel_immutable before update or delete on public.journal_entry_lines for each row execute function app.journal_immutable();

-- Deferred safety net: every entry must balance at commit time.
create or replace function app.check_entry_balanced() returns trigger
language plpgsql as $$
declare v_d numeric; v_c numeric;
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_d, v_c
    from public.journal_entry_lines where entry_id = new.entry_id;
  if v_d <> v_c then
    raise exception 'قيد غير متوازن: مدين % ≠ دائن %', v_d, v_c using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger trg_jel_balanced after insert on public.journal_entry_lines
  deferrable initially deferred for each row execute function app.check_entry_balanced();

create or replace function app.account_id(p_company uuid, p_code text) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v uuid;
begin
  select id into v from public.accounts where company_id = p_company and code = p_code;
  if v is null then raise exception 'الحساب % غير موجود في دليل الحسابات', p_code; end if;
  return v;
end $$;

-- Post a balanced journal entry.
-- p_lines: [{"account":"1300" | "account_id":uuid, "debit":n, "credit":n, "party_type":..,"party_id":..,"memo":..}]
create or replace function app.post_journal(
  p_company uuid, p_date date, p_description text, p_source_type text, p_source_id uuid,
  p_reference text, p_lines jsonb, p_is_opening boolean default false
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid; v_d numeric(18,2) := 0; v_c numeric(18,2) := 0; l jsonb; v_acc uuid;
  v_debit numeric(18,2); v_credit numeric(18,2); v_count int := 0;
begin
  for l in select * from jsonb_array_elements(p_lines) loop
    v_debit := round(coalesce((l->>'debit')::numeric, 0), 2);
    v_credit := round(coalesce((l->>'credit')::numeric, 0), 2);
    if v_debit < 0 or v_credit < 0 then raise exception 'قيم القيد لا يمكن أن تكون سالبة'; end if;
    v_d := v_d + v_debit; v_c := v_c + v_credit;
    if v_debit > 0 or v_credit > 0 then v_count := v_count + 1; end if;
  end loop;
  if v_count = 0 then return null; end if;   -- nothing to post (zero amounts)
  if v_d <> v_c then
    raise exception 'قيد غير متوازن (%): مدين % ≠ دائن %', p_description, v_d, v_c using errcode = '23514';
  end if;

  insert into public.journal_entries(company_id, number, entry_date, description, source_type, source_id, reference,
                                     is_opening, total_debit, total_credit, created_by)
  values (p_company, app.next_number(p_company, 'JE'), coalesce(p_date, (now() at time zone 'Africa/Cairo')::date),
          p_description, p_source_type, p_source_id, p_reference, p_is_opening, v_d, v_c, auth.uid())
  returning id into v_id;

  for l in select * from jsonb_array_elements(p_lines) loop
    v_debit := round(coalesce((l->>'debit')::numeric, 0), 2);
    v_credit := round(coalesce((l->>'credit')::numeric, 0), 2);
    continue when v_debit = 0 and v_credit = 0;
    v_acc := coalesce(nullif(l->>'account_id','')::uuid, app.account_id(p_company, l->>'account'));
    -- net both sides on same line is not allowed; split
    if v_debit > 0 and v_credit > 0 then
      raise exception 'سطر قيد يحتوي مدين ودائن معاً';
    end if;
    insert into public.journal_entry_lines(entry_id, company_id, account_id, debit, credit, party_type, party_id, warehouse_id, memo)
    values (v_id, p_company, v_acc, v_debit, v_credit, l->>'party_type', nullif(l->>'party_id','')::uuid,
            nullif(l->>'warehouse_id','')::uuid, l->>'memo');
  end loop;
  return v_id;
end $$;

-- Reverse every not-yet-reversed entry of a source document.
create or replace function app.reverse_source_entries(p_company uuid, p_source_type text, p_source_id uuid, p_reason text)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare e record; v_new uuid; v_n int := 0;
begin
  for e in select * from public.journal_entries
            where company_id = p_company and source_type = p_source_type and source_id = p_source_id
              and reversed_by_id is null and reverses_id is null
            order by created_at for update loop
    insert into public.journal_entries(company_id, number, entry_date, description, source_type, source_id, reference,
                                       is_opening, reverses_id, total_debit, total_credit, created_by)
    values (p_company, app.next_number(p_company, 'JE'), (now() at time zone 'Africa/Cairo')::date,
            'عكس قيد: ' || e.description || coalesce(' — ' || p_reason, ''), e.source_type, e.source_id, e.reference,
            e.is_opening, e.id, e.total_credit, e.total_debit, auth.uid())
    returning id into v_new;
    insert into public.journal_entry_lines(entry_id, company_id, account_id, debit, credit, party_type, party_id, warehouse_id, memo)
    select v_new, company_id, account_id, credit, debit, party_type, party_id, warehouse_id, 'عكس: ' || coalesce(memo,'')
      from public.journal_entry_lines where entry_id = e.id;
    update public.journal_entries set reversed_by_id = v_new where id = e.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- Cash & bank accounts
-- ---------------------------------------------------------------------
create table public.cash_accounts (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  name           text not null,
  type           text not null check (type in ('cash','bank','wallet')),
  bank_name      text,
  account_number text,
  gl_account_id  uuid not null references public.accounts(id),
  balance        numeric(18,2) not null default 0,
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, name)
);
create trigger trg_cash_accounts_touch before update on public.cash_accounts for each row execute function app.touch_updated_at();

create table public.cash_transactions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  cash_account_id uuid not null references public.cash_accounts(id),
  txn_date       date not null default (now() at time zone 'Africa/Cairo')::date,
  direction      text not null check (direction in ('in','out')),
  amount         numeric(18,2) not null check (amount > 0),
  balance_after  numeric(18,2) not null,
  source_type    text not null,
  source_id      uuid,
  reference      text,
  description    text,
  journal_entry_id uuid references public.journal_entries(id),
  is_opening     boolean not null default false,
  created_by     uuid,
  created_at     timestamptz not null default now()
);
create index on public.cash_transactions(company_id, cash_account_id, created_at desc);
create index on public.cash_transactions(source_type, source_id);
create trigger trg_cash_txn_immutable before update or delete on public.cash_transactions
  for each row execute function app.audit_immutable();

-- Balance columns maintained only by internal functions.
create or replace function app.guard_balance() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.internal', true), '') <> 'on' then
    if tg_op = 'INSERT' and new.balance <> 0 then
      raise exception 'لا يمكن إدخال رصيد مباشرة — استخدم الأرصدة الافتتاحية' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.balance is distinct from old.balance then
      raise exception 'لا يمكن تعديل الرصيد مباشرة — يتم تحديثه من خلال العمليات فقط' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger trg_cash_balance_guard before insert or update on public.cash_accounts for each row execute function app.guard_balance();

create or replace function app.internal_on() returns void language sql as $$ select set_config('app.internal','on',true) $$;

-- Move money in/out of a cash account (row-locked). Signed amount: + in, - out.
create or replace function app.cash_move(p_company uuid, p_account uuid, p_amount numeric, p_source_type text,
  p_source_id uuid, p_reference text, p_description text, p_journal uuid, p_date date default null,
  p_is_opening boolean default false) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_acc public.cash_accounts; v_new numeric(18,2); v_id uuid; v_allow boolean;
begin
  if p_amount = 0 then return null; end if;
  select * into v_acc from public.cash_accounts where id = p_account and company_id = p_company for update;
  if not found then raise exception 'حساب الخزنة/البنك غير موجود'; end if;
  if not v_acc.is_active then raise exception 'حساب الخزنة "%" غير مفعل', v_acc.name; end if;
  v_new := v_acc.balance + p_amount;
  select allow_negative_cash into v_allow from public.company_settings where company_id = p_company;
  if v_new < 0 and not coalesce(v_allow, false) then
    raise exception 'الرصيد غير كافٍ في "%": الرصيد الحالي % ج.م', v_acc.name, v_acc.balance using errcode = '23514';
  end if;
  perform app.internal_on();
  update public.cash_accounts set balance = v_new where id = p_account;
  insert into public.cash_transactions(company_id, cash_account_id, txn_date, direction, amount, balance_after, source_type,
    source_id, reference, description, journal_entry_id, is_opening, created_by)
  values (p_company, p_account, coalesce(p_date, (now() at time zone 'Africa/Cairo')::date),
          case when p_amount > 0 then 'in' else 'out' end, abs(p_amount), v_new, p_source_type, p_source_id,
          p_reference, p_description, p_journal, p_is_opening, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function app.cash_gl(p_account uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select gl_account_id from public.cash_accounts where id = p_account
$$;

-- ---------------------------------------------------------------------
-- Expense categories (each one owns a GL expense account)
-- ---------------------------------------------------------------------
create table public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  name        text not null,
  account_id  uuid not null references public.accounts(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

select app.attach_audit('public.cash_accounts', 'finance');
select app.attach_audit('public.expense_categories', 'expenses');
select app.attach_audit('public.journal_entries', 'finance');
