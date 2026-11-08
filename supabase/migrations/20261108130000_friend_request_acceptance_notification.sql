BEGIN;
CREATE OR REPLACE FUNCTION public.notify_on_friend_request_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='accepted' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
       WHERE n.recipient_id=NEW.requester_id AND n.type='friend_request_accepted'
         AND replace(coalesce(n.body,''),' ','') LIKE '%"friend_request_id":' || NEW.id::text || '%'
    ) THEN
      BEGIN
        INSERT INTO public.notifications(recipient_id,title,body,type)
        VALUES (NEW.requester_id,'تم قبول طلب الصداقة',
          jsonb_build_object('friend_request_id',NEW.id,'accepted_by',NEW.target_id)::text,
          'friend_request_accepted');
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Alwaha acceptance notification failed for friend request %: %',NEW.id,SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.notify_on_friend_request_accepted() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS friend_requests_accept_notify_trigger ON public.friend_requests;
CREATE TRIGGER friend_requests_accept_notify_trigger
AFTER UPDATE OF status ON public.friend_requests
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='accepted')
EXECUTE FUNCTION public.notify_on_friend_request_accepted();
COMMIT;