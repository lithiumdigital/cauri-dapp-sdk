/**
 * Popup helpers for the Cauri wallet approval flow.
 *
 * openPlaceholderPopup opens about:blank synchronously inside a user
 * gesture (browsers demote a later window.open to a background tab if
 * the gesture is consumed by an intervening await). navigatePopup then
 * swaps in the wallet URL without adding a history entry.
 *
 * waitForOpenerMessage validates both ev.origin (must match the wallet
 * UI origin) and ev.source (must be the popup this SDK opened). Without
 * those checks, any cross-origin frame could forge an approval message.
 */

const WIDTH = 480
const HEIGHT = 720

function featuresString(): string {
    const screenLeft =
        typeof window.screenLeft !== 'undefined'
            ? window.screenLeft
            : window.screenX
    const screenTop =
        typeof window.screenTop !== 'undefined'
            ? window.screenTop
            : window.screenY
    const screenWidth =
        window.outerWidth || window.innerWidth || screen.width
    const screenHeight =
        window.outerHeight || window.innerHeight || screen.height
    const left = Math.max(
        0,
        screenLeft + Math.floor((screenWidth - WIDTH) / 2),
    )
    const top = Math.max(
        0,
        screenTop + Math.floor((screenHeight - HEIGHT) / 3),
    )
    return [
        `width=${WIDTH}`,
        `height=${HEIGHT}`,
        `left=${left}`,
        `top=${top}`,
        'popup=yes',
        'toolbar=no',
        'menubar=no',
        'location=no',
        'status=no',
        'resizable=yes',
        'scrollbars=yes',
    ].join(',')
}

export function openPlaceholderPopup(namePrefix: string): Window | null {
    // Unique name per call so concurrent flows don't collide onto the same
    // window (window.open reuses an existing window with a matching name).
    const name = `${namePrefix}_${crypto.randomUUID()}`
    return window.open('about:blank', name, featuresString())
}

export function navigatePopup(popup: Window, url: string): void {
    popup.location.replace(url)
}

/**
 * Convert an origin URL (e.g. https://devnet.cauri.cc) to a comparable
 * origin string. Throws on invalid URLs so a misconfigured walletUiBase
 * fails at adapter construction time, not silently at approval time.
 */
export function normalizeOrigin(originOrUrl: string): string {
    const u = new URL(originOrUrl)
    return u.origin
}

export interface WaitForMessageOptions<T> {
    /** The popup window returned by openPlaceholderPopup. */
    popup: Window
    /** Origin of the wallet UI, e.g. "https://devnet.cauri.cc". */
    walletOrigin: string
    /** Predicate that matches an approval envelope. */
    matchSuccess: (m: { type: string }) => boolean
    /** Predicate that matches a rejection envelope. */
    matchReject: (m: { type: string }) => boolean
    /** Timeout in ms; resolves { status: 'timeout' } on expiry. */
    timeoutMs: number
    /** Optional abort signal; rejects with an Error when fired. */
    abortSignal?: AbortSignal
}

/** Outcome of a popup approval wait. */
export type OpenerOutcome<T> =
    | { status: 'success'; value: T }
    | { status: 'rejected' }
    | { status: 'timeout' }
    | { status: 'closed' }

/**
 * Resolve success/rejected/timeout/closed by how the approval popup ended;
 * reject only on abort. Enforces ev.origin === walletOrigin and
 * ev.source === popup; other messages are dropped.
 */
export function waitForOpenerMessage<T>(
    opts: WaitForMessageOptions<T>,
): Promise<OpenerOutcome<T>> {
    const { popup, walletOrigin, matchSuccess, matchReject, timeoutMs, abortSignal } = opts
    return new Promise<OpenerOutcome<T>>((resolve, reject) => {
        const cleanup = () => {
            window.removeEventListener('message', onMsg)
            clearTimeout(timer)
            clearInterval(closedPoll)
            abortSignal?.removeEventListener('abort', onAbort)
        }
        const onMsg = (ev: MessageEvent) => {
            if (ev.origin !== walletOrigin) return
            if (ev.source !== popup) return
            const m = ev.data as { type?: string }
            if (!m || typeof m.type !== 'string') return
            const typed = m as { type: string }
            if (matchSuccess(typed)) {
                cleanup()
                resolve({ status: 'success', value: m as T })
            } else if (matchReject(typed)) {
                cleanup()
                resolve({ status: 'rejected' })
            }
        }
        const onAbort = () => {
            cleanup()
            reject(new Error('Operation aborted'))
        }
        const timer = setTimeout(() => {
            cleanup()
            resolve({ status: 'timeout' })
        }, timeoutMs)
        const closedPoll = setInterval(() => {
            if (popup.closed) {
                cleanup()
                resolve({ status: 'closed' })
            }
        }, 500)
        window.addEventListener('message', onMsg)
        if (abortSignal) {
            if (abortSignal.aborted) {
                cleanup()
                reject(new Error('Operation aborted'))
                return
            }
            abortSignal.addEventListener('abort', onAbort)
        }
    })
}
