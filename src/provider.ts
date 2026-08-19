import { AbstractProvider } from '@canton-network/core-splice-provider'
import type {
    RpcTypes as DappRpcTypes,
    ConnectResult,
    SignMessageResult,
    SignMessageParams,
    PrepareExecuteParams,
    PrepareExecuteAndWaitResult,
    TxChangedExecutedEvent,
    LedgerApiParams,
    LedgerApiResult,
} from '@canton-network/core-wallet-dapp-rpc-client'
import type { RequestArgs } from '@canton-network/core-types'
import {
    openPlaceholderPopup,
    navigatePopup,
    waitForOpenerMessage,
    normalizeOrigin,
    type OpenerOutcome,
} from './popup'
import {
    CauriRpcClient,
    CauriUserRejectedError,
    type CauriConnectResult,
    type CauriIsConnectedResult,
    type CauriSignMessageResult,
    type CauriPrepareExecuteResult,
} from './rpc'
import { openEventStream, type StreamHandle } from './stream'
import { clearSession, saveSession } from './storage'
import type { CauriAdapterConfig } from './types'

const MSG_CONNECT_SUCCESS = 'SPLICE_WALLET_IDP_AUTH_SUCCESS'
const MSG_CONNECT_REJECTED = 'SPLICE_WALLET_IDP_AUTH_REJECTED'
const MSG_TX_APPROVED = 'SPLICE_WALLET_TX_APPROVED'
const MSG_TX_REJECTED = 'SPLICE_WALLET_TX_REJECTED'
const MSG_SIGN_MESSAGE_APPROVED = 'SPLICE_WALLET_MSG_SIGN_APPROVED'
const MSG_SIGN_MESSAGE_REJECTED = 'SPLICE_WALLET_MSG_SIGN_REJECTED'

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000

export interface CauriProviderInternalState {
    /** Pre-seeded session token — used by restore() so the returned provider is authed on construction. */
    sessionToken?: string
    /** Pre-seeded session id — persisted alongside the token. */
    sessionId?: string
}

export class CauriProvider extends AbstractProvider<DappRpcTypes> {
    private readonly rpc: CauriRpcClient
    private readonly walletUiBase: string
    private readonly walletOrigin: string
    private sessionToken: string | undefined
    private sessionId: string | undefined
    private readonly activePopups = new Set<Window>()
    private eventStream: StreamHandle | undefined

    constructor(
        config: CauriAdapterConfig,
        state: CauriProviderInternalState = {},
    ) {
        super()
        this.rpc = new CauriRpcClient(config.apiBase.replace(/\/+$/, ''))
        this.walletUiBase = config.walletUiBase.replace(/\/+$/, '')
        this.walletOrigin = normalizeOrigin(config.walletUiBase)
        this.sessionToken = state.sessionToken
        this.sessionId = state.sessionId
        if (this.sessionToken) this.openStream(this.sessionToken)
    }

    /** True once connect() has resolved (or a session was restored). */
    hasSession(): boolean {
        return Boolean(this.sessionToken)
    }

    /** Close any popups this provider still owns. */
    closeAllPopups(): void {
        for (const p of this.activePopups) {
            try {
                p.close()
            } catch {
                /* ignore */
            }
        }
        this.activePopups.clear()
    }

    /** Close the SSE event stream, if open. */
    closeEventStream(): void {
        this.eventStream?.close()
        this.eventStream = undefined
    }

    private openStream(token: string): void {
        this.closeEventStream()
        this.eventStream = openEventStream(
            this.rpc.apiBase,
            token,
            (name, data) => this.emit(name, data),
            () => this.emit('statusChanged', { isConnected: false, reason: 'stream_error' }),
        )
    }

