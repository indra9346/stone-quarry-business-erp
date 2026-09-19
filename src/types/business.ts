/**
 * Central business/quarry registry types.
 *
 * IMPORTANT: this is the ONLY place a "business code" is defined as a
 * union type. Every business-scoped table, route, Supabase client and
 * document-numbering prefix keys off this type, so a business can never
 * be referenced by a raw string that could typo into cross-tenant access.
 */
export type BusinessCode = 'kmg' | 'murudeshwara'

export const BUSINESS_CODES: readonly BusinessCode[] = ['kmg', 'murudeshwara']

export interface BusinessProfile {
  code: BusinessCode
  name: string
  legalName: string
  tagline: string
  /** Free-form location string shown on the gateway card. */
  location?: string
  documentPrefix: {
    quotation: string
    normalBill: string
    evBill: string
    payment: string
    trip: string
    expense: string
  }
  /** Whether the business is currently selectable on the Main Branch gateway. */
  active: boolean
}

/**
 * Lightweight, non-sensitive metadata only (Rule #34 — Main Branch must load
 * only lightweight business metadata, never operational data). Real business
 * profile fields (address, GST, logo, payment/UPI details) live in each
 * business's own `settings` table (see supabase/migrations/business-template)
 * and are fetched only AFTER the user is authenticated into that business.
 */
export const BUSINESS_REGISTRY: Record<BusinessCode, BusinessProfile> = {
  kmg: {
    code: 'kmg',
    name: 'KMG Stones',
    legalName: 'KMG Enterprises',
    tagline: 'Stone • Quarry • Factory',
    location: 'Chikkagollahalli, Devanahalli Taluk, Bangalore Rural',
    documentPrefix: {
      quotation: 'KMG-QT',
      normalBill: 'KMG-INV',
      evBill: 'KMG-EV',
      payment: 'KMG-PAY',
      trip: 'KMG-TRP',
      expense: 'KMG-EXP',
    },
    active: true,
  },
  murudeshwara: {
    code: 'murudeshwara',
    name: 'Murudeshwara Stones',
    legalName: 'Murudeshwara Stones',
    tagline: 'Stone • Quarry • Factory',
    documentPrefix: {
      quotation: 'MDS-QT',
      normalBill: 'MDS-INV',
      evBill: 'MDS-EV',
      payment: 'MDS-PAY',
      trip: 'MDS-TRP',
      expense: 'MDS-EXP',
    },
    active: true,
  },
}

export type UserRole = 'admin' | 'staff'

export interface BusinessAccessGrant {
  businessCode: BusinessCode
  role: UserRole
}
