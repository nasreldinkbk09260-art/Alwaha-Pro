BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS app_private.chat_message_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('direct','market')),
  period_kind text NOT NULL CHECK (period_kind IN ('day','week')),
  period_start date NOT NULL,
  used bigint NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope, period_kind, period_start)
);
REVOKE ALL ON TABLE app_private.chat_message_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.consume_chat_message_quota(
  p_user_id uuid, p_scope text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_config jsonb := '{}'::jsonb;
  v_free jsonb := '{}'::jsonb;
  v_daily_limit integer := 100;
  v_weekly_limit integer := 500;
  v_day date := (now() AT TIME ZONE 'UTC')::date;
  v_week date := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
  v_used bigint;
BEGIN
  IF p_user_id IS NULL OR p_scope NOT IN ('direct','market') OR (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Invalid quota identity or scope' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.is_admin IS TRUE) THEN
    RETURN true;
  END IF;
  BEGIN
    SELECT s.value::jsonb INTO v_config
      FROM public.app_settings s WHERE s.key = 'management_config_v1';
  EXCEPTION WHEN OTHERS THEN
    v_config := '{}'::jsonb;
  END;
  v_free := COALESCE(v_config->'free', '{}'::jsonb);
  IF p_scope = 'direct' THEN
    v_daily_limit := COALESCE((v_free->>'daily_direct_messages')::integer, 100);
    v_weekly_limit := COALESCE((v_free->>'weekly_direct_messages')::integer, 500);
  ELSE
    v_daily_limit := COALESCE((v_free->>'daily_market_messages')::integer, 50);
    v_weekly_limit := COALESCE((v_free->>'weekly_market_messages')::integer, 250);
  END IF;
  v_daily_limit := GREATEST(0, LEAST(v_daily_limit, 100000));
  v_weekly_limit := GREATEST(0, LEAST(v_weekly_limit, 500000));
  IF v_weekly_limit < v_daily_limit OR v_daily_limit = 0 THEN RETURN false; END IF;

  INSERT INTO app_private.chat_message_usage(user_id,scope,period_kind,period_start,used)
    VALUES (p_user_id,p_scope,'day',v_day,1)
  ON CONFLICT (user_id,scope,period_kind,period_start)
    DO UPDATE SET used = app_private.chat_message_usage.used + 1, updated_at = now()
    WHERE app_private.chat_message_usage.used < v_daily_limit
  RETURNING used INTO v_used;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO app_private.chat_message_usage(user_id,scope,period_kind,period_start,used)
    VALUES (p_user_id,p_scope,'week',v_week,1)
  ON CONFLICT (user_id,scope,period_kind,period_start)
    DO UPDATE SET used = app_private.chat_message_usage.used + 1, updated_at = now()
    WHERE app_private.chat_message_usage.used < v_weekly_limit
  RETURNING used INTO v_used;
  IF NOT FOUND THEN
    UPDATE app_private.chat_message_usage
      SET used = GREATEST(0,used-1), updated_at = now()
      WHERE user_id=p_user_id AND scope=p_scope AND period_kind='day' AND period_start=v_day;
    RETURN false;
  END IF;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.consume_chat_message_quota(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.consume_chat_message_quota(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_chat_message_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_scope text := TG_ARGV[0];
BEGIN
  IF NOT app_private.consume_chat_message_quota(NEW.sender_id, v_scope) THEN
    RAISE EXCEPTION 'ALWAHA_QUOTA_EXCEEDED: daily or weekly cloud message quota reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_chat_message_quota() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_direct_chat_message_quota ON public.messages;
CREATE TRIGGER enforce_direct_chat_message_quota
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_message_quota('direct');

DROP TRIGGER IF EXISTS enforce_market_chat_message_quota ON public.market_messages;
CREATE TRIGGER enforce_market_chat_message_quota
  BEFORE INSERT ON public.market_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_message_quota('market');

COMMENT ON TABLE app_private.chat_message_usage IS
  'Private daily and ISO-weekly cloud text-message quota usage. Not a limiter for local peer-to-peer Mesh traffic.';
NOTIFY pgrst, 'reload schema';
COMMIT;
