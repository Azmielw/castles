-- =====================================================================
-- 0008 Security: grants, Row Level Security, cost-safe views
-- Principle: authenticated users can READ what their permissions allow and
-- can WRITE only simple master data directly. Every financial / inventory
-- mutation goes through SECURITY DEFINER functions (0006/0007).
-- =====================================================================

-- Functions in app schema: not callable by clients except the helpers RLS needs
revoke execute on all functions in schema app from public;
grant execute on function app.company_id(), app.has_perm(text), app.is_owner(), app.uid() to authenticated;

-- Public functions are executable by authenticated only (anon may only check setup status)
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.setup_status() to anon;

-- Start from zero privileges on all tables, then grant selectively
revoke all on all tables in schema public from anon, authenticated;

-- Enable RLS everywhere
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;
-- Table owner (postgres) runs SECURITY DEFINER functions; FORCE RLS would apply to owner too,
-- so bypass is granted to the owner role explicitly.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I no force row level security', t);
  end loop;
end $$;

-- Helper to create a company-scoped SELECT policy guarded by a permission
create or replace function app.read_policy(p_table text, p_perm text) returns void
language plpgsql as $$
begin
  execute format('grant select on public.%I to authenticated', p_table);
  execute format($p$create policy %I on public.%I for select to authenticated
                    using (company_id = app.company_id() and app.has_perm(%L))$p$,
                 p_table || '_read', p_table, p_perm);
end $$;

-- Reference / catalogue
grant select on public.permissions to authenticated;
create policy permissions_read on public.permissions for select to authenticated using (true);

grant select on public.companies to authenticated;
create policy companies_read on public.companies for select to authenticated using (id = app.company_id());
grant update (name, legal_name, phone, address, tax_number, logo_url) on public.companies to authenticated;
create policy companies_update on public.companies for update to authenticated
  using (id = app.company_id() and app.has_perm('settings.manage')) with check (id = app.company_id());

grant select on public.company_settings to authenticated;
create policy settings_read on public.company_settings for select to authenticated using (company_id = app.company_id());
grant update (allow_negative_stock, allow_negative_cash, default_warehouse_id, default_cash_account_id, invoice_footer,
              invoice_terms, low_stock_notifications, ai_enabled, ai_provider, ai_model) on public.company_settings to authenticated;
create policy settings_update on public.company_settings for update to authenticated
  using (company_id = app.company_id() and app.has_perm('settings.manage')) with check (company_id = app.company_id());

grant select on public.roles, public.role_permissions to authenticated;
create policy roles_read on public.roles for select to authenticated using (company_id = app.company_id());
create policy role_permissions_read on public.role_permissions for select to authenticated
  using (exists (select 1 from public.roles r where r.id = role_id and r.company_id = app.company_id()));

grant select on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
  using (company_id = app.company_id());   -- names of colleagues are needed across modules

-- Master data: read + direct insert/update (no delete — archive instead)
select app.read_policy('warehouses', 'warehouses.view');
create policy warehouses_read_inv on public.warehouses for select to authenticated
  using (company_id = app.company_id() and (app.has_perm('inventory.view') or app.has_perm('sales.create')
         or app.has_perm('shipments.view') or app.has_perm('reports.view')));
grant insert (company_id, code, name, address, governorate, description, manager_id, status),
      update (code, name, address, governorate, description, manager_id, status) on public.warehouses to authenticated;
create policy warehouses_write on public.warehouses for insert to authenticated
  with check (company_id = app.company_id() and app.has_perm('warehouses.manage'));
create policy warehouses_update on public.warehouses for update to authenticated
  using (company_id = app.company_id() and app.has_perm('warehouses.manage')) with check (company_id = app.company_id());

select app.read_policy('product_categories', 'products.view');
grant insert (company_id, name, parent_id), update (name, parent_id) on public.product_categories to authenticated;
create policy product_categories_ins on public.product_categories for insert to authenticated
  with check (company_id = app.company_id() and app.has_perm('products.manage'));
create policy product_categories_upd on public.product_categories for update to authenticated
  using (company_id = app.company_id() and app.has_perm('products.manage'));

