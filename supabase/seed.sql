-- ============================================================================
-- OPTIONAL development seed data for a business-template project.
-- NEVER run this against a production project (Rule #58).
--
-- Everything here is clearly labelled generic sample data. None of it comes
-- from a real business document: no real customer, vehicle, rate or unit is
-- seeded, and no measurement formula is implied.
-- ============================================================================

insert into units (code, label, measurement_kind)
values ('SAMPLE-UNIT', 'Sample Unit', 'other')
on conflict (code) do nothing;

insert into materials (name, category, default_unit)
values
  ('Sample Stone (cutting stone)', 'cutting_stone', 'SAMPLE-UNIT'),
  ('Sample Block', 'block', 'SAMPLE-UNIT');

insert into customers (customer_name, city, state)
values ('Sample Customer', 'Sample City', 'Sample State');

insert into vehicles (registration_number, vehicle_type, status)
values ('SAMPLE-VEHICLE-001', 'Sample Truck', 'available');