    async request<M extends keyof DappRpcTypes>(
        args: RequestArgs<DappRpcTypes, M>,
    ): Promise<DappRpcTypes[M]['result']> {
        switch (args.method) {
            case 'connect':
                return (await this.doConnect()) as DappRpcTypes[M]['result']
            case 'disconnect':
                return (await this.doDisconnect()) as DappRpcTypes[M]['result']
            case 'isConnected':
                return (await this.doIsConnected()) as DappRpcTypes[M]['result']
            case 'status':
                return (await this.doPassthrough('status')) as DappRpcTypes[M]['result']
            case 'getActiveNetwork':
                return (await this.doPassthrough('getActiveNetwork')) as DappRpcTypes[M]['result']
            case 'listAccounts':
                return (await this.doPassthrough('listAccounts')) as DappRpcTypes[M]['result']
            case 'getPrimaryAccount':
                return (await this.doPassthrough('getPrimaryAccount')) as DappRpcTypes[M]['result']
            case 'signMessage':
                return (await this.doSignMessage(
                    (args as RequestArgs<DappRpcTypes, 'signMessage'>).params,
                )) as DappRpcTypes[M]['result']
            case 'prepareExecute':
                return (await this.doPrepareExecute(
                    (args as RequestArgs<DappRpcTypes, 'prepareExecute'>).params,
                )) as DappRpcTypes[M]['result']
            case 'prepareExecuteAndWait':
                return (await this.doPrepareExecuteAndWait(
                    (args as RequestArgs<DappRpcTypes, 'prepareExecuteAndWait'>).params,
                )) as DappRpcTypes[M]['result']
            case 'ledgerApi':
                return (await this.doLedgerApi(
                    (args as RequestArgs<DappRpcTypes, 'ledgerApi'>).params,
                )) as DappRpcTypes[M]['result']
            default:
                throw new Error(
                    `CauriProvider: method '${String(args.method)}' is not implemented`,
                )
        }
    }

    private async doPassthrough<T>(method: string): Promise<T> {
        return await this.rpc.call<T>(method, undefined, this.sessionToken)
    }

    /** Return the approval value, or throw a typed error for reject/timeout/closed. */
    private assertApproved<T>(outcome: OpenerOutcome<T>, action: string): T {
        switch (outcome.status) {
            case 'success':
                return outcome.value
            case 'rejected':
                throw new CauriUserRejectedError('rejected', `User rejected ${action}`)
            case 'timeout':
                throw new CauriUserRejectedError('timeout', `${action} approval timed out`)
            case 'closed':
                throw new CauriUserRejectedError(
                    'popup_closed',
                    `Approval window closed before ${action} completed`,
                )
        }
    }

    private async doConnect(): Promise<ConnectResult> {
        const popup = openPlaceholderPopup('cauriConnect')
        if (!popup) {
            throw new CauriUserRejectedError(
                'popup_blocked',
                'Popup blocked. Allow popups for this site and try again.',
            )
        }
        this.activePopups.add(popup)

        try {
            const result = await this.rpc.call<CauriConnectResult>('connect')
            if (!result.userUrl || !result.sessionToken) {
                throw new Error('Cauri gateway connect returned no userUrl/sessionToken')
            }
            const sessionId = lastPathSegment(result.userUrl)
            navigatePopup(
                popup,
                `${this.walletUiBase}/dapp/connect/${encodeURIComponent(sessionId)}`,
            )

            const outcome = await waitForOpenerMessage<{ sessionId: string }>({
                popup,
                walletOrigin: this.walletOrigin,
                matchSuccess: (m) =>
                    m.type === MSG_CONNECT_SUCCESS &&
                    (m as { sessionId?: string }).sessionId === sessionId,
                matchReject: (m) =>
                    m.type === MSG_CONNECT_REJECTED &&
                    (m as { sessionId?: string }).sessionId === sessionId,
                timeoutMs: APPROVAL_TIMEOUT_MS,
            })
            this.assertApproved(outcome, 'connect')

            this.sessionId = sessionId
            this.sessionToken = result.sessionToken
            saveSession({ sessionId, sessionToken: result.sessionToken })
            this.openStream(result.sessionToken)
            return {
                isConnected: result.isConnected,
                isNetworkConnected: result.isNetworkConnected,
            } as ConnectResult
        } finally {
            this.releasePopup(popup)
        }
    }

