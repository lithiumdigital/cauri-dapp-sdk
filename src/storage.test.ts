import { afterEach, describe, expect, it } from 'vitest'
import { clearSession, loadSession, saveSession } from './storage'

afterEach(() => {
    localStorage.clear()
})

describe('storage', () => {
    it('round-trips a session record', () => {
        saveSession({ sessionId: 's-1', sessionToken: 't-1' })
        expect(loadSession()).toEqual({ sessionId: 's-1', sessionToken: 't-1' })
    })

    it('returns null when no session is stored', () => {
        expect(loadSession()).toBeNull()
    })

    it('returns null when storage holds junk', () => {
        localStorage.setItem('cauri.session', 'not json')
        expect(loadSession()).toBeNull()
    })

    it('returns null when the payload is missing required fields', () => {
        localStorage.setItem('cauri.session', JSON.stringify({ sessionId: 'only' }))
        expect(loadSession()).toBeNull()
    })

    it('clears the record', () => {
        saveSession({ sessionId: 's', sessionToken: 't' })
        clearSession()
        expect(loadSession()).toBeNull()
    })
})
