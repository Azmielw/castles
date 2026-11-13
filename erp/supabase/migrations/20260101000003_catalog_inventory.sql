-- =====================================================================
-- 0003 Catalog, warehouses, inventory engine
-- =====================================================================

create table public.warehouses (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) default app.company_id(),
  code          text,
  name          text not null check (length(trim(name)) > 0),
  address       text,
  governorate   text,
  description   text,
  manager_id    uuid references public.profiles(id),
  status        text not null default 'active' check (status in ('active','inactive','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, name)
);
create trigger trg_wh_touch before update on public.warehouses for each row execute function app.touch_updated_at();

create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) default app.company_id(),
  name        text not null,
  parent_id   uuid references public.product_categories(id),
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) default app.company_id(),
  name          text not null check (length(trim(name)) > 0),
  model_number  text,
  brand         text,
  category_id   uuid references public.product_categories(id),
  description   text,
  specifications jsonb not null default '{}'::jsonb,
  unit          text not null default 'جهاز',
  selling_price numeric(18,2) not null default 0 check (selling_price >= 0),
  min_stock     numeric(14,3) not null default 0 check (min_stock >= 0),
  image_url     text,
  track_serials boolean not null default false,
  is_active     boolean not null default true,
  archived_at   timestamptz,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index products_model_unique on public.products(company_id, lower(model_number)) where model_number is not null and archived_at is null;
create index products_search on public.products(company_id, name);
create trigger trg_products_touch before update on public.products for each row execute function app.touch_updated_at();

-- Cost information is restricted (products.view_cost) and stored separately.
create table public.product_costs (
  product_id      uuid primary key references public.products(id),
  company_id      uuid not null references public.companies(id),
  purchase_price  numeric(18,4) not null default 0 check (purchase_price >= 0),
  last_landed_cost numeric(18,4),
  updated_at      timestamptz not null default now()
);
create trigger trg_pc_touch before update on public.product_costs for each row execute function app.touch_updated_at();

-- Variants = alternative SKUs / barcodes / trade names of a product (share stock with the product).
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) default app.company_id(),
  product_id  uuid not null references public.products(id),
  name        text not null,
  sku         text,
  barcode     text,
  attributes  jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index product_variants_sku on public.product_variants(company_id, sku) where sku is not null;
create unique index product_variants_barcode on public.product_variants(company_id, barcode) where barcode is not null;

-- ---------------------------------------------------------------------
-- Stock balances: one row per (warehouse, product). Only internal functions write.
-- ---------------------------------------------------------------------
create table public.stock_balances (
  company_id     uuid not null references public.companies(id),
  warehouse_id   uuid not null references public.warehouses(id),
  product_id     uuid not null references public.products(id),
  quantity       numeric(14,3) not null default 0,   -- sellable
  damaged_quantity numeric(14,3) not null default 0, -- damaged / quarantined, not sellable
  avg_cost       numeric(18,4) not null default 0,   -- weighted average cost (both buckets)
  updated_at     timestamptz not null default now(),
  primary key (warehouse_id, product_id)
);
create index on public.stock_balances(company_id, product_id);

create table public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id),
  warehouse_id   uuid not null references public.warehouses(id),
  product_id     uuid not null references public.products(id),
  bucket         text not null default 'available' check (bucket in ('available','damaged')),
  movement_type  text not null check (movement_type in (
                   'opening','purchase_receipt','sale','sale_cancel','sale_return',
                   'transfer_out','transfer_in','transfer_return','adjustment','count_adjustment',
                   'damage_writeoff','reclassify')),
  quantity       numeric(14,3) not null check (quantity <> 0),  -- signed
  unit_cost      numeric(18,4) not null default 0,
  total_cost     numeric(18,2) not null default 0,
  balance_after  numeric(14,3) not null,
  source_type    text not null,
  source_id      uuid not null,
  source_line_id uuid not null,
  reference      text,
  notes          text,
  movement_date  timestamptz not null default now(),
  created_by     uuid,
  created_at     timestamptz not null default now(),
  -- the same document line can never move the same stock twice
  unique (company_id, source_type, source_id, source_line_id, movement_type, bucket)
);
create index on public.stock_movements(company_id, warehouse_id, created_at desc);
create index on public.stock_movements(company_id, product_id, created_at desc);
create index on public.stock_movements(source_type, source_id);
create trigger trg_sm_immutable before update or delete on public.stock_movements for each row execute function app.audit_immutable();

