-- Run in the KMG project's SQL Editor. Run each statement on its own
-- (select it, then "Run selected").

-- 1) Find your user's exact id (copy it from the result; do not retype it).
select id, email from auth.users order by created_at desc;

-- 2) Grant that login the admin role. Replace PASTE-EXACT-ID-HERE, keep the quotes.
insert into public.staff_profiles (user_id, full_name, role)
values ('PASTE-EXACT-ID-HERE', 'Your Name', 'admin');

-- 3) Check. (The column is "status", not "is_active".)
select user_id, full_name, role, status from public.staff_profiles;