select app.read_policy('products', 'products.view');
select app.read_policy('product_costs', 'products.view_cost');

select app.read_policy('product_variants', 'products.view');
grant insert (company_id, product_id, name, sku, barcode, attributes, is_active),
      update (name, sku, barcode, attributes, is_active) on public.product_variants to authenticated;
create policy product_variants_ins on public.product_variants for insert to authenticated
  with check (company_id = app.company_id() and app.has_perm('products.manage'));
create policy product_variants_upd on public.product_variants for update to authenticated
  using (company_id = app.company_id() and app.has_perm('products.manage'));

select app.read_policy('customers', 'customers.view');
create policy customers_read_sales on public.customers for select to authenticated
  using (company_id = app.company_id() and (app.has_perm('sales.create') or app.has_perm('deliveries.view')));
grant insert (company_id, code, full_name, customer_type, phone, phone2, address, governorate, city, notes, credit_limit, is_active),
      update (code, full_name, customer_type, phone, phone2, address, governorate, city, notes, credit_limit, is_active, archived_at)
  on public.customers to authenticated;
create policy customers_ins on public.customers for insert to authenticated
  with check (company_id = app.company_id() and app.has_perm('customers.manage'));
create policy customers_upd on public.customers for update to authenticated
  using (company_id = app.company_id() and app.has_perm('customers.manage')) with check (company_id = app.company_id());

select app.read_policy('suppliers', 'suppliers.view');
create policy suppliers_read_ship on public.suppliers for select to authenticated
  using (company_id = app.company_id() and (app.has_perm('shipments.view') or app.has_perm('purchases.view')));
grant insert (company_id, name, contact_person, phone, email, address, country, notes, is_active),
      update (name, contact_person, phone, email, address, country, notes, is_active, archived_at) on public.suppliers to authenticated;
create policy suppliers_ins on public.suppliers for insert to authenticated
  with check (company_id = app.company_id() and app.has_perm('suppliers.manage'));
create policy suppliers_upd on public.suppliers for update to authenticated
  using (company_id = app.company_id() and app.has_perm('suppliers.manage')) with check (company_id = app.company_id());

select app.read_policy('pricing_rules', 'products.view');
grant insert (company_id, name, product_id, customer_type, customer_id, min_quantity, discount_percent, fixed_price, priority,
              is_active, valid_from, valid_to),
      update (name, product_id, customer_type, customer_id, min_quantity, discount_percent, fixed_price, priority, is_active,
              valid_from, valid_to) on public.pricing_rules to authenticated;
create policy pricing_rules_ins on public.pricing_rules for insert to authenticated
  with check (company_id = app.company_id() and app.has_perm('products.manage'));
create policy pricing_rules_upd on public.pricing_rules for update to authenticated
  using (company_id = app.company_id() and app.has_perm('products.manage'));

select app.read_policy('shipping_companies', 'deliveries.view');
grant insert (company_id, name, phone, contact_person, tracking_url_template, notes, is_active),
      update (name, phone, contact_person, tracking_url_template, notes, is_active) on public.shipping_companies to authenticated;
create policy shipping_companies_ins on public.shipping_companies for insert to authenticated
  with check (company_id = app.company_id() and app.has_perm('deliveries.manage'));
create policy shipping_companies_upd on public.shipping_companies for update to authenticated
  using (company_id = app.company_id() and app.has_perm('deliveries.manage'));

-- Inventory (balances & movements contain cost → base tables restricted; safe views below)
select app.read_policy('stock_balances', 'finance.view_profit');
select app.read_policy('stock_movements', 'finance.view_profit');
select app.read_policy('stock_transfers', 'inventory.view');
select app.read_policy('stock_transfer_items', 'finance.view_profit');
select app.read_policy('stock_adjustments', 'inventory.view');
select app.read_policy('stock_counts', 'inventory.count');
select app.read_policy('stock_count_items', 'inventory.count');
select app.read_policy('serial_numbers', 'inventory.view');

