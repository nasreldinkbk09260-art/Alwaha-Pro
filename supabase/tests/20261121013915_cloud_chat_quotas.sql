-- Daily/weekly limits are applied atomically and scope-separated.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('30000000-0000-4000-8000-000000000001','quota-ci@example.invalid',
  '{"username":"quota_ci","alwaha_terms_version":"2026-11-15","alwaha_privacy_version":"2026-11-15"}'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO public.app_settings(key,value) VALUES
 ('management_config_v1', '{"version":1,"currency":"EGP","free":{"daily_direct_messages":1,"weekly_direct_messages":2,"daily_market_messages":1,"weekly_market_messages":2},"plans":[],"payment_methods":[]}')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
DO $limits$
BEGIN
  IF NOT app_private.consume_chat_message_quota('30000000-0000-4000-8000-000000000001','direct') THEN RAISE EXCEPTION 'first direct message should be allowed'; END IF;
  IF app_private.consume_chat_message_quota('30000000-0000-4000-8000-000000000001','direct') THEN RAISE EXCEPTION 'second same-day direct message should be blocked at limit 1'; END IF;
  IF NOT app_private.consume_chat_message_quota('30000000-0000-4000-8000-000000000001','market') THEN RAISE EXCEPTION 'market quota must be counted separately'; END IF;
  IF app_private.consume_chat_message_quota('30000000-0000-4000-8000-000000000001','market') THEN RAISE EXCEPTION 'second same-day market message should be blocked at limit 1'; END IF;
END
$limits$;
RESET ROLE;

DO $assertions$
DECLARE v_direct bigint; v_market bigint;
BEGIN
  SELECT used INTO v_direct FROM app_private.chat_message_usage WHERE user_id='30000000-0000-4000-8000-000000000001' AND scope='direct' AND period_kind='day' AND period_start=(now() AT TIME ZONE 'UTC')::date;
  SELECT used INTO v_market FROM app_private.chat_message_usage WHERE user_id='30000000-0000-4000-8000-000000000001' AND scope='market' AND period_kind='day' AND period_start=(now() AT TIME ZONE 'UTC')::date;
  IF v_direct IS DISTINCT FROM 1 OR v_market IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'quota counters must not overcount rejected messages: direct %, market %',v_direct,v_market; END IF;
  IF has_table_privilege('authenticated','app_private.chat_message_usage','SELECT') OR has_table_privilege('anon','app_private.chat_message_usage','SELECT') THEN RAISE EXCEPTION 'chat usage must remain private'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='enforce_direct_chat_message_quota' AND NOT tgisinternal) OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='enforce_market_chat_message_quota' AND NOT tgisinternal) THEN RAISE EXCEPTION 'both direct and market quota triggers must be installed'; END IF;
END
$assertions$;
SELECT 'CHAT_QUOTA_SQL_REGRESSION=PASS' AS result;
