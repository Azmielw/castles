-- UI support functions (runs after 10_acceptance.sql on the same database)
\set QUIET on
\pset tuples_only on
\pset format unaligned
reset role;
insert into auth.users(id, email) values ('00000000-0000-0000-0000-000000000009', 'New.Hire@example.com');
select test.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
select test.fails($$select public.employee_attach_by_email('new.hire@example.com','x',(select id from roles where key='sales'))$$,
  'users.manage', 'sales employee cannot add employees by e-mail');
select test.login('00000000-0000-0000-0000-000000000001');
select test.fails($$select public.employee_attach_by_email('nobody@example.com','x',(select id from roles where key='sales'))$$,
  'لا يوجد حساب', 'unknown e-mail is rejected with a clear message');
select public.employee_attach_by_email(' new.hire@EXAMPLE.com ', 'موظف جديد', (select id from roles where key='shipping'));
select test.ok((select full_name = 'موظف جديد' from profiles where id = '00000000-0000-0000-0000-000000000009'),
  'owner attaches an employee by e-mail (case-insensitive)');
select test.fails($$select public.employee_attach_by_email('new.hire@example.com','x',(select id from roles where key='sales'))$$,
  'مضاف من قبل', 'employee cannot be attached twice');
reset role;
select 'UI SUPPORT TESTS PASSED';
