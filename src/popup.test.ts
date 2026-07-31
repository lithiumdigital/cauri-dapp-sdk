import { describe, expect, it } from 'vitest'
import { normalizeOrigin, waitForOpenerMessage } from './popup'

const WALLET_ORIGIN = 'https://devnet.cauri.cc'

/**
 * Fake popup window — an object that === identity-matches what we hand
 * waitForOpenerMessage as ev.source. jsdom exposes MessageEvent, and we
 * dispatch synthetic events with the `source` property overridden.
 */
function makeFakePopup(): Window {
    return {} as unknown as Window
}

function postFakeMessage(data: unknown, origin: string, source: Window | null): void {
    const ev = new MessageEvent('message', { data, origin })
    // jsdom's MessageEvent doesn't respect the `source` init option, so
    // override the property directly.
    Object.defineProperty(ev, 'source', { value: source })
    window.dispatchEvent(ev)
}

describe('normalizeOrigin', () => {
    it('extracts the origin from a full URL', () => {
        expect(normalizeOrigin('https://devnet.cauri.cc/dapp/connect/x')).toBe(
            'https://devnet.cauri.cc',
        )
    })
    it('throws on invalid URLs — surfaces config errors early', () => {
        expect(() => normalizeOrigin('not a url')).toThrow()
    })
})

describe('waitForOpenerMessage', () => {
    it('resolves on a matching success message from the popup + walletOrigin', async () => {
        const popup = makeFakePopup()
        const promise = waitForOpenerMessage<{ type: string; ok: number }>({
            popup,
            walletOrigin: WALLET_ORIGIN,
            matchSuccess: (m) => m.type === 'OK',
            matchReject: (m) => m.type === 'BAD',
            timeoutMs: 1000,
        })
        postFakeMessage({ type: 'OK', ok: 1 }, WALLET_ORIGIN, popup)
        await expect(promise).resolves.toEqual({ type: 'OK', ok: 1 })
    })

    it('ignores messages from the wrong origin (forgery guard)', async () => {
        const popup = makeFakePopup()
        const promise = waitForOpenerMessage({
            popup,
            walletOrigin: WALLET_ORIGIN,
            matchSuccess: (m) => m.type === 'OK',
            matchReject: (m) => m.type === 'BAD',
            timeoutMs: 100,
        })
        postFakeMessage({ type: 'OK' }, 'https://evil.example', popup)
        await expect(promise).resolves.toBeUndefined()
    })

    it('ignores messages from the wrong source window (forgery guard)', async () => {
        const popup = makeFakePopup()
        const otherWindow = makeFakePopup()
        const promise = waitForOpenerMessage({
            popup,
            walletOrigin: WALLET_ORIGIN,
            matchSuccess: (m) => m.type === 'OK',
            matchReject: (m) => m.type === 'BAD',
            timeoutMs: 100,
        })
        postFakeMessage({ type: 'OK' }, WALLET_ORIGIN, otherWindow)
        await expect(promise).resolves.toBeUndefined()
    })

    it('resolves undefined on a reject envelope', async () => {
        const popup = makeFakePopup()
        const promise = waitForOpenerMessage({
            popup,
            walletOrigin: WALLET_ORIGIN,
            matchSuccess: (m) => m.type === 'OK',
            matchReject: (m) => m.type === 'BAD',
            timeoutMs: 1000,
        })
        postFakeMessage({ type: 'BAD' }, WALLET_ORIGIN, popup)
        await expect(promise).resolves.toBeUndefined()
    })

    it('resolves undefined on timeout', async () => {
        const popup = makeFakePopup()
        const promise = waitForOpenerMessage({
            popup,
            walletOrigin: WALLET_ORIGIN,
            matchSuccess: () => false,
            matchReject: () => false,
            timeoutMs: 20,
        })
        await expect(promise).resolves.toBeUndefined()
    })

    it('rejects on abort', async () => {
        const popup = makeFakePopup()
        const ac = new AbortController()
        const promise = waitForOpenerMessage({
            popup,
            walletOrigin: WALLET_ORIGIN,
            matchSuccess: () => false,
            matchReject: () => false,
            timeoutMs: 1000,
            abortSignal: ac.signal,
        })
        ac.abort()
        await expect(promise).rejects.toThrow('Operation aborted')
    })
})
