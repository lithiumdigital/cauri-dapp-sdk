/**
 * JSON-RPC 2.0 client for the Cauri CIP-103 gateway (POST /api/dapp).
 */

interface JsonRpcRequest {
    jsonrpc: '2.0'
    id: string
    method: string
    params?: Record<string, unknown>
}

interface JsonRpcErrorObject {
    code: number
    message: string
    data?: unknown
}

interface JsonRpcResponse<T> {
    jsonrpc: '2.0'
    id: string
    result?: T
    error?: JsonRpcErrorObject
}

/**
 * Thrown when the gateway returns a JSON-RPC error. Exposes `.error`
 * ({code, message, data}) for callers that render by error code while
 * remaining `instanceof Error` for generic catch blocks.
 */
export class CauriRpcError extends Error {
    readonly error: JsonRpcErrorObject
    constructor(rpcError: JsonRpcErrorObject) {
        super(rpcError.message)
        this.name = 'CauriRpcError'
        this.error = rpcError
    }
}

/** Why a user-approval interaction did not complete. */
export type CauriUserRejectedReason = 'rejected' | 'timeout' | 'popup_closed' | 'popup_blocked'

/** Code for "the user did not approve", following the wallet convention. */
export const USER_REJECTED_CODE = 4001

/** Thrown when connect, signMessage, or prepareExecute is not approved. `reason` distinguishes the cases. */
export class CauriUserRejectedError extends Error {
    readonly reason: CauriUserRejectedReason
    readonly code = USER_REJECTED_CODE
    constructor(reason: CauriUserRejectedReason, message: string) {
        super(message)
        this.name = 'CauriUserRejectedError'
        this.reason = reason
    }
}

export interface CauriConnectResult {
    isConnected: boolean
    isNetworkConnected: boolean
    userUrl?: string
    sessionToken?: string
}

export interface CauriSignMessageResult {
    messageId: string
    userUrl: string
}

export interface CauriIsConnectedResult {
    isConnected: boolean
    isNetworkConnected: boolean
    partyId?: string
}

export interface CauriPrepareExecuteResult {
    userUrl: string
}

export class CauriRpcClient {
    constructor(readonly apiBase: string) {}

    async call<T>(
        method: string,
        params?: Record<string, unknown>,
        bearerToken?: string,
    ): Promise<T> {
        const body: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: crypto.randomUUID(),
            method,
            params: params ?? {},
        }
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`

        const res = await fetch(`${this.apiBase}/api/dapp`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })

        const text = await res.text()
        if (!text) {
            throw new Error(
                `Cauri gateway returned empty body for ${method} (HTTP ${res.status})`,
            )
        }
        let parsed: JsonRpcResponse<T>
        try {
            parsed = JSON.parse(text) as JsonRpcResponse<T>
        } catch {
            const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text
            throw new Error(
                `Cauri gateway ${method} returned non-JSON body (HTTP ${res.status}): ${snippet}`,
            )
        }
        if (parsed.error) {
            throw new CauriRpcError(parsed.error)
        }
        if (!res.ok) {
            throw new Error(
                `Cauri gateway ${method} failed with HTTP ${res.status}`,
            )
        }
        if (parsed.result === undefined) {
            throw new Error(`Cauri gateway ${method} returned no result`)
        }
        return parsed.result
    }
}
