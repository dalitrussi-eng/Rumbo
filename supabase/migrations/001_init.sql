create extension if not exists pgcrypto;

create table profiles(id uuid primary key references auth.users on delete cascade, name text not null default 'Viajero', avatar_color text default '#5980a6');
create table trips(id uuid primary key default gen_random_uuid(), name text not null, destination text not null, start_date date, end_date date, budget_cap numeric not null default 0, owner_id uuid not null default auth.uid() references profiles(id), created_at timestamptz default now());
create table trip_members(trip_id uuid references trips on delete cascade, user_id uuid references profiles on delete cascade, role text not null default 'member' check (role in ('owner','member')), joined_at timestamptz default now(), primary key(trip_id,user_id));
create table invites(token text primary key default encode(gen_random_bytes(12),'hex'), trip_id uuid not null references trips on delete cascade, created_by uuid default auth.uid(), expires_at timestamptz default now()+interval '7 days');
create table bookings(id uuid primary key default gen_random_uuid(), trip_id uuid not null references trips on delete cascade, kind text not null default 'otro' check (kind in ('vuelo','alojamiento','auto','actividad','otro')), title text not null, detail text, date date, time time, confirmation_code text, price numeric default 0, paid boolean not null default false, paid_by uuid references profiles(id), created_by uuid default auth.uid());
create table expenses(id uuid primary key default gen_random_uuid(), trip_id uuid not null references trips on delete cascade, category text not null default 'otros' check (category in ('alojamiento','vuelos','actividades','auto','comida','otros')), description text not null, amount numeric not null, paid_by uuid references profiles(id), split_between uuid[] not null default '{}', date date default current_date, booking_id uuid references bookings on delete set null);
create table places(id uuid primary key default gen_random_uuid(), trip_id uuid not null references trips on delete cascade, name text not null, category text not null default 'otro' check (category in ('bodega','comer','paseo','otro')), note text, distance_km numeric, maps_url text, saved_by uuid default auth.uid() references profiles(id), in_plan boolean not null default false);
create table place_votes(place_id uuid references places on delete cascade, user_id uuid default auth.uid() references profiles(id), primary key(place_id,user_id));
create table todos(id uuid primary key default gen_random_uuid(), trip_id uuid not null references trips on delete cascade, title text not null, due_label text, phase text not null default 'antes' check (phase in ('antes','alla')), assignee_ids uuid[] not null default '{}', done boolean not null default false, done_at timestamptz, created_by uuid default auth.uid());

create index on trip_members(user_id);
create index on bookings(trip_id,date); create index on expenses(trip_id); create index on places(trip_id);
create index on todos(trip_id); create index on invites(trip_id);

create function is_member(t uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from trip_members where trip_id=t and user_id=auth.uid()) $$;

create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,name) values(new.id, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1), 'Viajero')) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function add_owner_member() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into trip_members(trip_id,user_id,role) values(new.id,new.owner_id,'owner'); return new; end $$;
create trigger on_trip_created after insert on trips for each row execute function add_owner_member();

create function accept_invite(p_token text) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid; begin
 select trip_id into t from invites where token=p_token and expires_at>now();
 if t is null then raise exception 'Invitación inválida o vencida'; end if;
 insert into trip_members(trip_id,user_id) values(t,auth.uid()) on conflict do nothing; return t; end $$;

create function booking_paid_to_expense() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.paid and (tg_op='INSERT' or not old.paid) and not exists(select 1 from expenses where booking_id=new.id) then
  insert into expenses(trip_id,category,description,amount,paid_by,split_between,date,booking_id)
  values(new.trip_id, case new.kind when 'vuelo' then 'vuelos' when 'actividad' then 'actividades' when 'otro' then 'otros' else new.kind end,
   new.title, coalesce(new.price,0), coalesce(new.paid_by,new.created_by), (select coalesce(array_agg(user_id),'{}') from trip_members where trip_id=new.trip_id), coalesce(new.date,current_date), new.id);
 elsif not new.paid and tg_op='UPDATE' and old.paid then delete from expenses where booking_id=new.id; end if;
 return new; end $$;
create trigger on_booking_paid after insert or update on bookings for each row execute function booking_paid_to_expense();

alter table profiles enable row level security; alter table trips enable row level security; alter table trip_members enable row level security;
alter table invites enable row level security; alter table place_votes enable row level security;
create policy p_sel on profiles for select to authenticated using (true);
create policy p_ins on profiles for insert to authenticated with check (id=auth.uid());
create policy p_upd on profiles for update to authenticated using (id=auth.uid());
create policy t_sel on trips for select to authenticated using (is_member(id) or owner_id=auth.uid());
create policy t_ins on trips for insert to authenticated with check (owner_id=auth.uid());
create policy t_upd on trips for update to authenticated using (is_member(id));
create policy t_del on trips for delete to authenticated using (owner_id=auth.uid());
create policy m_sel on trip_members for select to authenticated using (is_member(trip_id));
create policy m_del on trip_members for delete to authenticated using (exists(select 1 from trips where id=trip_id and owner_id=auth.uid()) and role<>'owner');
create policy i_sel on invites for select to authenticated using (is_member(trip_id));
create policy i_ins on invites for insert to authenticated with check (is_member(trip_id));
create policy v_all on place_votes for all to authenticated using (exists(select 1 from places p where p.id=place_id and is_member(p.trip_id))) with check (user_id=auth.uid() and exists(select 1 from places p where p.id=place_id and is_member(p.trip_id)));
do $$ declare x text; begin foreach x in array array['bookings','expenses','places','todos'] loop
 execute format('alter table %I enable row level security', x);
 execute format('create policy %I on %I for all to authenticated using (is_member(trip_id)) with check (is_member(trip_id))', x||'_all', x);
end loop; end $$;

alter table bookings replica identity full; alter table expenses replica identity full; alter table places replica identity full;
alter table todos replica identity full; alter table place_votes replica identity full; alter table trip_members replica identity full;
alter publication supabase_realtime add table bookings, expenses, places, place_votes, todos, trip_members;
