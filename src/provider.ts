import { AbstractProvider } from '@canton-network/core-splice-provider'
import type { RpcTypes as DappRpcTypes } from '@canton-network/core-wallet-dapp-rpc-client'
import type { RequestArgs } from '@canton-network/core-types'
import type { CauriAdapterConfig } from './types'

export class CauriProvider extends AbstractProvider<DappRpcTypes> {
    constructor(private readonly config: CauriAdapterConfig) {
        super()
    }

    async request<M extends keyof DappRpcTypes>(
        _args: RequestArgs<DappRpcTypes, M>,
    ): Promise<DappRpcTypes[M]['result']> {
        // TODO: dispatch to Cauri backend at `${this.config.apiBase}/api/dapp`.
        // - connect / signMessage / prepareExecute open the popup at
        //   `${this.config.walletUiBase}/dapp/<screen>/<id>` from the sync
        //   call stack of the user action.
        // - popup posts result back via window.opener.postMessage.
        // - validate ev.origin === walletUiBase and ev.source === popup.
        // - resolve with the CIP-0103 result for the requested method.
        throw new Error('CauriProvider.request not implemented')
    }
}
