import type { Unit } from '@/types/db'

/**
 * Units commonly used when selling quarry and dressed stone in India. Offered
 * as a checklist in Settings → Stock; nothing is added unless an admin ticks it.
 * The "kind" only groups units for display: no conversion between units is ever
 * applied anywhere (quantities are always kept in the unit they were entered in).
 */
export const COMMON_QUARRY_UNITS: Unit[] = [
  { code: 'SQT', label: 'SQT (Square Feet)', measurement_kind: 'area' },
  { code: 't', label: 'Tonne', measurement_kind: 'weight' },
  { code: 'kg', label: 'Kilogram', measurement_kind: 'weight' },
  { code: 'm3', label: 'Cubic metre', measurement_kind: 'volume' },
  { code: 'cft', label: 'Cubic foot', measurement_kind: 'volume' },
  { code: 'brass', label: 'Brass (100 cubic feet)', measurement_kind: 'volume' },
  { code: 'm2', label: 'Square metre', measurement_kind: 'area' },
  { code: 'sqft', label: 'Square foot', measurement_kind: 'area' },
  { code: 'm', label: 'Metre', measurement_kind: 'other' },
  { code: 'rmt', label: 'Running metre', measurement_kind: 'other' },
  { code: 'ft', label: 'Foot', measurement_kind: 'other' },
  { code: 'rft', label: 'Running foot', measurement_kind: 'other' },
  { code: 'pcs', label: 'Piece', measurement_kind: 'count' },
  { code: 'load', label: 'Truck load', measurement_kind: 'count' },
]
