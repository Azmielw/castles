-- =====================================================================
-- 0009 Dashboard, reports, statements, timelines, search
-- Profit figures come from the double-entry general ledger (authoritative).
-- Sales/inventory figures come from documents and can be filtered by warehouse.
-- =====================================================================

create or replace function app.day_start(d date) returns timestamptz language sql immutable as $$
  select (d::timestamp at time zone 'Africa/Cairo') $$;

-- P&L block from the ledger for a date range
create or replace function app.pnl(p_company uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with x as (
    select a.code, a.type, sum(l.credit - l.debit) as net_credit
      from public.journal_entry_lines l
      join public.journal_entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id
     where l.company_id = p_company and e.entry_date between p_from and p_to and a.type in ('revenue','expense')
     group by a.code, a.type)
  select jsonb_build_object(
    'gross_sales', coalesce(sum(net_credit) filter (where code = '4100'), 0),
    'shipping_revenue', coalesce(sum(net_credit) filter (where code = '4150'), 0),
    'discounts', -coalesce(sum(net_credit) filter (where code = '4200'), 0),
    'returns', -coalesce(sum(net_credit) filter (where code = '4300'), 0),
    'other_revenue', coalesce(sum(net_credit) filter (where code = '4900'), 0),
    'net_revenue', coalesce(sum(net_credit) filter (where type = 'revenue'), 0),
    'cogs', -coalesce(sum(net_credit) filter (where code = '5100'), 0),
    'gross_profit', coalesce(sum(net_credit) filter (where type = 'revenue'), 0) + coalesce(sum(net_credit) filter (where code = '5100'), 0),
    'inventory_adjustments', -coalesce(sum(net_credit) filter (where code = '5200'), 0),
    'damage_losses', -coalesce(sum(net_credit) filter (where code = '5300'), 0),
    'operating_expenses', -coalesce(sum(net_credit) filter (where code like '6%'), 0),
    'net_profit', coalesce(sum(net_credit), 0))
  from x
$$;

create or replace function public.dashboard_summary(p_from date default null, p_to date default null, p_warehouse uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('dashboard.view'); v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_from date := coalesce(p_from, date_trunc('month', v_today)::date); v_to date := coalesce(p_to, v_today);
  v_res jsonb; v_fin boolean := app.has_perm('finance.view'); v_profit boolean := app.has_perm('finance.view_profit');
begin
  v_res := jsonb_build_object(
    'period', jsonb_build_object('from', v_from, 'to', v_to),
    'today_sales', (select coalesce(sum(total),0) from public.sales_invoices where company_id = v_company and status = 'approved'
                      and invoice_date >= app.day_start(v_today) and (p_warehouse is null or warehouse_id = p_warehouse)),
    'today_invoices', (select count(*) from public.sales_invoices where company_id = v_company and status = 'approved'
                      and invoice_date >= app.day_start(v_today) and (p_warehouse is null or warehouse_id = p_warehouse)),
    'month_sales', (select coalesce(sum(total),0) from public.sales_invoices where company_id = v_company and status = 'approved'
                      and invoice_date >= app.day_start(date_trunc('month', v_today)::date) and (p_warehouse is null or warehouse_id = p_warehouse)),
    'period_sales', (select coalesce(sum(total),0) from public.sales_invoices where company_id = v_company and status = 'approved'
                      and invoice_date >= app.day_start(v_from) and invoice_date < app.day_start(v_to + 1)
                      and (p_warehouse is null or warehouse_id = p_warehouse)),
    'period_units_sold', (select coalesce(sum(i.quantity - i.returned_quantity),0) from public.sales_invoice_items i
                      join public.sales_invoices s on s.id = i.invoice_id where s.company_id = v_company and s.status = 'approved'
                      and s.invoice_date >= app.day_start(v_from) and s.invoice_date < app.day_start(v_to + 1)
                      and (p_warehouse is null or s.warehouse_id = p_warehouse)),
    'units_in_stock', (select coalesce(sum(quantity),0) from public.stock_balances where company_id = v_company
                      and (p_warehouse is null or warehouse_id = p_warehouse)),
    'damaged_units', (select coalesce(sum(damaged_quantity),0) from public.stock_balances where company_id = v_company
                      and (p_warehouse is null or warehouse_id = p_warehouse)),
    'warehouses_count', (select count(*) from public.warehouses where company_id = v_company and status = 'active'),
    'low_stock_count', (select count(*) from public.stock_balances b join public.products p on p.id = b.product_id
                      where b.company_id = v_company and p.min_stock > 0 and b.quantity <= p.min_stock and p.is_active
                      and (p_warehouse is null or b.warehouse_id = p_warehouse)),
    'pending_deliveries', (select count(*) from public.deliveries where company_id = v_company and status in ('pending','preparing','shipped','in_transit')),
    'pending_shipments', (select count(*) from public.incoming_shipments where company_id = v_company and status in ('ordered','in_transit','partially_received')),
    'pending_returns', (select count(*) from public.sales_returns where company_id = v_company and status in ('pending_inspection','inspected')),
    'customers_with_balance', (select count(*) from public.customers where company_id = v_company and balance > 0),
    'receivables', case when app.has_perm('customers.view') or v_fin then
                      (select coalesce(sum(balance),0) from public.customers where company_id = v_company and balance > 0) end,
    'payables', case when v_fin then (select coalesce(sum(balance),0) from public.suppliers where company_id = v_company and balance > 0) end,
    'cash_balance', case when v_fin then (select coalesce(sum(balance),0) from public.cash_accounts where company_id = v_company and is_active) end,
    'inventory_value', case when v_profit then (select coalesce(sum(round((quantity + damaged_quantity) * avg_cost,2)),0)
                      from public.stock_balances where company_id = v_company and (p_warehouse is null or warehouse_id = p_warehouse)) end,
    'collected', case when v_fin or app.has_perm('payments.receive') then
                      (select coalesce(sum(case when direction='receipt' then amount else -amount end),0) from public.customer_payments
                        where company_id = v_company and status = 'posted' and payment_date between v_from and v_to) end,
    'pnl', case when v_profit then app.pnl(v_company, v_from, v_to) end,
    'total_revenue_all_time', case when v_profit then (app.pnl(v_company, '1900-01-01', v_to)->>'net_revenue')::numeric end,
    'sales_trend', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'total', t) order by d), '[]'::jsonb) from (
                      select (invoice_date at time zone 'Africa/Cairo')::date d, sum(total) t from public.sales_invoices
                       where company_id = v_company and status = 'approved' and invoice_date >= app.day_start(v_from)
                         and invoice_date < app.day_start(v_to + 1) and (p_warehouse is null or warehouse_id = p_warehouse)
                       group by 1) z),
    'stock_by_warehouse', (select coalesce(jsonb_agg(jsonb_build_object('warehouse', w.name, 'quantity', coalesce(q,0))), '[]'::jsonb)
                      from public.warehouses w left join (select warehouse_id, sum(quantity) q from public.stock_balances group by 1) b
                        on b.warehouse_id = w.id where w.company_id = v_company and w.status = 'active'),
    'top_products', (select coalesce(jsonb_agg(z), '[]'::jsonb) from (
                      select p.name, sum(i.quantity - i.returned_quantity) qty, sum(i.line_total) total
                        from public.sales_invoice_items i join public.sales_invoices s on s.id = i.invoice_id
                        join public.products p on p.id = i.product_id
                       where s.company_id = v_company and s.status = 'approved' and s.invoice_date >= app.day_start(v_from)
                         and s.invoice_date < app.day_start(v_to + 1) and (p_warehouse is null or s.warehouse_id = p_warehouse)
                       group by p.name order by 2 desc limit 5) z)
  );
  return v_res;
