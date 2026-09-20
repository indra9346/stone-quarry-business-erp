-- Run in the SQL Editor of the business project you are setting up (KMG or
-- Murudeshwara — each has its own logins). Run each statement on its own
-- (select it, then "Run selected").
--
-- STEP A (dashboard, not SQL): Authentication -> Users -> Add user.
--   Create TWO logins with an email + a password of your choice, tick "Auto Confirm User":
--     one for the ADMIN, one for the STAFF member.
--
-- STEP B: give each login its role. These look the login up BY EMAIL, so you
-- never have to copy or retype a UUID. Replace the emails and names.

-- 1) ADMIN
insert into public.staff_profiles (user_id, full_name, role)
select id, 'Admin Full Name', 'admin'
from auth.users
where email = 'admin@example.com';

-- 2) STAFF
insert into public.staff_profiles (user_id, full_name, role)
select id, 'Staff Full Name', 'staff'
from auth.users
where email = 'staff@example.com';

-- Each insert should say "Success. 1 row affected".
-- If it says 0 rows, the email does not exist in THIS project's Authentication -> Users
-- (check spelling, and that you are in the right project).

-- 3) CHECK: expect one admin row and one staff row, both status = active.
select p.user_id, u.email, p.full_name, p.role, p.status
from public.staff_profiles p
left join auth.users u on u.id = p.user_id
order by p.role, p.full_name;

-- Later: deactivate someone (they are blocked immediately), or change a role.
-- update public.staff_profiles set status = 'inactive'
-- where user_id = (select id from auth.users where email = 'staff@example.com');
-- update public.staff_profiles set role = 'staff'
-- where user_id = (select id from auth.users where email = 'someone@example.com');
