-- Advisor cleanup with behavior-preserving RLS consolidation and missing FK index.
create index if not exists automation_deliveries_user_id_idx on upt_private.automation_deliveries(user_id);

drop policy if exists event_guestlist_settings_admin_read on public.event_guestlist_settings;
drop policy if exists event_guestlist_settings_read on public.event_guestlist_settings;
create policy event_guestlist_settings_read on public.event_guestlist_settings for select to authenticated
using (public.upt_is_admin((select auth.uid())) or upt_private.guestlist_can_view(event_id,(select auth.uid())));

drop policy if exists feature_rollouts_admin_write on public.feature_rollouts;
create policy feature_rollouts_admin_insert on public.feature_rollouts for insert to authenticated
with check (public.upt_is_approved() and public.upt_is_admin((select auth.uid())));
create policy feature_rollouts_admin_update on public.feature_rollouts for update to authenticated
using (public.upt_is_approved() and public.upt_is_admin((select auth.uid())))
with check (public.upt_is_approved() and public.upt_is_admin((select auth.uid())));
create policy feature_rollouts_admin_delete on public.feature_rollouts for delete to authenticated
using (public.upt_is_approved() and public.upt_is_admin((select auth.uid())));

drop policy if exists knowledge_articles_admin on public.knowledge_articles;
create policy knowledge_articles_admin_insert on public.knowledge_articles for insert to authenticated
with check (public.upt_is_approved() and public.upt_is_admin((select auth.uid())));
create policy knowledge_articles_admin_update on public.knowledge_articles for update to authenticated
using (public.upt_is_approved() and public.upt_is_admin((select auth.uid())))
with check (public.upt_is_approved() and public.upt_is_admin((select auth.uid())));
create policy knowledge_articles_admin_delete on public.knowledge_articles for delete to authenticated
using (public.upt_is_approved() and public.upt_is_admin((select auth.uid())));