    private async doDisconnect(): Promise<null> {
        try {
            if (this.sessionToken) {
                await this.rpc.call('disconnect', undefined, this.sessionToken)
            }
        } catch (err) {
            console.warn('[cauri-dapp-sdk] disconnect RPC failed; clearing local state anyway', err)
        } finally {
            this.sessionToken = undefined
            this.sessionId = undefined
            clearSession()
            this.closeEventStream()
            this.closeAllPopups()
        }
        return null
    }

    private async doIsConnected(): Promise<ConnectResult> {
        if (!this.sessionToken) {
            return { isConnected: false, isNetworkConnected: false } as ConnectResult
        }
        const status = await this.rpc.call<CauriIsConnectedResult>(
            'isConnected',
            undefined,
            this.sessionToken,
        )
        if (!status.isConnected) {
            this.sessionToken = undefined
            this.sessionId = undefined
            clearSession()
            this.closeEventStream()
        }
        return {
            isConnected: status.isConnected,
            isNetworkConnected: status.isNetworkConnected,
        } as ConnectResult
    }

    private async doSignMessage(params: SignMessageParams): Promise<SignMessageResult> {
        if (!this.sessionToken) throw new Error('Not connected')
        const popup = openPlaceholderPopup('cauriSignMessage')
        if (!popup) {
            throw new CauriUserRejectedError(
                'popup_blocked',
                'Popup blocked. Allow popups for this site and try again.',
            )
        }
        this.activePopups.add(popup)

        try {
            const prep = await this.rpc.call<CauriSignMessageResult>(
                'signMessage',
                { message: params.message },
                this.sessionToken,
            )
            if (!prep.messageId) {
                throw new Error('Cauri gateway signMessage returned no messageId')
            }
            const messageId = prep.messageId
            navigatePopup(
                popup,
                `${this.walletUiBase}/dapp/message/${encodeURIComponent(messageId)}`,
            )

            const outcome = await waitForOpenerMessage<{
                commandId: string
                signature: string
                keyFingerprint: string
            }>({
                popup,
                walletOrigin: this.walletOrigin,
                matchSuccess: (m) =>
                    m.type === MSG_SIGN_MESSAGE_APPROVED &&
                    (m as { commandId?: string }).commandId === messageId,
                matchReject: (m) =>
                    m.type === MSG_SIGN_MESSAGE_REJECTED &&
                    (m as { commandId?: string }).commandId === messageId,
                timeoutMs: APPROVAL_TIMEOUT_MS,
            })
            const approval = this.assertApproved(outcome, 'signMessage')
            return { signature: approval.signature }
        } finally {
            this.releasePopup(popup)
        }
    }

    /** Prepare the transaction and point the popup at it; returns the command id. */
    private async beginPrepareExecute(
        params: PrepareExecuteParams,
        popup: Window,
    ): Promise<string> {
        if (!this.sessionToken) throw new Error('Not connected')
        const prep = await this.rpc.call<CauriPrepareExecuteResult>(
            'prepareExecute',
            params as unknown as Record<string, unknown>,
            this.sessionToken,
        )
        if (!prep.userUrl) throw new Error('Cauri gateway prepareExecute returned no userUrl')
        const commandId = lastPathSegment(prep.userUrl)
        navigatePopup(
            popup,
            `${this.walletUiBase}/dapp/transaction/${encodeURIComponent(commandId)}`,
        )
        return commandId
    }