-- Purchasing (costs are purchasing data; visible to purchasing/shipment roles)
select app.read_policy('purchase_orders', 'purchases.view');
select app.read_policy('purchase_order_items', 'purchases.view');
-- shipment headers/items carry purchase costs: base tables need products.view_cost, others use the v_ views
select app.read_policy('incoming_shipments', 'products.view_cost');
select app.read_policy('incoming_shipment_items', 'products.view_cost');
select app.read_policy('incoming_shipment_receipts', 'products.view_cost');
select app.read_policy('supplier_payments', 'finance.view');
create policy supplier_payments_read2 on public.supplier_payments for select to authenticated
  using (company_id = app.company_id() and app.has_perm('payments.pay_suppliers'));

-- Sales
select app.read_policy('sales_invoices', 'finance.view_profit');   -- has cost_total; others use v_sales_invoices
select app.read_policy('sales_invoice_items', 'finance.view_profit');   -- base table has unit_cost; use v_sales_invoice_items
select app.read_policy('customer_payments', 'sales.view');
create policy customer_payments_read2 on public.customer_payments for select to authenticated
  using (company_id = app.company_id() and (app.has_perm('finance.view') or app.has_perm('payments.receive')));
select app.read_policy('sales_returns', 'returns.view');
select app.read_policy('sales_return_items', 'returns.view');
-- cost columns are never selectable directly by clients
revoke select on public.sales_returns, public.sales_return_items from authenticated;
grant select (id, company_id, number, invoice_id, customer_id, warehouse_id, return_type, status, reason, credit_amount, refund_amount,
              exchange_invoice_id, notes, created_by, inspected_by, inspected_at, approved_by, approved_at, rejection_reason,
              created_at, updated_at) on public.sales_returns to authenticated;
grant select (id, return_id, company_id, invoice_item_id, product_id, quantity, reason, condition, inspection_notes, decision,
              credit_amount, serials) on public.sales_return_items to authenticated;

-- Finance (restricted)
select app.read_policy('accounts', 'finance.view');
create policy accounts_read_exp on public.accounts for select to authenticated
  using (company_id = app.company_id() and app.has_perm('expenses.view'));
select app.read_policy('journal_entries', 'finance.view');
select app.read_policy('journal_entry_lines', 'finance.view');
select app.read_policy('cash_accounts', 'finance.view');
select app.read_policy('cash_transactions', 'finance.view');
select app.read_policy('expense_categories', 'expenses.view');
select app.read_policy('expenses', 'expenses.view');

-- Shipping
select app.read_policy('deliveries', 'deliveries.view');
select app.read_policy('delivery_status_history', 'deliveries.view');

-- Opening balances
select app.read_policy('opening_balance_batches', 'opening.manage');
create policy obb_read2 on public.opening_balance_batches for select to authenticated
  using (company_id = app.company_id() and app.has_perm('opening.approve'));
select app.read_policy('opening_balance_lines', 'opening.manage');
create policy obl_read2 on public.opening_balance_lines for select to authenticated
  using (company_id = app.company_id() and app.has_perm('opening.approve'));

-- Audit log: own activity with audit.view; everything with audit.view_all. Never writable by clients.
grant select on public.audit_logs to authenticated;
create policy audit_read on public.audit_logs for select to authenticated
  using (company_id = app.company_id() and app.has_perm('audit.view')
         and (app.has_perm('audit.view_all') or user_id = auth.uid())
         and (module not in ('finance','payments','expenses','opening_balances') or app.has_perm('finance.view'))
         and (table_name is distinct from 'product_costs' or app.has_perm('products.view_cost'))
         and (table_name is distinct from 'sales_invoices' or app.has_perm('finance.view_profit') or not (coalesce(new_values,'{}') ? 'cost_total'))
         and (table_name is distinct from 'incoming_shipments' or app.has_perm('products.view_cost'))
         and (table_name is distinct from 'stock_movements' or app.has_perm('finance.view_profit')));

-- Notifications: own only
grant select on public.notifications to authenticated;
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());

