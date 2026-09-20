import type { CsvColumn } from './csv'
import { formatDate, formatTime } from './format'
import { billState } from '@/types/db'
import type { Customer, LedgerEntry } from '@/types/db'
import type { BillRow } from '@/services/bills'
import type { ExpenseRow, PaymentRow } from '@/services/finance'
import type { QuotationRow } from '@/services/documents'
import type { StockRow } from '@/services/operations'

/**
 * Column sets for the CSV exports. Money and quantities are plain numbers
 * (no ₹ sign, no thousands separators) so a spreadsheet can add them up;
 * dates use the on-screen DD-MM-YYYY; a value that is NULL in the database is
 * an empty cell, never 0.
 */
const d = (v: string | null | undefined) => (v ? formatDate(v) : '')

export const billColumns: CsvColumn<BillRow>[] = [
  { header: 'Bill number', value: (b) => b.bill_number },
  { header: 'Type', value: (b) => (b.bill_type === 'ev' ? 'EV' : 'Normal') },
  { header: 'Bill date', value: (b) => d(b.bill_date) },
  { header: 'Time recorded', value: (b) => formatTime(b.created_at) },
  { header: 'Customer', value: (b) => b.customers?.customer_name },
  { header: 'Party name on bill', value: (b) => b.party_name },
  { header: 'Party GSTIN', value: (b) => b.party_gstin },
  { header: 'Vehicle number', value: (b) => b.vehicle_number },
  { header: 'E-Way bill number', value: (b) => b.eway_bill_number },
  { header: 'Subtotal', value: (b) => b.subtotal },
  { header: 'Discount', value: (b) => b.discount_amount },
  { header: 'CGST %', value: (b) => b.cgst_percent },
  { header: 'CGST amount', value: (b) => b.cgst_amount },
  { header: 'SGST %', value: (b) => b.sgst_percent },
  { header: 'SGST amount', value: (b) => b.sgst_amount },
  { header: 'IGST %', value: (b) => b.igst_percent },
  { header: 'IGST amount', value: (b) => b.igst_amount },
  { header: 'Other charges', value: (b) => b.other_charges },
  { header: 'Grand total', value: (b) => b.grand_total },
  { header: 'Amount received', value: (b) => b.amount_received },
  { header: 'Balance due', value: (b) => b.balance_due },
  { header: 'Payment status', value: (b) => b.payment_status },
  { header: 'Status', value: (b) => billState(b) },
]

export const quotationColumns: CsvColumn<QuotationRow>[] = [
  { header: 'Quotation number', value: (q) => q.quotation_number },
  { header: 'Date', value: (q) => d(q.quotation_date) },
  { header: 'Time recorded', value: (q) => formatTime(q.created_at) },
  { header: 'Valid until', value: (q) => d(q.valid_until) },
  { header: 'Customer', value: (q) => q.customers?.customer_name },
  { header: 'Status', value: (q) => q.status },
  { header: 'Subtotal', value: (q) => q.subtotal },
  { header: 'Discount', value: (q) => q.discount_amount },
  { header: 'Tax', value: (q) => q.tax_amount },
  { header: 'Other charges', value: (q) => q.other_charges },
  { header: 'Grand total', value: (q) => q.grand_total },
]

export const customerColumns: CsvColumn<Customer>[] = [
  { header: 'Customer', value: (c) => c.customer_name },
  { header: 'Company', value: (c) => c.company_name },
  { header: 'Phone', value: (c) => c.phone },
  { header: 'Alternate phone', value: (c) => c.alternate_phone },
  { header: 'Email', value: (c) => c.email },
  { header: 'GSTIN', value: (c) => c.gstin },
  { header: 'Billing address', value: (c) => c.billing_address },
  { header: 'City', value: (c) => c.city },
  { header: 'State', value: (c) => c.state },
  { header: 'Pincode', value: (c) => c.pincode },
  { header: 'Status', value: (c) => c.status },
  { header: 'Notes', value: (c) => c.notes },
]

export const paymentColumns: CsvColumn<PaymentRow>[] = [
  { header: 'Payment number', value: (p) => p.payment_number },
  { header: 'Date', value: (p) => d(p.payment_date) },
  { header: 'Time recorded', value: (p) => formatTime(p.created_at) },
  { header: 'Customer', value: (p) => p.customers?.customer_name },
  { header: 'Against bill', value: (p) => p.bills?.bill_number },
  { header: 'Amount', value: (p) => p.amount },
  { header: 'Mode', value: (p) => p.payment_mode },
  { header: 'Reference number', value: (p) => p.reference_number },
  { header: 'Notes', value: (p) => p.notes },
]

export const ledgerColumns: CsvColumn<LedgerEntry>[] = [
  { header: 'Entry no.', value: (e) => e.entry_seq },
  { header: 'Date', value: (e) => d(e.transaction_date) },
  { header: 'Time recorded', value: (e) => formatTime(e.created_at) },
  { header: 'Type', value: (e) => e.transaction_type },
  { header: 'Description', value: (e) => e.description },
  { header: 'Debit', value: (e) => e.debit },
  { header: 'Credit', value: (e) => e.credit },
  { header: 'Running balance', value: (e) => e.running_balance },
]

export const expenseColumns: CsvColumn<ExpenseRow>[] = [
  { header: 'Expense number', value: (e) => e.expense_number },
  { header: 'Date', value: (e) => d(e.expense_date) },
  { header: 'Time', value: (e) => e.expense_time?.slice(0, 5) },
  { header: 'Category', value: (e) => e.category },
  { header: 'Vehicle', value: (e) => e.vehicles?.registration_number },
  { header: 'Amount', value: (e) => e.amount },
  { header: 'Vendor', value: (e) => e.vendor_name },
  { header: 'Description', value: (e) => e.description },
  { header: 'Payment mode', value: (e) => e.payment_mode },
  { header: 'Reference number', value: (e) => e.reference_number },
]

export const stockColumns: CsvColumn<StockRow>[] = [
  { header: 'Material', value: (r) => r.materials?.name },
  { header: 'Category', value: (r) => r.materials?.category },
  { header: 'Batch code', value: (r) => r.batch_code },
  { header: 'Location', value: (r) => r.location },
  { header: 'Unit', value: (r) => r.unit },
  { header: 'Opening', value: (r) => r.opening_quantity },
  { header: 'Received', value: (r) => r.received_quantity },
  { header: 'Used / sold', value: (r) => r.used_quantity },
  { header: 'Adjustments', value: (r) => r.adjustment_quantity },
  { header: 'Current', value: (r) => r.current_quantity },
]
