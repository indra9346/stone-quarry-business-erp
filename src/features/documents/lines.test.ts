import { describe, expect, it } from 'vitest'
import { draftAmount, draftsToInputs, formatParticulars, newLine, rowsToDrafts } from './lines'

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
      feet: 10,
      width_in: 12,
      thickness_in: 6,
    })

    expect(items[1]).toEqual({
      description: "8' × 18\" × 4\"",
      hsn_code: '6380',
      quantity: 10,
      unit: 'SQT',
      rate: 120,
      feet: 8,
      width_in: 18,
      thickness_in: 4,
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

  it('prefers real feet/width_in/thickness_in columns over parsing the description (post-migration rows)', () => {
    const rows = [
      { description: 'Temple pillar block', hsn_code: '6380', quantity: 2, unit: 'SQT', rate: 260, feet: 16, width_in: 15, thickness_in: 3 },
    ]
    const drafts = rowsToDrafts(rows)
    expect(drafts[0]?.feet).toBe('16')
    expect(drafts[0]?.inches1).toBe('15')
    expect(drafts[0]?.inches2).toBe('3')
  })

  it('provides default stone description when dimensions are omitted', () => {
    const line = newLine({ quantity: '5', rate: '200' })
    const { items, errors } = draftsToInputs([line])
    expect(errors).toHaveLength(0)
    expect(items[0]?.description).toBe('Stone Slabs / Blocks')
    expect(items[0]?.hsn_code).toBe('6380')
    expect(items[0]?.unit).toBe('SQT')
    expect(items[0]?.feet).toBeNull()
  })

  describe('dimension-based pricing (client-confirmed formula)', () => {
    it('ACCEPTANCE TEST: 16ft × 15in × 3in × ₹260 = ₹1,87,200 (no piece count given)', () => {
      const line = newLine({ feet: '16', inches1: '15', inches2: '3', rate: '260' })
      expect(draftAmount(line)).toBe(187200)
      const { items, errors } = draftsToInputs([line])
      expect(errors).toHaveLength(0)
      expect(items[0]).toMatchObject({ feet: 16, width_in: 15, thickness_in: 3, rate: 260, quantity: null })
    })

    it('pieces multiplies the per-piece dimension price when entered', () => {
      const line = newLine({ feet: '5', inches1: '6', inches2: '4', quantity: '24', rate: '244' })
      expect(draftAmount(line)).toBe(5 * 6 * 4 * 244 * 24) // 120 per piece × 24 = ₹7,02,720
    })

    it('amount updates live as any of feet / width / thickness / rate / pieces changes', () => {
      const base = newLine({ feet: '16', inches1: '15', inches2: '3', rate: '260' })
      expect(draftAmount(base)).toBe(187200)
      expect(draftAmount({ ...base, rate: '300' })).toBe(16 * 15 * 3 * 300)
      expect(draftAmount({ ...base, feet: '20' })).toBe(20 * 15 * 3 * 260)
      expect(draftAmount({ ...base, inches1: '10' })).toBe(16 * 10 * 3 * 260)
      expect(draftAmount({ ...base, inches2: '5' })).toBe(16 * 15 * 5 * 260)
      expect(draftAmount({ ...base, quantity: '3' })).toBe(16 * 15 * 3 * 260 * 3)
    })

    it('a half-filled dimension set (only 1 or 2 of feet/width/thickness) is rejected, no guessed amount', () => {
      const onlyFeet = newLine({ feet: '16', rate: '260' })
      expect(draftAmount(onlyFeet)).toBeNull()
      expect(draftsToInputs([onlyFeet]).errors[0]).toMatch(/feet, width and thickness together/)

      const twoOfThree = newLine({ feet: '16', inches1: '15', rate: '260' })
      expect(draftAmount(twoOfThree)).toBeNull()
      expect(draftsToInputs([twoOfThree]).errors[0]).toMatch(/feet, width and thickness together/)
    })

    it('dimensions given without a rate is rejected (not silently priced at 0)', () => {
      const line = newLine({ feet: '16', inches1: '15', inches2: '3' })
      expect(draftAmount(line)).toBeNull()
      expect(draftsToInputs([line]).errors[0]).toMatch(/enter a rate/)
    })

    it('legacy line with no dimensions still prices as pieces × rate (historical behaviour preserved)', () => {
      const line = newLine({ quantity: '24', rate: '244' })
      expect(draftAmount(line)).toBe(24 * 244)
      const { items, errors } = draftsToInputs([line])
      expect(errors).toHaveLength(0)
      expect(items[0]).toMatchObject({ quantity: 24, rate: 244, feet: null, width_in: null, thickness_in: null })
    })

    it('rate with no dimensions and no pieces is rejected (incomplete legacy line)', () => {
      const line = newLine({ rate: '244' })
      expect(draftAmount(line)).toBeNull()
      expect(draftsToInputs([line]).errors[0]).toMatch(/enter both pieces and rate/)
    })

    it('blank and zero inputs never produce a misleading amount', () => {
      expect(draftAmount(newLine())).toBeNull()
      expect(draftAmount(newLine({ feet: '0', inches1: '0', inches2: '0', rate: '260' }))).toBe(0)
      expect(draftAmount(newLine({ feet: '16', inches1: '15', inches2: '3', rate: '0' }))).toBe(0)
    })

    it('negative dimensions, pieces and rate are rejected', () => {
      expect(draftsToInputs([newLine({ feet: '-1', inches1: '15', inches2: '3', rate: '260' })]).errors.length).toBeGreaterThan(0)
      expect(draftsToInputs([newLine({ feet: '16', inches1: '15', inches2: '3', rate: '-260' })]).errors.length).toBeGreaterThan(0)
      expect(draftsToInputs([newLine({ quantity: '-1', rate: '10' })]).errors.length).toBeGreaterThan(0)
    })
  })
})
