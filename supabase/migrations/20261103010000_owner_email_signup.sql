alter table public.app_owner
  add column allowed_email text,
  add column owner_slot boolean not null default true;

update public.app_owner as owner
set allowed_email = lower(auth_user.email)
from auth.users as auth_user
where owner.user_id = auth_user.id
  and owner.allowed_email is null;

alter table public.app_owner
  drop constraint app_owner_pkey;

alter table public.app_owner
  alter column allowed_email set not null,
  alter column user_id drop not null,
  add constraint app_owner_pkey primary key (owner_slot),
  add constraint app_owner_single_slot check (owner_slot),
  add constraint app_owner_user_id_key unique (user_id);

create unique index app_owner_allowed_email_key
  on public.app_owner (lower(allowed_email));

create or replace function public.claim_owner()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_user uuid := auth.uid();
  claimed_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  rows_updated integer;
begin
  if claimed_user is null or claimed_email = '' then
    return false;
  end if;

  update public.app_owner
  set user_id = claimed_user
  where owner_slot
    and lower(allowed_email) = claimed_email
    and (user_id is null or user_id = claimed_user);

  get diagnostics rows_updated = row_count;
  return rows_updated = 1;
end;
$$;

revoke all on function public.claim_owner() from public, anon;
grant execute on function public.claim_owner() to authenticated;

-- Add the one permitted email before creating an account through Warmly.
-- insert into public.app_owner (allowed_email) values (lower('you@example.com'));
