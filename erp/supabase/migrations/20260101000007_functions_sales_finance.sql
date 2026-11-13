-- =====================================================================
-- 0007 Business functions (part 2): pricing, sales, payments, returns,
-- expenses, cash, manual journals, deliveries, opening balances, AI actions
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------
create or replace function public.get_product_price(p_product uuid, p_customer uuid default null, p_quantity numeric default 1)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('products.view'); v_base numeric(18,2); v_type text; r record;
  v_best numeric(18,2); v_rule text; v_price numeric(18,2);
begin
  select selling_price into v_base from public.products where id = p_product and company_id = v_company;
  if v_base is null then raise exception 'المنتج غير موجود'; end if;
  select customer_type into v_type from public.customers where id = p_customer;
  v_best := v_base;
  for r in select * from public.pricing_rules
            where company_id = v_company and is_active
              and (product_id is null or product_id = p_product)
              and (customer_id is null or customer_id = p_customer)
              and (customer_type is null or customer_type = v_type)
              and min_quantity <= coalesce(p_quantity,1)
              and (valid_from is null or valid_from <= current_date) and (valid_to is null or valid_to >= current_date)
            order by priority desc loop
    v_price := coalesce(r.fixed_price, round(v_base * (1 - r.discount_percent / 100), 2));
    if v_price < v_best then v_best := v_price; v_rule := r.name; end if;
  end loop;
  return jsonb_build_object('base_price', v_base, 'price', v_best, 'rule', v_rule);
end $$;

-- ---------------------------------------------------------------------
-- Sales invoices
-- p: {id?, customer_id?, customer_name?, warehouse_id, sale_type, payment_method, discount_amount, shipping_charge,
--     notes, items:[{product_id, quantity, unit_price, discount_amount, description, serials}],
--     approve: bool, payment: {amount, cash_account_id}}
-- ---------------------------------------------------------------------
create or replace function public.sales_invoice_save(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('sales.create'); v_prev jsonb; v_id uuid := nullif(p->>'id','')::uuid; v_num text;
  i jsonb; v_sub numeric(18,2) := 0; v_line numeric(18,2); v_list jsonb; v_n int := 0; v_status text; v_res jsonb;
  v_disc numeric(18,2) := coalesce((p->>'discount_amount')::numeric, 0); v_ship numeric(18,2) := coalesce((p->>'shipping_charge')::numeric, 0);
  v_cust uuid := nullif(p->>'customer_id','')::uuid; v_cname text;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'sales_invoice_save'); if v_prev is not null then return v_prev; end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل'; end if;
  if v_cust is not null then
    select full_name into v_cname from public.customers where id = v_cust and company_id = v_company and archived_at is null;
    if v_cname is null then raise exception 'العميل غير موجود'; end if;
  else v_cname := coalesce(nullif(trim(p->>'customer_name'),''), 'عميل نقدي'); end if;

  if v_id is null then
    v_num := app.next_number(v_company, 'INV');
    insert into public.sales_invoices(company_id, number, customer_id, customer_name, warehouse_id, sale_type, payment_method,
      discount_amount, shipping_charge, notes, salesperson_id, created_by, idempotency_key)
    values (v_company, v_num, v_cust, v_cname, (p->>'warehouse_id')::uuid, coalesce(nullif(p->>'sale_type',''),'cash'),
      coalesce(nullif(p->>'payment_method',''),'cash'), v_disc, v_ship, p->>'notes',
      coalesce(nullif(p->>'salesperson_id','')::uuid, auth.uid()), auth.uid(), p_idempotency_key)
    returning id into v_id;
  else
    select status, number into v_status, v_num from public.sales_invoices where id = v_id and company_id = v_company for update;
    if v_status is null then raise exception 'الفاتورة غير موجودة'; end if;
    if v_status <> 'draft' then raise exception 'لا يمكن تعديل فاتورة معتمدة — استخدم الإلغاء أو المرتجع'; end if;
    update public.sales_invoices set customer_id = v_cust, customer_name = v_cname, warehouse_id = (p->>'warehouse_id')::uuid,
      sale_type = coalesce(nullif(p->>'sale_type',''),'cash'), payment_method = coalesce(nullif(p->>'payment_method',''),'cash'),
      discount_amount = v_disc, shipping_charge = v_ship, notes = p->>'notes'
    where id = v_id;
    delete from public.sales_invoice_items where invoice_id = v_id;
  end if;

  for i in select * from jsonb_array_elements(p->'items') loop
    v_n := v_n + 1;
    if coalesce((i->>'quantity')::numeric,0) <= 0 then raise exception 'الكمية يجب أن تكون أكبر من صفر'; end if;
    v_list := public.get_product_price((i->>'product_id')::uuid, v_cust, (i->>'quantity')::numeric);
    if (i->>'unit_price')::numeric < (v_list->>'price')::numeric and not app.has_perm('sales.price_override') then
      raise exception 'سعر البيع (%) أقل من السعر المسموح (%) — يتطلب صلاحية البيع بسعر خاص',
        (i->>'unit_price')::numeric, (v_list->>'price')::numeric using errcode = '42501';
    end if;
    v_line := round((i->>'quantity')::numeric * (i->>'unit_price')::numeric - coalesce((i->>'discount_amount')::numeric,0), 2);
    if v_line < 0 then raise exception 'خصم السطر أكبر من قيمته'; end if;
    insert into public.sales_invoice_items(invoice_id, company_id, product_id, description, quantity, unit_price, list_price,
      discount_amount, line_total, serials, sort_order)
    values (v_id, v_company, (i->>'product_id')::uuid, i->>'description', (i->>'quantity')::numeric, (i->>'unit_price')::numeric,
      (v_list->>'price')::numeric, coalesce((i->>'discount_amount')::numeric,0), v_line, i->'serials', v_n);
    v_sub := v_sub + v_line;
  end loop;
  if v_disc > v_sub then raise exception 'خصم الفاتورة أكبر من قيمتها'; end if;
  update public.sales_invoices set subtotal = v_sub, total = v_sub - v_disc + v_ship where id = v_id;

  v_res := jsonb_build_object('id', v_id, 'number', v_num);
  if coalesce((p->>'approve')::boolean, false) then
    v_res := v_res || public.sales_invoice_approve(v_id, p->'payment');
  end if;
  return app.idem_finish(v_company, p_idempotency_key, v_res);
