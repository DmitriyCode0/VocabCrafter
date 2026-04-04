create or replace function public.log_ai_usage_event(
  p_user_id uuid,
  p_feature text,
  p_request_type text,
  p_provider text,
  p_model text,
  p_prompt_tokens integer,
  p_response_tokens integer,
  p_audio_output_tokens integer,
  p_total_tokens integer,
  p_is_estimated boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  insert into public.ai_usage_events (
    user_id,
    feature,
    request_type,
    provider,
    model,
    prompt_tokens,
    response_tokens,
    audio_output_tokens,
    total_tokens,
    is_estimated
  ) values (
    p_user_id,
    p_feature,
    p_request_type,
    p_provider,
    p_model,
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_response_tokens, 0), 0),
    greatest(coalesce(p_audio_output_tokens, 0), 0),
    greatest(coalesce(p_total_tokens, 0), 0),
    coalesce(p_is_estimated, false)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function public.log_ai_usage_event(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  boolean
) to anon, authenticated, service_role;