-- =====================================================================
-- 0005 Sales, returns, payments, expenses, deliveries, opening balances, AI
-- =====================================================================

create table public.sales_invoices (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  number          text not null,
  customer_id     uuid references public.customers(id),
  customer_name   text,                          -- snapshot / walk-in name
  warehouse_id    uuid not null references public.warehouses(id),
  invoice_date    timestamptz not null default now(),
  status          text not null default 'draft' check (status in ('draft','approved','cancelled','void')),
  sale_type       text not null default 'cash' check (sale_type in ('cash','credit','partial')),
  payment_method  text not null default 'cash' check (payment_method in ('cash','bank_transfer','cheque','wallet','instapay','other')),
  subtotal        numeric(18,2) not null default 0,   -- sum of line totals after line discounts
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  shipping_charge numeric(18,2) not null default 0 check (shipping_charge >= 0),
  total           numeric(18,2) not null default 0,
  paid_amount     numeric(18,2) not null default 0,   -- net of refunds
  returned_amount numeric(18,2) not null default 0,   -- credit notes
  balance_due     numeric(18,2) generated always as (total - paid_amount - returned_amount) stored,
  cost_total      numeric(18,2) not null default 0,   -- COGS (restricted)
  notes           text,
  salesperson_id  uuid references public.profiles(id),
  created_by      uuid,
  approved_by     uuid, approved_at timestamptz,
  cancelled_by    uuid, cancelled_at timestamptz, cancel_reason text,
  idempotency_key text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (total >= 0),
  unique (company_id, number)
);
create index on public.sales_invoices(company_id, status, invoice_date desc);
create index on public.sales_invoices(customer_id);
create trigger trg_si_touch before update on public.sales_invoices for each row execute function app.touch_updated_at();

create table public.sales_invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.sales_invoices(id),
  company_id    uuid not null references public.companies(id),
  product_id    uuid not null references public.products(id),
  description   text,
  quantity      numeric(14,3) not null check (quantity > 0),
  unit_price    numeric(18,2) not null check (unit_price >= 0),
  list_price    numeric(18,2),        -- price suggested by pricing rules at the time
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  line_total    numeric(18,2) not null,
  unit_cost     numeric(18,4),        -- set at approval (restricted)
  returned_quantity numeric(14,3) not null default 0,
  serials       jsonb,
  sort_order    int not null default 0
);
create index on public.sales_invoice_items(invoice_id);
create index on public.sales_invoice_items(company_id, product_id);

create table public.customer_payments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  number          text not null,
  customer_id     uuid references public.customers(id),
  invoice_id      uuid references public.sales_invoices(id),
  return_id       uuid,
  direction       text not null default 'receipt' check (direction in ('receipt','refund')),
  cash_account_id uuid not null references public.cash_accounts(id),
  amount          numeric(18,2) not null check (amount > 0),
  payment_date    date not null default (now() at time zone 'Africa/Cairo')::date,
  method          text not null default 'cash',
  notes           text,
  status          text not null default 'posted' check (status in ('posted','cancelled')),
  journal_entry_id uuid references public.journal_entries(id),
  created_by      uuid,
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz, cancelled_by uuid, cancel_reason text,
  unique (company_id, number)
);
create index on public.customer_payments(customer_id);
create index on public.customer_payments(invoice_id);

create table public.sales_returns (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  number          text not null,
  invoice_id      uuid not null references public.sales_invoices(id),
  customer_id     uuid references public.customers(id),
  warehouse_id    uuid not null references public.warehouses(id),   -- receiving warehouse
  return_type     text not null default 'return' check (return_type in ('return','exchange')),
  status          text not null default 'pending_inspection'
                  check (status in ('pending_inspection','inspected','approved','rejected','cancelled')),
  reason          text not null,
  credit_amount   numeric(18,2) not null default 0,
  refund_amount   numeric(18,2) not null default 0,
  cost_restocked  numeric(18,2) not null default 0,
  exchange_invoice_id uuid references public.sales_invoices(id),
  notes           text,
  created_by      uuid, inspected_by uuid, inspected_at timestamptz, approved_by uuid, approved_at timestamptz,
  rejection_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, number)
);
create index on public.sales_returns(invoice_id);
create trigger trg_sr_touch before update on public.sales_returns for each row execute function app.touch_updated_at();

create table public.sales_return_items (
  id              uuid primary key default gen_random_uuid(),
  return_id       uuid not null references public.sales_returns(id),
  company_id      uuid not null references public.companies(id),
  invoice_item_id uuid not null references public.sales_invoice_items(id),
  product_id      uuid not null references public.products(id),
  quantity        numeric(14,3) not null check (quantity > 0),
  reason          text,
  condition       text check (condition in ('good','damaged','defective','missing_parts')),
  inspection_notes text,
  decision        text check (decision in ('restock','damaged_stock','scrap','return_to_supplier')),
  credit_amount   numeric(18,2) not null default 0,
  unit_cost       numeric(18,4),
  serials         jsonb
);