-- AI logs: own only; inserts via server with user JWT
grant select, insert on public.ai_messages to authenticated;
create policy ai_messages_read on public.ai_messages for select to authenticated using (user_id = auth.uid());
create policy ai_messages_ins on public.ai_messages for insert to authenticated
  with check (user_id = auth.uid() and company_id = app.company_id() and app.has_perm('ai.use'));
grant select on public.ai_actions to authenticated;
create policy ai_actions_read on public.ai_actions for select to authenticated using (user_id = auth.uid());

grant select on public.document_sequences, public.idempotency_keys to authenticated;
create policy seq_none on public.document_sequences for select to authenticated using (false);
create policy idem_none on public.idempotency_keys for select to authenticated using (false);

-- ---------------------------------------------------------------------
-- Cost-safe views (definer views: filter by company & permission; cost columns
-- only returned when the user may see costs)
-- ---------------------------------------------------------------------
create or replace view public.v_products with (security_barrier = true) as
select p.id, p.company_id, p.name, p.model_number, p.brand, p.category_id, c.name as category_name, p.description,
       p.specifications, p.unit, p.selling_price, p.min_stock, p.image_url, p.track_serials, p.is_active, p.archived_at,
       p.created_at, p.updated_at,
       case when app.has_perm('products.view_cost') then pc.purchase_price end as purchase_price,
       case when app.has_perm('products.view_cost') then pc.last_landed_cost end as last_landed_cost,
       coalesce((select sum(b.quantity) from public.stock_balances b where b.product_id = p.id), 0) as total_quantity,
       coalesce((select sum(b.damaged_quantity) from public.stock_balances b where b.product_id = p.id), 0) as total_damaged,
       (select string_agg(v.name || coalesce(' ' || v.sku, ''), ' | ') from public.product_variants v where v.product_id = p.id) as aliases
  from public.products p
  left join public.product_categories c on c.id = p.category_id
  left join public.product_costs pc on pc.product_id = p.id
 where p.company_id = app.company_id() and app.has_perm('products.view');

create or replace view public.v_stock_balances with (security_barrier = true) as
select b.company_id, b.warehouse_id, w.name as warehouse_name, b.product_id, p.name as product_name, p.model_number, p.brand,
       p.min_stock, p.unit, b.quantity, b.damaged_quantity, b.updated_at,
       (b.quantity <= p.min_stock and p.min_stock > 0) as is_low,
       case when app.has_perm('finance.view_profit') or app.has_perm('products.view_cost') then b.avg_cost end as avg_cost,
       case when app.has_perm('finance.view_profit') or app.has_perm('products.view_cost')
            then round((b.quantity + b.damaged_quantity) * b.avg_cost, 2) end as stock_value
  from public.stock_balances b
  join public.products p on p.id = b.product_id
  join public.warehouses w on w.id = b.warehouse_id
 where b.company_id = app.company_id() and app.has_perm('inventory.view');

create or replace view public.v_stock_movements with (security_barrier = true) as
select m.id, m.company_id, m.warehouse_id, w.name as warehouse_name, m.product_id, p.name as product_name, p.model_number,
       m.bucket, m.movement_type, m.quantity, m.balance_after, m.source_type, m.source_id, m.reference, m.notes,
       m.movement_date, m.created_by, pr.full_name as created_by_name, m.created_at,
       case when app.has_perm('finance.view_profit') or app.has_perm('products.view_cost') then m.unit_cost end as unit_cost,
       case when app.has_perm('finance.view_profit') or app.has_perm('products.view_cost') then m.total_cost end as total_cost
  from public.stock_movements m
  join public.products p on p.id = m.product_id
  join public.warehouses w on w.id = m.warehouse_id
  left join public.profiles pr on pr.id = m.created_by
 where m.company_id = app.company_id() and app.has_perm('inventory.view_ledger');

