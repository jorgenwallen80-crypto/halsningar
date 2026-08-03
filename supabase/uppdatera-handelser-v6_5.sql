alter table public.hd_settings
  add column if not exists recipient_name text not null default '',
  add column if not exists welcome_message text not null default 'Här väntar små händelser att öppna när du vill och orkar.';

create or replace function public.hd_viewer_presentation(p_viewer_pin text)
returns table(recipient_name text,welcome_message text)
language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_pin_ok('viewer',p_viewer_pin),false) then raise exception 'Fel kod'; end if;
  return query select s.recipient_name,s.welcome_message from public.hd_settings s where s.id=1;
end;
$$;

create or replace function public.hd_admin_presentation(p_admin_pin text)
returns table(recipient_name text,welcome_message text)
language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  return query select s.recipient_name,s.welcome_message from public.hd_settings s where s.id=1;
end;
$$;

create or replace function public.hd_admin_update_presentation(p_admin_pin text,p_recipient_name text,p_welcome_message text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  if char_length(btrim(coalesce(p_recipient_name,'')))>60 then raise exception 'Namnet är för långt'; end if;
  if char_length(btrim(coalesce(p_welcome_message,'')))>280 then raise exception 'Välkomsttexten är för lång'; end if;
  update public.hd_settings
  set recipient_name=btrim(coalesce(p_recipient_name,'')),
      welcome_message=btrim(coalesce(p_welcome_message,'')),
      updated_at=clock_timestamp()
  where id=1;
  update public.hd_activity set changed_at=clock_timestamp() where id=1;
  return true;
end;
$$;

grant execute on function public.hd_viewer_presentation(text) to anon,authenticated;
grant execute on function public.hd_admin_presentation(text) to anon,authenticated;
grant execute on function public.hd_admin_update_presentation(text,text,text) to anon,authenticated;
