import { describe, it, expect } from 'vitest'
import { embedToken, verifyEmbedToken } from '@/lib/embed'

const SECRET = 'test-secret'

describe('embed tokens (#48)', () => {
  it('is deterministic for the same group + secret', () => {
    expect(embedToken(42, SECRET)).toBe(embedToken(42, SECRET))
  })

  it('differs by group and by secret', () => {
    expect(embedToken(1, SECRET)).not.toBe(embedToken(2, SECRET))
    expect(embedToken(1, SECRET)).not.toBe(embedToken(1, 'other-secret'))
  })

  it('verifies a valid token and rejects tampering', () => {
    const token = embedToken(7, SECRET)
    expect(verifyEmbedToken(7, token, SECRET)).toBe(true)
    expect(verifyEmbedToken(8, token, SECRET)).toBe(false) // wrong group
    expect(verifyEmbedToken(7, token, 'wrong')).toBe(false) // wrong secret
    expect(verifyEmbedToken(7, token + 'x', SECRET)).toBe(false) // length mismatch
    expect(verifyEmbedToken(7, null, SECRET)).toBe(false)
    expect(verifyEmbedToken(7, '', SECRET)).toBe(false)
  })

  it('treats string and number ids consistently', () => {
    expect(embedToken('7', SECRET)).toBe(embedToken(7, SECRET))
  })
})
