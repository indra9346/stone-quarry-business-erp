import { useBusinessContext } from '@/features/auth/businessContextValue'
import { listMaterials, listSettings, listUnits, pickCustomers, pickVehicles, staffNames } from '@/services/catalog'
import { useBizQuery } from './useBiz'

export function useUnits() {
  return useBizQuery(['units'], listUnits, { staleTime: 300_000 })
}
export function useMaterials() {
  return useBizQuery(['materials'], listMaterials, { staleTime: 120_000 })
}
export function useCustomerPicker() {
  return useBizQuery(['customers', 'picker'], pickCustomers, { staleTime: 60_000 })
}
export function useVehiclePicker() {
  return useBizQuery(['vehicles', 'picker'], pickVehicles, { staleTime: 60_000 })
}
export function useStaffNames() {
  return useBizQuery(['staff', 'names'], staffNames, { staleTime: 300_000 })
}
export function useSettings() {
  return useBizQuery(['settings'], listSettings, { staleTime: 60_000 })
}

export interface BusinessProfileSetting {
  name: string
  address: string
  phone: string
  email: string
  gstin: string
}

/** Letterhead details: the business's own `settings.business_profile`, falling back to the registry name. */
export function useBusinessLetterhead(): BusinessProfileSetting {
  const { profile } = useBusinessContext()
  const settings = useSettings()
  const p = (settings.data?.business_profile ?? {}) as Partial<BusinessProfileSetting>
  return {
    name: p.name?.trim() || profile.legalName,
    address: p.address?.trim() || profile.location || '',
    phone: p.phone?.trim() || '',
    email: p.email?.trim() || '',
    gstin: p.gstin?.trim() || '',
  }
}

/** Prefix configured in settings.document_prefixes for numbers the system generates. */
export function usePrefix(kind: 'quotation' | 'normal_bill' | 'payment' | 'trip' | 'expense'): string {
  const settings = useSettings()
  const prefixes = (settings.data?.document_prefixes ?? {}) as Record<string, string>
  return prefixes[kind] || { quotation: 'QT', normal_bill: 'INV', payment: 'PAY', trip: 'TRP', expense: 'EXP' }[kind]
}