    /** Wait for the user to approve the transaction popup. */
    private async awaitTxApproval(popup: Window, commandId: string): Promise<void> {
        const outcome = await waitForOpenerMessage<{ commandId: string; transactionId: string }>({
            popup,
            walletOrigin: this.walletOrigin,
            matchSuccess: (m) =>
                m.type === MSG_TX_APPROVED &&
                (m as { commandId?: string }).commandId === commandId,
            matchReject: (m) =>
                m.type === MSG_TX_REJECTED &&
                (m as { commandId?: string }).commandId === commandId,
            timeoutMs: APPROVAL_TIMEOUT_MS,
        })
        this.assertApproved(outcome, 'transaction')
    }

    /** Resolve with the executed event for a command, or reject when it fails. cancel() detaches the listener. */
    private waitForTerminalTx(commandId: string): {
        promise: Promise<TxChangedExecutedEvent>
        cancel: () => void
    } {
        let listener!: (ev: unknown) => void
        const cancel = () => this.removeListener('txChanged', listener)
        const promise = new Promise<TxChangedExecutedEvent>((resolve, reject) => {
            listener = (ev: unknown) => {
                const e = ev as {
                    commandId?: string
                    status?: string
                    payload?: { reason?: string }
                }
                if (e?.commandId !== commandId) return
                if (e.status === 'executed') {
                    cancel()
                    resolve(ev as TxChangedExecutedEvent)
                } else if (e.status === 'failed') {
                    cancel()
                    const reason = e.payload?.reason
                    if (reason === 'user_rejected') {
                        reject(new CauriUserRejectedError('rejected', 'User rejected transaction'))
                    } else {
                        reject(new Error(`Transaction failed${reason ? `: ${reason}` : ''}`))
                    }
                }
            }
            this.on('txChanged', listener)
        })
        return { promise, cancel }
    }

    private async doPrepareExecute(params: PrepareExecuteParams): Promise<null> {
        if (!this.sessionToken) throw new Error('Not connected')
        const popup = openPlaceholderPopup('cauriTx')
        if (!popup) {
            throw new CauriUserRejectedError(
                'popup_blocked',
                'Popup blocked. Allow popups for this site and try again.',
            )
        }
        this.activePopups.add(popup)

        try {
            const commandId = await this.beginPrepareExecute(params, popup)
            await this.awaitTxApproval(popup, commandId)
            return null
        } finally {
            this.releasePopup(popup)
        }
    }

    private async doPrepareExecuteAndWait(
        params: PrepareExecuteParams,
    ): Promise<PrepareExecuteAndWaitResult> {
        if (!this.sessionToken) throw new Error('Not connected')
        const popup = openPlaceholderPopup('cauriTx')
        if (!popup) {
            throw new CauriUserRejectedError(
                'popup_blocked',
                'Popup blocked. Allow popups for this site and try again.',
            )
        }
        this.activePopups.add(popup)

        try {
            const commandId = await this.beginPrepareExecute(params, popup)
            // Attach before awaiting approval so the terminal event can't be missed.
            const { promise: executed, cancel } = this.waitForTerminalTx(commandId)
            try {
                await this.awaitTxApproval(popup, commandId)
            } catch (err) {
                cancel()
                throw err
            }
            return { tx: await executed }
        } finally {
            this.releasePopup(popup)
        }
    }

    private async doLedgerApi(params: LedgerApiParams): Promise<LedgerApiResult> {
        if (!this.sessionToken) throw new Error('Not connected')
        return await this.rpc.call<LedgerApiResult>(
            'ledgerApi',
            params as unknown as Record<string, unknown>,
            this.sessionToken,
        )
    }

    private releasePopup(popup: Window): void {
        this.activePopups.delete(popup)
        try {
            popup.close()
        } catch {
            /* ignore */
        }
    }
}

/** Extract the last path segment from `{walletUiBase}/dapp/{connect|transaction}/{id}`. */
function lastPathSegment(userUrl: string): string {
    const trimmed = userUrl.replace(/\/+$/, '')
    return trimmed.substring(trimmed.lastIndexOf('/') + 1)
}
