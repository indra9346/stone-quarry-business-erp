import type { SupabaseClient } from '@supabase/supabase-js'
import { todayIST } from '@/lib/format'

/**
 * Seeds rich, realistic stone quarry business demo data into the current business's database.
 * Everything is fully connected with authentic industry workflows and relationships.
 */
export async function seedDemoData(client: SupabaseClient): Promise<{ count: number; message: string }> {
  // 1. Units
  const units = [
    { code: 'SQT', label: 'SQT (Square Feet)', measurement_kind: 'area' },
    { code: 't', label: 'Tonne', measurement_kind: 'weight' },
    { code: 'kg', label: 'Kilogram', measurement_kind: 'weight' },
    { code: 'cft', label: 'Cubic foot', measurement_kind: 'volume' },
    { code: 'brass', label: 'Brass (100 cu. ft)', measurement_kind: 'volume' },
    { code: 'pcs', label: 'Piece', measurement_kind: 'count' },
    { code: 'm2', label: 'Square metre', measurement_kind: 'area' },
  ]
  await client.from('units').upsert(units, { onConflict: 'code', ignoreDuplicates: true })

  // 2. Customers
  const customerRows = [
    {
      customer_name: 'Sri Murudeshwara Builders & Developers',
      company_name: 'Murudeshwara Infrastructure Pvt Ltd',
      phone: '+91 98451 23456',
      billing_address: 'NH-66, Near Temple Cross, Bhatkal, Karnataka - 581320',
      gstin: '29ABCDE1234F1Z5',
      city: 'Bhatkal',
      state: 'Karnataka',
      pincode: '581320',
      status: 'active',
      notes: 'Demo Stone Contractor - High Volume',
    },
    {
      customer_name: 'Rajesh Kumar - Granite Crafts',
      company_name: 'Rajesh Stone Works',
      phone: '+91 98452 34567',
      billing_address: 'Industrial Estate, Phase 2, Kundapura, Udupi - 576201',
      gstin: '29XYZPA5678Q1Z2',
      city: 'Kundapura',
      state: 'Karnataka',
      pincode: '576201',
      status: 'active',
      notes: 'Demo Monument & Flooring Fabricator',
    },
    {
      customer_name: 'Kaveri Stone & Highway Infrastructure',
      company_name: 'Kaveri Infra Projects',
      phone: '+91 98453 45678',
      billing_address: 'Bypass Highway Circle, Udupi, Karnataka - 576101',
      gstin: '29PQRST9876M1Z8',
      city: 'Udupi',
      state: 'Karnataka',
      pincode: '576101',
      status: 'active',
      notes: 'Demo Road & Flyover Contractor',
    },
  ]
  const custRes = await client.from('customers').upsert(customerRows, { onConflict: 'customer_name' }).select()
  const custs = (custRes.data ?? []) as { id: string; customer_name: string }[]
  const primaryCust = custs[0] || (await client.from('customers').select('id, customer_name').limit(1).single()).data

  // 3. Materials
  const materials = [
    {
      name: 'Cut Stone Slabs 6380',
      category: 'cutting_stone',
      hsn_code: '6380',
      default_unit: 'SQT',
      default_rate: 150,
      low_stock_threshold: 100,
      status: 'active',
    },
    {
      name: 'Rough Granite Blocks',
      category: 'block',
      hsn_code: '6380',
      default_unit: 'cft',
      default_rate: 450,
      low_stock_threshold: 50,
      status: 'active',
    },
    {
      name: '20mm Jelly Aggregate',
      category: 'raw_material',
      hsn_code: '2517',
      default_unit: 't',
      default_rate: 380,
      low_stock_threshold: 200,
      status: 'active',
    },
    {
      name: 'Quarry Dust / M-Sand',
      category: 'raw_material',
      hsn_code: '2517',
      default_unit: 't',
      default_rate: 260,
      low_stock_threshold: 150,
      status: 'active',
    },
  ]
  await client.from('materials').upsert(materials, { onConflict: 'name', ignoreDuplicates: true })
  const matRes = await client.from('materials').select('id, name')
  const mats = (matRes.data ?? []) as { id: string; name: string }[]

  // 4. Vehicles & Drivers
  const vehicles = [
    { vehicle_number: 'KA-47-M-1122', vehicle_type: 'tipper', make_model: 'Ashok Leyland 2820', status: 'active' },
    { vehicle_number: 'KA-20-B-3344', vehicle_type: 'dumper', make_model: 'Tata Prima Heavy 3530', status: 'active' },
  ]
  await client.from('vehicles').upsert(vehicles, { onConflict: 'vehicle_number', ignoreDuplicates: true })
  const vehRes = await client.from('vehicles').select('id, vehicle_number')
  const vehList = (vehRes.data ?? []) as { id: string; vehicle_number: string }[]

  const drivers = [
    { full_name: 'Ramesh Poojary', phone: '+91 98451 11223', license_number: 'KA47-20150001', status: 'active' },
    { full_name: 'Suresh Gowda', phone: '+91 98452 22334', license_number: 'KA20-20180002', status: 'active' },
  ]
  await client.from('drivers').upsert(drivers, { onConflict: 'full_name', ignoreDuplicates: true })
  const drvRes = await client.from('drivers').select('id, full_name')
  const drvList = (drvRes.data ?? []) as { id: string; full_name: string }[]

  // 5. Stock Items
  if (mats.length > 0) {
    const stockItems = mats.map((m, i) => ({
      material_id: m.id,
      batch_code: `BATCH-2026-0${i + 1}`,
      location: 'Yard A - North Bench',
      unit: i === 0 ? 'SQT' : i === 1 ? 'cft' : 't',
    }))
    await client.from('stock_items').upsert(stockItems, { onConflict: 'batch_code', ignoreDuplicates: true })
  }

  // 6. Quotation (Draft / Accepted)
  if (primaryCust) {
    const qNum = `QT-2026-DEMO1`
    const { data: qExisting } = await client.from('quotations').select('id').eq('quotation_number', qNum).maybeSingle()
    if (!qExisting) {
      const qInsert = await client
        .from('quotations')
        .insert({
          quotation_number: qNum,
          customer_id: primaryCust.id,
          quotation_date: todayIST(),
          status: 'accepted',
          subtotal: 7500,
          discount_amount: 0,
          tax_amount: 375,
          other_charges: 0,
          grand_total: 7875,
          notes: 'Demo Stone Quarry Quotation: Cut Stone Benches',
          terms: 'Standard delivery terms. Payment within 15 days of invoice.',
        })
        .select()
        .single()

      if (qInsert.data) {
        await client.from('quotation_items').insert([
          {
            quotation_id: qInsert.data.id,
            description: "10' × 12\" × 6\"",
            hsn_code: '6380',
            quantity: 25,
            unit: 'SQT',
            rate: 150,
            amount: 3750,
            sort_order: 0,
          },
          {
            quotation_id: qInsert.data.id,
            description: "8' × 18\" × 4\"",
            hsn_code: '6380',
            quantity: 25,
            unit: 'SQT',
            rate: 150,
            amount: 3750,
            sort_order: 1,
          },
        ])
      }
    }

    // 7. Bill (Normal Sales Bill)
    const billNum = `INV-2026-DEMO1`
    const { data: bExisting } = await client.from('bills').select('id').eq('bill_number', billNum).maybeSingle()
    if (!bExisting) {
      const bInsert = await client
        .from('bills')
        .insert({
          bill_type: 'normal',
          bill_number: billNum,
          bill_number_source: 'manual',
          customer_id: primaryCust.id,
          bill_date: todayIST(),
          party_name: primaryCust.customer_name,
          vehicle_number: vehList[0]?.vehicle_number || 'KA-47-M-1122',
          vehicle_id: vehList[0]?.id || null,
          eway_bill_number: '241890123456',
          cgst_percent: 2.5,
          sgst_percent: 2.5,
          notes: 'Demo Quarry Dispatch: 50 Pieces 6380 Slabs',
        })
        .select()
        .single()

      if (bInsert.data) {
        await client.from('bill_items').insert([
          {
            bill_id: bInsert.data.id,
            description: "10' × 12\" × 6\"",
            hsn_code: '6380',
            quantity: 30,
            unit: 'SQT',
            rate: 150,
            amount: 4500,
            sort_order: 0,
          },
          {
            bill_id: bInsert.data.id,
            description: "12' × 14\" × 6\"",
            hsn_code: '6380',
            quantity: 20,
            unit: 'SQT',
            rate: 150,
            amount: 3000,
            sort_order: 1,
          },
        ])
      }
    }

    // 8. Measurement Sheet
    const sheetNum = `MS-2026-DEMO1`
    const { data: msExisting } = await client.from('measurement_sheets').select('id').eq('sheet_number', sheetNum).maybeSingle()
    if (!msExisting) {
      const msInsert = await client
        .from('measurement_sheets')
        .insert({
          sheet_number: sheetNum,
          sheet_date: todayIST(),
          customer_id: primaryCust.id,
          party_name_text: primaryCust.customer_name,
          stated_total: 137280,
          notes: 'Demo Field Measurement Tally - Quarry Bench 3',
        })
        .select()
        .single()

      if (msInsert.data) {
        await client.from('measurement_sheet_rows').insert([
          { sheet_id: msInsert.data.id, measurement_text: '54 × 24 × 09', pcs_text: 'M', quantity: 108, rate: 520, amount: 56160 },
          { sheet_id: msInsert.data.id, measurement_text: '52 × 18 × 9.5"', pcs_text: 'M', quantity: 78, rate: 520, amount: 40560 },
          { sheet_id: msInsert.data.id, measurement_text: '45 × 18 × 12"', pcs_text: 'M', quantity: 67.5, rate: 600, amount: 40560 },
        ])
      }
    }
  }

  // 9. Expenses
  const expNum = `EXP-2026-DEMO1`
  const { data: expExisting } = await client.from('expenses').select('id').eq('expense_number', expNum).maybeSingle()
  if (!expExisting) {
    await client.from('expenses').insert({
      expense_number: expNum,
      expense_date: todayIST(),
      category: 'fuel',
      amount: 4500,
      payment_mode: 'bank_transfer',
      paid_to: 'Indian Oil Fuel Station Bhatkal',
      vehicle_id: vehList[0]?.id || null,
      notes: 'Diesel for Tipper KA-47-M-1122 haulage',
    })
  }

  // 10. Trips
  const tripNum = `TRP-2026-DEMO1`
  const { data: trpExisting } = await client.from('trips').select('id').eq('trip_number', tripNum).maybeSingle()
  if (!trpExisting && vehList[0] && drvList[0]) {
    await client.from('trips').insert({
      trip_number: tripNum,
      trip_date: todayIST(),
      vehicle_id: vehList[0].id,
      driver_id: drvList[0].id,
      customer_id: primaryCust?.id || null,
      material_id: mats[0]?.id || null,
      destination: 'Bhatkal Highway Site',
      net_weight: 18.5,
      unit: 't',
      freight_rate: 650,
      freight_amount: 12025,
      status: 'completed',
    })
  }

  return { count: 10, message: 'Stone Quarry demo data seeded successfully with full component relationships.' }
}

/**
 * Clears demo records prefixed with DEMO from the database.
 */
export async function clearDemoData(client: SupabaseClient): Promise<{ message: string }> {
  await client.from('trips').delete().ilike('trip_number', '%DEMO%')
  await client.from('expenses').delete().ilike('expense_number', '%DEMO%')
  await client.from('measurement_sheets').delete().ilike('sheet_number', '%DEMO%')
  await client.from('quotations').delete().ilike('quotation_number', '%DEMO%')
  await client.from('bills').delete().ilike('bill_number', '%DEMO%')
  await client.from('customers').delete().ilike('notes', '%Demo%')
  return { message: 'Demo records cleaned up successfully.' }
}
