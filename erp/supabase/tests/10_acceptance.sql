-- =====================================================================
-- Acceptance tests (spec §24). Runs as real "authenticated" users with JWT
-- claims, so RLS and permission checks are exercised exactly as in production.
-- =====================================================================
\set QUIET on
\pset tuples_only on
\pset format unaligned

create schema if not exists test;
grant usage on schema test to authenticated;
create or replace function test.eq(actual numeric, expected numeric, msg text) returns text language plpgsql as $$
begin
  if actual is distinct from expected then raise exception 'FAIL: % — expected %, got %', msg, expected, actual; end if;
  return 'ok  ' || msg;
end $$;
create or replace function test.ok(cond boolean, msg text) returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
  return 'ok  ' || msg;
end $$;
-- run a statement and expect it to fail with an error matching a pattern
create or replace function test.fails(stmt text, pattern text, msg text) returns text language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm ~ pattern then return 'ok  ' || msg || '  [' || left(sqlerrm, 90) || ']'; end if;
    raise exception 'FAIL: % — wrong error: %', msg, sqlerrm;
  end;
  raise exception 'FAIL: % — statement succeeded but should have failed', msg;
end $$;
grant execute on all functions in schema test to authenticated;
create or replace function test.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false) $$;
grant execute on function test.login(uuid) to authenticated;

-- Users (auth.users is managed by Supabase Auth in production)
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'sales@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'accountant@example.com'),
  ('00000000-0000-0000-0000-000000000004', 'store@example.com');

-- ---------------------------------------------------------------- setup
select test.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select public.bootstrap_company('المهندس للتكييفات', 'المهندس محمد', '01000000000');
select test.fails($$select public.bootstrap_company('x','y')$$, 'مرتبط بشركة', 'bootstrap cannot run twice');
select public.employee_attach('00000000-0000-0000-0000-000000000002', 'أحمد المبيعات', (select id from roles where key='sales'));
select public.employee_attach('00000000-0000-0000-0000-000000000003', 'منى المحاسبة', (select id from roles where key='accountant'));
select public.employee_attach('00000000-0000-0000-0000-000000000004', 'كريم المخزن', (select id from roles where key='warehouse'));

insert into warehouses(name, address) values ('مخزن ب - الإسكندرية', 'الإسكندرية');
select id as wh_a from warehouses where name = 'المخزن الرئيسي' \gset
select id as wh_b from warehouses where name = 'مخزن ب - الإسكندرية' \gset
select id as cash from cash_accounts limit 1 \gset
insert into suppliers(name, contact_person, phone) values ('Aolan Egypt', 'م. حسن', '0222222222');
select id as sup from suppliers limit 1 \gset
select (public.product_save('{"name":"تكييف صحراوي Aolan 30","model_number":"AZL30","brand":"Aolan","selling_price":15000,"purchase_price":11000,"min_stock":3}'::jsonb))->>'id' as prod \gset
insert into customers(full_name, phone, governorate, customer_type) values ('شركة النور للمقاولات', '01111111111', 'القاهرة', 'company');
insert into customers(full_name, phone, governorate, customer_type) values ('كنيسة مارمرقس', '01222222222', 'أسيوط', 'church');
select id as cust from customers where full_name like 'شركة النور%' \gset
select id as church from customers where full_name like 'كنيسة%' \gset
insert into pricing_rules(name, customer_type, discount_percent) values ('خصم دور العبادة 10%', 'church', 10);

-- Opening cash so payments/refunds can flow (opening balance workflow)
select (public.opening_batch_create(current_date, 'أرصدة دفترية'))->>'id' as ob \gset
select public.opening_line_add(:'ob', jsonb_build_object('line_type','cash','cash_account_id',:'cash','amount',50000));
select public.opening_batch_submit(:'ob');
select public.opening_batch_decide(:'ob', true);
select test.eq((select balance from cash_accounts where id = :'cash'), 50000, 'opening cash balance posted');
select test.ok((select bool_and(is_opening) from journal_entries where source_type = 'opening_balance'), 'opening entries flagged as opening');

-- ---------------------------------------------------------------- 1. receive 20 units into A
select (public.shipment_save(jsonb_build_object('supplier_id',:'sup','warehouse_id',:'wh_a','reference','BL-778',
   'shipping_cost',2000,'additional_cost',0,'status','in_transit',
   'items', jsonb_build_array(jsonb_build_object('product_id',:'prod','quantity',20,'unit_cost',11000)))))->>'id' as shp \gset