create table public.serial_numbers (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  product_id    uuid not null references public.products(id),
  serial        text not null,
  warehouse_id  uuid references public.warehouses(id),
  status        text not null default 'in_stock' check (status in ('in_stock','sold','returned_pending','damaged','in_transit','scrapped')),
  received_source_type text,
  received_source_id uuid,
  sales_invoice_id uuid,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, product_id, serial)
);
create trigger trg_sn_touch before update on public.serial_numbers for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- Core stock posting. All inventory changes go through here.
--   p_qty signed; positive = in, negative = out.
--   For "in" movements p_unit_cost is the incoming cost (weighted average updated).
--   For "out" movements the current average cost is used and returned.
-- Returns the unit cost applied.
-- ---------------------------------------------------------------------
create or replace function app.post_stock(
  p_company uuid, p_warehouse uuid, p_product uuid, p_qty numeric, p_unit_cost numeric,
  p_type text, p_source_type text, p_source_id uuid, p_line_id uuid, p_reference text,
  p_bucket text default 'available', p_notes text default null, p_allow_negative boolean default null
) returns numeric
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.stock_balances; v_cost numeric(18,4); v_new_qty numeric(14,3); v_new_avg numeric(18,4);
  v_total_qty numeric(14,3); v_allow boolean; v_wh public.warehouses; v_prod public.products;
begin
  if p_qty = 0 then return 0; end if;
  select * into v_wh from public.warehouses where id = p_warehouse and company_id = p_company;
  if not found then raise exception 'المخزن غير موجود'; end if;
  if v_wh.status <> 'active' then raise exception 'المخزن "%" غير نشط', v_wh.name; end if;
  select * into v_prod from public.products where id = p_product and company_id = p_company;
  if not found then raise exception 'المنتج غير موجود'; end if;

  insert into public.stock_balances(company_id, warehouse_id, product_id)
  values (p_company, p_warehouse, p_product) on conflict do nothing;
  select * into b from public.stock_balances where warehouse_id = p_warehouse and product_id = p_product for update;

  v_total_qty := b.quantity + b.damaged_quantity;
  if p_qty > 0 then
    v_cost := round(coalesce(p_unit_cost, b.avg_cost), 4);
    if v_total_qty <= 0 then v_new_avg := v_cost;
    else v_new_avg := round((v_total_qty * b.avg_cost + p_qty * v_cost) / (v_total_qty + p_qty), 4);
    end if;
  else
    v_cost := coalesce(p_unit_cost, b.avg_cost);
    v_new_avg := b.avg_cost;
  end if;

  if p_bucket = 'available' then v_new_qty := b.quantity + p_qty; else v_new_qty := b.damaged_quantity + p_qty; end if;

  if v_new_qty < 0 then
    select allow_negative_stock into v_allow from public.company_settings where company_id = p_company;
    if not (coalesce(p_allow_negative, false) or (coalesce(v_allow,false) and app.has_perm('inventory.negative_stock'))) then
      raise exception 'الكمية غير كافية: "%" في مخزن "%" — المتاح % والمطلوب %',
        v_prod.name, v_wh.name, case when p_bucket = 'available' then b.quantity else b.damaged_quantity end, abs(p_qty)
        using errcode = '23514';
    end if;
  end if;

  update public.stock_balances
     set quantity = case when p_bucket = 'available' then v_new_qty else quantity end,
         damaged_quantity = case when p_bucket = 'damaged' then v_new_qty else damaged_quantity end,
         avg_cost = v_new_avg, updated_at = now()
   where warehouse_id = p_warehouse and product_id = p_product;

  insert into public.stock_movements(company_id, warehouse_id, product_id, bucket, movement_type, quantity, unit_cost,
    total_cost, balance_after, source_type, source_id, source_line_id, reference, notes, created_by)
  values (p_company, p_warehouse, p_product, p_bucket, p_type, p_qty, v_cost, round(p_qty * v_cost, 2), v_new_qty,
    p_source_type, p_source_id, p_line_id, p_reference, p_notes, auth.uid());
  return v_cost;