-- ---------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  number          text not null,
  category_id     uuid not null references public.expense_categories(id),
  cash_account_id uuid not null references public.cash_accounts(id),
  warehouse_id    uuid references public.warehouses(id),
  amount          numeric(18,2) not null check (amount > 0),
  expense_date    date not null default (now() at time zone 'Africa/Cairo')::date,
  payee           text,
  description     text not null,
  attachment_url  text,
  status          text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  journal_entry_id uuid references public.journal_entries(id),
  created_by      uuid, approved_by uuid, approved_at timestamptz,
  cancelled_by uuid, cancelled_at timestamptz, cancel_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, number)
);
create trigger trg_exp_touch before update on public.expenses for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- Shipping & delivery
-- ---------------------------------------------------------------------
create table public.shipping_companies (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) default app.company_id(),
  name        text not null,
  phone       text,
  contact_person text,
  tracking_url_template text,   -- e.g. https://carrier.example/track/{tracking}
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

create table public.deliveries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  number          text not null,
  invoice_id      uuid references public.sales_invoices(id),
  customer_id     uuid references public.customers(id),
  shipping_company_id uuid references public.shipping_companies(id),
  recipient_name  text not null,
  recipient_phone text,
  address         text not null,
  governorate     text,
  city            text,
  tracking_number text,
  delivery_fee    numeric(18,2) not null default 0 check (delivery_fee >= 0),
  fee_paid_by     text not null default 'customer' check (fee_paid_by in ('customer','company')),
  status          text not null default 'pending'
                  check (status in ('pending','preparing','shipped','in_transit','delivered','failed','returned','cancelled')),
  scheduled_date  date,
  delivered_at    timestamptz,
  assigned_to     uuid references public.profiles(id),
  notes           text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, number)
);
create index on public.deliveries(company_id, status);
create trigger trg_del_touch before update on public.deliveries for each row execute function app.touch_updated_at();

create table public.delivery_status_history (
  id           uuid primary key default gen_random_uuid(),
  delivery_id  uuid not null references public.deliveries(id),
  company_id   uuid not null references public.companies(id),
  from_status  text,
  to_status    text not null,
  note         text,
  changed_by   uuid,
  changed_at   timestamptz not null default now()
);
create index on public.delivery_status_history(delivery_id, changed_at);

create or replace function app.delivery_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.delivery_status_history(delivery_id, company_id, from_status, to_status, note, changed_by)
    values (new.id, new.company_id, case when tg_op = 'UPDATE' then old.status end, new.status, app.ctx('reason'), auth.uid());
  end if;
  return new;
end $$;
create trigger trg_delivery_history after insert or update of status on public.deliveries
  for each row execute function app.delivery_history();

-- ---------------------------------------------------------------------
-- Opening balances (paper-record migration) — review & approval workflow
-- ---------------------------------------------------------------------
create table public.opening_balance_batches (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  number        text not null,
  opening_date  date not null,
  description   text,
  status        text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  entered_by    uuid, submitted_at timestamptz,
  approved_by   uuid, approved_at timestamptz, rejection_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, number)
);
create trigger trg_ob_touch before update on public.opening_balance_batches for each row execute function app.touch_updated_at();

create table public.opening_balance_lines (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.opening_balance_batches(id),
  company_id    uuid not null references public.companies(id),
  line_type     text not null check (line_type in ('inventory','customer','supplier','cash')),
  warehouse_id  uuid references public.warehouses(id),
  product_id    uuid references public.products(id),
  quantity      numeric(14,3),
  unit_cost     numeric(18,4),
  customer_id   uuid references public.customers(id),
  supplier_id   uuid references public.suppliers(id),
  cash_account_id uuid references public.cash_accounts(id),
  amount        numeric(18,2),
  serials       jsonb,
  notes         text,
  entered_by    uuid,
  created_at    timestamptz not null default now(),
  check (
    (line_type = 'inventory' and warehouse_id is not null and product_id is not null and quantity > 0 and unit_cost >= 0) or
    (line_type = 'customer' and customer_id is not null and amount is not null and amount <> 0) or
    (line_type = 'supplier' and supplier_id is not null and amount is not null and amount <> 0) or
    (line_type = 'cash' and cash_account_id is not null and amount is not null and amount > 0)
  )
);
create index on public.opening_balance_lines(batch_id);

-- ---------------------------------------------------------------------
-- AI assistant: conversations log & pending (preview → confirm) actions
-- ---------------------------------------------------------------------
create table public.ai_messages (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) default app.company_id(),
  user_id       uuid not null default auth.uid(),
  conversation_id uuid not null,
  role          text not null check (role in ('user','assistant','tool')),
  content       text,
  tool_name     text,
  tool_input    jsonb,
  provider      text,
  model         text,
  created_at    timestamptz not null default now()
);
create index on public.ai_messages(user_id, conversation_id, created_at);

create table public.ai_actions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  user_id       uuid not null,
  conversation_id uuid,
  action_type   text not null check (action_type in ('create_sales_invoice','create_incoming_shipment','create_customer',
                                                      'record_customer_payment','record_expense')),
  payload       jsonb not null,
  preview       jsonb not null,
  status        text not null default 'pending' check (status in ('pending','executed','cancelled','failed','expired')),
  result        jsonb,
  error         text,
  expires_at    timestamptz not null default now() + interval '30 minutes',
  executed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.ai_actions(user_id, created_at desc);

select app.attach_audit('public.sales_invoices', 'sales');
select app.attach_audit('public.sales_returns', 'returns');
select app.attach_audit('public.customer_payments', 'payments');
select app.attach_audit('public.expenses', 'expenses');
select app.attach_audit('public.shipping_companies', 'shipping');
select app.attach_audit('public.deliveries', 'shipping');
select app.attach_audit('public.opening_balance_batches', 'opening_balances');
select app.attach_audit('public.ai_actions', 'ai');
