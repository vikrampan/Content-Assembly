-- ===========================================================================
-- 0006_departments.sql — Put each team member on a desk (department)
--
-- A team member belongs to a department (their desk in the pipeline). Admins
-- stay global; clients have no department. This is what makes the app render
-- "according to the pipeline" — each person lands on their own portal.
-- ===========================================================================

alter table public.memberships
  add column if not exists department text;   -- brand|strategy|content|design|video|image|audio|capture|qa|social

-- Give the demo creator a desk so the Content portal has an owner to show.
update public.memberships m
   set department = 'content'
  from auth.users u
 where u.email = 'creator@mendly.co'
   and m.user_id = u.id
   and m.role = 'team_incharge';
