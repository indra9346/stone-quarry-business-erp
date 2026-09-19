-- ============================================================================
-- Stock as a real inventory system (Rule #14/#17), not a single quantity
-- field. Every change is a traceable stock_movement row.
-- ============================================================================

create table if not exists stock_items (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id),
  -- Optional identity for a specific physical block/slab batch.
  batch_code text,
  location text,
  unit text not null references units (code),
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
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_movements_item on stock_movements (stock_item_id);
create index if not exists idx_stock_movements_reference on stock_movements (reference_type, reference_id);

-- Applies a movement atomically: locks the stock_item row, checks for
-- negative stock (unless explicitly permitted), updates quantity_on_hand,
-- and writes the audit trail row. ALWAYS use this function to change stock
-- — never update stock_items.quantity_on_hand directly (Rule #17/#43).
create or replace function apply_stock_movement(
  p_stock_item_id uuid,
  p_movement_type text,
  p_quantity_change numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_reason text,
  p_performed_by uuid,
  p_allow_negative boolean default false
) returns stock_movements
language plpgsql as $$
declare
  v_prev numeric;
  v_new numeric;
  v_row stock_movements;
begin
  select quantity_on_hand into v_prev from stock_items where id = p_stock_item_id for update;
  if v_prev is null then
    raise exception 'Stock item % not found', p_stock_item_id;
  end if;

  v_new := v_prev + p_quantity_change;
  if v_new < 0 and not p_allow_negative then
    raise exception 'Insufficient stock: have %, requested change %', v_prev, p_quantity_change;
  end if;

  update stock_items set quantity_on_hand = v_new where id = p_stock_item_id;

  insert into stock_movements (
    stock_item_id, movement_type, quantity_change, previous_quantity,
    new_quantity, reference_type, reference_id, reason, performed_by
  ) values (
    p_stock_item_id, p_movement_type, p_quantity_change, v_prev,
    v_new, p_reference_type, p_reference_id, p_reason, p_performed_by
  ) returning * into v_row;

  return v_row;
end;
$$;