select id as shp_item from incoming_shipment_items where shipment_id = :'shp' \gset
select test.eq((select coalesce(sum(quantity),0) from stock_balances where product_id = :'prod'), 0, 'no stock before receiving');
-- partial delivery 12 then 8
select public.shipment_receive(:'shp', jsonb_build_array(jsonb_build_object('item_id',:'shp_item','received_quantity',12)), 'دفعة أولى', 'rcv-1');
select test.eq((select received_quantity from incoming_shipment_items where id = :'shp_item'), 12, 'partial receipt recorded');
select test.ok((select status = 'partially_received' from incoming_shipments where id = :'shp'), 'shipment partially received');
-- duplicate submission of the same receipt must not double stock (scenario 13)
select public.shipment_receive(:'shp', jsonb_build_array(jsonb_build_object('item_id',:'shp_item','received_quantity',12)), 'دفعة أولى', 'rcv-1');
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 12, 'duplicate receipt ignored (idempotent)');
select public.shipment_receive(:'shp', jsonb_build_array(jsonb_build_object('item_id',:'shp_item','received_quantity',8)), 'دفعة ثانية', 'rcv-2');
select test.fails(format($$select public.shipment_receive(%L, jsonb_build_array(jsonb_build_object('item_id',%L,'received_quantity',1)))$$, :'shp', :'shp_item'),
  'لا يمكن استلام', 'cannot over-receive a completed shipment');
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 20, '1. warehouse A has 20 units');
select test.eq((select avg_cost from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 11100, 'landed cost = 11000 + 2000/20');
select test.eq((select balance from suppliers where id = :'sup'), 220000, 'supplier payable = goods value');

-- ---------------------------------------------------------------- 2-3. transfer 5 to B
select (public.stock_transfer_create(jsonb_build_object('source_warehouse_id',:'wh_a','dest_warehouse_id',:'wh_b',
   'items', jsonb_build_array(jsonb_build_object('product_id',:'prod','quantity',5))), 'tr-1'))->>'id' as tr \gset
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 20, 'pending transfer does not move stock');
select public.stock_transfer_dispatch(:'tr');
select test.fails(format('select public.stock_transfer_dispatch(%L)', :'tr'), 'لا يمكن شحن', 'transfer cannot be dispatched twice');
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 15, 'source reduced on dispatch');
select public.stock_transfer_receive(:'tr');
select test.fails(format('select public.stock_transfer_receive(%L)', :'tr'), 'لا يمكن استلام', 'transfer cannot be received twice');
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 15, '3. warehouse A has 15');
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_b'), 5, '3. warehouse B has 5');
select test.eq((select count(*) from stock_movements where source_id = :'tr'), 2, 'transfer produced exactly 2 movements');

-- ---------------------------------------------------------------- 4-5. sell 2 from B (as sales employee)
reset role;
select test.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
select (public.sales_invoice_save(jsonb_build_object('customer_id',:'cust','warehouse_id',:'wh_b','payment_method','cash',
   'items', jsonb_build_array(jsonb_build_object('product_id',:'prod','quantity',2,'unit_price',15000)),
   'approve', true, 'payment', jsonb_build_object('amount', 20000, 'cash_account_id', :'cash')), 'inv-key-1'))->>'id' as inv \gset
-- duplicate click on "save & approve"
select public.sales_invoice_save(jsonb_build_object('customer_id',:'cust','warehouse_id',:'wh_b',
   'items', jsonb_build_array(jsonb_build_object('product_id',:'prod','quantity',2,'unit_price',15000)),
   'approve', true, 'payment', jsonb_build_object('amount', 20000, 'cash_account_id', :'cash')), 'inv-key-1');
select test.eq((select count(*) from v_sales_invoices), 1, 'duplicate invoice submission created one invoice');
select test.eq((select count(*) from sales_invoices), 0, 'sales role cannot read cost-bearing invoice base table');
select test.eq((select count(*) from customer_payments), 1, 'duplicate submission created one payment');
reset role;
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_b'), 3, '5. warehouse B has 3');
select test.eq((select total from sales_invoices where id = :'inv'), 30000, 'invoice total');
select test.eq((select balance_due from sales_invoices where id = :'inv'), 10000, 'partial payment leaves 10,000 due');
select test.eq((select balance from customers where id = :'cust'), 10000, 'customer balance = remaining');
select test.eq((select balance from cash_accounts where id = :'cash'), 70000, 'cash increased by collected amount only');
select test.eq((select cost_total from sales_invoices where id = :'inv'), 22200, 'COGS at landed avg cost');

