-- =====================================================================
-- 0006 Business functions (part 1): setup, users, master data, inventory,
-- purchasing & receiving. All are SECURITY DEFINER and check permissions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permission catalogue
-- ---------------------------------------------------------------------
insert into public.permissions(code, module, name_ar, is_financial, sort_order) values
 ('dashboard.view','dashboard','عرض لوحة التحكم',false,10),
 ('warehouses.view','warehouses','عرض المخازن',false,20),
 ('warehouses.manage','warehouses','إدارة المخازن',false,21),
 ('products.view','products','عرض المنتجات',false,30),
 ('products.manage','products','إضافة وتعديل المنتجات والأسعار',false,31),
 ('products.view_cost','products','عرض تكلفة الشراء',true,32),
 ('inventory.view','inventory','عرض أرصدة المخزون',false,40),
 ('inventory.view_ledger','inventory','عرض سجل حركات المخزون',false,41),
 ('inventory.transfer','inventory','تحويل بين المخازن',false,42),
 ('inventory.adjust','inventory','طلب تسوية مخزون',false,43),
 ('inventory.approve_adjustment','inventory','اعتماد التسويات والجرد',false,44),
 ('inventory.count','inventory','الجرد الفعلي',false,45),
 ('inventory.negative_stock','inventory','السماح بالبيع بالسالب',false,46),
 ('shipments.view','shipments','عرض الشحنات الواردة',false,50),
 ('shipments.manage','shipments','إنشاء وتعديل الشحنات',false,51),
 ('shipments.receive','shipments','استلام الشحنات',false,52),
 ('purchases.view','purchases','عرض أوامر الشراء',false,60),
 ('purchases.manage','purchases','إنشاء أوامر الشراء',false,61),
 ('purchases.approve','purchases','اعتماد أوامر الشراء',false,62),
 ('sales.view','sales','عرض الفواتير',false,70),
 ('sales.create','sales','إنشاء فواتير البيع',false,71),
 ('sales.approve','sales','اعتماد فواتير البيع',false,72),
 ('sales.cancel','sales','إلغاء الفواتير المعتمدة',false,73),
 ('sales.price_override','sales','البيع بأقل من السعر المحدد',false,74),
 ('returns.view','returns','عرض المرتجعات',false,80),
 ('returns.create','returns','تسجيل مرتجع',false,81),
 ('returns.inspect','returns','فحص المرتجعات',false,82),
 ('returns.approve','returns','اعتماد المرتجعات والاسترداد',true,83),
 ('customers.view','customers','عرض العملاء',false,90),
 ('customers.manage','customers','إضافة وتعديل العملاء',false,91),
 ('suppliers.view','suppliers','عرض الموردين',false,100),
 ('suppliers.manage','suppliers','إضافة وتعديل الموردين',false,101),
 ('payments.receive','finance','تحصيل من العملاء',true,110),
 ('payments.pay_suppliers','finance','سداد للموردين',true,111),
 ('finance.view','finance','عرض الخزنة والحسابات والقيود',true,112),
 ('finance.manage','finance','إدارة الحسابات والقيود والتحويلات',true,113),
 ('finance.view_profit','finance','عرض الأرباح والتكلفة',true,114),
 ('expenses.view','expenses','عرض المصروفات',true,120),
 ('expenses.create','expenses','تسجيل مصروف',true,121),
 ('expenses.approve','expenses','اعتماد المصروفات',true,122),
 ('deliveries.view','shipping','عرض الشحن والتوصيل',false,130),
 ('deliveries.manage','shipping','إدارة التوصيل',false,131),
 ('users.view','employees','عرض الموظفين',false,140),
 ('users.manage','employees','إدارة الموظفين',false,141),
 ('roles.manage','employees','إدارة الأدوار والصلاحيات',false,142),
 ('reports.view','reports','عرض التقارير التشغيلية',false,150),
 ('reports.financial','reports','عرض التقارير المالية',true,151),
 ('reports.export','reports','تصدير التقارير',false,152),
 ('audit.view','audit','عرض السجل التاريخي',false,160),
 ('audit.view_all','audit','عرض نشاط جميع الموظفين',false,161),
 ('opening.manage','opening','إدخال الأرصدة الافتتاحية',true,170),
 ('opening.approve','opening','اعتماد الأرصدة الافتتاحية',true,171),
 ('ai.use','ai','استخدام المساعد الذكي',false,180),
 ('ai.execute','ai','تنفيذ عمليات عبر المساعد الذكي',false,181),
 ('settings.manage','settings','إعدادات النظام',false,190)
on conflict (code) do update set module = excluded.module, name_ar = excluded.name_ar,
  is_financial = excluded.is_financial, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Seed a new company: roles, chart of accounts, settings, categories
