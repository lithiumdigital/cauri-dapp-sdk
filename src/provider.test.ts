import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CauriProvider } from './provider'
import { CauriRpcError, CauriUserRejectedError } from './rpc'

const CONFIG = {
    apiBase: 'https://api.example',
    walletUiBase: 'https://wallet.example',
}

class FakeEventSource {
    static instances: FakeEventSource[] = []
    readonly listeners = new Map<string, (ev: MessageEvent) => void>()
    closed = false
    constructor(public readonly url: string) {
        FakeEventSource.instances.push(this)
    }
    addEventListener(name: string, cb: (ev: MessageEvent) => void): void {
        this.listeners.set(name, cb)
    }
    close(): void {
        this.closed = true
    }
    dispatch(name: string, data: string): void {
        this.listeners.get(name)?.({ data } as MessageEvent)
    }
}

function mockJsonRpc(result: unknown, opts?: { status?: number }) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
            JSON.stringify({ jsonrpc: '2.0', id: 'x', result }),
            { status: opts?.status ?? 200 },
        ),
    )
}

function mockJsonRpcError(code: number, message: string) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
            JSON.stringify({ jsonrpc: '2.0', id: 'x', error: { code, message } }),
            { status: 200 },
        ),
    )
}

beforeEach(() => {
    FakeEventSource.instances = []
    ;(globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource
    localStorage.clear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('CauriProvider — dispatch', () => {
    it('unknown method throws a clear error', async () => {
        const p = new CauriProvider(CONFIG)
        await expect(
            p.request({ method: 'nonexistentMethod' as never }),
        ).rejects.toThrow(/not implemented/)
    })

    it('isConnected returns disconnected when no session', async () => {
        const p = new CauriProvider(CONFIG)
        const status = await p.request({ method: 'isConnected' })
        expect(status.isConnected).toBe(false)
        expect(status.isNetworkConnected).toBe(false)
    })

    it('isConnected round-trips when a session is present', async () => {
        mockJsonRpc({ isConnected: true, isNetworkConnected: true })
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        const status = await p.request({ method: 'isConnected' })
        expect(status.isConnected).toBe(true)
    })

    it('isConnected clears session on backend false', async () => {
        mockJsonRpc({ isConnected: false, isNetworkConnected: true })
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        await p.request({ method: 'isConnected' })
        expect(p.hasSession()).toBe(false)
    })

    it('disconnect clears session and closes stream even if backend errors', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        const stream = FakeEventSource.instances[0]
        expect(stream.closed).toBe(false)
        await p.request({ method: 'disconnect' })
        expect(p.hasSession()).toBe(false)
        expect(stream.closed).toBe(true)
        expect(warn).toHaveBeenCalled()
    })

    it('signMessage throws Not connected when no session', async () => {
        const p = new CauriProvider(CONFIG)
        await expect(
            p.request({ method: 'signMessage', params: { message: 'hi' } }),
        ).rejects.toThrow(/Not connected/)
    })

    it('prepareExecute throws Not connected when no session', async () => {
        const p = new CauriProvider(CONFIG)
        await expect(
            p.request({
                method: 'prepareExecute',
                params: { commands: [] as never },
            }),
        ).rejects.toThrow(/Not connected/)
    })

    it('prepareExecuteAndWait throws Not connected when no session', async () => {
        const p = new CauriProvider(CONFIG)
        await expect(
            p.request({
                method: 'prepareExecuteAndWait',
                params: { commands: [] as never },
            }),
        ).rejects.toThrow(/Not connected/)
    })

    it('connect throws a typed CauriUserRejectedError when the popup is blocked', async () => {
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
        try {
            const p = new CauriProvider(CONFIG)
            await expect(p.request({ method: 'connect' })).rejects.toMatchObject({
                name: 'CauriUserRejectedError',
                reason: 'popup_blocked',
                code: 4001,
            })
            await expect(p.request({ method: 'connect' })).rejects.toBeInstanceOf(
                CauriUserRejectedError,
            )
        } finally {
            openSpy.mockRestore()
        }
    })

    it('ledgerApi throws Not connected when no session', async () => {
        const p = new CauriProvider(CONFIG)
        await expect(
            p.request({
                method: 'ledgerApi',
                params: { requestMethod: 'get', resource: '/x' },
            }),
        ).rejects.toThrow(/Not connected/)
    })

    it('ledgerApi round-trips when connected', async () => {
        const fetchSpy = mockJsonRpc({ version: '3.0.0' })
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        const res = await p.request({
            method: 'ledgerApi',
            params: { requestMethod: 'get', resource: '/v2/version' },
        })
        expect(res).toEqual({ version: '3.0.0' })
        const [, init] = fetchSpy.mock.calls[0]
        const headers = (init as RequestInit).headers as Record<string, string>
        expect(headers['Authorization']).toBe('Bearer t')
    })

    it('status passthrough uses bearer token', async () => {
        const fetchSpy = mockJsonRpc({
            provider: { id: 'cauri', providerType: 'remote' },
            connection: { isConnected: true, isNetworkConnected: true },
        })
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        await p.request({ method: 'status' })
        const [, init] = fetchSpy.mock.calls[0]
        const headers = (init as RequestInit).headers as Record<string, string>
        expect(headers['Authorization']).toBe('Bearer t')
    })

    it('surfaces CauriRpcError on JSON-RPC error', async () => {
        mockJsonRpcError(-32007, 'ledger API returned 400')
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        try {
            await p.request({
                method: 'ledgerApi',
                params: { requestMethod: 'get', resource: '/v2/version' },
            })
            throw new Error('should have thrown')
        } catch (e) {
            expect(e).toBeInstanceOf(CauriRpcError)
            expect((e as CauriRpcError).error.code).toBe(-32007)
        }
    })
})

describe('CauriProvider — SSE stream lifecycle', () => {
    it('opens EventSource in the constructor when seeded with a token', () => {
        new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        expect(FakeEventSource.instances).toHaveLength(1)
        expect(FakeEventSource.instances[0].url).toContain('/api/dapp/events?token=t')
    })

    it('does NOT open EventSource without a token', () => {
        new CauriProvider(CONFIG)
        expect(FakeEventSource.instances).toHaveLength(0)
    })

    it('forwards SSE events via provider.emit', () => {
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        const received: Array<{ commandId: string }> = []
        p.on<{ commandId: string }>('txChanged', (ev) => {
            received.push(ev)
        })
        FakeEventSource.instances[0].dispatch(
            'txChanged',
            JSON.stringify({ commandId: 'c1', status: 'executed' }),
        )
        expect(received).toEqual([{ commandId: 'c1', status: 'executed' }])
    })

    it('closeEventStream closes the underlying source', () => {
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        const source = FakeEventSource.instances[0]
        p.closeEventStream()
        expect(source.closed).toBe(true)
    })

    it('emits statusChanged with reason: stream_error on EventSource error', () => {
        const p = new CauriProvider(CONFIG, { sessionToken: 't', sessionId: 's' })
        const received: Array<{ isConnected: boolean; reason?: string }> = []
        p.on<{ isConnected: boolean; reason?: string }>('statusChanged', (ev) => {
            received.push(ev)
        })
        FakeEventSource.instances[0].listeners.get('error')?.(
            {} as MessageEvent,
        )
        expect(received).toEqual([{ isConnected: false, reason: 'stream_error' }])
    })
})
