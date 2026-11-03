create extension if not exists pgcrypto;

create table public.app_owner (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  email text not null default '',
  company text not null default '—',
  role text not null default '',
  relationship text not null default 'Connection',
  notes text not null default '',
  created_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  type text not null check (type in ('outreach', 'response', 'call', 'connection')),
  happened_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  value_type text not null check (value_type in ('text', 'date')),
  created_at timestamptz not null default now()
);

create table public.custom_values (
  contact_id uuid not null references public.contacts (id) on delete cascade,
  field_id uuid not null references public.custom_fields (id) on delete cascade,
  value_text text,
  value_date date,
  primary key (contact_id, field_id),
  check (num_nonnulls(value_text, value_date) = 1)
);

create index activities_contact_date_idx on public.activities (contact_id, happened_on desc);

alter table public.app_owner enable row level security;
alter table public.contacts enable row level security;
alter table public.activities enable row level security;
alter table public.custom_fields enable row level security;
alter table public.custom_values enable row level security;

revoke all on public.app_owner from anon, authenticated;
revoke all on public.contacts, public.activities, public.custom_fields, public.custom_values from anon;
grant select on public.app_owner to authenticated;

create policy "Owner can verify their own account"
  on public.app_owner for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Only the configured owner can access contacts"
  on public.contacts for all to authenticated
  using (exists (select 1 from public.app_owner where user_id = (select auth.uid())))
  with check (exists (select 1 from public.app_owner where user_id = (select auth.uid())));

create policy "Only the configured owner can access activities"
  on public.activities for all to authenticated
  using (exists (select 1 from public.app_owner where user_id = (select auth.uid())))
  with check (exists (select 1 from public.app_owner where user_id = (select auth.uid())));

create policy "Only the configured owner can access custom fields"
  on public.custom_fields for all to authenticated
  using (exists (select 1 from public.app_owner where user_id = (select auth.uid())))
  with check (exists (select 1 from public.app_owner where user_id = (select auth.uid())));

create policy "Only the configured owner can access custom values"
  on public.custom_values for all to authenticated
  using (exists (select 1 from public.app_owner where user_id = (select auth.uid())))
  with check (exists (select 1 from public.app_owner where user_id = (select auth.uid())));

grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.custom_fields to authenticated;
grant select, insert, update, delete on public.custom_values to authenticated;

create function public.validate_custom_value_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_type text;
begin
  select value_type into expected_type
  from public.custom_fields
  where id = new.field_id;

  if expected_type is null then
    raise exception 'Custom field does not exist';
  end if;

  if expected_type = 'date' and (new.value_date is null or new.value_text is not null) then
    raise exception 'Date fields require a date value';
  elsif expected_type = 'text' and (new.value_text is null or new.value_date is not null) then
    raise exception 'Text fields require a text value';
  end if;
  return new;
end;
$$;

create trigger custom_values_check_type
  before insert or update on public.custom_values
  for each row execute function public.validate_custom_value_type();

-- After creating your one allowed Auth user, add that user's UUID here.
-- insert into public.app_owner (user_id) values ('YOUR_AUTH_USER_UUID');
