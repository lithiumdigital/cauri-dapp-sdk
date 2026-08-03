import type { Provider } from '@canton-network/core-splice-provider'
import type { RpcTypes as DappRpcTypes } from '@canton-network/core-wallet-dapp-rpc-client'
import type {
    ProviderAdapter,
    WalletInfo,
} from '@canton-network/core-wallet-discovery'
import { CauriProvider } from './provider'
import { clearSession, loadSession } from './storage'
import type { CauriAdapterConfig } from './types'

const CAURI_ICON_URL =
    'https://raw.githubusercontent.com/lithiumdigital/cauri-dapp-sdk/main/assets/cauri.svg'

export function createCauriAdapter(
    config: CauriAdapterConfig,
): ProviderAdapter {
    let current: CauriProvider | null = null

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
                reuseGlobalWalletPopup: false,
            }
        },

        detect(): Promise<boolean> {
            return Promise.resolve(true)
        },

        provider(): Provider<DappRpcTypes> {
            if (!current) {
                const persisted = loadSession()
                current = persisted
                    ? new CauriProvider(config, {
                          sessionId: persisted.sessionId,
                          sessionToken: persisted.sessionToken,
                      })
                    : new CauriProvider(config)
            }
            return current
        },

        teardown(): void {
            if (current) {
                current.closeAllPopups()
                current.closeEventStream()
                current = null
            }
        },

        async restore(): Promise<Provider<DappRpcTypes> | null> {
            const persisted = loadSession()
            if (!persisted) return null

            // Reuse the provider() instance if it already holds the same session;
            // constructing a second one opens a second EventSource and orphans the first.
            if (current?.hasSession()) {
                const existing = current
                try {
                    const status = await existing.request({ method: 'isConnected' })
                    if (!status.isConnected) {
                        clearSession()
                        existing.closeAllPopups()
                        existing.closeEventStream()
                        current = null
                        return null
                    }
                    return existing
                } catch {
                    clearSession()
                    existing.closeAllPopups()
                    existing.closeEventStream()
                    current = null
                    return null
                }
            }

            const provider = new CauriProvider(config, {
                sessionId: persisted.sessionId,
                sessionToken: persisted.sessionToken,
            })

            try {
                const status = await provider.request({ method: 'isConnected' })
                if (!status.isConnected) {
                    clearSession()
                    provider.closeEventStream()
                    return null
                }
                current = provider
                return provider
            } catch {
                clearSession()
                provider.closeEventStream()
                return null
            }
        },
    }
}
