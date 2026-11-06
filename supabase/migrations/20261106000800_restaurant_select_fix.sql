-- INSERT ... RETURNING on restaurants evaluates the SELECT policy against the new row.
-- private.can_view_restaurant(id) looks the restaurant up by id, which a STABLE function
-- cannot see inside the same statement, so super admins could not create restaurants
-- through the API. Also allow super admins of the row's organization directly.
drop policy if exists restaurants_select on public.restaurants;
create policy restaurants_select on public.restaurants for select to authenticated
  using (private.can_view_restaurant(id) or private.current_role_in(organization_id) = 'super_admin');