-- sales employee cannot sell below the allowed price, cannot over-sell
set role authenticated;
select test.fails(format($$select public.sales_invoice_save(jsonb_build_object('warehouse_id',%L,'items',
   jsonb_build_array(jsonb_build_object('product_id',%L,'quantity',1,'unit_price',9000))))$$, :'wh_b', :'prod'),
   'أقل من السعر', 'sales employee cannot sell below price list');
select test.fails(format($$select public.sales_invoice_save(jsonb_build_object('customer_id',%L,'warehouse_id',%L,'approve',true,'items',
   jsonb_build_array(jsonb_build_object('product_id',%L,'quantity',4,'unit_price',15000))))$$, :'cust', :'wh_b', :'prod'),
   'الكمية غير كافية', 'negative stock prevented');
-- church special pricing (10%)
select test.eq(((public.get_product_price(:'prod', :'church', 1))->>'price')::numeric, 13500, 'church gets 10% special price');

-- ---------------------------------------------------------------- 11. sales employee cannot access restricted financial data
select test.eq((select count(*) from journal_entries), 0, '11. sales cannot read journal entries (RLS)');
select test.eq((select count(*) from cash_accounts), 0, '11. sales cannot read cash accounts');
select test.eq((select count(*) from stock_movements), 0, '11. sales cannot read cost-bearing movement table');
select test.ok((select avg_cost is null and stock_value is null from v_stock_balances where product_id = :'prod' and warehouse_id = :'wh_b'),
   '11. sales sees quantities but not costs');
select test.ok((select cost_total is null and gross_profit is null from v_sales_invoices where id = :'inv'), '11. sales cannot see invoice profit');
select test.ok((select purchase_price is null from v_products where id = :'prod'), '11. sales cannot see purchase price');
select test.eq((select count(*) from product_costs), 0, '11. product_costs hidden');
select test.fails('select public.trial_balance()', 'ليس لديك صلاحية', '11. sales cannot run trial balance RPC');
select test.fails($$select public.report_profit_loss('2020-01-01', '2030-01-01')$$, 'ليس لديك صلاحية', '11. sales cannot run P&L');
select test.ok((public.dashboard_summary())->'pnl' = 'null'::jsonb, '11. dashboard hides P&L for sales');
select test.fails($$update customers set balance = 0$$, 'permission denied', 'balances cannot be edited directly');
select test.fails($$insert into stock_movements(company_id, warehouse_id, product_id, movement_type, quantity, balance_after, source_type, source_id, source_line_id)
   values (app.company_id(), gen_random_uuid(), gen_random_uuid(), 'adjustment', 1, 1, 'x', gen_random_uuid(), gen_random_uuid())$$,
   'permission denied', 'stock movements cannot be inserted directly');
select test.fails($$update stock_balances set quantity = 999$$, 'permission denied', '1st rule: users cannot edit stock balances');
select test.fails($$delete from audit_logs$$, 'permission denied', 'audit log cannot be deleted by users');
select test.fails($$select public.sales_invoice_cancel('00000000-0000-0000-0000-000000000000', 'x')$$, 'ليس لديك صلاحية', 'sales cannot cancel approved invoices');

-- ---------------------------------------------------------------- 6-7. return one unit, inspect, approve
select (public.sales_return_create(jsonb_build_object('invoice_id',:'inv','reason','عيب تصنيع','items',
   jsonb_build_array(jsonb_build_object('invoice_item_id',(select id from v_sales_invoice_items where invoice_id = :'inv'),'quantity',1))),
   'ret-1'))->>'id' as ret \gset
reset role;
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_b'), 3, '7. return request does not add stock');
select test.login('00000000-0000-0000-0000-000000000004');   -- warehouse inspects
set role authenticated;
select test.fails(format($$select public.sales_return_inspect(%L, jsonb_build_array(jsonb_build_object('id',%L,'condition','damaged','decision','restock')))$$,
   :'ret', (select id from sales_return_items limit 1)), 'غير سليم', 'damaged item cannot be restocked as sellable');
select public.sales_return_inspect(:'ret', jsonb_build_array(jsonb_build_object('id',(select id from sales_return_items limit 1),
   'condition','good','decision','restock','inspection_notes','الجهاز سليم بالكرتونة')));
select test.fails(format('select public.sales_return_approve(%L)', :'ret'), 'ليس لديك صلاحية', 'warehouse cannot approve returns financially');
reset role;
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_b'), 3, '7. inspected return still not in stock');
select test.login('00000000-0000-0000-0000-000000000003');   -- accountant approves
set role authenticated;
select public.sales_return_approve(:'ret', jsonb_build_object('amount', 0));
reset role;
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_b'), 4, '7. stock increases only after approval');
select test.eq((select balance from customers where id = :'cust'), -5000, 'return credit reduces customer balance (now a credit)');
select test.eq((select returned_amount from sales_invoices where id = :'inv'), 15000, 'invoice returned amount');