create or replace view public.v_sales_invoice_items with (security_barrier = true) as
select i.id, i.invoice_id, i.company_id, i.product_id, p.name as product_name, p.model_number, p.unit, i.description, i.quantity,
       i.unit_price, i.list_price, i.discount_amount, i.line_total, i.returned_quantity, i.serials, i.sort_order,
       case when app.has_perm('finance.view_profit') then i.unit_cost end as unit_cost,
       case when app.has_perm('finance.view_profit') then round(i.line_total - i.quantity * coalesce(i.unit_cost,0), 2) end as line_profit
  from public.sales_invoice_items i join public.products p on p.id = i.product_id
 where i.company_id = app.company_id() and (app.has_perm('sales.view') or app.has_perm('returns.view'));

create or replace view public.v_stock_transfer_items with (security_barrier = true) as
select i.id, i.transfer_id, i.company_id, i.product_id, p.name as product_name, p.model_number, i.quantity, i.serials
  from public.stock_transfer_items i join public.products p on p.id = i.product_id
 where i.company_id = app.company_id() and app.has_perm('inventory.view');

-- Sales invoice list with cost hidden
create or replace view public.v_sales_invoices with (security_barrier = true) as
select s.id, s.company_id, s.number, s.customer_id, s.customer_name, c.phone as customer_phone, s.warehouse_id, w.name as warehouse_name,
       s.invoice_date, s.status, s.sale_type, s.payment_method, s.subtotal, s.discount_amount, s.shipping_charge, s.total,
       s.paid_amount, s.returned_amount, s.balance_due, s.notes, s.salesperson_id, sp.full_name as salesperson_name,
       s.created_by, s.approved_by, s.approved_at, s.cancelled_by, s.cancelled_at, s.cancel_reason, s.created_at,
       case when app.has_perm('finance.view_profit') then s.cost_total end as cost_total,
       case when app.has_perm('finance.view_profit') and s.status = 'approved'
            then s.subtotal - s.discount_amount - s.cost_total end as gross_profit
  from public.sales_invoices s
  left join public.customers c on c.id = s.customer_id
  join public.warehouses w on w.id = s.warehouse_id
  left join public.profiles sp on sp.id = s.salesperson_id
 where s.company_id = app.company_id() and app.has_perm('sales.view');

-- Customers with balances hidden from roles that only sell
create or replace view public.v_customers with (security_barrier = true) as
select c.id, c.company_id, c.code, c.full_name, c.customer_type, c.phone, c.phone2, c.address, c.governorate, c.city, c.notes,
       c.credit_limit, c.is_active, c.archived_at, c.created_at, c.updated_at,
       case when app.has_perm('customers.view') then c.balance end as balance
  from public.customers c
 where c.company_id = app.company_id() and (app.has_perm('customers.view') or app.has_perm('sales.create') or app.has_perm('deliveries.view'));

create or replace view public.v_suppliers with (security_barrier = true) as
select s.id, s.company_id, s.name, s.contact_person, s.phone, s.email, s.address, s.country, s.notes, s.is_active, s.archived_at,
       s.created_at, case when app.has_perm('finance.view') or app.has_perm('payments.pay_suppliers') then s.balance end as balance
  from public.suppliers s
 where s.company_id = app.company_id() and (app.has_perm('suppliers.view') or app.has_perm('shipments.view'));

create or replace view public.v_audit_logs with (security_barrier = true) as
select a.*, w.name as warehouse_name, c.full_name as customer_name, s.name as supplier_name, p.name as product_name
  from public.audit_logs a
  left join public.warehouses w on w.id = a.warehouse_id
  left join public.customers c on c.id = a.customer_id
  left join public.suppliers s on s.id = a.supplier_id
  left join public.products p on p.id = a.product_id
 where a.company_id = app.company_id() and app.has_perm('audit.view')
   and (app.has_perm('audit.view_all') or a.user_id = auth.uid())
   and (a.module not in ('finance','payments','expenses','opening_balances') or app.has_perm('finance.view'))
   and (a.table_name is distinct from 'product_costs' or app.has_perm('products.view_cost'))
   and (a.table_name is distinct from 'sales_invoices' or app.has_perm('finance.view_profit') or not (coalesce(a.new_values,'{}') ? 'cost_total'))
   and (a.table_name is distinct from 'incoming_shipments' or app.has_perm('products.view_cost'))
   and (a.table_name is distinct from 'stock_movements' or app.has_perm('inventory.view_ledger'));

