import { afterEach, describe, expect, it, vi } from 'vitest'
import { CauriRpcClient, CauriRpcError } from './rpc'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('CauriRpcClient', () => {
    it('resolves with the JSON-RPC result on success', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({ jsonrpc: '2.0', id: 'x', result: { ok: true } }),
                { status: 200 },
            ),
        )
        const client = new CauriRpcClient('https://api.example')
        await expect(client.call('anything')).resolves.toEqual({ ok: true })
    })

    it('throws CauriRpcError preserving code + message on JSON-RPC error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'x',
                    error: { code: -32007, message: 'ledger API returned 400' },
                }),
                { status: 200 },
            ),
        )
        const client = new CauriRpcClient('https://api.example')
        try {
            await client.call('ledgerApi')
            throw new Error('should have thrown')
        } catch (e) {
            expect(e).toBeInstanceOf(CauriRpcError)
            expect(e).toBeInstanceOf(Error)
            const err = e as CauriRpcError
            expect(err.error.code).toBe(-32007)
            expect(err.error.message).toBe('ledger API returned 400')
            expect(err.message).toBe('ledger API returned 400')
        }
    })

    it('CauriRpcError shape matches Canton ErrorResponse (has .error.code + .error.message)', () => {
        const err = new CauriRpcError({ code: -1, message: 'oops' })
        expect(err.error).toEqual({ code: -1, message: 'oops' })
    })

    it('throws a plain Error with body snippet on non-JSON response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('<html>gateway crashed</html>', { status: 502 }),
        )
        const client = new CauriRpcClient('https://api.example')
        await expect(client.call('anything')).rejects.toThrow(/non-JSON body.*502/)
    })

    it('throws on empty body', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('', { status: 200 }),
        )
        const client = new CauriRpcClient('https://api.example')
        await expect(client.call('anything')).rejects.toThrow(/empty body/)
    })

    it('sends the bearer token when provided', async () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({ jsonrpc: '2.0', id: 'x', result: null }),
                { status: 200 },
            ),
        )
        const client = new CauriRpcClient('https://api.example')
        await client.call('disconnect', undefined, 'tok-123')
        const [, init] = spy.mock.calls[0]
        const headers = (init as RequestInit).headers as Record<string, string>
        expect(headers['Authorization']).toBe('Bearer tok-123')
    })
})
