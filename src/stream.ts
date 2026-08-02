/** Wallet-pushed events forwarded from the Cauri gateway's SSE stream. */
export const STREAM_EVENTS = [
    'txChanged',
    'statusChanged',
    'accountsChanged',
    'messageSignature',
] as const

export type StreamEventName = (typeof STREAM_EVENTS)[number]

export interface StreamHandle {
    close(): void
}

/**
 * Open the gateway's SSE stream at `${apiBase}/api/dapp/events?token=<token>`
 * and dispatch each named CIP-103 event to `onEvent(name, data)`. Malformed
 * event payloads are dropped so a single bad message can't take the stream
 * down. Returns a handle whose `close()` shuts the connection.
 */
export function openEventStream(
    apiBase: string,
    sessionToken: string,
    onEvent: (name: StreamEventName, data: unknown) => void,
): StreamHandle {
    if (typeof EventSource === 'undefined') {
        return { close: () => {} }
    }
    const url = `${apiBase}/api/dapp/events?token=${encodeURIComponent(sessionToken)}`
    const source = new EventSource(url)

    for (const name of STREAM_EVENTS) {
        source.addEventListener(name, (ev: MessageEvent) => {
            try {
                onEvent(name, JSON.parse(ev.data))
            } catch {
                /* ignore malformed payload */
            }
        })
    }

    return {
        close: () => source.close(),
    }
}