-- ---------------------------------------------------------------- 8. financial entries balance
select test.eq((select count(*) from journal_entries e where (select sum(debit) - sum(credit) from journal_entry_lines l where l.entry_id = e.id) <> 0), 0,
   '8. every journal entry balances');
select test.eq((select sum(debit) - sum(credit) from journal_entry_lines), 0, '8. trial balance totals equal');
select test.login('00000000-0000-0000-0000-000000000003');
set role authenticated;
select test.eq(((public.integrity_check())->>'ar_gl_vs_customers')::numeric, 0, '8. AR ledger = customer balances');
select test.eq(((public.integrity_check())->>'ap_gl_vs_suppliers')::numeric, 0, '8. AP ledger = supplier balances');
select test.eq(((public.integrity_check())->>'cash_gl_vs_accounts')::numeric, 0, '8. cash ledger = cash accounts');
select test.eq(((public.integrity_check())->>'stock_ledger_mismatches')::numeric, 0, '8. stock balances = movement ledger');
select test.ok(abs(((public.integrity_check())->>'inventory_gl_vs_subledger')::numeric) < 1, '8. inventory GL ≈ valuation (rounding < 1 EGP)');
-- profit vs cash are distinct
select test.eq(((public.report_profit_loss(current_date - 1, current_date + 1))->>'net_revenue')::numeric, 15000, 'net revenue after return');
select test.eq(((public.report_profit_loss(current_date - 1, current_date + 1))->>'gross_profit')::numeric, 3900, 'gross profit = 15000 - 11100');
select test.eq(((public.dashboard_summary())->>'collected')::numeric, 20000, 'cash collected is reported separately from profit');
-- supplier payment
select public.supplier_payment_create(jsonb_build_object('supplier_id',:'sup','amount',50000,'cash_account_id',:'cash'), 'sp-1');
select public.supplier_payment_create(jsonb_build_object('supplier_id',:'sup','amount',50000,'cash_account_id',:'cash'), 'sp-1');
reset role;
select test.eq((select balance from suppliers where id = :'sup'), 170000, 'supplier payment once despite double submit');
select test.eq((select balance from cash_accounts where id = :'cash'), 20000, 'cash after supplier payment');
-- expense
select test.login('00000000-0000-0000-0000-000000000003');
set role authenticated;
select public.expense_create(jsonb_build_object('category_id',(select id from expense_categories where name='إيجارات'),
  'cash_account_id',:'cash','amount',3000,'description','إيجار المعرض'), 'exp-1');
select test.eq(((public.report_profit_loss(current_date - 1, current_date + 1))->>'net_profit')::numeric, 900, 'net profit = gross 3900 - expenses 3000');
reset role;

-- ---------------------------------------------------------------- 9. cancellation keeps history
select test.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select (public.sales_invoice_save(jsonb_build_object('customer_id',:'church','warehouse_id',:'wh_a',
   'items', jsonb_build_array(jsonb_build_object('product_id',:'prod','quantity',1,'unit_price',13500)), 'approve', true), 'inv-key-2'))->>'id' as inv2 \gset
select test.fails(format($$select public.sales_invoice_cancel(%L, '')$$, :'inv2'), 'سبب الإلغاء مطلوب', 'cancellation requires a reason');
select public.sales_invoice_cancel(:'inv2', 'العميل ألغى الطلب');
reset role;
select test.ok((select status = 'cancelled' from sales_invoices where id = :'inv2'), '9. cancelled invoice still exists');
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 15, '9. cancellation restored stock');
select test.eq((select balance from customers where id = :'church'), 0, '9. cancellation cleared customer balance');
select test.eq((select count(*) from journal_entries where source_id = :'inv2' and reverses_id is not null), 1, '9. revenue/COGS reversed by a reversing entry');
set role authenticated;
select test.fails(format($$delete from sales_invoices where id = %L$$, :'inv2'), 'permission denied', '9. invoices cannot be deleted by users');
reset role;
select test.fails(format($$delete from sales_invoice_items where invoice_id = %L$$, :'inv2'), 'لا يمكن حذف', '9. financial documents cannot be deleted even by the DB owner');
select test.fails(format($$delete from journal_entries where source_id = %L$$, :'inv2'), 'لا يمكن تعديلها', '9. journal is immutable even for the DB owner');

-- ---------------------------------------------------------------- 10. audit trail
select test.ok((select count(*) > 0 from audit_logs a join profiles p on p.id = a.user_id
   where a.record_id = :'inv' and a.action = 'approve' and p.full_name = 'أحمد المبيعات' and a.created_at is not null),
   '10. audit shows who approved the invoice and when');