end $$;

create or replace function public.sales_invoice_approve(p_id uuid, p_payment jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('sales.approve'); inv public.sales_invoices; it record; v_cost numeric;
  v_cogs numeric(18,2) := 0; v_pay numeric(18,2); v_je uuid; v_limit numeric; v_bal numeric;
begin
  select * into inv from public.sales_invoices where id = p_id and company_id = v_company for update;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  if inv.status <> 'draft' then raise exception 'الفاتورة معتمدة أو ملغاة بالفعل'; end if;
  v_pay := round(coalesce((p_payment->>'amount')::numeric, 0), 2);
  if v_pay < 0 or v_pay > inv.total then raise exception 'المبلغ المدفوع يجب أن يكون بين صفر وإجمالي الفاتورة'; end if;
  if inv.customer_id is null and v_pay < inv.total then
    raise exception 'البيع الآجل أو الجزئي يتطلب اختيار عميل مسجل';
  end if;
  if inv.customer_id is not null and v_pay < inv.total then
    select credit_limit, balance into v_limit, v_bal from public.customers where id = inv.customer_id for update;
    if v_limit is not null and v_bal + (inv.total - v_pay) > v_limit then
      raise exception 'تجاوز حد الائتمان للعميل (الحد % ج.م، الرصيد الحالي % ج.م)', v_limit, v_bal;
    end if;
  end if;

  for it in select * from public.sales_invoice_items where invoice_id = p_id order by sort_order loop
    v_cost := app.post_stock(v_company, inv.warehouse_id, it.product_id, -it.quantity, null, 'sale', 'sales_invoice', p_id, it.id, inv.number);
    perform app.serials_move(v_company, it.product_id, it.serials, it.quantity, inv.warehouse_id, 'in_stock', null, 'sold', p_id);
    update public.sales_invoice_items set unit_cost = v_cost where id = it.id;
    v_cogs := v_cogs + round(it.quantity * v_cost, 2);
  end loop;

  v_je := app.post_journal(v_company, (inv.invoice_date at time zone 'Africa/Cairo')::date, 'فاتورة بيع ' || inv.number, 'sales_invoice', p_id, inv.number,
    jsonb_build_array(
      jsonb_build_object('account','1200','debit', inv.total, 'party_type', case when inv.customer_id is not null then 'customer' end, 'party_id', inv.customer_id),
      jsonb_build_object('account','4200','debit', inv.discount_amount),
      jsonb_build_object('account','4100','credit', inv.subtotal),
      jsonb_build_object('account','4150','credit', inv.shipping_charge),
      jsonb_build_object('account','5100','debit', v_cogs),
      jsonb_build_object('account','1300','credit', v_cogs, 'warehouse_id', inv.warehouse_id)));
  perform app.customer_balance_add(inv.customer_id, inv.total);

  perform app.set_context('approve', null, 'sales_invoices');
  update public.sales_invoices set status = 'approved', approved_by = auth.uid(), approved_at = now(), cost_total = v_cogs,
    sale_type = case when v_pay >= total then 'cash' when v_pay = 0 then 'credit' else 'partial' end
   where id = p_id;

  if v_pay > 0 then
    perform public.customer_payment_create(jsonb_build_object('customer_id', inv.customer_id, 'invoice_id', p_id, 'amount', v_pay,
      'cash_account_id', coalesce(nullif(p_payment->>'cash_account_id','')::uuid,
                                  (select default_cash_account_id from public.company_settings where company_id = v_company)),
      'method', inv.payment_method, 'notes', 'دفعة مع الفاتورة ' || inv.number), null, true);
  end if;
  return jsonb_build_object('status', 'approved', 'cost_total', case when app.has_perm('finance.view_profit') then v_cogs end);
end $$;

create or replace function public.sales_invoice_void(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('sales.create');
begin
  perform app.set_context('void', p_reason, 'sales_invoices');
  update public.sales_invoices set status = 'void', cancel_reason = p_reason, cancelled_by = auth.uid(), cancelled_at = now()
   where id = p_id and company_id = v_company and status = 'draft';
  if not found then raise exception 'يمكن إلغاء المسودات فقط بهذه الطريقة'; end if;
  return jsonb_build_object('id', p_id, 'status', 'void');
end $$;

-- Cancel an approved invoice: stock returns, revenue/COGS reversed; payments stay as customer credit.
create or replace function public.sales_invoice_cancel(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('sales.cancel'); inv public.sales_invoices; it record;
begin
  if coalesce(trim(p_reason),'') = '' then raise exception 'سبب الإلغاء مطلوب'; end if;
  select * into inv from public.sales_invoices where id = p_id and company_id = v_company for update;
  if not found then raise exception 'الفاتورة غير موجودة'; end if;
  if inv.status <> 'approved' then raise exception 'يمكن إلغاء الفواتير المعتمدة فقط'; end if;
  if exists (select 1 from public.sales_returns where invoice_id = p_id and status not in ('rejected','cancelled')) then
    raise exception 'لا يمكن إلغاء فاتورة عليها مرتجعات — عالج المرتجعات أولاً';
  end if;
  for it in select * from public.sales_invoice_items where invoice_id = p_id loop
    perform app.post_stock(v_company, inv.warehouse_id, it.product_id, it.quantity, it.unit_cost, 'sale_cancel',
                           'sales_invoice', p_id, it.id, inv.number, 'available', p_reason);
    perform app.serials_move(v_company, it.product_id, it.serials, it.quantity, null, 'sold', inv.warehouse_id, 'in_stock');
  end loop;
  perform app.reverse_source_entries(v_company, 'sales_invoice', p_id, p_reason);
  perform app.customer_balance_add(inv.customer_id, -inv.total);
  update public.deliveries set status = 'cancelled' where invoice_id = p_id and status in ('pending','preparing');
  perform app.set_context('cancel', p_reason, 'sales_invoices');
  update public.sales_invoices set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = p_reason
   where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'cancelled', 'customer_credit', inv.paid_amount);
end $$;

-- ---------------------------------------------------------------------
-- Customer payments (receipts & refunds)
-- ---------------------------------------------------------------------
create or replace function public.customer_payment_create(p jsonb, p_idempotency_key text default null,
  p_internal boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid; v_prev jsonb; v_id uuid; v_num text; v_amt numeric(18,2); inv public.sales_invoices;
  v_cust uuid := nullif(p->>'customer_id','')::uuid; v_acc uuid := nullif(p->>'cash_account_id','')::uuid; v_je uuid;
  v_dir text := coalesce(p->>'direction','receipt'); v_name text;
begin
  -- invoice-embedded payments are authorised by sales.approve inside sales_invoice_approve
  if p_internal then v_company := app.company_id(); else v_company := app.require_perm('payments.receive'); end if;
  if v_dir = 'refund' and not p_internal then perform app.require_perm('returns.approve'); end if;
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'customer_payment_create'); if v_prev is not null then return v_prev; end if;
  v_amt := round((p->>'amount')::numeric, 2);
  if v_amt is null or v_amt <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  if v_acc is null then raise exception 'اختر الخزنة أو الحساب البنكي'; end if;
  if nullif(p->>'invoice_id','') is not null then
    select * into inv from public.sales_invoices where id = (p->>'invoice_id')::uuid and company_id = v_company for update;
    if not found or inv.status <> 'approved' then raise exception 'الفاتورة غير معتمدة'; end if;
    v_cust := inv.customer_id;
    if v_dir = 'receipt' and v_amt > inv.balance_due then
      raise exception 'المبلغ (%) أكبر من المتبقي على الفاتورة (%)', v_amt, inv.balance_due;
    end if;
  end if;
  if v_cust is null and inv.id is null then raise exception 'اختر العميل'; end if;
  select full_name into v_name from public.customers where id = v_cust;
  v_name := coalesce(v_name, inv.customer_name, 'عميل نقدي');
  v_num := app.next_number(v_company, case when v_dir = 'refund' then 'RFD' else 'RCPT' end);
  insert into public.customer_payments(company_id, number, customer_id, invoice_id, return_id, direction, cash_account_id, amount,
    payment_date, method, notes, created_by)
  values (v_company, v_num, v_cust, inv.id, nullif(p->>'return_id','')::uuid, v_dir, v_acc, v_amt,
          coalesce(nullif(p->>'payment_date','')::date, (now() at time zone 'Africa/Cairo')::date), coalesce(p->>'method','cash'),
          p->>'notes', auth.uid())
  returning id into v_id;
  if v_dir = 'receipt' then
    v_je := app.post_journal(v_company, nullif(p->>'payment_date','')::date, 'تحصيل من ' || v_name || ' ' || v_num, 'customer_payment', v_id,
      coalesce(inv.number, v_num),
      jsonb_build_array(jsonb_build_object('account_id', app.cash_gl(v_acc), 'debit', v_amt),
                        jsonb_build_object('account','1200','credit',v_amt,'party_type', case when v_cust is not null then 'customer' end,'party_id',v_cust)));
    perform app.cash_move(v_company, v_acc, v_amt, 'customer_payment', v_id, v_num, 'تحصيل من ' || v_name, v_je, nullif(p->>'payment_date','')::date);
    perform app.customer_balance_add(v_cust, -v_amt);
    if inv.id is not null then update public.sales_invoices set paid_amount = paid_amount + v_amt where id = inv.id; end if;
  else
    v_je := app.post_journal(v_company, nullif(p->>'payment_date','')::date, 'رد مبلغ إلى ' || v_name || ' ' || v_num, 'customer_payment', v_id,
      coalesce(inv.number, v_num),
      jsonb_build_array(jsonb_build_object('account','1200','debit',v_amt,'party_type', case when v_cust is not null then 'customer' end,'party_id',v_cust),
                        jsonb_build_object('account_id', app.cash_gl(v_acc), 'credit', v_amt)));
    perform app.cash_move(v_company, v_acc, -v_amt, 'customer_refund', v_id, v_num, 'رد مبلغ إلى ' || v_name, v_je, nullif(p->>'payment_date','')::date);
    perform app.customer_balance_add(v_cust, v_amt);
    if inv.id is not null then update public.sales_invoices set paid_amount = paid_amount - v_amt where id = inv.id; end if;
  end if;
  update public.customer_payments set journal_entry_id = v_je where id = v_id;
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('payment_id', v_id, 'payment_number', v_num));
end $$;

create or replace function public.customer_payment_cancel(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.manage'); cp public.customer_payments; v_sign int;
begin
  if coalesce(trim(p_reason),'') = '' then raise exception 'سبب الإلغاء مطلوب'; end if;
  select * into cp from public.customer_payments where id = p_id and company_id = v_company for update;
  if not found or cp.status <> 'posted' then raise exception 'لا يمكن إلغاء هذه الحركة'; end if;
  v_sign := case when cp.direction = 'receipt' then 1 else -1 end;
  perform app.reverse_source_entries(v_company, 'customer_payment', p_id, p_reason);
  perform app.cash_move(v_company, cp.cash_account_id, -v_sign * cp.amount, 'customer_payment_cancel', p_id, cp.number, 'إلغاء ' || cp.number, null);
  perform app.customer_balance_add(cp.customer_id, v_sign * cp.amount);
  if cp.invoice_id is not null then update public.sales_invoices set paid_amount = paid_amount - v_sign * cp.amount where id = cp.invoice_id; end if;
  perform app.set_context('cancel', p_reason, 'customer_payments');
  update public.customer_payments set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'cancelled');
end $$;

-- ---------------------------------------------------------------------
-- Sales returns: create (no stock change) → inspect → approve (stock + finance)
-- ---------------------------------------------------------------------
create or replace function public.sales_return_create(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('returns.create'); v_prev jsonb; inv public.sales_invoices; v_id uuid; v_num text;
  i jsonb; it public.sales_invoice_items; v_pending numeric;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'sales_return_create'); if v_prev is not null then return v_prev; end if;
  if coalesce(trim(p->>'reason'),'') = '' then raise exception 'سبب المرتجع مطلوب'; end if;
  select * into inv from public.sales_invoices where id = (p->>'invoice_id')::uuid and company_id = v_company for update;
  if not found then raise exception 'الفاتورة الأصلية غير موجودة'; end if;
  if inv.status <> 'approved' then raise exception 'المرتجع يجب أن يكون على فاتورة معتمدة'; end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'حدد الأصناف المرتجعة'; end if;
  v_num := app.next_number(v_company, 'RET');
  insert into public.sales_returns(company_id, number, invoice_id, customer_id, warehouse_id, return_type, reason, notes, created_by)
  values (v_company, v_num, inv.id, inv.customer_id, coalesce(nullif(p->>'warehouse_id','')::uuid, inv.warehouse_id),
          coalesce(nullif(p->>'return_type',''),'return'), p->>'reason', p->>'notes', auth.uid())
  returning id into v_id;
  for i in select * from jsonb_array_elements(p->'items') loop
    select * into it from public.sales_invoice_items where id = (i->>'invoice_item_id')::uuid and invoice_id = inv.id for update;
    if not found then raise exception 'الصنف غير موجود في الفاتورة الأصلية'; end if;
    select coalesce(sum(ri.quantity),0) into v_pending from public.sales_return_items ri join public.sales_returns r on r.id = ri.return_id
     where ri.invoice_item_id = it.id and r.status in ('pending_inspection','inspected');
    if (i->>'quantity')::numeric > it.quantity - it.returned_quantity - v_pending then
      raise exception 'الكمية المرتجعة أكبر من الكمية المتاحة للإرجاع (%)', it.quantity - it.returned_quantity - v_pending;
    end if;
    insert into public.sales_return_items(return_id, company_id, invoice_item_id, product_id, quantity, reason, serials)
    values (v_id, v_company, it.id, it.product_id, (i->>'quantity')::numeric, i->>'reason', i->'serials');
  end loop;
  perform app.notify(v_company, 'returns.inspect', 'approval', 'مرتجع بانتظار الفحص', 'المرتجع ' || v_num || ' على الفاتورة ' || inv.number,
                     '/returns/' || v_id);
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_id, 'number', v_num));
end $$;

