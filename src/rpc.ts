/**
 * JSON-RPC 2.0 client for the Cauri CIP-103 gateway (POST /api/dapp).
 */

interface JsonRpcRequest {
    jsonrpc: '2.0'
    id: string
    method: string
    params?: Record<string, unknown>
}

interface JsonRpcResponse<T> {
    jsonrpc: '2.0'
    id: string
    result?: T
    error?: { code: number; message: string; data?: unknown }
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
            throw new Error(
                `Cauri gateway ${method} failed: ${parsed.error.code} ${parsed.error.message}`,
            )
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
