-- ============================================================================
-- Stock as a movement-based inventory (Rule #14/#17):
--
--   Current = Opening + Received - Used/Sold +/- Adjustments
--
-- Every change to a stock item's quantity is a row in stock_movements,
-- written ONLY by apply_stock_movement(). No client role holds UPDATE on
-- stock_items.quantity_on_hand or INSERT on stock_movements (see
-- 010_rls_policies.sql), so the quantity can never drift from its history.
--
-- No unit or dimension formula is invented here: quantities are plain
-- numbers in the unit the business assigns to the stock item.
-- ============================================================================

create table if not exists stock_items (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id),
  -- Optional identity for a specific physical block/slab batch.
  batch_code text,
  location text,
  unit text references units (code),
  quantity_on_hand numeric(14, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_nonnegative check (quantity_on_hand >= 0)
);
create trigger trg_stock_items_updated_at before update on stock_items
  for each row execute function set_updated_at();
create index if not exists idx_stock_items_material on stock_items (material_id);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references stock_items (id),
  movement_type text not null check (
    movement_type in (
      'opening_stock', 'purchase', 'receipt', 'transfer', 'processing',
      'sale', 'consumption', 'adjustment', 'return', 'damage'
    )
  ),
  quantity_change numeric(14, 3) not null,   -- signed: negative reduces stock
  previous_quantity numeric(14, 3) not null,
  new_quantity numeric(14, 3) not null,
  reference_type text,                        -- 'bill' | 'quotation' | 'manual' | ...
  reference_id uuid,
  reason text,
  performed_by uuid references staff_profiles (user_id),
  created_at timestamptz not null default now(),
  constraint stock_movement_nonzero check (quantity_change <> 0),
  constraint stock_movement_balances check (new_quantity = previous_quantity + quantity_change),
  -- Direction is fixed by the movement's meaning. transfer / processing /
  -- adjustment / return may legitimately go either way.
  constraint stock_movement_direction check (
    case
      when movement_type in ('opening_stock', 'purchase', 'receipt') then quantity_change > 0
      when movement_type in ('sale', 'consumption', 'damage') then quantity_change < 0
      else true
    end
  )
);
create index if not exists idx_stock_movements_item on stock_movements (stock_item_id, created_at);
create index if not exists idx_stock_movements_reference on stock_movements (reference_type, reference_id);

-- Applies a movement atomically: locks the stock_item row, checks for
-- negative stock (never permitted), updates quantity_on_hand,
-- and writes the history row.
--
-- SECURITY DEFINER because no client role may write quantity_on_hand or
-- insert movements directly; the explicit authorization check below
-- replaces what RLS would otherwise do. performed_by is taken from the
-- session (auth.uid()), never from a caller-supplied argument.
create or replace function apply_stock_movement(
  p_stock_item_id uuid,
  p_movement_type text,
  p_quantity_change numeric,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reason text default null
) returns stock_movements
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_prev numeric;
  v_new numeric;
  v_row stock_movements;
begin
  if not is_active_staff() then
    raise exception 'Not authorized to move stock';
  end if;

  select quantity_on_hand into v_prev from stock_items where id = p_stock_item_id for update;
  if v_prev is null then
    raise exception 'Stock item % not found', p_stock_item_id;
  end if;

  v_new := v_prev + p_quantity_change;
  if v_new < 0 then
    raise exception 'Insufficient stock: have %, requested change %', v_prev, p_quantity_change;
  end if;

  insert into stock_movements (
    stock_item_id, movement_type, quantity_change, previous_quantity,
    new_quantity, reference_type, reference_id, reason, performed_by
  ) values (
    p_stock_item_id, p_movement_type, p_quantity_change, v_prev,
    v_new, p_reference_type, p_reference_id, p_reason, auth.uid()
  ) returning * into v_row;

  update stock_items set quantity_on_hand = v_new where id = p_stock_item_id;

  return v_row;
end;
$$;

revoke execute on function apply_stock_movement(uuid, text, numeric, text, uuid, text) from public, anon;
grant execute on function apply_stock_movement(uuid, text, numeric, text, uuid, text) to authenticated;

-- Opening / received / used / adjustments / current, derived from the
-- movement history. `quantity_on_hand` must always equal `current_quantity`.
create or replace view stock_balances
with (security_invoker = true) as
select
  si.id as stock_item_id,
  si.material_id,
  si.batch_code,
  si.location,
  si.unit,
  coalesce(sum(m.quantity_change) filter (where m.movement_type = 'opening_stock'), 0) as opening_quantity,
  coalesce(sum(m.quantity_change) filter (where m.movement_type in ('purchase', 'receipt')), 0) as received_quantity,
  coalesce(-sum(m.quantity_change) filter (where m.movement_type in ('sale', 'consumption', 'damage')), 0) as used_quantity,
  coalesce(sum(m.quantity_change) filter (
    where m.movement_type in ('transfer', 'processing', 'adjustment', 'return')), 0) as adjustment_quantity,
  coalesce(sum(m.quantity_change), 0) as current_quantity,
  si.quantity_on_hand
from stock_items si
left join stock_movements m on m.stock_item_id = si.id
group by si.id;
