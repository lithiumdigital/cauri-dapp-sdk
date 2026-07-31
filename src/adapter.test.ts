import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCauriAdapter } from './adapter'

const CONFIG = {
    apiBase: 'https://api.devnet.cauri.cc',
    walletUiBase: 'https://devnet.cauri.cc',
}

afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
})

describe('createCauriAdapter', () => {
    it('exposes the ProviderAdapter shape the standard requires', () => {
        const adapter = createCauriAdapter(CONFIG)
        expect(adapter.providerId).toBe('cauri')
        expect(adapter.name).toBe('Cauri')
        expect(adapter.type).toBe('remote')
        expect(typeof adapter.icon).toBe('string')
        expect(typeof adapter.getInfo).toBe('function')
        expect(typeof adapter.detect).toBe('function')
        expect(typeof adapter.provider).toBe('function')
        expect(typeof adapter.teardown).toBe('function')
        expect(typeof adapter.restore).toBe('function')
    })

    it('getInfo() returns metadata matching the picker WalletInfo contract', () => {
        const adapter = createCauriAdapter(CONFIG)
        const info = adapter.getInfo()
        expect(info.providerId).toBe('cauri')
        expect(info.name).toBe('Cauri')
        expect(info.type).toBe('remote')
        expect(info.url).toBe(CONFIG.walletUiBase)
        expect(info.reuseGlobalWalletPopup).toBe(false)
    })

    it('detect() resolves true (remote wallets are always available)', async () => {
        const adapter = createCauriAdapter(CONFIG)
        await expect(adapter.detect()).resolves.toBe(true)
    })

    it('provider() returns the same instance across calls', () => {
        const adapter = createCauriAdapter(CONFIG)
        expect(adapter.provider()).toBe(adapter.provider())
    })

    it('teardown() drops the current provider so the next call is fresh', () => {
        const adapter = createCauriAdapter(CONFIG)
        const before = adapter.provider()
        adapter.teardown()
        const after = adapter.provider()
        expect(after).not.toBe(before)
    })

    describe('restore()', () => {
        beforeEach(() => {
            localStorage.clear()
        })

        it('returns null when there is no persisted session', async () => {
            const adapter = createCauriAdapter(CONFIG)
            const restored = await adapter.restore!()
            expect(restored).toBeNull()
        })

        it('returns a live provider when the backend confirms the session', async () => {
            localStorage.setItem(
                'cauri.session',
                JSON.stringify({ sessionId: 's', sessionToken: 't' }),
            )
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(
                    JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'x',
                        result: { isConnected: true, isNetworkConnected: true },
                    }),
                    { status: 200 },
                ),
            )
            const adapter = createCauriAdapter(CONFIG)
            const restored = await adapter.restore!()
            expect(restored).not.toBeNull()
            expect(fetchSpy).toHaveBeenCalledOnce()
            // Confirms the persisted sessionToken is applied — bearer auth header present.
            const call = fetchSpy.mock.calls[0]
            const init = call[1] as RequestInit
            const headers = init.headers as Record<string, string>
            expect(headers['Authorization']).toBe('Bearer t')
        })

        it('clears storage and returns null when the backend says not connected', async () => {
            localStorage.setItem(
                'cauri.session',
                JSON.stringify({ sessionId: 's', sessionToken: 't' }),
            )
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(
                    JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'x',
                        result: { isConnected: false, isNetworkConnected: true },
                    }),
                    { status: 200 },
                ),
            )
            const adapter = createCauriAdapter(CONFIG)
            const restored = await adapter.restore!()
            expect(restored).toBeNull()
            expect(localStorage.getItem('cauri.session')).toBeNull()
        })

        it('fails closed when the backend errors', async () => {
            localStorage.setItem(
                'cauri.session',
                JSON.stringify({ sessionId: 's', sessionToken: 't' }),
            )
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))
            const adapter = createCauriAdapter(CONFIG)
            const restored = await adapter.restore!()
            expect(restored).toBeNull()
            expect(localStorage.getItem('cauri.session')).toBeNull()
        })
    })
})