-- p_items: [{id, condition, decision, inspection_notes}]
create or replace function public.sales_return_inspect(p_id uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('returns.inspect'); r public.sales_returns; i jsonb;
begin
  select * into r from public.sales_returns where id = p_id and company_id = v_company for update;
  if not found then raise exception 'المرتجع غير موجود'; end if;
  if r.status not in ('pending_inspection','inspected') then raise exception 'المرتجع ليس في مرحلة الفحص'; end if;
  for i in select * from jsonb_array_elements(p_items) loop
    if i->>'condition' not in ('good','damaged','defective','missing_parts') then raise exception 'حالة الفحص غير صحيحة'; end if;
    if i->>'decision' not in ('restock','damaged_stock','scrap','return_to_supplier') then raise exception 'قرار الفحص غير صحيح'; end if;
    if i->>'decision' = 'restock' and i->>'condition' <> 'good' then
      raise exception 'لا يمكن إعادة صنف غير سليم إلى المخزون القابل للبيع';
    end if;
    update public.sales_return_items set condition = i->>'condition', decision = i->>'decision', inspection_notes = i->>'inspection_notes'
     where id = (i->>'id')::uuid and return_id = p_id;
  end loop;
  if exists (select 1 from public.sales_return_items where return_id = p_id and decision is null) then
    raise exception 'يجب فحص جميع الأصناف';
  end if;
  perform app.set_context('inspect', null, 'sales_returns');
  update public.sales_returns set status = 'inspected', inspected_by = auth.uid(), inspected_at = now() where id = p_id;
  perform app.notify(v_company, 'returns.approve', 'approval', 'مرتجع بانتظار الاعتماد', 'تم فحص المرتجع ' || r.number, '/returns/' || p_id);
  return jsonb_build_object('id', p_id, 'status', 'inspected');
end $$;

-- Approve: credit note, stock per inspection decision, optional cash refund.
create or replace function public.sales_return_approve(p_id uuid, p_refund jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('returns.approve'); r public.sales_returns; inv public.sales_invoices; ri record;
  v_factor numeric; v_credit numeric(18,2); v_credit_total numeric(18,2) := 0; v_cost_back numeric(18,2) := 0;
  v_scrap numeric(18,2) := 0; v_lc numeric(18,2); v_refund numeric(18,2); v_lines jsonb := '[]'::jsonb;
begin
  select * into r from public.sales_returns where id = p_id and company_id = v_company for update;
  if not found then raise exception 'المرتجع غير موجود'; end if;
  if r.status <> 'inspected' then raise exception 'يجب فحص المرتجع قبل الاعتماد'; end if;
  select * into inv from public.sales_invoices where id = r.invoice_id for update;
  v_factor := case when inv.subtotal > 0 then (inv.subtotal - inv.discount_amount) / inv.subtotal else 1 end;

  for ri in select x.*, it.line_total, it.quantity as sold_qty, it.unit_cost as sold_cost, it.returned_quantity
              from public.sales_return_items x join public.sales_invoice_items it on it.id = x.invoice_item_id
             where x.return_id = p_id loop
    if ri.quantity > ri.sold_qty - ri.returned_quantity then raise exception 'تم إرجاع هذه الكمية من قبل'; end if;
    v_credit := round(ri.quantity * (ri.line_total / ri.sold_qty) * v_factor, 2);
    v_lc := round(ri.quantity * coalesce(ri.sold_cost,0), 2);
    if ri.decision in ('restock','damaged_stock','return_to_supplier') then
      perform app.post_stock(v_company, r.warehouse_id, ri.product_id, ri.quantity, ri.sold_cost, 'sale_return', 'sales_return', p_id,
                             ri.id, r.number, case when ri.decision = 'restock' then 'available' else 'damaged' end, ri.inspection_notes);
      perform app.serials_move(v_company, ri.product_id, ri.serials, ri.quantity, null, 'sold', r.warehouse_id,
                               case when ri.decision = 'restock' then 'in_stock' else 'damaged' end);
      v_cost_back := v_cost_back + v_lc;
    else
      perform app.serials_move(v_company, ri.product_id, ri.serials, ri.quantity, null, 'sold', null, 'scrapped');
      v_scrap := v_scrap + v_lc;
    end if;
    update public.sales_return_items set credit_amount = v_credit, unit_cost = ri.sold_cost where id = ri.id;
    update public.sales_invoice_items set returned_quantity = returned_quantity + ri.quantity where id = ri.invoice_item_id;
    v_credit_total := v_credit_total + v_credit;
  end loop;

  perform app.post_journal(v_company, null, 'مرتجع مبيعات ' || r.number || ' على ' || inv.number, 'sales_return', p_id, r.number,
    jsonb_build_array(
      jsonb_build_object('account','4300','debit',v_credit_total),
      jsonb_build_object('account','1200','credit',v_credit_total,'party_type', case when inv.customer_id is not null then 'customer' end,'party_id',inv.customer_id),
      jsonb_build_object('account','1300','debit',v_cost_back,'warehouse_id',r.warehouse_id),
      jsonb_build_object('account','5100','credit',v_cost_back),
      jsonb_build_object('account','5300','debit',v_scrap,'memo','مرتجع تالف غير قابل للإصلاح'),
      jsonb_build_object('account','5100','credit',v_scrap)));
  perform app.customer_balance_add(inv.customer_id, -v_credit_total);
  update public.sales_invoices set returned_amount = returned_amount + v_credit_total where id = inv.id;

  v_refund := round(coalesce((p_refund->>'amount')::numeric, 0), 2);
  if v_refund > 0 then
    if v_refund > v_credit_total then raise exception 'مبلغ الاسترداد أكبر من قيمة المرتجع'; end if;
    perform public.customer_payment_create(jsonb_build_object('direction','refund','customer_id',inv.customer_id,'invoice_id',inv.id,
      'return_id', p_id, 'amount', v_refund, 'cash_account_id', p_refund->>'cash_account_id', 'notes', 'استرداد مرتجع ' || r.number),
      null, true);
  end if;
  perform app.set_context('approve', null, 'sales_returns');
  update public.sales_returns set status = 'approved', approved_by = auth.uid(), approved_at = now(), credit_amount = v_credit_total,
         refund_amount = v_refund, cost_restocked = v_cost_back where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'approved', 'credit_amount', v_credit_total, 'refund_amount', v_refund);
end $$;

create or replace function public.sales_return_reject(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('returns.approve');
begin
  if coalesce(trim(p_reason),'') = '' then raise exception 'سبب الرفض مطلوب'; end if;
  perform app.set_context('reject', p_reason, 'sales_returns');
  update public.sales_returns set status = 'rejected', rejection_reason = p_reason, approved_by = auth.uid(), approved_at = now()
   where id = p_id and company_id = v_company and status in ('pending_inspection','inspected');
  if not found then raise exception 'لا يمكن رفض هذا المرتجع'; end if;
  return jsonb_build_object('id', p_id, 'status', 'rejected');
end $$;

create or replace function public.sales_return_link_exchange(p_return_id uuid, p_invoice_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('sales.create');
begin
  perform app.set_context('exchange_link', null, 'sales_returns');
  update public.sales_returns set exchange_invoice_id = p_invoice_id, return_type = 'exchange'
   where id = p_return_id and company_id = v_company;
  return jsonb_build_object('id', p_return_id);
end $$;

-- ---------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------
create or replace function app.expense_post(p_company uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.expenses; v_je uuid; v_acc uuid;
begin
  select * into e from public.expenses where id = p_id for update;
  select account_id into v_acc from public.expense_categories where id = e.category_id;
  v_je := app.post_journal(p_company, e.expense_date, 'مصروف ' || e.number || ' — ' || e.description, 'expense', e.id, e.number,
    jsonb_build_array(jsonb_build_object('account_id', v_acc, 'debit', e.amount, 'warehouse_id', e.warehouse_id),
                      jsonb_build_object('account_id', app.cash_gl(e.cash_account_id), 'credit', e.amount)));
  perform app.cash_move(p_company, e.cash_account_id, -e.amount, 'expense', e.id, e.number, e.description, v_je, e.expense_date);
  perform app.set_context('approve', null, 'expenses');
  update public.expenses set status = 'approved', approved_by = auth.uid(), approved_at = now(), journal_entry_id = v_je where id = p_id;
end $$;

create or replace function public.expense_create(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('expenses.create'); v_prev jsonb; v_id uuid; v_num text;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'expense_create'); if v_prev is not null then return v_prev; end if;
  if coalesce((p->>'amount')::numeric,0) <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  v_num := app.next_number(v_company, 'EXP');
  insert into public.expenses(company_id, number, category_id, cash_account_id, warehouse_id, amount, expense_date, payee,
    description, attachment_url, created_by)
  values (v_company, v_num, (p->>'category_id')::uuid, (p->>'cash_account_id')::uuid, nullif(p->>'warehouse_id','')::uuid,
    round((p->>'amount')::numeric,2), coalesce(nullif(p->>'expense_date','')::date, (now() at time zone 'Africa/Cairo')::date),
    p->>'payee', coalesce(nullif(trim(p->>'description'),''), 'مصروف'), nullif(p->>'attachment_url',''), auth.uid())
  returning id into v_id;
  if app.has_perm('expenses.approve') and coalesce((p->>'approve')::boolean, true) then
    perform app.expense_post(v_company, v_id);
  else
    perform app.notify(v_company, 'expenses.approve', 'approval', 'مصروف بانتظار الاعتماد', v_num || ' — ' || (p->>'amount') || ' ج.م', '/expenses');
  end if;
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_id, 'number', v_num,
    'status', (select status from public.expenses where id = v_id)));
end $$;

create or replace function public.expense_decide(p_id uuid, p_action text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('expenses.approve'); e public.expenses;
begin
  select * into e from public.expenses where id = p_id and company_id = v_company for update;
  if not found then raise exception 'المصروف غير موجود'; end if;
  if p_action = 'approve' then
    if e.status <> 'pending' then raise exception 'المصروف ليس بانتظار الاعتماد'; end if;
    perform app.expense_post(v_company, p_id);
  elsif p_action = 'reject' then
    if e.status <> 'pending' then raise exception 'المصروف ليس بانتظار الاعتماد'; end if;
    perform app.set_context('reject', p_reason, 'expenses');
    update public.expenses set status = 'rejected', cancel_reason = p_reason, cancelled_by = auth.uid(), cancelled_at = now() where id = p_id;
  elsif p_action = 'cancel' then
    if e.status <> 'approved' then raise exception 'يمكن إلغاء المصروفات المعتمدة فقط'; end if;
    if coalesce(trim(p_reason),'') = '' then raise exception 'سبب الإلغاء مطلوب'; end if;
    perform app.reverse_source_entries(v_company, 'expense', p_id, p_reason);
    perform app.cash_move(v_company, e.cash_account_id, e.amount, 'expense_cancel', p_id, e.number, 'إلغاء ' || e.number, null);
    perform app.set_context('cancel', p_reason, 'expenses');
    update public.expenses set status = 'cancelled', cancel_reason = p_reason, cancelled_by = auth.uid(), cancelled_at = now() where id = p_id;
  else raise exception 'إجراء غير معروف'; end if;
  return jsonb_build_object('id', p_id);
end $$;

-- ---------------------------------------------------------------------
-- Cash operations
-- ---------------------------------------------------------------------
create or replace function public.cash_transfer(p_from uuid, p_to uuid, p_amount numeric, p_notes text default null,
  p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.manage'); v_prev jsonb; v_je uuid; v_ref text;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'cash_transfer'); if v_prev is not null then return v_prev; end if;
  if p_from = p_to then raise exception 'لا يمكن التحويل لنفس الحساب'; end if;
  if p_amount <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  v_ref := app.next_number(v_company, 'CT');
  v_je := app.post_journal(v_company, null, 'تحويل نقدي ' || v_ref || coalesce(' — ' || p_notes, ''), 'cash_transfer', null, v_ref,
    jsonb_build_array(jsonb_build_object('account_id', app.cash_gl(p_to), 'debit', p_amount),
                      jsonb_build_object('account_id', app.cash_gl(p_from), 'credit', p_amount)));
  perform app.cash_move(v_company, p_from, -p_amount, 'cash_transfer', v_je, v_ref, coalesce(p_notes,'تحويل صادر'), v_je);
  perform app.cash_move(v_company, p_to, p_amount, 'cash_transfer', v_je, v_ref, coalesce(p_notes,'تحويل وارد'), v_je);
  perform app.log_event(v_company, 'cash_transfer', 'finance', v_je, v_ref, jsonb_build_object('from', p_from, 'to', p_to, 'amount', p_amount));
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('reference', v_ref, 'journal_entry_id', v_je));
end $$;

-- Owner capital deposit / withdrawal
create or replace function public.cash_owner_transaction(p_account uuid, p_amount numeric, p_kind text, p_notes text default null,
  p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.manage'); v_prev jsonb; v_je uuid; v_ref text;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'cash_owner_transaction'); if v_prev is not null then return v_prev; end if;
  if p_amount <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  v_ref := app.next_number(v_company, 'OWN');
  if p_kind = 'deposit' then
    v_je := app.post_journal(v_company, null, 'إيداع رأس مال ' || v_ref, 'owner_transaction', null, v_ref,
      jsonb_build_array(jsonb_build_object('account_id', app.cash_gl(p_account), 'debit', p_amount),
                        jsonb_build_object('account','3200','credit',p_amount)));
    perform app.cash_move(v_company, p_account, p_amount, 'owner_deposit', v_je, v_ref, coalesce(p_notes,'إيداع من المالك'), v_je);
  elsif p_kind = 'withdrawal' then
    v_je := app.post_journal(v_company, null, 'مسحوبات المالك ' || v_ref, 'owner_transaction', null, v_ref,
      jsonb_build_array(jsonb_build_object('account','3300','debit',p_amount),
                        jsonb_build_object('account_id', app.cash_gl(p_account), 'credit', p_amount)));
    perform app.cash_move(v_company, p_account, -p_amount, 'owner_withdrawal', v_je, v_ref, coalesce(p_notes,'مسحوبات المالك'), v_je);
  else raise exception 'نوع غير معروف'; end if;
  perform app.log_event(v_company, 'owner_' || p_kind, 'finance', v_je, v_ref, jsonb_build_object('amount', p_amount), null, p_notes);
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('reference', v_ref));
end $$;

-- Manual journal entry: only non-control accounts (subledgers stay consistent)
create or replace function public.journal_entry_manual(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.manage'); v_prev jsonb; v_je uuid; l jsonb;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'journal_entry_manual'); if v_prev is not null then return v_prev; end if;
  for l in select * from jsonb_array_elements(p->'lines') loop
    if exists (select 1 from public.accounts where id = (l->>'account_id')::uuid and (is_control or company_id <> v_company)) then
      raise exception 'لا يمكن استخدام حساب رقابي (عملاء/موردين/مخزون/نقدية) في قيد يدوي — استخدم الشاشات المخصصة';
    end if;
  end loop;
  if coalesce(trim(p->>'description'),'') = '' then raise exception 'بيان القيد مطلوب'; end if;
  v_je := app.post_journal(v_company, nullif(p->>'entry_date','')::date, p->>'description', 'manual', null, p->>'reference', p->'lines');
  if v_je is null then raise exception 'القيد فارغ'; end if;
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_je));
end $$;

-- ---------------------------------------------------------------------
-- Deliveries
-- ---------------------------------------------------------------------
create or replace function public.delivery_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('deliveries.manage'); v_id uuid := nullif(p->>'id','')::uuid; v_num text;
begin
  if v_id is null then
    v_num := app.next_number(v_company, 'DLV');
    insert into public.deliveries(company_id, number, invoice_id, customer_id, shipping_company_id, recipient_name, recipient_phone,
      address, governorate, city, tracking_number, delivery_fee, fee_paid_by, scheduled_date, assigned_to, notes, created_by)
    values (v_company, v_num, nullif(p->>'invoice_id','')::uuid, nullif(p->>'customer_id','')::uuid,
      nullif(p->>'shipping_company_id','')::uuid, p->>'recipient_name', p->>'recipient_phone', p->>'address', p->>'governorate',
      p->>'city', nullif(p->>'tracking_number',''), coalesce((p->>'delivery_fee')::numeric,0), coalesce(nullif(p->>'fee_paid_by',''),'customer'),
      nullif(p->>'scheduled_date','')::date, nullif(p->>'assigned_to','')::uuid, p->>'notes', auth.uid())
    returning id into v_id;
  else
    update public.deliveries set shipping_company_id = nullif(p->>'shipping_company_id','')::uuid, recipient_name = p->>'recipient_name',
      recipient_phone = p->>'recipient_phone', address = p->>'address', governorate = p->>'governorate', city = p->>'city',
      tracking_number = nullif(p->>'tracking_number',''), delivery_fee = coalesce((p->>'delivery_fee')::numeric,0),
      fee_paid_by = coalesce(nullif(p->>'fee_paid_by',''),'customer'), scheduled_date = nullif(p->>'scheduled_date','')::date,
      assigned_to = nullif(p->>'assigned_to','')::uuid, notes = p->>'notes'
    where id = v_id and company_id = v_company returning number into v_num;
    if v_num is null then raise exception 'أمر التوصيل غير موجود'; end if;
  end if;
  return jsonb_build_object('id', v_id, 'number', v_num);
end $$;

create or replace function public.delivery_set_status(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('deliveries.manage'); d public.deliveries;
begin
  select * into d from public.deliveries where id = p_id and company_id = v_company for update;
  if not found then raise exception 'أمر التوصيل غير موجود'; end if;
  if d.status in ('delivered','cancelled','returned') then raise exception 'أمر التوصيل مغلق (%)', d.status; end if;
  perform app.set_context('status_change', p_note, 'deliveries');
  update public.deliveries set status = p_status, delivered_at = case when p_status = 'delivered' then now() else delivered_at end
   where id = p_id;
  return jsonb_build_object('id', p_id, 'status', p_status);
end $$;

-- ---------------------------------------------------------------------
-- Opening balances
-- ---------------------------------------------------------------------
create or replace function public.opening_batch_create(p_opening_date date, p_description text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('opening.manage'); v_id uuid; v_num text;
begin
  v_num := app.next_number(v_company, 'OB');
  insert into public.opening_balance_batches(company_id, number, opening_date, description, entered_by)
  values (v_company, v_num, p_opening_date, p_description, auth.uid()) returning id into v_id;
  return jsonb_build_object('id', v_id, 'number', v_num);
end $$;

create or replace function public.opening_line_add(p_batch uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('opening.manage'); v_id uuid; v_status text;
begin
  select status into v_status from public.opening_balance_batches where id = p_batch and company_id = v_company for update;
  if v_status is null then raise exception 'الدفعة غير موجودة'; end if;
  if v_status not in ('draft','rejected') then raise exception 'لا يمكن تعديل دفعة مقدمة أو معتمدة'; end if;
  insert into public.opening_balance_lines(batch_id, company_id, line_type, warehouse_id, product_id, quantity, unit_cost, customer_id,
    supplier_id, cash_account_id, amount, serials, notes, entered_by)
  values (p_batch, v_company, p->>'line_type', nullif(p->>'warehouse_id','')::uuid, nullif(p->>'product_id','')::uuid,
    nullif(p->>'quantity','')::numeric, nullif(p->>'unit_cost','')::numeric, nullif(p->>'customer_id','')::uuid,
    nullif(p->>'supplier_id','')::uuid, nullif(p->>'cash_account_id','')::uuid, nullif(p->>'amount','')::numeric, p->'serials',
    p->>'notes', auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.opening_line_remove(p_line uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('opening.manage'); l public.opening_balance_lines; v_status text;
begin
  select * into l from public.opening_balance_lines where id = p_line and company_id = v_company;
  select status into v_status from public.opening_balance_batches where id = l.batch_id for update;
  if v_status not in ('draft','rejected') then raise exception 'لا يمكن تعديل دفعة مقدمة أو معتمدة'; end if;
  delete from public.opening_balance_lines where id = p_line;
  perform app.log_event(v_company, 'opening_line_remove', 'opening_balances', l.batch_id, null, null, to_jsonb(l));
  return jsonb_build_object('id', p_line);
end $$;

create or replace function public.opening_batch_submit(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('opening.manage');
begin
  if not exists (select 1 from public.opening_balance_lines where batch_id = p_id) then raise exception 'الدفعة فارغة'; end if;
  perform app.set_context('submit', null, 'opening_balance_batches');
  update public.opening_balance_batches set status = 'submitted', submitted_at = now()
   where id = p_id and company_id = v_company and status in ('draft','rejected');
  if not found then raise exception 'لا يمكن تقديم هذه الدفعة'; end if;
  perform app.notify(v_company, 'opening.approve', 'approval', 'أرصدة افتتاحية بانتظار الاعتماد', 'راجع الأرصدة الافتتاحية واعتمدها', '/opening-balances/' || p_id);
  return jsonb_build_object('id', p_id, 'status', 'submitted');
end $$;

create or replace function public.opening_batch_decide(p_id uuid, p_approve boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('opening.approve'); b public.opening_balance_batches; l record; v_amt numeric(18,2);
  v_inv numeric(18,2) := 0; v_je uuid;
begin
  select * into b from public.opening_balance_batches where id = p_id and company_id = v_company for update;
  if not found or b.status <> 'submitted' then raise exception 'الدفعة ليست بانتظار الاعتماد'; end if;
  if not p_approve then
    perform app.set_context('reject', p_reason, 'opening_balance_batches');
    update public.opening_balance_batches set status = 'rejected', rejection_reason = p_reason, approved_by = auth.uid(), approved_at = now()
     where id = p_id;
    return jsonb_build_object('id', p_id, 'status', 'rejected');
  end if;
  for l in select * from public.opening_balance_lines where batch_id = p_id order by created_at loop
    if l.line_type = 'inventory' then
      perform app.post_stock(v_company, l.warehouse_id, l.product_id, l.quantity, l.unit_cost, 'opening', 'opening_balance', p_id, l.id, b.number);
      perform app.serials_receive(v_company, l.product_id, l.warehouse_id, l.serials, l.quantity, 'opening_balance', p_id);
      insert into public.product_costs(product_id, company_id, purchase_price) values (l.product_id, v_company, l.unit_cost)
      on conflict (product_id) do update set purchase_price = case when public.product_costs.purchase_price = 0
                                                                    then excluded.purchase_price else public.product_costs.purchase_price end;
      v_inv := v_inv + round(l.quantity * l.unit_cost, 2);
    elsif l.line_type = 'customer' then
      v_amt := l.amount;
      v_je := app.post_journal(v_company, b.opening_date, 'رصيد افتتاحي عميل ' || b.number, 'opening_balance', p_id, b.number,
        case when v_amt > 0 then jsonb_build_array(jsonb_build_object('account','1200','debit',v_amt,'party_type','customer','party_id',l.customer_id),
                                                    jsonb_build_object('account','3100','credit',v_amt))
             else jsonb_build_array(jsonb_build_object('account','3100','debit',-v_amt),
                                    jsonb_build_object('account','1200','credit',-v_amt,'party_type','customer','party_id',l.customer_id)) end, true);
      perform app.customer_balance_add(l.customer_id, v_amt);
    elsif l.line_type = 'supplier' then
      v_amt := l.amount;
      v_je := app.post_journal(v_company, b.opening_date, 'رصيد افتتاحي مورد ' || b.number, 'opening_balance', p_id, b.number,
        case when v_amt > 0 then jsonb_build_array(jsonb_build_object('account','3100','debit',v_amt),
                                                    jsonb_build_object('account','2100','credit',v_amt,'party_type','supplier','party_id',l.supplier_id))
             else jsonb_build_array(jsonb_build_object('account','2100','debit',-v_amt,'party_type','supplier','party_id',l.supplier_id),
                                    jsonb_build_object('account','3100','credit',-v_amt)) end, true);
      perform app.supplier_balance_add(l.supplier_id, v_amt);
    elsif l.line_type = 'cash' then
      v_je := app.post_journal(v_company, b.opening_date, 'رصيد افتتاحي نقدية ' || b.number, 'opening_balance', p_id, b.number,
        jsonb_build_array(jsonb_build_object('account_id', app.cash_gl(l.cash_account_id), 'debit', l.amount),
                          jsonb_build_object('account','3100','credit', l.amount)), true);
      perform app.cash_move(v_company, l.cash_account_id, l.amount, 'opening_balance', p_id, b.number, 'رصيد افتتاحي', v_je, b.opening_date, true);
    end if;
  end loop;
  perform app.post_journal(v_company, b.opening_date, 'رصيد افتتاحي مخزون ' || b.number, 'opening_balance', p_id, b.number,
    jsonb_build_array(jsonb_build_object('account','1300','debit',v_inv), jsonb_build_object('account','3100','credit',v_inv)), true);
  perform app.set_context('approve', p_reason, 'opening_balance_batches');
  update public.opening_balance_batches set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_id;
  update public.company_settings set opening_date = coalesce(opening_date, b.opening_date) where company_id = v_company;
  return jsonb_build_object('id', p_id, 'status', 'approved');
end $$;

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
create or replace function public.notifications_mark_read(p_ids uuid[] default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.notifications set is_read = true
   where user_id = auth.uid() and not is_read and (p_ids is null or id = any(p_ids));
$$;

-- ---------------------------------------------------------------------
-- AI actions: the assistant can only PREPARE; the user confirms; this executes once.
-- ---------------------------------------------------------------------
create or replace function public.ai_action_prepare(p_type text, p_payload jsonb, p_preview jsonb, p_conversation uuid default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('ai.use'); v_id uuid;
begin
  insert into public.ai_actions(company_id, user_id, conversation_id, action_type, payload, preview)
  values (v_company, auth.uid(), p_conversation, p_type, p_payload, p_preview) returning id into v_id;
  return jsonb_build_object('id', v_id, 'expires_at', now() + interval '30 minutes');
end $$;

create or replace function public.ai_action_execute(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('ai.execute'); a public.ai_actions; v_res jsonb; v_key text;
begin
  select * into a from public.ai_actions where id = p_id and company_id = v_company for update;
  if not found or a.user_id <> auth.uid() then raise exception 'العملية غير موجودة'; end if;
  if a.status = 'executed' then return a.result || jsonb_build_object('replayed', true); end if;
  if a.status <> 'pending' then raise exception 'العملية لم تعد متاحة (%)', a.status; end if;
  if a.expires_at < now() then
    update public.ai_actions set status = 'expired' where id = p_id;
    return jsonb_build_object('error', 'انتهت صلاحية المعاينة، اطلب من المساعد تجهيزها من جديد');
  end if;
  perform set_config('app.source', 'ai', true);
  perform set_config('app.ai_action_id', p_id::text, true);
  v_key := 'ai:' || p_id::text;
  -- each target function re-checks its own permission and business rules
  if a.action_type = 'create_sales_invoice' then v_res := public.sales_invoice_save(a.payload, v_key);
  elsif a.action_type = 'create_incoming_shipment' then v_res := public.shipment_save(a.payload, v_key);
  elsif a.action_type = 'record_customer_payment' then v_res := public.customer_payment_create(a.payload, v_key);
  elsif a.action_type = 'record_expense' then v_res := public.expense_create(a.payload, v_key);
  elsif a.action_type = 'create_customer' then
    perform app.require_perm('customers.manage');
    insert into public.customers(company_id, full_name, phone, address, governorate, customer_type, notes)
    values (v_company, a.payload->>'full_name', a.payload->>'phone', a.payload->>'address', a.payload->>'governorate',
            coalesce(a.payload->>'customer_type','individual'), a.payload->>'notes')
    returning jsonb_build_object('id', id) into v_res;
  end if;
  perform app.set_context('execute', null, 'ai_actions');
  update public.ai_actions set status = 'executed', result = v_res, executed_at = now() where id = p_id;
  return v_res;
end $$;

create or replace function public.ai_action_cancel(p_id uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.ai_actions set status = 'cancelled' where id = p_id and user_id = auth.uid() and status = 'pending';
$$;
