-- Follow-up hardening from Supabase advisors for the new platform layer.

revoke execute on function public.upt_god_data_audit_list(text,integer) from anon;
revoke execute on function public.upt_god_data_rollback(text,bigint) from anon;
grant execute on function public.upt_god_data_audit_list(text,integer) to authenticated;
grant execute on function public.upt_god_data_rollback(text,bigint) to authenticated;

create index if not exists configuration_versions_created_by_idx
  on public.configuration_versions(created_by);
create index if not exists event_report_snapshots_generated_by_idx
  on public.event_report_snapshots(generated_by);
create index if not exists event_templates_source_event_idx
  on public.event_templates(source_event_id);
create index if not exists feature_rollouts_updated_by_idx
  on public.feature_rollouts(updated_by);
create index if not exists knowledge_articles_created_by_idx
  on public.knowledge_articles(created_by);
create index if not exists knowledge_articles_workplace_idx
  on public.knowledge_articles(workplace_id);
create index if not exists planning_recommendations_applied_shift_idx
  on public.planning_recommendations(applied_shift_id);
create index if not exists planning_recommendations_created_by_idx
  on public.planning_recommendations(created_by);
create index if not exists planning_recommendations_user_idx
  on public.planning_recommendations(recommended_user_id);
create index if not exists planning_recommendations_workplace_idx
  on public.planning_recommendations(workplace_id);
create index if not exists qr_resources_created_by_idx
  on public.qr_resources(created_by);
create index if not exists qr_resources_workplace_idx
  on public.qr_resources(workplace_id);
create index if not exists shifts_marketplace_opened_by_idx
  on public.shifts(marketplace_opened_by);
create index if not exists staff_pay_rates_created_by_idx
  on public.staff_pay_rates(created_by);
create index if not exists operational_alert_deliveries_user_idx
  on upt_private.operational_alert_deliveries(user_id);
create index if not exists shift_marketplace_claims_decided_by_idx
  on upt_private.shift_marketplace_claims(decided_by);
create index if not exists shift_marketplace_claims_event_idx
  on upt_private.shift_marketplace_claims(event_id);
create index if not exists shift_marketplace_claims_workplace_idx
  on upt_private.shift_marketplace_claims(workplace_id);

notify pgrst,'reload schema';

