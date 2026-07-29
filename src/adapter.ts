import type { Provider } from '@canton-network/core-splice-provider'
import type { RpcTypes as DappRpcTypes } from '@canton-network/core-wallet-dapp-rpc-client'
import type {
    ProviderAdapter,
    WalletInfo,
} from '@canton-network/core-wallet-discovery'
import { CauriProvider } from './provider'
import type { CauriAdapterConfig } from './types'

const CAURI_ICON_URL = 'https://cauri.cc/icon.svg'

export function createCauriAdapter(
    config: CauriAdapterConfig,
): ProviderAdapter {
    return {
        providerId: 'cauri',
        name: 'Cauri',
        type: 'remote',
        icon: CAURI_ICON_URL,

        getInfo(): WalletInfo {
            return {
                providerId: 'cauri',
                name: 'Cauri',
                type: 'remote',
                icon: CAURI_ICON_URL,
                url: config.walletUiBase,
                // One popup per approval request — see docs/DECISIONS.md.
                reuseGlobalWalletPopup: false,
            }
        },

        detect(): Promise<boolean> {
            return Promise.resolve(true)
        },

        provider(): Provider<DappRpcTypes> {
            return new CauriProvider(config)
        },

        teardown(): void {
            // TODO: close any open popup window opened by provider().
        },

        async restore(): Promise<Provider<DappRpcTypes> | null> {
            // TODO: read cauriSessionId + cauriSessionToken from storage,
            // call isConnected against apiBase, return a CauriProvider or null.
            // Must be gesture-free (no popup).
            return null
        },
    }
}
