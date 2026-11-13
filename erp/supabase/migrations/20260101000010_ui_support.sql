-- =====================================================================
-- Al-Mohandes HVAC ERP — 0010 UI support
-- Lets the owner add an employee by the e-mail they signed up with
-- (the browser app never sees auth.users or the service key).
-- =====================================================================
create or replace function public.employee_attach_by_email(p_email text, p_full_name text, p_role_id uuid,
  p_phone text default null, p_job_title text default null, p_default_warehouse uuid default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;
begin
  perform app.require_perm('users.manage');
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'لا يوجد حساب بهذا البريد — اطلب من الموظف إنشاء حساب من شاشة الدخول أولاً';
  end if;
  return public.employee_attach(v_user, p_full_name, p_role_id, p_phone, p_job_title, p_default_warehouse);
end $$;
revoke execute on function public.employee_attach_by_email(text, text, uuid, text, text, uuid) from public, anon;
grant execute on function public.employee_attach_by_email(text, text, uuid, text, text, uuid) to authenticated;
