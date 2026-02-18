-- 1. Create Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  email text,
  role text default 'user', -- 'admin', 'seller', 'logistics'
  full_name text,
  avatar_url text
);

-- 2. Enable RLS
alter table public.profiles enable row level security;

-- 3. Create Policies
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 4. Create Trigger Function for New Users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (new.id, new.email, 'user', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- 5. Attach Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Backfill Existing Users (Safe Insert)
insert into public.profiles (id, email, role)
select id, email, 'user'
from auth.users
on conflict (id) do nothing;

-- 7. Promote Admin User
update public.profiles
set role = 'admin'
where email = 'admin@puntourbano.cl';
