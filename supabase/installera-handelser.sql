create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path=public,extensions;


insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('handelser-images','handelser-images',false,500000,array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set
  public=false,
  file_size_limit=500000,
  allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];

create table if not exists public.hd_settings (
  id smallint primary key default 1 check (id = 1),
  viewer_pin_hash text not null,
  friend_pin_hash text not null,
  admin_pin_hash text not null,
  daily_limit integer not null default 6 check (daily_limit between 1 and 24),
  recipient_name text not null default '' check (char_length(recipient_name) <= 60),
  welcome_message text not null default 'Här väntar små händelser att öppna när du vill och orkar.' check (char_length(welcome_message) <= 280),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.hd_settings add column if not exists recipient_name text not null default '';
alter table public.hd_settings add column if not exists welcome_message text not null default 'Här väntar små händelser att öppna när du vill och orkar.';

insert into public.hd_settings (id,viewer_pin_hash,friend_pin_hash,admin_pin_hash,daily_limit,is_active)
values (
  1,
  crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf',10)),
  crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf',10)),
  crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf',10)),
  6,
  true
)
on conflict (id) do nothing;

create table if not exists public.hd_memories (
  id uuid primary key default gen_random_uuid(),
  contributor_token uuid not null,
  friend_name text not null check (char_length(friend_name) between 1 and 60),
  unlock_at timestamptz not null,
  content_type text not null check (content_type in ('text','image','quiz','youtube','sudoku','fact')),
  title text not null default '' check (char_length(title) <= 100),
  body text not null default '' check (char_length(body) between 1 and 3000),
  image_path text not null default '' check (char_length(image_path) <= 180),
  youtube_id text not null default '' check (char_length(youtube_id) <= 20),
  quiz_question text not null default '' check (char_length(quiz_question) <= 600),
  quiz_options jsonb not null default '[]'::jsonb,
  quiz_answer text not null default '' check (char_length(quiz_answer) <= 2000),
  quiz_explanation text not null default '' check (char_length(quiz_explanation) <= 6000),
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hd_memories_unlock_at_idx on public.hd_memories(unlock_at);
create index if not exists hd_memories_contributor_idx on public.hd_memories(contributor_token);
create unique index if not exists hd_one_daily_activity_idx
  on public.hd_memories(content_type,((unlock_at at time zone 'Europe/Stockholm')::date))
  where content_type in ('sudoku','fact');

create table if not exists public.hd_facts (
  id text primary key,
  category text not null,
  fact_text text not null check (char_length(fact_text) between 1 and 900)
);

insert into public.hd_facts (id,category,fact_text) values
  ('djur-01', 'Djur', 'Bläckfiskar har tre hjärtan.'),
  ('djur-02', 'Djur', 'Vombaters bajs är format som små kuber.'),
  ('djur-03', 'Djur', 'En grupp flamingor kallas på engelska för en “flamboyance”.'),
  ('djur-04', 'Djur', 'Kor har nära vänner och kan bli stressade när de skiljs åt.'),
  ('djur-05', 'Djur', 'Kråkfåglar kan känna igen enskilda människoansikten.'),
  ('djur-06', 'Djur', 'Havsuttrar kan hålla varandra i tassarna när de vilar i vattnet.'),
  ('djur-07', 'Djur', 'En snigel kan ha tusentals pyttesmå tänder på sin rasptunga.'),
  ('djur-08', 'Djur', 'Getter har rektangulära pupiller.'),
  ('rymd-01', 'Rymden', 'Ett dygn på Venus är längre än ett år på Venus.'),
  ('rymd-02', 'Rymden', 'På månen kan fotspår ligga kvar mycket länge eftersom där nästan inte finns vind eller väder.'),
  ('rymd-03', 'Rymden', 'Saturnus har lägre medeldensitet än vatten.'),
  ('rymd-04', 'Rymden', 'Ljuset från solen tar ungefär åtta minuter att nå jorden.'),
  ('rymd-05', 'Rymden', 'Mars solnedgångar kan se blå ut nära solen.'),
  ('rymd-06', 'Rymden', 'Neptunus upptäcktes först genom matematiska beräkningar innan den sågs i teleskop.'),
  ('kropp-01', 'Kroppen', 'En vuxen människa har vanligtvis 206 ben i kroppen.'),
  ('kropp-02', 'Kroppen', 'Huden är människokroppens största organ.'),
  ('kropp-03', 'Kroppen', 'Du är oftast lite längre på morgonen än på kvällen.'),
  ('kropp-04', 'Kroppen', 'Ögats hornhinna har inga blodkärl.'),
  ('kropp-05', 'Kroppen', 'Människans minsta ben finns i mellanörat och kallas stigbygeln.'),
  ('mat-01', 'Mat', 'Bananer räknas botaniskt som bär, men jordgubbar gör det inte.'),
  ('mat-02', 'Mat', 'Jordnötter är baljväxter och är närmare släkt med ärtor än med nötter.'),
  ('mat-03', 'Mat', 'Cashewnötter växer utanpå en frukt som kallas cashewäpple.'),
  ('mat-04', 'Mat', 'Morötter odlades i flera färger långt innan orange blev den vanligaste.'),
  ('mat-05', 'Mat', 'Vanilj kommer från frökapseln hos en orkidé.'),
  ('historia-01', 'Historia', 'Oxford University är äldre än det aztekiska riket.'),
  ('historia-02', 'Historia', 'Cleopatra levde närmare månlandningen 1969 än byggandet av de stora pyramiderna i Giza.'),
  ('historia-03', 'Historia', 'Den kortaste kända krigshandlingen mellan två stater varade mindre än en timme.'),
  ('historia-04', 'Historia', 'Eiffeltornet kan bli flera centimeter högre under varma sommardagar när metallen expanderar.'),
  ('historia-05', 'Historia', 'Den första kända varuautomaten beskrev en maskin som delade ut heligt vatten.'),
  ('vardag-01', 'Vardagen', 'Ett vanligt A4-papper har sidförhållandet 1 till kvadratroten ur 2.'),
  ('vardag-02', 'Vardagen', 'Det lilla hålet i locket på många kulspetspennor är en säkerhetsdetalj.'),
  ('vardag-03', 'Vardagen', 'Ordet “robot” kommer från ett tjeckiskt ord för tvångsarbete.'),
  ('vardag-04', 'Vardagen', 'En standardkortlek kan blandas på fler sätt än det finns atomer på jorden.'),
  ('vardag-05', 'Vardagen', 'Bubbelplast uppfanns ursprungligen som ett slags tapet.'),
  ('sprak-01', 'Språk', 'Punkten över bokstäverna i och j kallas på engelska för en “tittle”.'),
  ('sprak-02', 'Språk', 'Ordet “alfabet” kommer från de grekiska bokstäverna alfa och beta.'),
  ('sprak-03', 'Språk', 'Tecknet & kallas ampersand och började som en sammanskrivning av de latinska bokstäverna e och t.'),
  ('natur-01', 'Naturen', 'Bambu kan växa mycket snabbt och vissa arter kan skjuta upp flera decimeter på ett dygn.'),
  ('natur-02', 'Naturen', 'En blixt kan värma luften omkring sig till flera gånger solens yttemperatur.'),
  ('natur-03', 'Naturen', 'Antarktis är världens största öken eftersom nederbörden där är så liten.')
on conflict (id) do update set category=excluded.category, fact_text=excluded.fact_text;

create table if not exists public.hd_activity (
  id smallint primary key default 1 check (id = 1),
  changed_at timestamptz not null default now()
);
insert into public.hd_activity(id) values(1) on conflict(id) do nothing;

create table if not exists public.hd_help_requests (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.hd_memories(id) on delete cascade,
  contributor_token uuid not null,
  request_type text not null check (request_type in ('change','delete')),
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hd_help_open_unique_idx
  on public.hd_help_requests(memory_id,contributor_token)
  where status='open';

alter table public.hd_settings enable row level security;
alter table public.hd_memories enable row level security;
alter table public.hd_facts enable row level security;
alter table public.hd_activity enable row level security;
alter table public.hd_help_requests enable row level security;

revoke all on table public.hd_settings from anon,authenticated;
revoke all on table public.hd_memories from anon,authenticated;
revoke all on table public.hd_facts from anon,authenticated;
revoke all on table public.hd_activity from anon,authenticated;
revoke all on table public.hd_help_requests from anon,authenticated;

grant select on table public.hd_activity to anon,authenticated;
drop policy if exists hd_activity_read on public.hd_activity;
create policy hd_activity_read on public.hd_activity for select to anon,authenticated using (true);

create or replace function public.hd_pin_ok(p_kind text,p_pin text)
returns boolean language sql stable security definer set search_path=public,extensions as $$
  select case p_kind
    when 'viewer' then viewer_pin_hash=crypt(coalesce(p_pin,''),viewer_pin_hash)
    when 'friend' then friend_pin_hash=crypt(coalesce(p_pin,''),friend_pin_hash)
    when 'admin' then admin_pin_hash=crypt(coalesce(p_pin,''),admin_pin_hash)
    else false end
  from public.hd_settings where id=1;
$$;

create or replace function public.hd_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at=clock_timestamp();
  return new;
end;
$$;

drop trigger if exists hd_memories_updated_at on public.hd_memories;
create trigger hd_memories_updated_at before update on public.hd_memories
for each row execute function public.hd_touch_updated_at();

drop trigger if exists hd_help_requests_updated_at on public.hd_help_requests;
create trigger hd_help_requests_updated_at before update on public.hd_help_requests
for each row execute function public.hd_touch_updated_at();

create or replace function public.hd_touch_activity()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
begin
  update public.hd_activity set changed_at=clock_timestamp() where id=1;
  return null;
end;
$$;

drop trigger if exists hd_memories_activity on public.hd_memories;
create trigger hd_memories_activity after insert or update or delete on public.hd_memories
for each statement execute function public.hd_touch_activity();

drop trigger if exists hd_help_requests_activity on public.hd_help_requests;
create trigger hd_help_requests_activity after insert or update or delete on public.hd_help_requests
for each statement execute function public.hd_touch_activity();

create or replace function public.hd_validate_memory(
  p_content_type text,
  p_body text,
  p_image_path text,
  p_youtube_id text,
  p_quiz_question text,
  p_quiz_options jsonb,
  p_quiz_answer text,
  p_quiz_explanation text,
  p_extra_data jsonb
)
returns void language plpgsql immutable as $$
declare
  v_count integer;
  v_question jsonb;
  v_answers jsonb;
  v_url text;
  v_puzzle text;
  v_solution text;
  v_fact text;
begin
  if p_content_type not in ('text','image','quiz','youtube','sudoku','fact') then raise exception 'Ogiltig innehållstyp'; end if;
  if nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'Alla händelser behöver ett personligt meddelande'; end if;

  if p_content_type='image' then
    if nullif(btrim(coalesce(p_image_path,'')),'') is null then raise exception 'Bilden saknas'; end if;
    if p_image_path !~ '^[0-9a-fA-F-]{36}-[0-9a-fA-F-]{36}\.(jpg|jpeg|webp|png)$' then raise exception 'Bildens lagringssökväg är ogiltig'; end if;
  end if;

  if p_content_type='youtube' then
    v_url:=coalesce(p_extra_data->>'link_url','');
    if v_url !~ '^https://[^[:space:]]+$' then raise exception 'Klistra in en giltig https-länk'; end if;
    if coalesce(p_youtube_id,'')<>'' and p_youtube_id !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'YouTube-länken är ogiltig'; end if;
  end if;

  if p_content_type='quiz' then
    if jsonb_typeof(coalesce(p_quiz_options,'[]'::jsonb))<>'array' then raise exception 'Miniquizets frågor är ogiltiga'; end if;
    v_count:=jsonb_array_length(coalesce(p_quiz_options,'[]'::jsonb));
    if v_count<1 or v_count>4 then raise exception 'Miniquizet behöver 1 till 4 frågor'; end if;
    begin v_answers:=coalesce(nullif(p_quiz_answer,''),'[]')::jsonb; exception when others then raise exception 'Miniquizets facit är ogiltigt'; end;
    if jsonb_typeof(v_answers)<>'array' or jsonb_array_length(v_answers)<>v_count then raise exception 'Miniquizets facit är ofullständigt'; end if;
    for v_question in select value from jsonb_array_elements(p_quiz_options)
    loop
      if jsonb_typeof(v_question)<>'object' then raise exception 'Miniquizets frågor är ogiltiga'; end if;
      if nullif(btrim(coalesce(v_question->>'question','')),'') is null then raise exception 'En quizfråga saknar text'; end if;
      if jsonb_typeof(v_question->'options')<>'array' or jsonb_array_length(v_question->'options')<2 or jsonb_array_length(v_question->'options')>4 then raise exception 'Varje quizfråga behöver 2 till 4 svar'; end if;
    end loop;
  end if;

  if p_content_type='sudoku' then
    v_puzzle:=coalesce(p_extra_data->>'sudoku_puzzle','');
    v_solution:=coalesce(p_extra_data->>'sudoku_solution','');
    if v_puzzle !~ '^[0-4]{16}$' or v_solution !~ '^[1-4]{16}$' then raise exception 'Sudokut är ogiltigt'; end if;
  end if;

  if p_content_type='fact' then
    v_fact:=btrim(coalesce(p_extra_data->>'fact_text',''));
    if v_fact='' or char_length(v_fact)>900 then raise exception 'Faktan saknas eller är för lång'; end if;
  end if;
end;
$$;

create or replace function public.hd_assert_active()
returns void language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce((select is_active from public.hd_settings where id=1),false) then
    raise exception 'Tidslinjen är avslutad';
  end if;
end;
$$;

create or replace function public.hd_verify_friend(p_friend_pin text)
returns boolean language sql stable security definer set search_path=public,extensions as $$
  select coalesce(public.hd_pin_ok('friend',p_friend_pin),false)
    and coalesce((select is_active from public.hd_settings where id=1),false);
$$;

create or replace function public.hd_verify_admin(p_admin_pin text)
returns boolean language sql stable security definer set search_path=public,extensions as $$
  select coalesce(public.hd_pin_ok('admin',p_admin_pin),false);
$$;

create or replace function public.hd_server_clock(p_viewer_pin text)
returns timestamptz language plpgsql volatile security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_pin_ok('viewer',p_viewer_pin),false) then raise exception 'Fel kod'; end if;
  return clock_timestamp();
end;
$$;

create or replace function public.hd_timeline(p_viewer_pin text)
returns table(
  id uuid,unlock_at timestamptz,is_unlocked boolean,content_type text,title text,body text,image_path text,youtube_id text,
  quiz_question text,quiz_options jsonb,quiz_explanation text,extra_data jsonb,friend_name text,created_at timestamptz,server_now timestamptz
) language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_pin_ok('viewer',p_viewer_pin),false) then raise exception 'Fel kod'; end if;
  return query
  select m.id,m.unlock_at,m.unlock_at<=clock_timestamp(),
    case when m.unlock_at<=clock_timestamp() then m.content_type end,
    case when m.unlock_at<=clock_timestamp() then m.title end,
    case when m.unlock_at<=clock_timestamp() then m.body end,
    case when m.unlock_at<=clock_timestamp() then m.image_path end,
    case when m.unlock_at<=clock_timestamp() then m.youtube_id end,
    case when m.unlock_at<=clock_timestamp() then m.quiz_question end,
    case when m.unlock_at<=clock_timestamp() then m.quiz_options end,
    null::text,
    case when m.unlock_at<=clock_timestamp() then m.extra_data end,
    case when m.unlock_at<=clock_timestamp() then m.friend_name end,
    m.created_at,
    clock_timestamp()
  from public.hd_memories m
  order by m.unlock_at,m.created_at;
end;
$$;

create or replace function public.hd_assert_day_capacity(p_unlock_at timestamptz,p_ignore_id uuid default null)
returns void language plpgsql stable security definer set search_path=public,extensions as $$
declare v_limit integer; v_count integer;
begin
  select daily_limit into v_limit from public.hd_settings where id=1;
  select count(*) into v_count from public.hd_memories m
  where (m.unlock_at at time zone 'Europe/Stockholm')::date=(p_unlock_at at time zone 'Europe/Stockholm')::date
    and (p_ignore_id is null or m.id<>p_ignore_id);
  if v_count>=coalesce(v_limit,6) then raise exception 'Dagen har redan nått gränsen på % händelser',coalesce(v_limit,6); end if;
end;
$$;

create or replace function public.hd_day_available(p_friend_pin text,p_content_type text,p_unlock_at timestamptz,p_ignore_id uuid default null)
returns boolean language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  if p_content_type not in ('sudoku','fact') then return true; end if;
  return not exists(select 1 from public.hd_memories m where m.content_type=p_content_type
    and (m.unlock_at at time zone 'Europe/Stockholm')::date=(p_unlock_at at time zone 'Europe/Stockholm')::date
    and (p_ignore_id is null or m.id<>p_ignore_id));
end;
$$;

create or replace function public.hd_day_capacity(p_friend_pin text,p_unlock_at timestamptz,p_ignore_id uuid default null)
returns table(count integer,"limit" integer,available boolean,remaining integer)
language plpgsql stable security definer set search_path=public,extensions as $$
declare v_count integer; v_limit integer;
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  select count(*) into v_count from public.hd_memories m where (m.unlock_at at time zone 'Europe/Stockholm')::date=(p_unlock_at at time zone 'Europe/Stockholm')::date and (p_ignore_id is null or m.id<>p_ignore_id);
  select daily_limit into v_limit from public.hd_settings where id=1;
  return query select v_count,v_limit,v_count<v_limit,greatest(0,v_limit-v_count);
end;
$$;

create or replace function public.hd_random_fact(p_friend_pin text,p_category text default '')
returns jsonb language plpgsql volatile security definer set search_path=public,extensions as $$
declare v_fact public.hd_facts%rowtype;
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  select f.* into v_fact from public.hd_facts f
  where (coalesce(p_category,'')='' or f.category=p_category)
    and not exists(select 1 from public.hd_memories m where m.content_type='fact' and m.extra_data->>'fact_id'=f.id)
  order by random() limit 1;
  if not found then select f.* into v_fact from public.hd_facts f where coalesce(p_category,'')='' or f.category=p_category order by random() limit 1; end if;
  if not found then raise exception 'Det finns ingen fakta i den kategorin ännu'; end if;
  return jsonb_build_object('id',v_fact.id,'category',v_fact.category,'text',v_fact.fact_text);
end;
$$;

create or replace function public.hd_add_memory(
  p_friend_pin text,p_contributor_token uuid,p_friend_name text,p_unlock_at timestamptz,p_content_type text,
  p_title text default '',p_body text default '',p_image_path text default '',p_youtube_id text default '',p_quiz_question text default '',
  p_quiz_options jsonb default '[]'::jsonb,p_quiz_answer text default '',p_quiz_explanation text default '',p_extra_data jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare v_id uuid;
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  perform public.hd_assert_active();
  if p_contributor_token is null then raise exception 'Enhetens bidragsnyckel saknas'; end if;
  if nullif(btrim(coalesce(p_friend_name,'')),'') is null then raise exception 'Skriv ditt namn'; end if;
  if p_unlock_at is null then raise exception 'Välj datum och tid'; end if;
  perform public.hd_validate_memory(p_content_type,p_body,p_image_path,p_youtube_id,p_quiz_question,p_quiz_options,p_quiz_answer,p_quiz_explanation,p_extra_data);
  perform public.hd_assert_day_capacity(p_unlock_at,null);
  if p_content_type in ('sudoku','fact') and exists(select 1 from public.hd_memories m where m.content_type=p_content_type and (m.unlock_at at time zone 'Europe/Stockholm')::date=(p_unlock_at at time zone 'Europe/Stockholm')::date) then
    raise exception 'Det finns redan % den här dagen',case when p_content_type='sudoku' then 'ett sudoku' else 'onödig fakta' end;
  end if;
  insert into public.hd_memories(contributor_token,friend_name,unlock_at,content_type,title,body,image_path,youtube_id,quiz_question,quiz_options,quiz_answer,quiz_explanation,extra_data)
  values(p_contributor_token,btrim(p_friend_name),p_unlock_at,p_content_type,left(coalesce(p_title,''),100),btrim(p_body),coalesce(p_image_path,''),coalesce(p_youtube_id,''),coalesce(p_quiz_question,''),coalesce(p_quiz_options,'[]'::jsonb),coalesce(p_quiz_answer,''),coalesce(p_quiz_explanation,''),coalesce(p_extra_data,'{}'::jsonb))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Det finns redan % den här dagen',case when p_content_type='sudoku' then 'ett sudoku' else 'onödig fakta' end;
end;
$$;

create or replace function public.hd_my_memories(p_friend_pin text,p_contributor_token uuid)
returns table(id uuid,contributor_token uuid,friend_name text,unlock_at timestamptz,content_type text,title text,body text,image_path text,youtube_id text,quiz_question text,quiz_options jsonb,quiz_answer text,quiz_explanation text,extra_data jsonb,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  return query select m.id,m.contributor_token,m.friend_name,m.unlock_at,m.content_type,m.title,m.body,m.image_path,m.youtube_id,m.quiz_question,m.quiz_options,m.quiz_answer,m.quiz_explanation,m.extra_data,m.created_at,m.updated_at
  from public.hd_memories m where m.contributor_token=p_contributor_token order by m.unlock_at,m.created_at;
end;
$$;

create or replace function public.hd_update_memory(
  p_friend_pin text,p_contributor_token uuid,p_id uuid,p_friend_name text,p_unlock_at timestamptz,p_content_type text,
  p_title text default '',p_body text default '',p_image_path text default '',p_youtube_id text default '',p_quiz_question text default '',
  p_quiz_options jsonb default '[]'::jsonb,p_quiz_answer text default '',p_quiz_explanation text default '',p_extra_data jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  perform public.hd_assert_active();
  perform public.hd_validate_memory(p_content_type,p_body,p_image_path,p_youtube_id,p_quiz_question,p_quiz_options,p_quiz_answer,p_quiz_explanation,p_extra_data);
  perform public.hd_assert_day_capacity(p_unlock_at,p_id);
  if p_content_type in ('sudoku','fact') and exists(select 1 from public.hd_memories m where m.id<>p_id and m.content_type=p_content_type and (m.unlock_at at time zone 'Europe/Stockholm')::date=(p_unlock_at at time zone 'Europe/Stockholm')::date) then raise exception 'Det finns redan den här typen den dagen'; end if;
  update public.hd_memories set friend_name=btrim(p_friend_name),unlock_at=p_unlock_at,content_type=p_content_type,title=left(coalesce(p_title,''),100),body=btrim(p_body),image_path=coalesce(p_image_path,''),youtube_id=coalesce(p_youtube_id,''),quiz_question=coalesce(p_quiz_question,''),quiz_options=coalesce(p_quiz_options,'[]'::jsonb),quiz_answer=coalesce(p_quiz_answer,''),quiz_explanation=coalesce(p_quiz_explanation,''),extra_data=coalesce(p_extra_data,'{}'::jsonb)
  where id=p_id and contributor_token=p_contributor_token;
  if not found then raise exception 'Bidraget kunde inte hittas'; end if;
  return true;
end;
$$;

create or replace function public.hd_delete_memory(p_friend_pin text,p_contributor_token uuid,p_id uuid)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  delete from public.hd_memories where id=p_id and contributor_token=p_contributor_token;
  if not found then raise exception 'Bidraget kunde inte hittas'; end if;
  return true;
end;
$$;

create or replace function public.hd_check_quiz(p_viewer_pin text,p_id uuid,p_question_index integer,p_answer text)
returns table(correct boolean,explanation text,correct_answer text) language plpgsql stable security definer set search_path=public,extensions as $$
declare v_memory public.hd_memories%rowtype; v_answers jsonb; v_explanations jsonb; v_expected text; v_explanation text; v_index integer;
begin
  if not coalesce(public.hd_pin_ok('viewer',p_viewer_pin),false) then raise exception 'Fel kod'; end if;
  select m.* into v_memory from public.hd_memories m where m.id=p_id and m.content_type='quiz' and m.unlock_at<=clock_timestamp();
  if not found then raise exception 'Miniquizet är fortfarande låst eller saknas'; end if;
  v_index:=greatest(0,coalesce(p_question_index,0));
  begin v_answers:=v_memory.quiz_answer::jsonb; exception when others then raise exception 'Miniquizets facit är ogiltigt'; end;
  begin v_explanations:=v_memory.quiz_explanation::jsonb; exception when others then v_explanations:='[]'::jsonb; end;
  if v_index>=jsonb_array_length(v_memory.quiz_options) then raise exception 'Frågan kunde inte hittas'; end if;
  v_expected:=coalesce(v_answers->>v_index,'');
  v_explanation:=coalesce(v_explanations->>v_index,'');
  return query select lower(btrim(v_expected))=lower(btrim(coalesce(p_answer,''))),v_explanation,v_expected;
end;
$$;

create or replace function public.hd_admin_memories(p_admin_pin text)
returns table(id uuid,contributor_token uuid,friend_name text,unlock_at timestamptz,content_type text,title text,body text,image_path text,youtube_id text,quiz_question text,quiz_options jsonb,quiz_answer text,quiz_explanation text,extra_data jsonb,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  return query select m.id,m.contributor_token,m.friend_name,m.unlock_at,m.content_type,m.title,m.body,m.image_path,m.youtube_id,m.quiz_question,m.quiz_options,m.quiz_answer,m.quiz_explanation,m.extra_data,m.created_at,m.updated_at
  from public.hd_memories m order by m.unlock_at,m.created_at;
end;
$$;

create or replace function public.hd_admin_update_memory(
  p_admin_pin text,p_id uuid,p_friend_name text,p_unlock_at timestamptz,p_content_type text,
  p_title text default '',p_body text default '',p_image_path text default '',p_youtube_id text default '',p_quiz_question text default '',
  p_quiz_options jsonb default '[]'::jsonb,p_quiz_answer text default '',p_quiz_explanation text default '',p_extra_data jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  perform public.hd_validate_memory(p_content_type,p_body,p_image_path,p_youtube_id,p_quiz_question,p_quiz_options,p_quiz_answer,p_quiz_explanation,p_extra_data);
  perform public.hd_assert_day_capacity(p_unlock_at,p_id);
  update public.hd_memories set friend_name=btrim(p_friend_name),unlock_at=p_unlock_at,content_type=p_content_type,title=left(coalesce(p_title,''),100),body=btrim(p_body),image_path=coalesce(p_image_path,''),youtube_id=coalesce(p_youtube_id,''),quiz_question=coalesce(p_quiz_question,''),quiz_options=coalesce(p_quiz_options,'[]'::jsonb),quiz_answer=coalesce(p_quiz_answer,''),quiz_explanation=coalesce(p_quiz_explanation,''),extra_data=coalesce(p_extra_data,'{}'::jsonb)
  where id=p_id;
  if not found then raise exception 'Bidraget kunde inte hittas'; end if;
  return true;
end;
$$;

create or replace function public.hd_admin_delete_memory(p_admin_pin text,p_id uuid)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  delete from public.hd_memories where id=p_id;
  if not found then raise exception 'Bidraget kunde inte hittas'; end if;
  return true;
end;
$$;

create or replace function public.hd_request_admin_help(p_friend_pin text,p_contributor_token uuid,p_memory_id uuid,p_request_type text,p_message text default '')
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  if p_request_type not in ('change','delete') then raise exception 'Ogiltig förfrågan'; end if;
  if not exists(select 1 from public.hd_memories where id=p_memory_id and contributor_token=p_contributor_token) then raise exception 'Händelsen kunde inte hittas'; end if;
  insert into public.hd_help_requests(memory_id,contributor_token,request_type,message,status)
  values(p_memory_id,p_contributor_token,p_request_type,left(coalesce(p_message,''),1000),'open')
  on conflict(memory_id,contributor_token) where status='open'
  do update set request_type=excluded.request_type,message=excluded.message,updated_at=clock_timestamp();
  return true;
end;
$$;

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

create or replace function public.hd_admin_settings(p_admin_pin text)
returns table(daily_limit integer,is_active boolean) language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  return query select s.daily_limit,s.is_active from public.hd_settings s where id=1;
end;
$$;

create or replace function public.hd_admin_update_settings(p_admin_pin text,p_daily_limit integer)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  update public.hd_settings set daily_limit=greatest(1,least(24,coalesce(p_daily_limit,6))),updated_at=clock_timestamp() where id=1;
  return true;
end;
$$;

create or replace function public.hd_admin_help_requests(p_admin_pin text)
returns table(id uuid,memory_id uuid,contributor_token uuid,request_type text,message text,status text,created_at timestamptz,memory jsonb)
language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  return query select r.id,r.memory_id,r.contributor_token,r.request_type,r.message,r.status,r.created_at,to_jsonb(m)
  from public.hd_help_requests r left join public.hd_memories m on m.id=r.memory_id
  where r.status='open' order by r.created_at desc;
end;
$$;

create or replace function public.hd_admin_resolve_help(p_admin_pin text,p_id uuid)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  update public.hd_help_requests set status='resolved' where id=p_id;
  if not found then raise exception 'Förfrågan kunde inte hittas'; end if;
  return true;
end;
$$;

create or replace function public.hd_viewer_image_path(p_viewer_pin text,p_id uuid)
returns text language plpgsql stable security definer set search_path=public,extensions as $$
declare v_path text;
begin
  if not coalesce(public.hd_pin_ok('viewer',p_viewer_pin),false) then raise exception 'Fel kod'; end if;
  select image_path into v_path from public.hd_memories where id=p_id and content_type='image' and unlock_at<=clock_timestamp();
  if coalesce(v_path,'')='' then raise exception 'Bilden är fortfarande låst eller saknas'; end if;
  return v_path;
end;
$$;

create or replace function public.hd_friend_image_path(p_friend_pin text,p_contributor_token uuid,p_id uuid)
returns text language plpgsql stable security definer set search_path=public,extensions as $$
declare v_path text;
begin
  if not coalesce(public.hd_verify_friend(p_friend_pin),false) then raise exception 'Fel kod'; end if;
  select image_path into v_path from public.hd_memories where id=p_id and contributor_token=p_contributor_token and content_type='image';
  if coalesce(v_path,'')='' then raise exception 'Bilden saknas'; end if;
  return v_path;
end;
$$;

create or replace function public.hd_admin_image_path(p_admin_pin text,p_id uuid)
returns text language plpgsql stable security definer set search_path=public,extensions as $$
declare v_path text;
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  select image_path into v_path from public.hd_memories where id=p_id and content_type='image';
  if coalesce(v_path,'')='' then raise exception 'Bilden saknas'; end if;
  return v_path;
end;
$$;

create or replace function public.hd_admin_delete_all(p_admin_pin text,p_confirmation text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not coalesce(public.hd_verify_admin(p_admin_pin),false) then raise exception 'Fel kod'; end if;
  if upper(btrim(coalesce(p_confirmation,'')))<>'AVSLUTA HÄNDELSER' then raise exception 'Skriv AVSLUTA HÄNDELSER för att bekräfta'; end if;
  delete from public.hd_help_requests;
  delete from public.hd_memories;
  update public.hd_settings set is_active=false,updated_at=clock_timestamp() where id=1;
  update public.hd_activity set changed_at=clock_timestamp() where id=1;
  return true;
end;
$$;

revoke all on function public.hd_pin_ok(text,text) from public;
revoke all on function public.hd_validate_memory(text,text,text,text,text,jsonb,text,text,jsonb) from public;
revoke all on function public.hd_assert_active() from public;
revoke all on function public.hd_assert_day_capacity(timestamptz,uuid) from public;

grant execute on function public.hd_verify_friend(text) to anon,authenticated;
grant execute on function public.hd_verify_admin(text) to anon,authenticated;
grant execute on function public.hd_server_clock(text) to anon,authenticated;
grant execute on function public.hd_timeline(text) to anon,authenticated;
grant execute on function public.hd_day_available(text,text,timestamptz,uuid) to anon,authenticated;
grant execute on function public.hd_day_capacity(text,timestamptz,uuid) to anon,authenticated;
grant execute on function public.hd_random_fact(text,text) to anon,authenticated;
grant execute on function public.hd_add_memory(text,uuid,text,timestamptz,text,text,text,text,text,text,jsonb,text,text,jsonb) to anon,authenticated;
grant execute on function public.hd_my_memories(text,uuid) to anon,authenticated;
grant execute on function public.hd_update_memory(text,uuid,uuid,text,timestamptz,text,text,text,text,text,text,jsonb,text,text,jsonb) to anon,authenticated;
grant execute on function public.hd_delete_memory(text,uuid,uuid) to anon,authenticated;
grant execute on function public.hd_check_quiz(text,uuid,integer,text) to anon,authenticated;
grant execute on function public.hd_admin_memories(text) to anon,authenticated;
grant execute on function public.hd_admin_update_memory(text,uuid,text,timestamptz,text,text,text,text,text,text,jsonb,text,text,jsonb) to anon,authenticated;
grant execute on function public.hd_admin_delete_memory(text,uuid) to anon,authenticated;
grant execute on function public.hd_request_admin_help(text,uuid,uuid,text,text) to anon,authenticated;
grant execute on function public.hd_viewer_presentation(text) to anon,authenticated;
grant execute on function public.hd_admin_presentation(text) to anon,authenticated;
grant execute on function public.hd_admin_update_presentation(text,text,text) to anon,authenticated;
grant execute on function public.hd_admin_settings(text) to anon,authenticated;
grant execute on function public.hd_admin_update_settings(text,integer) to anon,authenticated;
grant execute on function public.hd_admin_help_requests(text) to anon,authenticated;
grant execute on function public.hd_admin_resolve_help(text,uuid) to anon,authenticated;
grant execute on function public.hd_viewer_image_path(text,uuid) to anon,authenticated;
grant execute on function public.hd_friend_image_path(text,uuid,uuid) to anon,authenticated;
grant execute on function public.hd_admin_image_path(text,uuid) to anon,authenticated;
grant execute on function public.hd_admin_delete_all(text,text) to anon,authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='hd_activity'
  ) then
    alter publication supabase_realtime add table public.hd_activity;
  end if;
end $$;
