do $$
begin
  if exists(select 1 from storage.objects where bucket_id='handelser-images') then
    raise exception 'Storage-bucket handelser-images innehåller fortfarande filer. Använd först adminfunktionen Avsluta tidslinjen och radera allt.';
  end if;
end $$;

do $$
begin
  if exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hd_activity'
  ) then
    alter publication supabase_realtime drop table public.hd_activity;
  end if;
end $$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'hd\_%' escape '\'
  loop
    execute format('drop function if exists %s cascade',r.signature);
  end loop;
end $$;

drop table if exists public.hd_help_requests cascade;
drop table if exists public.hd_memories cascade;
drop table if exists public.hd_facts cascade;
drop table if exists public.hd_activity cascade;
drop table if exists public.hd_settings cascade;

delete from storage.buckets where id='handelser-images';