exception when unique_violation then
  raise exception 'تم تسجيل حركة المخزون لهذا السطر من قبل (منع التكرار)' using errcode = '23505';
end $$;

-- Low-stock notifications
create or replace function app.low_stock_check() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p public.products; v_w public.warehouses; v_on boolean;
begin
  if new.quantity >= coalesce(old.quantity, 0) then return new; end if;
  select * into v_p from public.products where id = new.product_id;
  if v_p.min_stock <= 0 or new.quantity > v_p.min_stock then return new; end if;
  select low_stock_notifications into v_on from public.company_settings where company_id = new.company_id;
  if not coalesce(v_on, true) then return new; end if;
  select * into v_w from public.warehouses where id = new.warehouse_id;
  perform app.notify(new.company_id, 'inventory.view', 'low_stock', 'تنبيه انخفاض المخزون',
    format('%s — المتبقي %s في %s (الحد الأدنى %s)', v_p.name, trim(to_char(new.quantity,'FM999999990.###')), v_w.name,
           trim(to_char(v_p.min_stock,'FM999999990.###'))),
    '/inventory?product=' || new.product_id, 'low_stock:' || new.warehouse_id || ':' || new.product_id);
  return new;
end $$;
create trigger trg_low_stock after update of quantity on public.stock_balances for each row execute function app.low_stock_check();

-- Serial helpers
create or replace function app.serials_receive(p_company uuid, p_product uuid, p_warehouse uuid, p_serials jsonb,
  p_expected numeric, p_source_type text, p_source_id uuid, p_status text default 'in_stock') returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_track boolean; v_s text; v_n int := 0;
begin
  select track_serials into v_track from public.products where id = p_product;
  if p_serials is null or jsonb_typeof(p_serials) <> 'array' or jsonb_array_length(p_serials) = 0 then
    if v_track and p_expected > 0 then
      raise exception 'هذا المنتج يتطلب تسجيل الأرقام التسلسلية (% رقم)', p_expected;
    end if;
    return;
  end if;
  for v_s in select trim(x) from jsonb_array_elements_text(p_serials) x where trim(x) <> '' loop
    v_n := v_n + 1;
    insert into public.serial_numbers(company_id, product_id, serial, warehouse_id, status, received_source_type, received_source_id)
    values (p_company, p_product, v_s, p_warehouse, p_status, p_source_type, p_source_id)
    on conflict (company_id, product_id, serial) do update
      set warehouse_id = excluded.warehouse_id, status = excluded.status
      where public.serial_numbers.status in ('sold','scrapped') and p_source_type in ('sales_return')
    ;
    if not found then raise exception 'الرقم التسلسلي % مسجل من قبل', v_s; end if;
  end loop;
  if v_track and v_n <> p_expected then
    raise exception 'عدد الأرقام التسلسلية (%) لا يساوي الكمية (%)', v_n, p_expected;
  end if;
end $$;