-- ---------------------------------------------------------------------
create or replace function app.seed_company(p_company uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role uuid; v_acc uuid; r record;
begin
  -- Roles
  insert into public.roles(company_id, key, name_ar, description, is_owner, is_system) values
    (p_company,'owner','المالك / مدير النظام','صلاحيات كاملة',true,true),
    (p_company,'general_manager','المدير العام','إدارة كاملة للعمليات',false,true),
    (p_company,'sales','موظف مبيعات','المبيعات والعملاء والتحصيل',false,true),
    (p_company,'warehouse','أمين مخزن','المخزون والاستلام والتحويلات',false,true),
    (p_company,'accountant','محاسب','الحسابات والخزنة والتقارير المالية',false,true),
    (p_company,'shipping','موظف شحن','الشحن والتوصيل',false,true)
  on conflict do nothing;

  -- General manager: everything except role management and system settings
  select id into v_role from public.roles where company_id = p_company and key = 'general_manager';
  insert into public.role_permissions(role_id, permission_code)
  select v_role, code from public.permissions where code not in ('roles.manage','settings.manage','inventory.negative_stock')
  on conflict do nothing;

  select id into v_role from public.roles where company_id = p_company and key = 'sales';
  insert into public.role_permissions(role_id, permission_code)
  select v_role, unnest(array['dashboard.view','products.view','inventory.view','sales.view','sales.create','sales.approve',
    'returns.view','returns.create','customers.view','customers.manage','payments.receive','deliveries.view','deliveries.manage',
    'audit.view','ai.use','ai.execute','warehouses.view'])
  on conflict do nothing;

  select id into v_role from public.roles where company_id = p_company and key = 'warehouse';
  insert into public.role_permissions(role_id, permission_code)
  select v_role, unnest(array['dashboard.view','warehouses.view','products.view','inventory.view','inventory.view_ledger',
    'inventory.transfer','inventory.adjust','inventory.count','shipments.view','shipments.receive',
    'returns.view','returns.inspect','deliveries.view','deliveries.manage','suppliers.view','reports.view','audit.view','ai.use'])
  on conflict do nothing;

  select id into v_role from public.roles where company_id = p_company and key = 'accountant';
  insert into public.role_permissions(role_id, permission_code)
  select v_role, unnest(array['dashboard.view','warehouses.view','products.view','products.view_cost','inventory.view',
    'inventory.view_ledger','shipments.view','purchases.view','sales.view','returns.view','returns.approve','customers.view',
    'suppliers.view','payments.receive','payments.pay_suppliers','finance.view','finance.manage','finance.view_profit',
    'expenses.view','expenses.create','expenses.approve','reports.view','reports.financial','reports.export',
    'audit.view','audit.view_all','opening.manage','ai.use','ai.execute','deliveries.view'])
  on conflict do nothing;

  select id into v_role from public.roles where company_id = p_company and key = 'shipping';
  insert into public.role_permissions(role_id, permission_code)
  select v_role, unnest(array['dashboard.view','deliveries.view','deliveries.manage','sales.view','customers.view','audit.view','ai.use'])
  on conflict do nothing;

  -- Chart of accounts
  insert into public.accounts(company_id, code, name_ar, type, normal_side, is_control, is_system) values
    (p_company,'1100','النقدية والبنوك','asset','debit',true,true),
    (p_company,'1200','العملاء (ذمم مدينة)','asset','debit',true,true),
    (p_company,'1300','المخزون','asset','debit',true,true),
    (p_company,'2100','الموردون (ذمم دائنة)','liability','credit',true,true),
    (p_company,'2150','مصاريف شحن وتخليص مستحقة','liability','credit',true,true),
    (p_company,'3100','أرصدة افتتاحية','equity','credit',true,true),
    (p_company,'3200','رأس المال','equity','credit',false,true),
    (p_company,'3300','جاري ومسحوبات المالك','equity','debit',false,true),
    (p_company,'4100','إيرادات المبيعات','revenue','credit',true,true),
    (p_company,'4150','إيرادات الشحن','revenue','credit',true,true),
    (p_company,'4200','خصم مسموح به','revenue','debit',true,true),
    (p_company,'4300','مردودات المبيعات','revenue','debit',true,true),
    (p_company,'4900','إيرادات أخرى','revenue','credit',false,true),
    (p_company,'5100','تكلفة البضاعة المباعة','expense','debit',true,true),
    (p_company,'5200','فروقات الجرد والتسويات','expense','debit',true,true),
    (p_company,'5300','خسائر بضاعة تالفة','expense','debit',true,true)
  on conflict do nothing;

  -- Default expense categories (each with its own GL account 61xx)
  for r in select * from (values (1,'إيجارات'),(2,'رواتب وأجور'),(3,'كهرباء ومياه'),(4,'نقل ومواصلات'),
                                 (5,'صيانة وتركيبات'),(6,'دعاية وتسويق'),(7,'اتصالات وإنترنت'),(8,'مصروفات متنوعة')) t(n, name) loop
    insert into public.accounts(company_id, code, name_ar, type, normal_side, is_system)
    values (p_company, '61' || lpad(r.n::text, 2, '0'), r.name, 'expense', 'debit', false)
    on conflict do nothing returning id into v_acc;
    if v_acc is not null then
      insert into public.expense_categories(company_id, name, account_id) values (p_company, r.name, v_acc) on conflict do nothing;
    end if;
  end loop;

  insert into public.product_categories(company_id, name) values
    (p_company,'تكييف مركزي'),(p_company,'تكييف صحراوي'),(p_company,'قطع غيار'),(p_company,'خدمات وتركيبات')
  on conflict do nothing;

  insert into public.company_settings(company_id) values (p_company) on conflict do nothing;
end $$;

-- First-time setup: only possible when no company exists yet.
create or replace function public.bootstrap_company(p_company_name text, p_full_name text, p_phone text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid; v_owner uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'هذا المستخدم مرتبط بشركة بالفعل';
  end if;
  perform pg_advisory_xact_lock(hashtext('bootstrap_company'));
  if exists (select 1 from public.companies) then
    raise exception 'تم إعداد النظام من قبل. اطلب من المالك إضافتك كموظف.' using errcode = '42501';
  end if;
  insert into public.companies(name) values (coalesce(nullif(trim(p_company_name),''), 'المهندس للتكييفات')) returning id into v_company;
  perform app.seed_company(v_company);
  select id into v_owner from public.roles where company_id = v_company and key = 'owner';
  select email into v_email from auth.users where id = auth.uid();
  insert into public.profiles(id, company_id, role_id, full_name, phone, email, job_title)
  values (auth.uid(), v_company, v_owner, coalesce(nullif(trim(p_full_name),''), 'المالك'), p_phone, v_email, 'المالك');
  -- default warehouse & cash box so the system is usable immediately (no balances invented)
  insert into public.warehouses(company_id, code, name, description) values (v_company, 'WH1', 'المخزن الرئيسي', 'المخزن الافتراضي');
  perform public.cash_account_create('الخزنة الرئيسية', 'cash', null, null, null);
  update public.company_settings set default_warehouse_id = (select id from public.warehouses where company_id = v_company limit 1),
         default_cash_account_id = (select id from public.cash_accounts where company_id = v_company limit 1)
   where company_id = v_company;
  perform app.log_event(v_company, 'bootstrap', 'settings', v_company, null, jsonb_build_object('company', p_company_name));
  return jsonb_build_object('company_id', v_company);
end $$;

-- Is first-time setup still available? (callable by anon for the setup screen)
create or replace function public.setup_status() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('needs_setup', not exists (select 1 from public.companies))
$$;

-- Everything the client needs about the current user.
create or replace function public.my_context() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_p public.profiles; v_r public.roles; v_perms text[];
begin
  select * into v_p from public.profiles where id = auth.uid();
  if not found then return jsonb_build_object('profile', null); end if;
  select * into v_r from public.roles where id = v_p.role_id;
  if v_r.is_owner then select array_agg(code order by sort_order) into v_perms from public.permissions;
  else select array_agg(permission_code) into v_perms from public.role_permissions where role_id = v_r.id; end if;
  update public.profiles set last_seen_at = now() where id = v_p.id and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
  return jsonb_build_object(
    'profile', to_jsonb(v_p),
    'role', jsonb_build_object('id', v_r.id, 'key', v_r.key, 'name_ar', v_r.name_ar, 'is_owner', v_r.is_owner),
    'permissions', coalesce(to_jsonb(v_perms), '[]'::jsonb),
    'company', (select to_jsonb(c) from public.companies c where c.id = v_p.company_id),
    'settings', (select to_jsonb(s) from public.company_settings s where s.company_id = v_p.company_id),
    'is_active', v_p.is_active);
end $$;

create or replace function public.has_permission(p_code text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$ select app.has_perm(p_code) $$;

-- ---------------------------------------------------------------------
-- Employees & roles
-- ---------------------------------------------------------------------
create or replace function public.employee_attach(p_user_id uuid, p_full_name text, p_role_id uuid,
  p_phone text default null, p_job_title text default null, p_default_warehouse uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('users.manage'); v_email text; v_role public.roles;
begin
  select * into v_role from public.roles where id = p_role_id and company_id = v_company;
  if not found then raise exception 'الدور غير موجود'; end if;
  if v_role.is_owner and not app.is_owner() then raise exception 'فقط المالك يمكنه إضافة مالك آخر' using errcode = '42501'; end if;
  select email into v_email from auth.users where id = p_user_id;
  if not found then raise exception 'المستخدم غير موجود في نظام الدخول'; end if;
  if exists (select 1 from public.profiles where id = p_user_id) then raise exception 'المستخدم مضاف من قبل'; end if;
  perform app.set_context('employee_add', null, 'profiles');
  insert into public.profiles(id, company_id, role_id, full_name, phone, email, job_title, default_warehouse_id)
  values (p_user_id, v_company, p_role_id, p_full_name, p_phone, v_email, p_job_title, p_default_warehouse);
  return jsonb_build_object('id', p_user_id);
end $$;

create or replace function public.employee_update(p_user_id uuid, p jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('users.manage'); v_cur public.profiles; v_role public.roles; v_new_role uuid;
begin
  select * into v_cur from public.profiles where id = p_user_id and company_id = v_company for update;
  if not found then raise exception 'الموظف غير موجود'; end if;
  v_new_role := coalesce(nullif(p->>'role_id','')::uuid, v_cur.role_id);
  select * into v_role from public.roles where id = v_new_role and company_id = v_company;
  if not found then raise exception 'الدور غير موجود'; end if;
  if not app.is_owner() and (v_role.is_owner or (select is_owner from public.roles where id = v_cur.role_id)) then
    raise exception 'فقط المالك يمكنه تعديل حسابات المالك' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and (coalesce((p->>'is_active')::boolean, true) = false or v_new_role <> v_cur.role_id) then
    raise exception 'لا يمكنك تعطيل حسابك أو تغيير دورك بنفسك';
  end if;
  perform app.set_context(case when v_new_role <> v_cur.role_id then 'role_change'
                               when (p ? 'is_active') and (p->>'is_active')::boolean <> v_cur.is_active then
                                 case when (p->>'is_active')::boolean then 'employee_activate' else 'employee_deactivate' end
                               else 'update' end, p_reason, 'profiles');
  update public.profiles set
    full_name = coalesce(nullif(p->>'full_name',''), full_name),
    phone = case when p ? 'phone' then p->>'phone' else phone end,
    job_title = case when p ? 'job_title' then p->>'job_title' else job_title end,
    role_id = v_new_role,
    default_warehouse_id = case when p ? 'default_warehouse_id' then nullif(p->>'default_warehouse_id','')::uuid else default_warehouse_id end,
    is_active = coalesce((p->>'is_active')::boolean, is_active)
  where id = p_user_id;
  return jsonb_build_object('id', p_user_id);
end $$;

create or replace function public.role_save(p_id uuid, p_name_ar text, p_description text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('roles.manage'); v_id uuid;
begin
  if p_id is null then
    insert into public.roles(company_id, key, name_ar, description)
    values (v_company, 'custom_' || substr(md5(random()::text), 1, 8), p_name_ar, p_description) returning id into v_id;
  else
    update public.roles set name_ar = p_name_ar, description = p_description
     where id = p_id and company_id = v_company and not is_owner returning id into v_id;
    if v_id is null then raise exception 'لا يمكن تعديل هذا الدور'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.role_set_permissions(p_role_id uuid, p_codes text[], p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('roles.manage'); v_role public.roles;
begin
  select * into v_role from public.roles where id = p_role_id and company_id = v_company for update;
  if not found then raise exception 'الدور غير موجود'; end if;
  if v_role.is_owner then raise exception 'صلاحيات المالك كاملة ولا يمكن تعديلها'; end if;
  if exists (select 1 from unnest(p_codes) c where c not in (select code from public.permissions)) then
    raise exception 'صلاحية غير معروفة';
  end if;
  perform app.set_context('permission_change', p_reason);
  delete from public.role_permissions where role_id = p_role_id and permission_code <> all(p_codes);
  insert into public.role_permissions(role_id, permission_code)
  select p_role_id, c from unnest(p_codes) c on conflict do nothing;
  return jsonb_build_object('id', p_role_id, 'count', coalesce(array_length(p_codes,1),0));
end $$;

-- ---------------------------------------------------------------------
-- Master data that needs GL accounts / restricted columns
-- ---------------------------------------------------------------------
create or replace function public.cash_account_create(p_name text, p_type text, p_bank_name text,
  p_account_number text, p_notes text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.company_id(); v_code text; v_acc uuid; v_id uuid;
begin
  if not (app.has_perm('finance.manage') or (select count(*) from public.cash_accounts where company_id = v_company) = 0) then
    perform app.require_perm('finance.manage');
  end if;
  if v_company is null then raise exception 'الحساب غير مرتبط بشركة'; end if;
  select '11' || lpad((coalesce(max(substr(code,3)::int), 0) + 1)::text, 2, '0') into v_code
    from public.accounts where company_id = v_company and code ~ '^11[0-9]{2}$' and code <> '1100';
  insert into public.accounts(company_id, code, name_ar, type, normal_side, is_control)
  values (v_company, v_code, p_name, 'asset', 'debit', true) returning id into v_acc;
  insert into public.cash_accounts(company_id, name, type, bank_name, account_number, gl_account_id, notes)
  values (v_company, p_name, p_type, p_bank_name, p_account_number, v_acc, p_notes) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.expense_category_create(p_name text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('expenses.approve'); v_code text; v_acc uuid; v_id uuid;
begin
  select '61' || lpad((coalesce(max(substr(code,3)::int), 0) + 1)::text, 2, '0') into v_code
    from public.accounts where company_id = v_company and code ~ '^61[0-9]{2}$';
  insert into public.accounts(company_id, code, name_ar, type, normal_side) values (v_company, v_code, p_name, 'expense', 'debit')
  returning id into v_acc;
  insert into public.expense_categories(company_id, name, account_id) values (v_company, p_name, v_acc) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.account_create(p_code text, p_name text, p_type text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.manage'); v_id uuid;
begin
  insert into public.accounts(company_id, code, name_ar, type, normal_side)
  values (v_company, p_code, p_name, p_type, case when p_type in ('asset','expense') then 'debit' else 'credit' end)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- Create / update a product (+ restricted purchase price)
create or replace function public.product_save(p jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('products.manage'); v_id uuid := nullif(p->>'id','')::uuid;
begin
  perform app.set_context(null, p_reason);
  if v_id is null then
    insert into public.products(company_id, name, model_number, brand, category_id, description, specifications, unit,
      selling_price, min_stock, image_url, track_serials, is_active)
    values (v_company, trim(p->>'name'), nullif(trim(p->>'model_number'),''), nullif(trim(p->>'brand'),''),
      nullif(p->>'category_id','')::uuid, p->>'description', coalesce(p->'specifications','{}'::jsonb),
      coalesce(nullif(p->>'unit',''),'جهاز'), coalesce((p->>'selling_price')::numeric,0), coalesce((p->>'min_stock')::numeric,0),
      nullif(p->>'image_url',''), coalesce((p->>'track_serials')::boolean,false), coalesce((p->>'is_active')::boolean,true))
    returning id into v_id;
    insert into public.product_costs(product_id, company_id, purchase_price)
    values (v_id, v_company, case when app.has_perm('products.view_cost') then coalesce((p->>'purchase_price')::numeric,0) else 0 end);
  else
    update public.products set
      name = coalesce(nullif(trim(p->>'name'),''), name),
      model_number = case when p ? 'model_number' then nullif(trim(p->>'model_number'),'') else model_number end,
      brand = case when p ? 'brand' then nullif(trim(p->>'brand'),'') else brand end,
      category_id = case when p ? 'category_id' then nullif(p->>'category_id','')::uuid else category_id end,
      description = case when p ? 'description' then p->>'description' else description end,
      specifications = coalesce(p->'specifications', specifications),
      unit = coalesce(nullif(p->>'unit',''), unit),
      selling_price = coalesce((p->>'selling_price')::numeric, selling_price),
      min_stock = coalesce((p->>'min_stock')::numeric, min_stock),
      image_url = case when p ? 'image_url' then nullif(p->>'image_url','') else image_url end,
      track_serials = coalesce((p->>'track_serials')::boolean, track_serials),
      is_active = coalesce((p->>'is_active')::boolean, is_active)
    where id = v_id and company_id = v_company;
    if not found then raise exception 'المنتج غير موجود'; end if;
    if p ? 'purchase_price' and app.has_perm('products.view_cost') then
      insert into public.product_costs(product_id, company_id, purchase_price) values (v_id, v_company, (p->>'purchase_price')::numeric)
      on conflict (product_id) do update set purchase_price = excluded.purchase_price;
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.product_archive(p_id uuid, p_archive boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('products.manage');
begin
  perform app.set_context(case when p_archive then 'archive' else 'restore' end, p_reason, 'products');
  update public.products set archived_at = case when p_archive then now() end, is_active = not p_archive
   where id = p_id and company_id = v_company;
  return jsonb_build_object('id', p_id);
end $$;

-- ---------------------------------------------------------------------
-- Stock transfers
-- ---------------------------------------------------------------------
create or replace function public.stock_transfer_create(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.transfer'); v_prev jsonb; v_id uuid; v_num text; i jsonb;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'stock_transfer_create'); if v_prev is not null then return v_prev; end if;
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'أضف صنفاً واحداً على الأقل'; end if;
  v_num := app.next_number(v_company, 'TR');
  insert into public.stock_transfers(company_id, number, source_warehouse_id, dest_warehouse_id, notes, created_by)
  values (v_company, v_num, (p->>'source_warehouse_id')::uuid, (p->>'dest_warehouse_id')::uuid, p->>'notes', auth.uid())
  returning id into v_id;
  for i in select * from jsonb_array_elements(p->'items') loop
    insert into public.stock_transfer_items(transfer_id, company_id, product_id, quantity, serials)
    values (v_id, v_company, (i->>'product_id')::uuid, (i->>'quantity')::numeric, i->'serials');
  end loop;
  perform app.notify(v_company, 'inventory.transfer', 'transfer', 'تحويل مخزني جديد', 'تحويل رقم ' || v_num || ' بانتظار الشحن',
                     '/inventory/transfers/' || v_id);
  if coalesce((p->>'dispatch')::boolean, false) then perform public.stock_transfer_dispatch(v_id); end if;
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_id, 'number', v_num));
end $$;

create or replace function public.stock_transfer_dispatch(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.transfer'); t public.stock_transfers; i record; v_cost numeric;
begin
  select * into t from public.stock_transfers where id = p_id and company_id = v_company for update;
  if not found then raise exception 'التحويل غير موجود'; end if;
  if t.status <> 'pending' then raise exception 'لا يمكن شحن تحويل حالته "%"', t.status; end if;
  for i in select * from public.stock_transfer_items where transfer_id = p_id loop
    v_cost := app.post_stock(v_company, t.source_warehouse_id, i.product_id, -i.quantity, null, 'transfer_out',
                             'stock_transfer', p_id, i.id, t.number);
    perform app.serials_move(v_company, i.product_id, i.serials, i.quantity, t.source_warehouse_id, 'in_stock', null, 'in_transit');
    update public.stock_transfer_items set unit_cost = v_cost where id = i.id;
  end loop;
  perform app.set_context('dispatch', null, 'stock_transfers');
  update public.stock_transfers set status = 'dispatched', dispatched_by = auth.uid(), dispatched_at = now() where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'dispatched');
end $$;

create or replace function public.stock_transfer_receive(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.transfer'); t public.stock_transfers; i record;
begin
  select * into t from public.stock_transfers where id = p_id and company_id = v_company for update;
  if not found then raise exception 'التحويل غير موجود'; end if;
  if t.status <> 'dispatched' then raise exception 'لا يمكن استلام تحويل حالته "%"', t.status; end if;
  for i in select * from public.stock_transfer_items where transfer_id = p_id loop
    perform app.post_stock(v_company, t.dest_warehouse_id, i.product_id, i.quantity, i.unit_cost, 'transfer_in',
                           'stock_transfer', p_id, i.id, t.number);
    perform app.serials_move(v_company, i.product_id, i.serials, i.quantity, null, 'in_transit', t.dest_warehouse_id, 'in_stock');
  end loop;
  perform app.set_context('receive', null, 'stock_transfers');
  update public.stock_transfers set status = 'received', received_by = auth.uid(), received_at = now() where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'received');
end $$;

create or replace function public.stock_transfer_cancel(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.transfer'); t public.stock_transfers; i record;
begin
  if coalesce(trim(p_reason),'') = '' then raise exception 'سبب الإلغاء مطلوب'; end if;
  select * into t from public.stock_transfers where id = p_id and company_id = v_company for update;
  if not found then raise exception 'التحويل غير موجود'; end if;
  if t.status not in ('pending','dispatched') then raise exception 'لا يمكن إلغاء تحويل حالته "%"', t.status; end if;
  if t.status = 'dispatched' then
    for i in select * from public.stock_transfer_items where transfer_id = p_id loop
      perform app.post_stock(v_company, t.source_warehouse_id, i.product_id, i.quantity, i.unit_cost, 'transfer_return',
                             'stock_transfer', p_id, i.id, t.number, 'available', p_reason);
      perform app.serials_move(v_company, i.product_id, i.serials, i.quantity, null, 'in_transit', t.source_warehouse_id, 'in_stock');
    end loop;
  end if;
  perform app.set_context('cancel', p_reason, 'stock_transfers');
  update public.stock_transfers set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = p_reason
   where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'cancelled');
end $$;

-- ---------------------------------------------------------------------
-- Stock adjustments (request → approve)
-- ---------------------------------------------------------------------
create or replace function public.stock_adjustment_request(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.adjust'); v_prev jsonb; v_id uuid; v_num text;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'stock_adjustment_request'); if v_prev is not null then return v_prev; end if;
  if coalesce(trim(p->>'reason'),'') = '' then raise exception 'سبب التسوية مطلوب'; end if;
  v_num := app.next_number(v_company, 'ADJ');
  perform app.set_context('adjustment_request', p->>'reason', 'stock_adjustments');
  insert into public.stock_adjustments(company_id, number, warehouse_id, product_id, bucket, quantity, unit_cost, reason, requested_by)
  values (v_company, v_num, (p->>'warehouse_id')::uuid, (p->>'product_id')::uuid, coalesce(p->>'bucket','available'),
          (p->>'quantity')::numeric, nullif(p->>'unit_cost','')::numeric, p->>'reason', auth.uid())
  returning id into v_id;
  perform app.notify(v_company, 'inventory.approve_adjustment', 'approval', 'طلب تسوية مخزون', 'التسوية ' || v_num || ' بانتظار الاعتماد',
                     '/inventory/adjustments');
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_id, 'number', v_num));
end $$;

create or replace function public.stock_adjustment_decide(p_id uuid, p_approve boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.approve_adjustment'); a public.stock_adjustments; v_cost numeric;
  v_amount numeric(18,2); v_je uuid;
begin
  select * into a from public.stock_adjustments where id = p_id and company_id = v_company for update;
  if not found then raise exception 'التسوية غير موجودة'; end if;
  if a.status <> 'pending' then raise exception 'تم البت في هذه التسوية من قبل'; end if;
  if not p_approve then
    perform app.set_context('reject', p_reason, 'stock_adjustments');
    update public.stock_adjustments set status = 'rejected', approved_by = auth.uid(), approved_at = now(), rejection_reason = p_reason
     where id = p_id;
    return jsonb_build_object('id', p_id, 'status', 'rejected');
  end if;
  v_cost := app.post_stock(v_company, a.warehouse_id, a.product_id, a.quantity, a.unit_cost,
                           case when a.bucket = 'damaged' and a.quantity < 0 then 'damage_writeoff' else 'adjustment' end,
                           'stock_adjustment', a.id, a.id, a.number, a.bucket, a.reason);
  v_amount := round(abs(a.quantity) * v_cost, 2);
  if a.quantity > 0 then
    v_je := app.post_journal(v_company, null, 'تسوية مخزون بالزيادة ' || a.number, 'stock_adjustment', a.id, a.number,
      jsonb_build_array(jsonb_build_object('account','1300','debit',v_amount,'warehouse_id',a.warehouse_id),
                        jsonb_build_object('account','5200','credit',v_amount)));
  else
    v_je := app.post_journal(v_company, null, 'تسوية مخزون بالعجز ' || a.number, 'stock_adjustment', a.id, a.number,
      jsonb_build_array(jsonb_build_object('account', case when a.bucket = 'damaged' then '5300' else '5200' end,'debit',v_amount),
                        jsonb_build_object('account','1300','credit',v_amount,'warehouse_id',a.warehouse_id)));
  end if;
  perform app.set_context('approve', p_reason, 'stock_adjustments');
  update public.stock_adjustments set status = 'approved', approved_by = auth.uid(), approved_at = now(), unit_cost = v_cost,
         journal_entry_id = v_je where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'approved');
end $$;

-- ---------------------------------------------------------------------
-- Physical stock counts
-- ---------------------------------------------------------------------
create or replace function public.stock_count_create(p_warehouse uuid, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.count'); v_id uuid; v_num text;
begin
  v_num := app.next_number(v_company, 'CNT');
  insert into public.stock_counts(company_id, number, warehouse_id, notes, created_by)
  values (v_company, v_num, p_warehouse, p_notes, auth.uid()) returning id into v_id;
  insert into public.stock_count_items(count_id, company_id, product_id, system_quantity)
  select v_id, v_company, pr.id, coalesce(b.quantity, 0)
    from public.products pr
    left join public.stock_balances b on b.product_id = pr.id and b.warehouse_id = p_warehouse
   where pr.company_id = v_company and (pr.is_active or coalesce(b.quantity,0) <> 0);
  return jsonb_build_object('id', v_id, 'number', v_num);
end $$;

create or replace function public.stock_count_update(p_id uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.count'); c public.stock_counts; i jsonb;
begin
  select * into c from public.stock_counts where id = p_id and company_id = v_company for update;
  if c.status <> 'draft' then raise exception 'لا يمكن تعديل جرد تم تقديمه'; end if;
  for i in select * from jsonb_array_elements(p_items) loop
    update public.stock_count_items set counted_quantity = nullif(i->>'counted_quantity','')::numeric, notes = i->>'notes'
     where count_id = p_id and product_id = (i->>'product_id')::uuid;
  end loop;
  return jsonb_build_object('id', p_id);
end $$;

create or replace function public.stock_count_submit(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.count');
begin
  perform app.set_context('submit', null, 'stock_counts');
  update public.stock_counts set status = 'submitted', submitted_by = auth.uid()
   where id = p_id and company_id = v_company and status = 'draft';
  if not found then raise exception 'لا يمكن تقديم هذا الجرد'; end if;
  perform app.notify(v_company, 'inventory.approve_adjustment', 'approval', 'جرد بانتظار الاعتماد', 'يوجد جرد فعلي مقدم للاعتماد', '/inventory/counts');
  return jsonb_build_object('id', p_id, 'status', 'submitted');
end $$;

-- Approval posts the differences (counted - snapshot) as count adjustments.
create or replace function public.stock_count_approve(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('inventory.approve_adjustment'); c public.stock_counts; i record;
  v_cost numeric; v_plus numeric(18,2) := 0; v_minus numeric(18,2) := 0; v_n int := 0;
begin
  select * into c from public.stock_counts where id = p_id and company_id = v_company for update;
  if not found or c.status <> 'submitted' then raise exception 'الجرد غير جاهز للاعتماد'; end if;
  for i in select * from public.stock_count_items where count_id = p_id and counted_quantity is not null
            and counted_quantity <> system_quantity loop
    v_cost := app.post_stock(v_company, c.warehouse_id, i.product_id, i.counted_quantity - i.system_quantity, null,
                             'count_adjustment', 'stock_count', p_id, i.id, c.number, 'available', 'جرد فعلي', true);
    if i.counted_quantity > i.system_quantity then v_plus := v_plus + round((i.counted_quantity - i.system_quantity) * v_cost, 2);
    else v_minus := v_minus + round((i.system_quantity - i.counted_quantity) * v_cost, 2); end if;
    v_n := v_n + 1;
  end loop;
  perform app.post_journal(v_company, c.count_date, 'فروقات جرد ' || c.number, 'stock_count', p_id, c.number,
    jsonb_build_array(
      jsonb_build_object('account','1300','debit',v_plus), jsonb_build_object('account','5200','credit',v_plus),
      jsonb_build_object('account','5200','debit',v_minus), jsonb_build_object('account','1300','credit',v_minus)));
  perform app.set_context('approve', null, 'stock_counts');
  update public.stock_counts set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_id;
  return jsonb_build_object('id', p_id, 'adjusted_lines', v_n);
end $$;

-- ---------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------
create or replace function public.purchase_order_save(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('purchases.manage'); v_prev jsonb; v_id uuid := nullif(p->>'id','')::uuid;
  v_num text; i jsonb; v_total numeric(18,2) := 0;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'purchase_order_save'); if v_prev is not null then return v_prev; end if;
  if v_id is null then
    v_num := app.next_number(v_company, 'PO');
    insert into public.purchase_orders(company_id, number, supplier_id, warehouse_id, order_date, expected_date, notes, created_by)
    values (v_company, v_num, (p->>'supplier_id')::uuid, nullif(p->>'warehouse_id','')::uuid,
            coalesce(nullif(p->>'order_date','')::date, (now() at time zone 'Africa/Cairo')::date), nullif(p->>'expected_date','')::date,
            p->>'notes', auth.uid())
    returning id into v_id;
  else
    update public.purchase_orders set supplier_id = (p->>'supplier_id')::uuid, warehouse_id = nullif(p->>'warehouse_id','')::uuid,
      expected_date = nullif(p->>'expected_date','')::date, notes = p->>'notes'
    where id = v_id and company_id = v_company and status = 'draft' returning number into v_num;
    if v_num is null then raise exception 'لا يمكن تعديل أمر شراء معتمد'; end if;
    delete from public.purchase_order_items where po_id = v_id;
  end if;
  for i in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    insert into public.purchase_order_items(po_id, company_id, product_id, quantity, unit_cost)
    values (v_id, v_company, (i->>'product_id')::uuid, (i->>'quantity')::numeric, (i->>'unit_cost')::numeric);
    v_total := v_total + round((i->>'quantity')::numeric * (i->>'unit_cost')::numeric, 2);
  end loop;
  update public.purchase_orders set total = v_total where id = v_id;
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_id, 'number', v_num));
end $$;

create or replace function public.purchase_order_set_status(p_id uuid, p_status text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid; po public.purchase_orders;
begin
  v_company := app.require_perm(case when p_status = 'approved' then 'purchases.approve' else 'purchases.manage' end);
  select * into po from public.purchase_orders where id = p_id and company_id = v_company for update;
  if not found then raise exception 'أمر الشراء غير موجود'; end if;
  if p_status = 'approved' and po.status <> 'draft' then raise exception 'أمر الشراء ليس مسودة'; end if;
  if p_status = 'cancelled' and po.status not in ('draft','approved') then raise exception 'لا يمكن إلغاء أمر تم استلامه'; end if;
  if p_status not in ('approved','cancelled') then raise exception 'حالة غير مسموحة'; end if;
  perform app.set_context(case when p_status = 'approved' then 'approve' else 'cancel' end, p_reason, 'purchase_orders');
  update public.purchase_orders set status = p_status,
    approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
    approved_at = case when p_status = 'approved' then now() else approved_at end
  where id = p_id;
  return jsonb_build_object('id', p_id, 'status', p_status);
end $$;

-- ---------------------------------------------------------------------
-- Incoming shipments
-- ---------------------------------------------------------------------
create or replace function public.shipment_save(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('shipments.manage'); v_prev jsonb; v_id uuid := nullif(p->>'id','')::uuid;
  v_num text; i jsonb; v_status text; v_total numeric(18,2) := 0; v_received boolean;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'shipment_save'); if v_prev is not null then return v_prev; end if;
  if v_id is null then
    if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'أضف صنفاً واحداً على الأقل'; end if;
    v_num := app.next_number(v_company, 'SHP');
    insert into public.incoming_shipments(company_id, number, reference, supplier_id, warehouse_id, po_id, shipment_date,
      expected_arrival, status, shipping_cost, additional_cost, additional_cost_notes, notes, attachments, created_by)
    values (v_company, v_num, p->>'reference', (p->>'supplier_id')::uuid, (p->>'warehouse_id')::uuid, nullif(p->>'po_id','')::uuid,
      nullif(p->>'shipment_date','')::date, nullif(p->>'expected_arrival','')::date, coalesce(nullif(p->>'status',''),'ordered'),
      coalesce((p->>'shipping_cost')::numeric,0), coalesce((p->>'additional_cost')::numeric,0), p->>'additional_cost_notes',
      p->>'notes', coalesce(p->'attachments','[]'::jsonb), auth.uid())
    returning id into v_id;
  else
    select status, number into v_status, v_num from public.incoming_shipments where id = v_id and company_id = v_company for update;
    if v_status is null then raise exception 'الشحنة غير موجودة'; end if;
    if v_status in ('received','cancelled') then raise exception 'لا يمكن تعديل شحنة حالتها "%"', v_status; end if;
    select exists(select 1 from public.incoming_shipment_receipts where shipment_id = v_id) into v_received;
    update public.incoming_shipments set reference = p->>'reference',
      supplier_id = case when v_received then supplier_id else (p->>'supplier_id')::uuid end,
      warehouse_id = case when v_received then warehouse_id else (p->>'warehouse_id')::uuid end,
      shipment_date = nullif(p->>'shipment_date','')::date, expected_arrival = nullif(p->>'expected_arrival','')::date,
      shipping_cost = case when v_received then shipping_cost else coalesce((p->>'shipping_cost')::numeric,0) end,
      additional_cost = case when v_received then additional_cost else coalesce((p->>'additional_cost')::numeric,0) end,
      additional_cost_notes = p->>'additional_cost_notes', notes = p->>'notes',
      attachments = coalesce(p->'attachments', attachments),
      status = case when p->>'status' in ('draft','ordered','in_transit') and not v_received then p->>'status' else status end
    where id = v_id;
    if v_received then
      return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_id, 'number', v_num, 'items_locked', true));
    end if;
    delete from public.incoming_shipment_items where shipment_id = v_id;
  end if;
  for i in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    insert into public.incoming_shipment_items(shipment_id, company_id, product_id, po_item_id, quantity, unit_cost)
    values (v_id, v_company, (i->>'product_id')::uuid, nullif(i->>'po_item_id','')::uuid, (i->>'quantity')::numeric,
            (i->>'unit_cost')::numeric);
    v_total := v_total + round((i->>'quantity')::numeric * (i->>'unit_cost')::numeric, 2);
  end loop;
  update public.incoming_shipments set goods_total = v_total where id = v_id;
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_id, 'number', v_num));
end $$;

create or replace function public.shipment_set_status(p_id uuid, p_status text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('shipments.manage'); s public.incoming_shipments;
begin
  select * into s from public.incoming_shipments where id = p_id and company_id = v_company for update;
  if not found then raise exception 'الشحنة غير موجودة'; end if;
  if p_status not in ('ordered','in_transit','cancelled') then raise exception 'حالة غير مسموحة'; end if;
  if s.status in ('received','partially_received','cancelled') then
    raise exception 'لا يمكن تغيير حالة شحنة "%"', s.status;
  end if;
  if p_status = 'cancelled' and coalesce(trim(p_reason),'') = '' then raise exception 'سبب الإلغاء مطلوب'; end if;
  perform app.set_context(case when p_status = 'cancelled' then 'cancel' else 'status_change' end, p_reason, 'incoming_shipments');
  update public.incoming_shipments set status = p_status where id = p_id;
  return jsonb_build_object('id', p_id, 'status', p_status);
end $$;

-- Receive (fully or partially). p_lines: [{item_id, received_quantity, damaged_quantity, serials:[...]}]
create or replace function public.shipment_receive(p_id uuid, p_lines jsonb, p_notes text default null,
  p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('shipments.receive'); v_prev jsonb; s public.incoming_shipments;
  it public.incoming_shipment_items; l jsonb; v_good numeric; v_dmg numeric; v_extra_total numeric; v_base numeric;
  v_extra_unit numeric(18,4); v_landed numeric(18,4); v_goods numeric(18,2) := 0; v_extra numeric(18,2) := 0;
  v_rid uuid; v_rnum text; v_je uuid; v_lines jsonb := '[]'::jsonb; v_left numeric; v_any boolean := false;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'shipment_receive'); if v_prev is not null then return v_prev; end if;
  select * into s from public.incoming_shipments where id = p_id and company_id = v_company for update;
  if not found then raise exception 'الشحنة غير موجودة'; end if;
  if s.status in ('received','cancelled','draft') then raise exception 'لا يمكن استلام شحنة حالتها "%"', s.status; end if;

  v_extra_total := s.shipping_cost + s.additional_cost;
  select coalesce(sum(quantity * unit_cost), 0) into v_base from public.incoming_shipment_items where shipment_id = p_id;
  v_rnum := app.next_number(v_company, 'GRN');
  insert into public.incoming_shipment_receipts(shipment_id, company_id, number, received_by, notes)
  values (p_id, v_company, v_rnum, auth.uid(), p_notes) returning id into v_rid;

  for l in select * from jsonb_array_elements(p_lines) loop
    select * into it from public.incoming_shipment_items where id = (l->>'item_id')::uuid and shipment_id = p_id for update;
    if not found then raise exception 'صنف غير موجود في الشحنة'; end if;
    v_good := coalesce((l->>'received_quantity')::numeric, 0);
    v_dmg := coalesce((l->>'damaged_quantity')::numeric, 0);
    if v_good < 0 or v_dmg < 0 then raise exception 'الكميات لا يمكن أن تكون سالبة'; end if;
    continue when v_good + v_dmg = 0;
    v_left := it.quantity - it.received_quantity - it.damaged_quantity;
    if v_good + v_dmg > v_left then
      raise exception 'الكمية المستلمة أكبر من المتبقي في الشحنة (المتبقي %)', v_left;
    end if;
    -- landed cost: allocate extra costs proportionally to line value
    if v_base > 0 then v_extra_unit := round((it.quantity * it.unit_cost / v_base) * v_extra_total / it.quantity, 4);
    else v_extra_unit := round(v_extra_total / nullif((select sum(quantity) from public.incoming_shipment_items where shipment_id = p_id),0), 4);
    end if;
    v_extra_unit := coalesce(v_extra_unit, 0);
    v_landed := it.unit_cost + v_extra_unit;
    if v_good > 0 then
      perform app.post_stock(v_company, s.warehouse_id, it.product_id, v_good, v_landed, 'purchase_receipt',
                             'shipment_receipt', v_rid, it.id, s.number || ' / ' || v_rnum, 'available');
    end if;
    if v_dmg > 0 then
      perform app.post_stock(v_company, s.warehouse_id, it.product_id, v_dmg, v_landed, 'purchase_receipt',
                             'shipment_receipt', v_rid, it.id, s.number || ' / ' || v_rnum, 'damaged', 'تالف عند الاستلام');
    end if;
    perform app.serials_receive(v_company, it.product_id, s.warehouse_id, l->'serials', v_good, 'shipment', p_id);
    update public.incoming_shipment_items set received_quantity = received_quantity + v_good,
           damaged_quantity = damaged_quantity + v_dmg, landed_unit_cost = v_landed where id = it.id;
    if it.po_item_id is not null then
      update public.purchase_order_items set received_quantity = received_quantity + v_good + v_dmg where id = it.po_item_id;
    end if;
    insert into public.product_costs(product_id, company_id, purchase_price, last_landed_cost)
    values (it.product_id, v_company, it.unit_cost, v_landed)
    on conflict (product_id) do update set purchase_price = excluded.purchase_price, last_landed_cost = excluded.last_landed_cost;
    v_goods := v_goods + round((v_good + v_dmg) * it.unit_cost, 2);
    v_extra := v_extra + round((v_good + v_dmg) * v_extra_unit, 2);
    v_lines := v_lines || jsonb_build_object('item_id', it.id, 'product_id', it.product_id, 'received', v_good,
                                             'damaged', v_dmg, 'unit_cost', it.unit_cost, 'landed_unit_cost', v_landed);
    v_any := true;
  end loop;
  if not v_any then raise exception 'لم يتم إدخال أي كميات للاستلام'; end if;

  v_je := app.post_journal(v_company, null, 'استلام شحنة ' || s.number || ' (' || v_rnum || ')', 'shipment_receipt', v_rid, s.number,
    jsonb_build_array(
      jsonb_build_object('account','1300','debit', v_goods + v_extra, 'warehouse_id', s.warehouse_id),
      jsonb_build_object('account','2100','credit', v_goods, 'party_type','supplier','party_id', s.supplier_id),
      jsonb_build_object('account','2150','credit', v_extra, 'memo','مصاريف شحن محملة على التكلفة')));
  perform app.supplier_balance_add(s.supplier_id, v_goods);
  update public.incoming_shipment_receipts set goods_value = v_goods, landed_extra = v_extra, journal_entry_id = v_je,
         lines = v_lines where id = v_rid;

  perform app.set_context('receive', p_notes, 'incoming_shipments');
  update public.incoming_shipments set
    received_value = received_value + v_goods,
    actual_arrival = coalesce(actual_arrival, (now() at time zone 'Africa/Cairo')::date),
    status = case when exists (select 1 from public.incoming_shipment_items where shipment_id = p_id
                                and received_quantity + damaged_quantity < quantity) then 'partially_received' else 'received' end
  where id = p_id;
  update public.purchase_orders po set status = case when exists (select 1 from public.purchase_order_items
      where po_id = po.id and received_quantity < quantity) then 'partially_received' else 'received' end
   where po.id = s.po_id;
  return app.idem_finish(v_company, p_idempotency_key,
    jsonb_build_object('id', p_id, 'receipt_id', v_rid, 'receipt_number', v_rnum, 'goods_value', v_goods, 'landed_extra', v_extra));
end $$;

-- Pay accrued shipping / clearance costs (Dr accrued landed costs / Cr cash)
create or replace function public.landed_cost_payment(p_shipment_id uuid, p_amount numeric, p_cash_account uuid,
  p_notes text default null, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('payments.pay_suppliers'); v_prev jsonb; s public.incoming_shipments; v_je uuid;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'landed_cost_payment'); if v_prev is not null then return v_prev; end if;
  if p_amount <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  select * into s from public.incoming_shipments where id = p_shipment_id and company_id = v_company;
  if not found then raise exception 'الشحنة غير موجودة'; end if;
  v_je := app.post_journal(v_company, null, 'سداد مصاريف شحن ' || s.number, 'landed_cost_payment', p_shipment_id, s.number,
    jsonb_build_array(jsonb_build_object('account','2150','debit',p_amount),
                      jsonb_build_object('account_id', app.cash_gl(p_cash_account),'credit',p_amount)));
  perform app.cash_move(v_company, p_cash_account, -p_amount, 'landed_cost_payment', p_shipment_id, s.number,
                        coalesce(p_notes, 'مصاريف شحن ' || s.number), v_je);
  perform app.log_event(v_company, 'landed_cost_payment', 'shipments', p_shipment_id, s.number,
                        jsonb_build_object('amount', p_amount), null, p_notes, jsonb_build_object('supplier_id', s.supplier_id));
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('journal_entry_id', v_je));
end $$;

-- ---------------------------------------------------------------------
-- Supplier payments
-- ---------------------------------------------------------------------
create or replace function public.supplier_payment_create(p jsonb, p_idempotency_key text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('payments.pay_suppliers'); v_prev jsonb; v_id uuid; v_num text; v_amt numeric(18,2);
  v_sup public.suppliers; v_je uuid; v_acc uuid := (p->>'cash_account_id')::uuid;
begin
  v_prev := app.idem_begin(v_company, p_idempotency_key, 'supplier_payment_create'); if v_prev is not null then return v_prev; end if;
  v_amt := round((p->>'amount')::numeric, 2);
  if v_amt is null or v_amt <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  select * into v_sup from public.suppliers where id = (p->>'supplier_id')::uuid and company_id = v_company for update;
  if not found then raise exception 'المورد غير موجود'; end if;
  v_num := app.next_number(v_company, 'SPAY');
  insert into public.supplier_payments(company_id, number, supplier_id, shipment_id, cash_account_id, amount, payment_date, method, notes, created_by)
  values (v_company, v_num, v_sup.id, nullif(p->>'shipment_id','')::uuid, v_acc, v_amt,
          coalesce(nullif(p->>'payment_date','')::date, (now() at time zone 'Africa/Cairo')::date), coalesce(p->>'method','cash'),
          p->>'notes', auth.uid())
  returning id into v_id;
  v_je := app.post_journal(v_company, nullif(p->>'payment_date','')::date, 'سداد للمورد ' || v_sup.name || ' ' || v_num,
    'supplier_payment', v_id, v_num,
    jsonb_build_array(jsonb_build_object('account','2100','debit',v_amt,'party_type','supplier','party_id',v_sup.id),
                      jsonb_build_object('account_id', app.cash_gl(v_acc),'credit',v_amt)));
  perform app.cash_move(v_company, v_acc, -v_amt, 'supplier_payment', v_id, v_num, 'سداد للمورد ' || v_sup.name, v_je,
                        nullif(p->>'payment_date','')::date);
  perform app.supplier_balance_add(v_sup.id, -v_amt);
  update public.supplier_payments set journal_entry_id = v_je where id = v_id;
  return app.idem_finish(v_company, p_idempotency_key, jsonb_build_object('id', v_id, 'number', v_num));
end $$;

create or replace function public.supplier_payment_cancel(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_company uuid := app.require_perm('finance.manage'); sp public.supplier_payments;
begin
  if coalesce(trim(p_reason),'') = '' then raise exception 'سبب الإلغاء مطلوب'; end if;
  select * into sp from public.supplier_payments where id = p_id and company_id = v_company for update;
  if not found or sp.status <> 'posted' then raise exception 'لا يمكن إلغاء هذه الدفعة'; end if;
  perform app.reverse_source_entries(v_company, 'supplier_payment', p_id, p_reason);
  perform app.cash_move(v_company, sp.cash_account_id, sp.amount, 'supplier_payment_cancel', p_id, sp.number, 'إلغاء ' || sp.number, null);
  perform app.supplier_balance_add(sp.supplier_id, sp.amount);
  perform app.set_context('cancel', p_reason, 'supplier_payments');
  update public.supplier_payments set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason
   where id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'cancelled');
end $$;
