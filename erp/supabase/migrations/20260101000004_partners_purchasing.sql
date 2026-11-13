-- =====================================================================
-- 0004 Customers, suppliers, purchase orders, incoming shipments
-- =====================================================================

create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) default app.company_id(),
  code         text,
  full_name    text not null check (length(trim(full_name)) > 0),
  customer_type text not null default 'individual'
               check (customer_type in ('individual','company','contractor','church','mosque','government','other')),
  phone        text,
  phone2       text,
  address      text,
  governorate  text,
  city         text,
  notes        text,
  credit_limit numeric(18,2),
  balance      numeric(18,2) not null default 0,   -- + customer owes us, - we owe customer
  is_active    boolean not null default true,
  archived_at  timestamptz,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index customers_search on public.customers(company_id, full_name);
create index customers_phone on public.customers(company_id, phone);
create trigger trg_cust_touch before update on public.customers for each row execute function app.touch_updated_at();
create trigger trg_cust_balance_guard before insert or update on public.customers for each row execute function app.guard_balance();

create table public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) default app.company_id(),
  name           text not null check (length(trim(name)) > 0),
  contact_person text,
  phone          text,
  email          text,
  address        text,
  country        text default 'مصر',
  notes          text,
  balance        numeric(18,2) not null default 0,  -- + we owe supplier
  is_active      boolean not null default true,
  archived_at    timestamptz,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, name)
);
create trigger trg_sup_touch before update on public.suppliers for each row execute function app.touch_updated_at();
create trigger trg_sup_balance_guard before insert or update on public.suppliers for each row execute function app.guard_balance();

create or replace function app.customer_balance_add(p_customer uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_customer is null or p_amount = 0 then return; end if;
  perform app.internal_on();
  update public.customers set balance = balance + p_amount where id = p_customer;
end $$;

create or replace function app.supplier_balance_add(p_supplier uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_supplier is null or p_amount = 0 then return; end if;
  perform app.internal_on();
  update public.suppliers set balance = balance + p_amount where id = p_supplier;
end $$;

-- Pricing rules: quantity discounts, customer-type (church/mosque) and customer-specific prices
create table public.pricing_rules (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) default app.company_id(),
  name           text not null,
  product_id     uuid references public.products(id),     -- null = all products
  customer_type  text,                                      -- null = any type
  customer_id    uuid references public.customers(id),     -- null = any customer
  min_quantity   numeric(14,3) not null default 1,
  discount_percent numeric(5,2) check (discount_percent between 0 and 100),
  fixed_price    numeric(18,2) check (fixed_price >= 0),
  priority       int not null default 0,
  is_active      boolean not null default true,
  valid_from     date, valid_to date,
  created_at     timestamptz not null default now(),
  check (discount_percent is not null or fixed_price is not null)
);

-- ---------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------
create table public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  number        text not null,
  supplier_id   uuid not null references public.suppliers(id),
  warehouse_id  uuid references public.warehouses(id),
  order_date    date not null default (now() at time zone 'Africa/Cairo')::date,
  expected_date date,
  status        text not null default 'draft' check (status in ('draft','approved','partially_received','received','cancelled')),
  notes         text,
  total         numeric(18,2) not null default 0,
  created_by    uuid, approved_by uuid, approved_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, number)
);
create trigger trg_po_touch before update on public.purchase_orders for each row execute function app.touch_updated_at();

create table public.purchase_order_items (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references public.purchase_orders(id),
  company_id  uuid not null references public.companies(id),
  product_id  uuid not null references public.products(id),
  quantity    numeric(14,3) not null check (quantity > 0),
  unit_cost   numeric(18,4) not null check (unit_cost >= 0),
  received_quantity numeric(14,3) not null default 0
);

-- ---------------------------------------------------------------------
-- Incoming shipments (receiving with landed cost & partial deliveries)
-- ---------------------------------------------------------------------
create table public.incoming_shipments (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id),
  number           text not null,
  reference        text,                     -- supplier / bill of lading reference
  supplier_id      uuid not null references public.suppliers(id),
  warehouse_id     uuid not null references public.warehouses(id),
  po_id            uuid references public.purchase_orders(id),
  shipment_date    date,
  expected_arrival date,
  actual_arrival   date,
  status           text not null default 'draft'
                   check (status in ('draft','ordered','in_transit','partially_received','received','cancelled')),
  shipping_cost    numeric(18,2) not null default 0 check (shipping_cost >= 0),
  additional_cost  numeric(18,2) not null default 0 check (additional_cost >= 0),
  additional_cost_notes text,
  goods_total      numeric(18,2) not null default 0,
  received_value   numeric(18,2) not null default 0,  -- supplier liability recognised so far
  notes            text,
  attachments      jsonb not null default '[]'::jsonb,  -- [{name,url}]
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, number)
);
create index on public.incoming_shipments(company_id, status);
create trigger trg_ship_touch before update on public.incoming_shipments for each row execute function app.touch_updated_at();

create table public.incoming_shipment_items (
  id               uuid primary key default gen_random_uuid(),
  shipment_id      uuid not null references public.incoming_shipments(id),
  company_id       uuid not null references public.companies(id),
  product_id       uuid not null references public.products(id),
  po_item_id       uuid references public.purchase_order_items(id),
  quantity         numeric(14,3) not null check (quantity > 0),
  unit_cost        numeric(18,4) not null check (unit_cost >= 0),
  total_cost       numeric(18,2) generated always as (round(quantity * unit_cost, 2)) stored,
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  damaged_quantity numeric(14,3) not null default 0 check (damaged_quantity >= 0),
  landed_unit_cost numeric(18,4),
  check (received_quantity + damaged_quantity <= quantity)
);

create table public.incoming_shipment_receipts (
  id            uuid primary key default gen_random_uuid(),
  shipment_id   uuid not null references public.incoming_shipments(id),
  company_id    uuid not null references public.companies(id),
  number        text not null,
  received_at   timestamptz not null default now(),
  received_by   uuid,
  notes         text,
  goods_value   numeric(18,2) not null default 0,
  landed_extra  numeric(18,2) not null default 0,
  journal_entry_id uuid references public.journal_entries(id),
  lines         jsonb not null default '[]'::jsonb,
  unique (company_id, number)
);

create table public.supplier_payments (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  number         text not null,
  supplier_id    uuid not null references public.suppliers(id),
  shipment_id    uuid references public.incoming_shipments(id),
  cash_account_id uuid not null references public.cash_accounts(id),
  amount         numeric(18,2) not null check (amount > 0),
  payment_date   date not null default (now() at time zone 'Africa/Cairo')::date,
  method         text not null default 'cash' check (method in ('cash','bank_transfer','cheque','wallet','other')),
  notes          text,
  status         text not null default 'posted' check (status in ('posted','cancelled')),
  journal_entry_id uuid references public.journal_entries(id),
  created_by     uuid,
  created_at     timestamptz not null default now(),
  cancelled_at   timestamptz, cancelled_by uuid, cancel_reason text,
  unique (company_id, number)
);

select app.attach_audit('public.customers', 'customers');
select app.attach_audit('public.suppliers', 'suppliers');
select app.attach_audit('public.pricing_rules', 'sales');
select app.attach_audit('public.purchase_orders', 'purchases');
select app.attach_audit('public.incoming_shipments', 'shipments');
select app.attach_audit('public.incoming_shipment_receipts', 'shipments');
select app.attach_audit('public.supplier_payments', 'payments');
