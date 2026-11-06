begin;

-- Preserve the existing private workspace owner and their local-cache import option.
update public.app_owner as owner
set user_id = auth_user.id
from auth.users as auth_user
where owner.user_id is null
  and lower(owner.allowed_email) = lower(auth_user.email);

alter table public.app_owner
  add column legacy_owner boolean not null default false;

update public.app_owner
set legacy_owner = true
where user_id is not null;

alter table public.contacts
  add column user_id uuid references auth.users (id) on delete cascade;
alter table public.activities
  add column user_id uuid references auth.users (id) on delete cascade;
alter table public.custom_fields
  add column user_id uuid references auth.users (id) on delete cascade;
alter table public.custom_values
  add column user_id uuid references auth.users (id) on delete cascade;

update public.contacts as contact
set user_id = owner.user_id
from public.app_owner as owner
where contact.user_id is null and owner.user_id is not null;

update public.activities as activity
set user_id = owner.user_id
from public.app_owner as owner
where activity.user_id is null and owner.user_id is not null;

update public.custom_fields as custom_field
set user_id = owner.user_id
from public.app_owner as owner
where custom_field.user_id is null and owner.user_id is not null;

update public.custom_values as custom_value
set user_id = owner.user_id
from public.app_owner as owner
where custom_value.user_id is null and owner.user_id is not null;

do $$
begin
  if exists (select 1 from public.contacts where user_id is null)
    or exists (select 1 from public.activities where user_id is null)
    or exists (select 1 from public.custom_fields where user_id is null)
    or exists (select 1 from public.custom_values where user_id is null) then
    raise exception 'Could not assign existing CRM data to its current owner';
  end if;
end;
$$;

alter table public.contacts alter column user_id set not null;
alter table public.activities alter column user_id set not null;
alter table public.custom_fields alter column user_id set not null;
alter table public.custom_values alter column user_id set not null;

alter table public.contacts
  add constraint contacts_id_user_id_key unique (id, user_id);

alter table public.custom_fields
  add constraint custom_fields_id_user_id_key unique (id, user_id);

alter table public.activities
  drop constraint activities_contact_id_fkey,
  add constraint activities_contact_owner_fkey
    foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade;

alter table public.custom_values
  drop constraint custom_values_contact_id_fkey,
  drop constraint custom_values_field_id_fkey,
  add constraint custom_values_contact_owner_fkey
    foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  add constraint custom_values_field_owner_fkey
    foreign key (field_id, user_id)
    references public.custom_fields (id, user_id) on delete cascade;

create index contacts_user_id_idx on public.contacts (user_id);
create index activities_user_id_idx on public.activities (user_id);
create index custom_fields_user_id_idx on public.custom_fields (user_id);
create index custom_values_user_id_idx on public.custom_values (user_id);

drop policy "Only the configured owner can access contacts" on public.contacts;
drop policy "Only the configured owner can access activities" on public.activities;
drop policy "Only the configured owner can access custom fields" on public.custom_fields;
drop policy "Only the configured owner can access custom values" on public.custom_values;

create policy "Users can access their own contacts"
  on public.contacts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can access their own activities"
  on public.activities for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can access their own custom fields"
  on public.custom_fields for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can access their own custom values"
  on public.custom_values for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

delete from public.app_owner where user_id is null;

drop index public.app_owner_allowed_email_key;

alter table public.app_owner
  drop constraint app_owner_pkey,
  drop constraint app_owner_single_slot,
  drop constraint app_owner_user_id_key,
  alter column user_id set not null,
  drop column allowed_email,
  drop column owner_slot,
  add constraint app_owner_pkey primary key (user_id);

insert into public.app_owner (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.create_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_owner (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_user_workspace() from public, anon, authenticated;

drop trigger if exists create_warmly_workspace on auth.users;
create trigger create_warmly_workspace
  after insert on auth.users
  for each row execute function public.create_user_workspace();

drop function if exists public.claim_owner();

commit;
