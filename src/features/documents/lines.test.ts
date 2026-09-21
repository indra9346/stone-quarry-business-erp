import { describe, expect, it } from 'vitest'
import { draftsToInputs, formatParticulars, newLine, rowsToDrafts } from './lines'

describe('Stone Quarry Document Lines & Dimensions', () => {
  it('creates new line with default HSN 6380 and Unit SQT', () => {
    const l = newLine()
    expect(l.hsn).toBe('6380')
    expect(l.unit).toBe('SQT')
    expect(l.feet).toBe('')
    expect(l.inches1).toBe('')
    expect(l.inches2).toBe('')
    expect(l.quantity).toBe('')
    expect(l.rate).toBe('')
  })

  it('formats stone dimensions [Feet] × [Inches] × [Inches] into particulars', () => {
    const l = newLine({ feet: '10', inches1: '12', inches2: '6' })
    expect(formatParticulars(l)).toBe("10' × 12\" × 6\"")
  })

  it('converts typed drafts to valid database inputs with calculated amounts', () => {
    const lines = [
      newLine({ feet: '10', inches1: '12', inches2: '6', quantity: '20', rate: '150' }),
      newLine({ feet: '8', inches1: '18', inches2: '4', quantity: '10', rate: '120' }),
    ]
    const { items, errors } = draftsToInputs(lines)
    expect(errors).toHaveLength(0)
    expect(items).toHaveLength(2)

    expect(items[0]).toEqual({
      description: "10' × 12\" × 6\"",
      hsn_code: '6380',
      quantity: 20,
      unit: 'SQT',
      rate: 150,
    })

    expect(items[1]).toEqual({
      description: "8' × 18\" × 4\"",
      hsn_code: '6380',
      quantity: 10,
      unit: 'SQT',
      rate: 120,
    })
  })

  it('parses existing dimension descriptions back into feet and inches in rowsToDrafts', () => {
    const rows = [
      { description: "10' × 12\" × 6\"", hsn_code: '6380', quantity: 25, unit: 'SQT', rate: 150 },
      { description: '5 × 10 × 8', hsn_code: '6380', quantity: 15, unit: 'SQT', rate: 100 },
    ]
    const drafts = rowsToDrafts(rows)
    expect(drafts[0]?.feet).toBe('10')
    expect(drafts[0]?.inches1).toBe('12')
    expect(drafts[0]?.inches2).toBe('6')
    expect(drafts[0]?.quantity).toBe('25')

    expect(drafts[1]?.feet).toBe('5')
    expect(drafts[1]?.inches1).toBe('10')
    expect(drafts[1]?.inches2).toBe('8')
  })

  it('provides default stone description when dimensions are omitted', () => {
    const line = newLine({ quantity: '5', rate: '200' })
    const { items, errors } = draftsToInputs([line])
    expect(errors).toHaveLength(0)
    expect(items[0]?.description).toBe('Stone Slabs / Blocks')
    expect(items[0]?.hsn_code).toBe('6380')
    expect(items[0]?.unit).toBe('SQT')
  })
})