create or replace view public.v_incoming_shipments with (security_barrier = true) as
select s.id, s.company_id, s.number, s.reference, s.supplier_id, sp.name as supplier_name, s.warehouse_id, w.name as warehouse_name,
       s.po_id, s.shipment_date, s.expected_arrival, s.actual_arrival, s.status, s.notes, s.attachments, s.created_by, s.created_at,
       s.additional_cost_notes,
       case when app.has_perm('products.view_cost') then s.shipping_cost end as shipping_cost,
       case when app.has_perm('products.view_cost') then s.additional_cost end as additional_cost,
       case when app.has_perm('products.view_cost') then s.goods_total end as goods_total,
       case when app.has_perm('products.view_cost') then s.received_value end as received_value,
       (select coalesce(sum(quantity),0) from public.incoming_shipment_items i where i.shipment_id = s.id) as total_quantity,
       (select coalesce(sum(received_quantity + damaged_quantity),0) from public.incoming_shipment_items i where i.shipment_id = s.id) as received_quantity
  from public.incoming_shipments s
  join public.suppliers sp on sp.id = s.supplier_id
  join public.warehouses w on w.id = s.warehouse_id
 where s.company_id = app.company_id() and app.has_perm('shipments.view');

create or replace view public.v_incoming_shipment_items with (security_barrier = true) as
select i.id, i.shipment_id, i.company_id, i.product_id, p.name as product_name, p.model_number, p.track_serials, i.po_item_id,
       i.quantity, i.received_quantity, i.damaged_quantity,
       case when app.has_perm('products.view_cost') then i.unit_cost end as unit_cost,
       case when app.has_perm('products.view_cost') then i.total_cost end as total_cost,
       case when app.has_perm('products.view_cost') then i.landed_unit_cost end as landed_unit_cost
  from public.incoming_shipment_items i join public.products p on p.id = i.product_id
 where i.company_id = app.company_id() and app.has_perm('shipments.view');

create or replace view public.v_shipment_receipts with (security_barrier = true) as
select r.id, r.shipment_id, r.company_id, r.number, r.received_at, r.received_by, pr.full_name as received_by_name, r.notes,
       case when app.has_perm('products.view_cost') then r.goods_value end as goods_value,
       case when app.has_perm('products.view_cost') then r.landed_extra end as landed_extra
  from public.incoming_shipment_receipts r left join public.profiles pr on pr.id = r.received_by
 where r.company_id = app.company_id() and app.has_perm('shipments.view');

grant select on public.v_incoming_shipments, public.v_incoming_shipment_items, public.v_shipment_receipts to authenticated;
grant select on public.v_products, public.v_stock_balances, public.v_stock_movements, public.v_sales_invoice_items,
  public.v_stock_transfer_items, public.v_sales_invoices, public.v_customers, public.v_suppliers, public.v_audit_logs to authenticated;

-- Financial / inventory documents are never physically deleted (even by the owner role)
create or replace function app.no_delete() returns trigger language plpgsql as $$
begin
  raise exception 'لا يمكن حذف السجلات المالية أو المخزنية — استخدم الإلغاء أو العكس' using errcode = '42501';
end $$;
do $$
declare t text;
begin
  foreach t in array array['sales_invoices','sales_invoice_items','customer_payments','supplier_payments','expenses','sales_returns',
    'sales_return_items','incoming_shipments','incoming_shipment_receipts','stock_transfers','stock_transfer_items','stock_adjustments',
    'stock_counts','opening_balance_batches','deliveries','delivery_status_history','purchase_orders','ai_actions','ai_messages'] loop
    execute format('create trigger trg_no_delete before delete on public.%I for each row execute function app.no_delete()', t);
  end loop;
end $$;

-- Service role (server-side only) keeps full access for admin/backups
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Realtime (only on Supabase where the publication exists)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.sales_invoices, public.incoming_shipments,
      public.stock_transfers, public.deliveries, public.sales_returns;
  end if;
end $$;
