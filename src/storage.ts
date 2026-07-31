import type { CauriSessionRecord } from './types'

const STORAGE_KEY = 'cauri.session'

// localStorage access throws in SSR, in some private-browsing modes, and
// when a page has been iframed with restrictive sandbox flags. Every
// helper here swallows those errors so the adapter degrades to "no
// persistence" instead of taking the caller down.

export function loadSession(): CauriSessionRecord | null {
    try {
        if (typeof localStorage === 'undefined') return null
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<CauriSessionRecord>
        if (
            typeof parsed.sessionId !== 'string' ||
            typeof parsed.sessionToken !== 'string'
        ) {
            return null
        }
        return {
            sessionId: parsed.sessionId,
            sessionToken: parsed.sessionToken,
        }
    } catch {
        return null
    }
}

export function saveSession(record: CauriSessionRecord): void {
    try {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    } catch {
        // no-op: persistence is best-effort
    }
}

export function clearSession(): void {
    try {
        if (typeof localStorage === 'undefined') return
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // no-op
    }
}