end $$;

-- Sales report grouped by day / month / year / product / employee / customer / warehouse
create or replace function public.report_sales(p_from date, p_to date, p_group text default 'day', p_warehouse uuid default null,
  p_product uuid default null, p_employee uuid default null)
returns table(group_key text, invoices bigint, units numeric, total numeric, discounts numeric, returns numeric, net numeric,
              cost numeric, gross_profit numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('reports.view'); v_profit boolean := app.has_perm('finance.view_profit');
begin
  return query
  with lines as (
    select s.id as inv_id, s.invoice_date, s.warehouse_id, s.salesperson_id, s.customer_id, s.customer_name, i.product_id,
           i.quantity, i.returned_quantity, i.line_total, i.quantity * coalesce(i.unit_cost,0) as line_cost,
           case when s.subtotal > 0 then i.line_total / s.subtotal * s.discount_amount else 0 end as alloc_disc,
           coalesce((select sum(ri.credit_amount) from public.sales_return_items ri join public.sales_returns r on r.id = ri.return_id
                      where ri.invoice_item_id = i.id and r.status = 'approved'), 0) as ret_credit,
           coalesce((select sum(ri.quantity * coalesce(ri.unit_cost,0)) from public.sales_return_items ri join public.sales_returns r on r.id = ri.return_id
                      where ri.invoice_item_id = i.id and r.status = 'approved' and ri.decision <> 'scrap'), 0) as ret_cost
      from public.sales_invoices s join public.sales_invoice_items i on i.invoice_id = s.id
     where s.company_id = v_company and s.status = 'approved'
       and s.invoice_date >= app.day_start(p_from) and s.invoice_date < app.day_start(p_to + 1)
       and (p_warehouse is null or s.warehouse_id = p_warehouse) and (p_product is null or i.product_id = p_product)
       and (p_employee is null or s.salesperson_id = p_employee))
  select k::text, count(distinct inv_id), sum(quantity - returned_quantity), round(sum(line_total),2), round(sum(alloc_disc),2),
         round(sum(ret_credit),2), round(sum(line_total - alloc_disc - ret_credit),2),
         case when v_profit then round(sum(line_cost - ret_cost),2) end,
         case when v_profit then round(sum(line_total - alloc_disc - ret_credit - line_cost + ret_cost),2) end
    from (select l.*, case p_group
            when 'day' then to_char(l.invoice_date at time zone 'Africa/Cairo', 'YYYY-MM-DD')
            when 'month' then to_char(l.invoice_date at time zone 'Africa/Cairo', 'YYYY-MM')
            when 'year' then to_char(l.invoice_date at time zone 'Africa/Cairo', 'YYYY')
            when 'product' then (select coalesce(p.name || coalesce(' (' || p.model_number || ')',''), '') from public.products p where p.id = l.product_id)
            when 'warehouse' then (select w.name from public.warehouses w where w.id = l.warehouse_id)
            when 'employee' then (select coalesce(pr.full_name,'—') from public.profiles pr where pr.id = l.salesperson_id)
            when 'customer' then coalesce((select c.full_name from public.customers c where c.id = l.customer_id), l.customer_name)
            else 'الإجمالي' end as k from lines l) z
   group by k order by k;
end $$;

create or replace function public.report_profit_loss(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('reports.financial');
begin
  if not app.has_perm('finance.view_profit') then raise exception 'ليس لديك صلاحية عرض الأرباح' using errcode = '42501'; end if;
  return app.pnl(v_company, p_from, p_to) || jsonb_build_object('expenses_by_account', (
    select coalesce(jsonb_agg(jsonb_build_object('account', a.name_ar, 'code', a.code, 'amount', amt) order by a.code), '[]'::jsonb)
      from (select l.account_id, sum(l.debit - l.credit) amt from public.journal_entry_lines l join public.journal_entries e on e.id = l.entry_id
             where l.company_id = v_company and e.entry_date between p_from and p_to group by 1) x
      join public.accounts a on a.id = x.account_id where a.type = 'expense' and x.amt <> 0));
end $$;

create or replace function public.trial_balance(p_to date default null) returns table(account_id uuid, code text, name_ar text,
  type text, debit numeric, credit numeric, balance numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.view');
begin
  return query
  select a.id, a.code, a.name_ar, a.type, coalesce(sum(l.debit),0), coalesce(sum(l.credit),0),
         case when a.normal_side = 'debit' then coalesce(sum(l.debit - l.credit),0) else coalesce(sum(l.credit - l.debit),0) end
    from public.accounts a
    left join public.journal_entry_lines l on l.account_id = a.id
         and exists (select 1 from public.journal_entries e where e.id = l.entry_id and e.entry_date <= coalesce(p_to, '9999-12-31'))
   where a.company_id = v_company
   group by a.id order by a.code;
end $$;

create or replace function public.general_ledger(p_account uuid, p_from date, p_to date) returns table(entry_id uuid, number text,
  entry_date date, description text, reference text, debit numeric, credit numeric, running_balance numeric, party_type text, party_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.view'); v_side text; v_open numeric;
begin
  select normal_side into v_side from public.accounts where id = p_account and company_id = v_company;
  select coalesce(sum(case when v_side = 'debit' then l.debit - l.credit else l.credit - l.debit end),0) into v_open
    from public.journal_entry_lines l join public.journal_entries e on e.id = l.entry_id
   where l.account_id = p_account and e.entry_date < p_from;
  return query
  select e.id, e.number, e.entry_date, e.description, e.reference, l.debit, l.credit,
         v_open + sum(case when v_side = 'debit' then l.debit - l.credit else l.credit - l.debit end)
                  over (order by e.entry_date, e.created_at, l.id),
         l.party_type, l.party_id
    from public.journal_entry_lines l join public.journal_entries e on e.id = l.entry_id
   where l.account_id = p_account and e.entry_date between p_from and p_to
   order by e.entry_date, e.created_at, l.id;
end $$;

-- Customer / supplier statement built from the ledger subaccount (party lines on AR/AP)
create or replace function public.party_statement(p_party_type text, p_party_id uuid, p_from date default null, p_to date default null)
returns table(entry_date date, number text, description text, reference text, debit numeric, credit numeric, balance numeric, is_opening boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid; v_code text;
begin
  if p_party_type = 'customer' then v_company := app.require_perm('customers.view'); v_code := '1200';
  else v_company := app.require_perm('suppliers.view');
       if not (app.has_perm('finance.view') or app.has_perm('payments.pay_suppliers')) then
         raise exception 'ليس لديك صلاحية عرض حسابات الموردين' using errcode = '42501'; end if;
       v_code := '2100'; end if;
  return query
  select e.entry_date, e.number, e.description, e.reference, l.debit, l.credit,
         sum(case when v_code = '1200' then l.debit - l.credit else l.credit - l.debit end) over (order by e.entry_date, e.created_at, l.id),
         e.is_opening
    from public.journal_entry_lines l join public.journal_entries e on e.id = l.entry_id
   where l.company_id = v_company and l.account_id = app.account_id(v_company, v_code)
     and l.party_type = p_party_type and l.party_id = p_party_id
     and (p_to is null or e.entry_date <= p_to)
   order by e.entry_date, e.created_at, l.id;
end $$;

-- Unified timeline for a customer / supplier / product
create or replace function public.entity_timeline(p_type text, p_id uuid, p_limit int default 200) returns table(
  occurred_at timestamptz, kind text, title text, reference text, amount numeric, status text, link text, actor text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.company_id();
begin
  if p_type = 'customer' then
    perform app.require_perm('customers.view');
    return query select * from (
      select s.invoice_date, 'invoice'::text, 'فاتورة بيع'::text, s.number, s.total, s.status, '/sales/' || s.id, pr.full_name
        from public.sales_invoices s left join public.profiles pr on pr.id = s.created_by where s.customer_id = p_id and s.company_id = v_company
      union all
      select cp.created_at, 'payment', case when cp.direction = 'receipt' then 'تحصيل' else 'رد مبلغ' end, cp.number, cp.amount, cp.status,
             '/finance/receipts', pr.full_name
        from public.customer_payments cp left join public.profiles pr on pr.id = cp.created_by where cp.customer_id = p_id and cp.company_id = v_company
      union all
      select r.created_at, 'return', 'مرتجع', r.number, r.credit_amount, r.status, '/returns/' || r.id, pr.full_name
        from public.sales_returns r left join public.profiles pr on pr.id = r.created_by where r.customer_id = p_id and r.company_id = v_company
      union all
      select d.created_at, 'delivery', 'توصيل', d.number, d.delivery_fee, d.status, '/shipping/' || d.id, pr.full_name
        from public.deliveries d left join public.profiles pr on pr.id = d.created_by where d.customer_id = p_id and d.company_id = v_company
      union all
      select a.created_at, 'audit', 'تعديل بيانات العميل', a.reference_number, null::numeric, a.action, '/history/' || a.id, a.actor_name
        from public.audit_logs a where a.table_name = 'customers' and a.record_id = p_id and a.company_id = v_company
    ) t order by 1 desc limit p_limit;
  elsif p_type = 'supplier' then
    perform app.require_perm('suppliers.view');
    return query select * from (
      select s.created_at, 'shipment'::text, 'شحنة واردة'::text, s.number,
             case when app.has_perm('products.view_cost') then s.goods_total end, s.status, '/shipments/' || s.id, pr.full_name
        from public.incoming_shipments s left join public.profiles pr on pr.id = s.created_by where s.supplier_id = p_id and s.company_id = v_company
      union all
      select sp.created_at, 'payment', 'سداد للمورد', sp.number,
             case when app.has_perm('finance.view') or app.has_perm('payments.pay_suppliers') then sp.amount end, sp.status, '/finance/supplier-payments', pr.full_name
        from public.supplier_payments sp left join public.profiles pr on pr.id = sp.created_by where sp.supplier_id = p_id and sp.company_id = v_company
      union all
      select po.created_at, 'purchase_order', 'أمر شراء', po.number, null::numeric, po.status, '/purchases/' || po.id, pr.full_name
        from public.purchase_orders po left join public.profiles pr on pr.id = po.created_by where po.supplier_id = p_id and po.company_id = v_company
      union all
      select a.created_at, 'audit', 'تعديل بيانات المورد', a.reference_number, null::numeric, a.action, '/history/' || a.id, a.actor_name
        from public.audit_logs a where a.table_name = 'suppliers' and a.record_id = p_id and a.company_id = v_company
    ) t order by 1 desc limit p_limit;
  elsif p_type = 'product' then
    perform app.require_perm('products.view');
    return query select * from (
      select m.created_at, 'movement'::text, m.movement_type, m.reference, m.quantity, w.name, '/inventory/movements', pr.full_name
        from public.stock_movements m join public.warehouses w on w.id = m.warehouse_id left join public.profiles pr on pr.id = m.created_by
       where m.product_id = p_id and m.company_id = v_company and app.has_perm('inventory.view_ledger')
      union all
      select a.created_at, 'audit', 'تعديل بيانات المنتج', a.reference_number, null::numeric, a.action, '/history/' || a.id, a.actor_name
        from public.audit_logs a where a.product_id = p_id and a.table_name in ('products','product_costs') and a.company_id = v_company
         and (a.table_name <> 'product_costs' or app.has_perm('products.view_cost'))
    ) t order by 1 desc limit p_limit;
  end if;
end $$;

create or replace function public.report_inventory_valuation(p_warehouse uuid default null) returns table(
  warehouse_id uuid, warehouse_name text, products bigint, units numeric, damaged_units numeric, value numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('reports.view'); v_cost boolean := app.has_perm('finance.view_profit') or app.has_perm('products.view_cost');
begin
  return query
  select w.id, w.name, count(b.product_id) filter (where b.quantity + b.damaged_quantity <> 0), coalesce(sum(b.quantity),0),
         coalesce(sum(b.damaged_quantity),0),
         case when v_cost then coalesce(sum(round((b.quantity + b.damaged_quantity) * b.avg_cost, 2)),0) end
    from public.warehouses w left join public.stock_balances b on b.warehouse_id = w.id
   where w.company_id = v_company and (p_warehouse is null or w.id = p_warehouse)
   group by w.id order by w.name;
end $$;

create or replace function public.report_expenses(p_from date, p_to date) returns table(category text, count bigint, total numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('expenses.view');
begin
  return query select c.name, count(e.id), coalesce(sum(e.amount),0)
    from public.expenses e join public.expense_categories c on c.id = e.category_id
   where e.company_id = v_company and e.status = 'approved' and e.expense_date between p_from and p_to
   group by c.name order by 3 desc;
end $$;

create or replace function public.report_returns(p_from date, p_to date) returns table(reason text, decision text, returns bigint,
  units numeric, credit numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('returns.view');
begin
  return query select r.reason, coalesce(ri.decision,'—'), count(distinct r.id), sum(ri.quantity), sum(ri.credit_amount)
    from public.sales_returns r join public.sales_return_items ri on ri.return_id = r.id
   where r.company_id = v_company and r.created_at >= app.day_start(p_from) and r.created_at < app.day_start(p_to + 1)
   group by 1, 2 order by 3 desc;
end $$;

create or replace function public.report_employee_activity(p_from date, p_to date) returns table(user_id uuid, full_name text,
  actions bigint, invoices bigint, sales_total numeric, last_action timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('audit.view_all');
begin
  return query
  select p.id, p.full_name,
    (select count(*) from public.audit_logs a where a.user_id = p.id and a.created_at >= app.day_start(p_from) and a.created_at < app.day_start(p_to + 1)),
    (select count(*) from public.sales_invoices s where s.salesperson_id = p.id and s.status = 'approved'
       and s.invoice_date >= app.day_start(p_from) and s.invoice_date < app.day_start(p_to + 1)),
    (select coalesce(sum(total),0) from public.sales_invoices s where s.salesperson_id = p.id and s.status = 'approved'
       and s.invoice_date >= app.day_start(p_from) and s.invoice_date < app.day_start(p_to + 1)),
    (select max(created_at) from public.audit_logs a where a.user_id = p.id)
  from public.profiles p where p.company_id = v_company order by 4 desc, 3 desc;
end $$;

-- Global search across main entities (respects permissions)
create or replace function public.global_search(q text) returns table(kind text, id uuid, title text, subtitle text, link text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.company_id(); v text := '%' || trim(q) || '%';
begin
  if v_company is null or length(trim(q)) < 2 then return; end if;
  if app.has_perm('products.view') then
    return query select 'product'::text, p.id, p.name, coalesce(p.model_number,'') || ' ' || coalesce(p.brand,''), '/products/' || p.id
      from public.products p where p.company_id = v_company and (p.name ilike v or p.model_number ilike v or p.brand ilike v
        or exists (select 1 from public.product_variants pv where pv.product_id = p.id and (pv.name ilike v or pv.sku ilike v or pv.barcode ilike v)))
      limit 8;
  end if;
  if app.has_perm('customers.view') or app.has_perm('sales.create') then
    return query select 'customer'::text, c.id, c.full_name, coalesce(c.phone,'') || ' ' || coalesce(c.governorate,''), '/customers/' || c.id
      from public.customers c where c.company_id = v_company and (c.full_name ilike v or c.phone ilike v or c.phone2 ilike v) limit 8;
  end if;
  if app.has_perm('sales.view') then
    return query select 'invoice'::text, s.id, s.number, s.customer_name || ' — ' || s.total::text || ' ج.م', '/sales/' || s.id
      from public.sales_invoices s where s.company_id = v_company and (s.number ilike v or s.customer_name ilike v) limit 8;
  end if;
  if app.has_perm('suppliers.view') then
    return query select 'supplier'::text, s.id, s.name, coalesce(s.phone,''), '/suppliers/' || s.id
      from public.suppliers s where s.company_id = v_company and (s.name ilike v or s.phone ilike v) limit 5;
  end if;
  if app.has_perm('shipments.view') then
    return query select 'shipment'::text, s.id, s.number, coalesce(s.reference,'') || ' ' || s.status, '/shipments/' || s.id
      from public.incoming_shipments s where s.company_id = v_company and (s.number ilike v or s.reference ilike v) limit 5;
  end if;
end $$;

-- Integrity check (used by tests, backups verification and the settings page)
create or replace function public.integrity_check() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.view');
begin
  return jsonb_build_object(
    'unbalanced_entries', (select count(*) from public.journal_entries e where e.company_id = v_company and
        (select coalesce(sum(debit),0) - coalesce(sum(credit),0) from public.journal_entry_lines l where l.entry_id = e.id) <> 0),
    'trial_balance_difference', (select coalesce(sum(debit) - sum(credit),0) from public.journal_entry_lines where company_id = v_company),
    'stock_ledger_mismatches', (select count(*) from public.stock_balances b where b.company_id = v_company and
        (b.quantity <> coalesce((select sum(quantity) from public.stock_movements m where m.warehouse_id = b.warehouse_id
                                  and m.product_id = b.product_id and m.bucket = 'available'),0)
         or b.damaged_quantity <> coalesce((select sum(quantity) from public.stock_movements m where m.warehouse_id = b.warehouse_id
                                  and m.product_id = b.product_id and m.bucket = 'damaged'),0))),
    'inventory_gl_vs_subledger', (select coalesce(sum(l.debit - l.credit),0) from public.journal_entry_lines l
        where l.company_id = v_company and l.account_id = app.account_id(v_company,'1300'))
        - (select coalesce(sum(round((quantity + damaged_quantity) * avg_cost, 2)),0) from public.stock_balances where company_id = v_company),
    'ar_gl_vs_customers', (select coalesce(sum(l.debit - l.credit),0) from public.journal_entry_lines l
        where l.company_id = v_company and l.account_id = app.account_id(v_company,'1200') and l.party_type = 'customer')
        - (select coalesce(sum(balance),0) from public.customers where company_id = v_company),
    'ap_gl_vs_suppliers', (select coalesce(sum(l.credit - l.debit),0) from public.journal_entry_lines l
        where l.company_id = v_company and l.account_id = app.account_id(v_company,'2100'))
        - (select coalesce(sum(balance),0) from public.suppliers where company_id = v_company),
    'cash_gl_vs_accounts', (select coalesce(sum(l.debit - l.credit),0) from public.journal_entry_lines l
        join public.cash_accounts c on c.gl_account_id = l.account_id where l.company_id = v_company)
        - (select coalesce(sum(balance),0) from public.cash_accounts where company_id = v_company)
  );
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.setup_status() to anon;
revoke execute on all functions in schema app from public;
grant execute on function app.company_id(), app.has_perm(text), app.is_owner(), app.uid() to authenticated;
