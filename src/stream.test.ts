import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openEventStream, STREAM_EVENTS } from './stream'

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
        const cb = this.listeners.get(name)
        if (cb) cb({ data } as MessageEvent)
    }
}

beforeEach(() => {
    FakeEventSource.instances = []
    ;(globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('openEventStream', () => {
    it('opens EventSource at the events endpoint with the token in the query', () => {
        openEventStream('https://api.example', 'tok-abc', () => {})
        expect(FakeEventSource.instances).toHaveLength(1)
        expect(FakeEventSource.instances[0].url).toBe(
            'https://api.example/api/dapp/events?token=tok-abc',
        )
    })

    it('URL-encodes the session token', () => {
        openEventStream('https://api.example', 'a b/c=d', () => {})
        expect(FakeEventSource.instances[0].url).toBe(
            'https://api.example/api/dapp/events?token=a%20b%2Fc%3Dd',
        )
    })

    it('forwards each named CIP-103 event to onEvent with parsed data', () => {
        const events: Array<{ name: string; data: unknown }> = []
        openEventStream('https://api.example', 'tok', (name, data) => {
            events.push({ name, data })
        })
        const source = FakeEventSource.instances[0]
        source.dispatch('txChanged', JSON.stringify({ commandId: 'c1', status: 'executed' }))
        source.dispatch('statusChanged', JSON.stringify({ isConnected: false }))
        expect(events).toEqual([
            { name: 'txChanged', data: { commandId: 'c1', status: 'executed' } },
            { name: 'statusChanged', data: { isConnected: false } },
        ])
    })

    it('subscribes to every event name in STREAM_EVENTS', () => {
        openEventStream('https://api.example', 'tok', () => {})
        const source = FakeEventSource.instances[0]
        for (const name of STREAM_EVENTS) {
            expect(source.listeners.has(name)).toBe(true)
        }
    })

    it('drops malformed payloads without throwing', () => {
        const spy = vi.fn()
        openEventStream('https://api.example', 'tok', spy)
        const source = FakeEventSource.instances[0]
        source.dispatch('txChanged', 'not json')
        expect(spy).not.toHaveBeenCalled()
    })

    it('close() closes the underlying EventSource', () => {
        const handle = openEventStream('https://api.example', 'tok', () => {})
        handle.close()
        expect(FakeEventSource.instances[0].closed).toBe(true)
    })

    it('returns a no-op handle when EventSource is unavailable (SSR)', () => {
        ;(globalThis as unknown as { EventSource: unknown }).EventSource = undefined
        const handle = openEventStream('https://api.example', 'tok', () => {})
        expect(() => handle.close()).not.toThrow()
        expect(FakeEventSource.instances).toHaveLength(0)
    })
})
