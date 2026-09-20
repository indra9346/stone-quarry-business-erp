import type { Permissions } from '@/lib/permissions'
/**
 * Row types for the business-template schema (supabase/migrations/
 * business-template). Hand-written from the migrations, which are the source
 * of truth. PostgREST returns `numeric` columns as JSON numbers.
 *
 * Every column that is nullable in the database is `| null` here — a NULL is
 * "not entered", never 0.
 */

export type StaffRole = 'admin' | 'staff'

export interface StaffProfile {
  user_id: string
  full_name: string
  phone: string | null
  role: StaffRole
  status: 'active' | 'inactive'
  /** Per-person module overrides (null = role defaults). See src/lib/permissions.ts. */
  permissions: Permissions | null
  created_at: string
  updated_at: string
}

export interface Unit {
  code: string
  label: string
  measurement_kind: 'count' | 'area' | 'volume' | 'weight' | 'other'
}

export type MaterialCategory = 'block' | 'cutting_stone' | 'raw_material' | 'finished' | 'other'

export interface Material {
  id: string
  name: string
  category: MaterialCategory
  hsn_code: string | null
  default_unit: string | null
  default_rate: number | null
  low_stock_threshold: number | null
  status: 'active' | 'inactive'
}

export interface Customer {
  id: string
  customer_code: string | null
  customer_name: string
  company_name: string | null
  phone: string | null
  alternate_phone: string | null
  email: string | null
  billing_address: string | null
  shipping_address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  gstin: string | null
  notes: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export type BillType = 'normal' | 'ev'

export interface Bill {
  id: string
  bill_type: BillType
  bill_number: string
  bill_number_source: 'manual' | 'generated'
  customer_id: string
  quotation_id: string | null
  bill_date: string
  party_name: string | null
  party_address: string | null
  party_gstin: string | null
  eway_bill_number: string | null
  vehicle_number: string | null
  vehicle_id: string | null
  trip_id: string | null
  cgst_percent: number | null
  sgst_percent: number | null
  igst_percent: number | null
  subtotal: number
  discount_amount: number | null
  cgst_amount: number | null
  sgst_amount: number | null
  igst_amount: number | null
  tax_amount: number
  other_charges: number | null
  grand_total: number
  amount_received: number
  balance_due: number
  payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'overpaid'
  status: 'active' | 'cancelled'
  ledger_posted_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
  notes: string | null
  extra_fields: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BillItem {
  id: string
  bill_id: string
  material_id: string | null
  description: string
  hsn_code: string | null
  quantity: number | null
  unit: string | null
  rate: number | null
  amount: number | null
  stock_item_id: string | null
  sort_order: number
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'

export interface Quotation {
  id: string
  quotation_number: string
  customer_id: string
  quotation_date: string
  valid_until: string | null
  status: QuotationStatus
  subtotal: number
  discount_amount: number
  tax_amount: number
  other_charges: number
  grand_total: number
  notes: string | null
  terms: string | null
  converted_bill_id: string | null
  created_at: string
}

export interface QuotationItem {
  id: string
  quotation_id: string
  material_id: string | null
  description: string
  hsn_code: string | null
  quantity: number | null
  unit: string | null
  rate: number | null
  amount: number | null
  sort_order: number
}

export interface MeasurementSheet {
  id: string
  sheet_number: string | null
  sheet_date: string | null
  customer_id: string | null
  party_name_text: string | null
  stated_total: number | null
  notes: string | null
  created_at: string
}

export interface MeasurementRow {
  id: string
  sheet_id: string
  row_no: number
  measurement_text: string
  pcs_text: string | null
  quantity: number | null
  rate: number | null
  amount: number | null
  sort_order: number
}

export interface MeasurementVerification {
  sheet_id: string
  sheet_number: string | null
  stated_total: number | null
  row_count: number
  rows_amount_sum: number | null
  difference: number | null
  rows_where_amount_differs_from_qty_x_rate: number
}

export type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'

export interface Payment {
  id: string
  payment_number: string
  customer_id: string
  bill_id: string | null
  payment_date: string
  amount: number
  payment_mode: PaymentMode
  reference_number: string | null
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export interface LedgerEntry {
  id: string
  entry_seq: number
  customer_id: string
  transaction_date: string
  transaction_type: 'bill' | 'payment' | 'adjustment' | 'opening_balance'
  reference_type: 'bill' | 'payment' | null
  reference_id: string | null
  description: string | null
  debit: number
  credit: number
  running_balance: number
  created_at: string
}

export interface StockItem {
  id: string
  material_id: string
  batch_code: string | null
  location: string | null
  unit: string | null
  quantity_on_hand: number
  created_at: string
}

export type StockMovementType =
  | 'opening_stock'
  | 'purchase'
  | 'receipt'
  | 'transfer'
  | 'processing'
  | 'sale'
  | 'consumption'
  | 'adjustment'
  | 'return'
  | 'damage'

export interface StockMovement {
  id: string
  stock_item_id: string
  movement_type: StockMovementType
  quantity_change: number
  previous_quantity: number
  new_quantity: number
  reference_type: string | null
  reference_id: string | null
  reason: string | null
  performed_by: string | null
  created_at: string
}

export interface StockBalance {
  stock_item_id: string
  material_id: string
  batch_code: string | null
  location: string | null
  unit: string | null
  opening_quantity: number
  received_quantity: number
  used_quantity: number
  adjustment_quantity: number
  current_quantity: number
  quantity_on_hand: number
}

export interface Driver {
  id: string
  driver_name: string
  phone: string | null
  license_number: string | null
  license_expiry: string | null
  address: string | null
  status: 'active' | 'inactive'
  notes: string | null
}

export type VehicleStatus = 'available' | 'on_trip' | 'maintenance' | 'inactive'

export interface Vehicle {
  id: string
  registration_number: string
  vehicle_type: string | null
  make_model: string | null
  default_driver_id: string | null
  capacity: string | null
  status: VehicleStatus
  notes: string | null
}

export type TripStatus = 'planned' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled'

export interface Trip {
  id: string
  trip_number: string
  vehicle_id: string
  driver_id: string | null
  customer_id: string | null
  bill_id: string | null
  material_id: string | null
  quantity: number | null
  unit: string | null
  pickup_location: string | null
  destination: string | null
  trip_date: string
  status: TripStatus
  notes: string | null
  created_at: string
}

export type ExpenseCategory =
  | 'fuel'
  | 'labour'
  | 'vehicle'
  | 'factory'
  | 'quarry'
  | 'maintenance'
  | 'electricity'
  | 'transport'
  | 'office'
  | 'other'

export interface Expense {
  id: string
  expense_number: string
  expense_date: string
  expense_time: string | null
  category: ExpenseCategory
  amount: number
  description: string | null
  vendor_name: string | null
  payment_mode: PaymentMode | null
  reference_number: string | null
  vehicle_id: string | null
  trip_id: string | null
  notes: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  module: string
  record_id: string | null
  previous_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export interface SettingRow {
  key: string
  value: Record<string, unknown>
  updated_at: string
}

/** A bill's lifecycle state, derived from status + ledger_posted_at. */
export type BillState = 'draft' | 'posted' | 'cancelled'

export function billState(b: Pick<Bill, 'status' | 'ledger_posted_at'>): BillState {
  if (b.status === 'cancelled') return 'cancelled'
  return b.ledger_posted_at ? 'posted' : 'draft'
}
