-- ============================================================================
-- OPTIONAL development seed data for a business-template project.
-- NEVER run this against a production project. Clearly separate from
-- production data (Rule #58) — delete this file's contents (keep the file
-- empty) before go-live if you want to be extra safe.
-- ============================================================================

insert into materials (name, category, hsn_code, default_unit, is_dimension_based, dimension_calculation, default_rate)
values
  ('Temple Stone', 'block', '6802', 'piece', false, null, 60),
  ('Cutting Stone - Standard Slab', 'cutting_stone', '6802', 'sqft', true, 'area', 520),
  ('Raw Granite Block', 'raw_material', '2516', 'cuft', true, 'volume', 400)
on conflict do nothing;

insert into customers (customer_name, phone, city, state)
values
  ('Shree Anjaneya Swamy Temple, Sowmya Temple, Mandya', null, 'Mandya', 'Karnataka'),
  ('Nagesh Murudeshwara', null, null, 'Karnataka')
on conflict do nothing;

insert into vehicles (registration_number, vehicle_type, status)
values ('KA13C6489', 'Truck', 'available')
on conflict do nothing;
