-- Table for local cost multipliers per U.S. state (RPP-like factor)
create table if not exists public.state_rpp (
  state_code text primary key,          -- e.g., 'FL'
  state_name text not null,             -- e.g., 'Florida'
  rpp_factor numeric(6,4) not null,     -- 1.0000 = national baseline
  updated_at timestamptz default now()
);

-- Demo seed values (replace later with official BEA values)
insert into public.state_rpp(state_code, state_name, rpp_factor) values
('AL','Alabama', 0.9500) on conflict (state_code) do nothing,
('AZ','Arizona', 0.9800) on conflict (state_code) do nothing,
('CA','California', 1.1200) on conflict (state_code) do nothing,
('FL','Florida', 0.9900) on conflict (state_code) do nothing,
('NY','New York', 1.1500) on conflict (state_code) do nothing,
('TX','Texas', 0.9700) on conflict (state_code) do nothing;

alter table public.state_rpp enable row level security;

-- PUBLIC read for anon (safe: read-only multipliers)
create policy "select rpp for anon" on public.state_rpp
for select to anon using (true);