select test.ok((select count(*) > 0 from audit_logs where record_id = :'inv2' and action = 'cancel' and reason = 'العميل ألغى الطلب'),
   '10. cancellation reason is audited');
select test.ok((select count(*) > 0 from audit_logs where table_name = 'stock_movements' and action = 'stock_transfer_out'),
   '10. inventory movements are audited at DB level');
select test.ok((select count(*) > 0 from audit_logs where table_name = 'role_permissions'), '10. permission grants audited');
select test.fails($$update audit_logs set action = 'x'$$, 'غير قابل للتعديل', '10. audit log is append-only even for the DB owner');

-- price change audited with old/new values
select test.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select public.product_save(jsonb_build_object('id', :'prod', 'selling_price', 15500), 'زيادة سعر المورد');
reset role;
select test.ok((select (old_values->>'selling_price')::numeric = 15000 and (new_values->>'selling_price')::numeric = 15500
   and reason = 'زيادة سعر المورد' from audit_logs where table_name = 'products' and record_id = :'prod' and action = 'update'
   order by created_at desc limit 1), '10. price change logged with previous/new values and reason');

-- ---------------------------------------------------------------- 12. AI cannot execute unauthorized operations
select test.login('00000000-0000-0000-0000-000000000004');   -- warehouse: has ai.use but not ai.execute / sales.create
set role authenticated;
select (public.ai_action_prepare('create_sales_invoice', jsonb_build_object('customer_id',:'cust','warehouse_id',:'wh_a',
   'items', jsonb_build_array(jsonb_build_object('product_id',:'prod','quantity',1,'unit_price',15500))), '{}'::jsonb))->>'id' as ai1 \gset
select test.fails(format('select public.ai_action_execute(%L)', :'ai1'), 'ليس لديك صلاحية', '12. AI action blocked without permission');
reset role;
select test.login('00000000-0000-0000-0000-000000000002');   -- sales: allowed, executes once
set role authenticated;
select test.fails(format('select public.ai_action_execute(%L)', :'ai1'), 'غير موجودة', '12. user cannot execute another user''s AI action');
select (public.ai_action_prepare('create_sales_invoice', jsonb_build_object('customer_id',:'cust','warehouse_id',:'wh_a',
   'items', jsonb_build_array(jsonb_build_object('product_id',:'prod','quantity',1,'unit_price',15500))), '{}'::jsonb))->>'id' as ai2 \gset
select public.ai_action_execute(:'ai2');
select public.ai_action_execute(:'ai2');
reset role;
select test.eq((select count(*) from sales_invoices where status = 'draft'), 1, '12/13. AI action executed exactly once (draft invoice)');
select test.ok((select count(*) > 0 from audit_logs where source = 'ai' and ai_action_id = :'ai2'), '12. AI-generated operation logged with source=ai');

-- ---------------------------------------------------------------- adjustments need approval, counts
select test.login('00000000-0000-0000-0000-000000000004');
set role authenticated;
select (public.stock_adjustment_request(jsonb_build_object('warehouse_id',:'wh_a','product_id',:'prod','quantity',-1,'reason','كسر أثناء النقل')))->>'id' as adj \gset
select test.fails(format('select public.stock_adjustment_decide(%L, true)', :'adj'), 'ليس لديك صلاحية', 'warehouse keeper cannot approve own adjustment');
reset role;
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 15, 'adjustment pending → no stock change');
select test.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select public.stock_adjustment_decide(:'adj', true);
select (public.stock_count_create(:'wh_b'))->>'id' as cnt \gset
select public.stock_count_update(:'cnt', jsonb_build_array(jsonb_build_object('product_id',:'prod','counted_quantity',4)));
select public.stock_count_submit(:'cnt');
select public.stock_count_approve(:'cnt');
reset role;
select test.eq((select quantity from stock_balances where product_id = :'prod' and warehouse_id = :'wh_a'), 14, 'approved adjustment applied');
select test.eq((select sum(debit) - sum(credit) from journal_entry_lines), 0, 'ledger still balanced at end');

-- concurrency guard: two sessions approving the same draft — second sees status check under row lock
select test.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select public.sales_invoice_approve((select id from sales_invoices where status = 'draft' limit 1));
select test.fails($$select public.sales_invoice_approve((select id from sales_invoices where number like 'INV%' and status = 'approved' order by created_at desc limit 1))$$,
   'معتمدة أو ملغاة', 'invoice cannot be approved twice');
reset role;
select 'ALL ACCEPTANCE TESTS PASSED';