-- Move existing serials: validates they are at p_from_status in warehouse.
create or replace function app.serials_move(p_company uuid, p_product uuid, p_serials jsonb, p_expected numeric,
  p_from_warehouse uuid, p_from_status text, p_to_warehouse uuid, p_to_status text, p_invoice uuid default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_track boolean; v_s text; v_n int := 0;
begin
  select track_serials into v_track from public.products where id = p_product;
  if p_serials is null or jsonb_typeof(p_serials) <> 'array' or jsonb_array_length(p_serials) = 0 then
    if v_track and p_expected > 0 then raise exception 'هذا المنتج يتطلب تحديد الأرقام التسلسلية'; end if;
    return;
  end if;
  for v_s in select trim(x) from jsonb_array_elements_text(p_serials) x where trim(x) <> '' loop
    v_n := v_n + 1;
    update public.serial_numbers
       set warehouse_id = p_to_warehouse, status = p_to_status,
           sales_invoice_id = coalesce(p_invoice, sales_invoice_id)
     where company_id = p_company and product_id = p_product and serial = v_s
       and status = p_from_status and (p_from_warehouse is null or warehouse_id = p_from_warehouse);
    if not found then raise exception 'الرقم التسلسلي % غير متاح بالحالة المطلوبة', v_s; end if;
  end loop;
  if v_track and v_n <> p_expected then
    raise exception 'عدد الأرقام التسلسلية (%) لا يساوي الكمية (%)', v_n, p_expected;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Transfers
-- ---------------------------------------------------------------------
create table public.stock_transfers (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id),
  number              text not null,
  source_warehouse_id uuid not null references public.warehouses(id),
  dest_warehouse_id   uuid not null references public.warehouses(id),
  status              text not null default 'pending' check (status in ('pending','dispatched','received','cancelled')),
  notes               text,
  created_by          uuid, dispatched_by uuid, received_by uuid, cancelled_by uuid,
  dispatched_at       timestamptz, received_at timestamptz, cancelled_at timestamptz,
  cancel_reason       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (source_warehouse_id <> dest_warehouse_id),
  unique (company_id, number)
);
create trigger trg_tr_touch before update on public.stock_transfers for each row execute function app.touch_updated_at();

create table public.stock_transfer_items (
  id           uuid primary key default gen_random_uuid(),
  transfer_id  uuid not null references public.stock_transfers(id),
  company_id   uuid not null references public.companies(id),
  product_id   uuid not null references public.products(id),
  quantity     numeric(14,3) not null check (quantity > 0),
  unit_cost    numeric(18,4),
  serials      jsonb,
  unique (transfer_id, product_id)
);

-- ---------------------------------------------------------------------
-- Adjustments (require approval) & physical counts
-- ---------------------------------------------------------------------
create table public.stock_adjustments (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  number        text not null,
  warehouse_id  uuid not null references public.warehouses(id),
  product_id    uuid not null references public.products(id),
  bucket        text not null default 'available' check (bucket in ('available','damaged')),
  quantity      numeric(14,3) not null check (quantity <> 0),  -- signed
  unit_cost     numeric(18,4),   -- optional for positive adjustments
  reason        text not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by  uuid, approved_by uuid, approved_at timestamptz, rejection_reason text,
  journal_entry_id uuid references public.journal_entries(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, number)
);
create trigger trg_adj_touch before update on public.stock_adjustments for each row execute function app.touch_updated_at();

create table public.stock_counts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  number        text not null,
  warehouse_id  uuid not null references public.warehouses(id),
  status        text not null default 'draft' check (status in ('draft','submitted','approved','cancelled')),
  count_date    date not null default (now() at time zone 'Africa/Cairo')::date,
  notes         text,
  created_by    uuid, submitted_by uuid, approved_by uuid, approved_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, number)
);
create trigger trg_cnt_touch before update on public.stock_counts for each row execute function app.touch_updated_at();

create table public.stock_count_items (
  id            uuid primary key default gen_random_uuid(),
  count_id      uuid not null references public.stock_counts(id),
  company_id    uuid not null references public.companies(id),
  product_id    uuid not null references public.products(id),
  system_quantity numeric(14,3) not null,
  counted_quantity numeric(14,3) check (counted_quantity >= 0),
  notes         text,
  unique (count_id, product_id)
);

select app.attach_audit('public.warehouses', 'warehouses');
select app.attach_audit('public.products', 'products');
select app.attach_audit('public.product_costs', 'products');
select app.attach_audit('public.product_categories', 'products');
select app.attach_audit('public.product_variants', 'products');
select app.attach_audit('public.stock_movements', 'inventory');
select app.attach_audit('public.stock_transfers', 'inventory');
select app.attach_audit('public.stock_adjustments', 'inventory');
select app.attach_audit('public.stock_counts', 'inventory');
