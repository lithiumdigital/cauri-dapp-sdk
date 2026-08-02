import type { ProviderAdapter } from '@canton-network/core-wallet-discovery'
import { createCauriAdapter } from './adapter'

const API_BASE_BY_WALLET_HOST: Record<string, string> = {
    'cauri.cc': 'https://api.mainnet.cauri.cc',
    'devnet.cauri.cc': 'https://api.devnet.cauri.cc',
}

function resolveApiBase(walletUiBase: string): string {
    const host = new URL(walletUiBase).host.toLowerCase()
    const apiBase = API_BASE_BY_WALLET_HOST[host]
    if (!apiBase) {
        throw new Error(
            `No apiBase mapping for wallet UI host "${host}". Add an entry to API_BASE_BY_WALLET_HOST or construct the adapter directly with createCauriAdapter({apiBase, walletUiBase}).`,
        )
    }
    return apiBase
}

/**
 * OfficialAdapterFactory for the PartyLayer generic bridge. For local
 * dev or hosts not in the mapping table, use `createCauriAdapter`
 * directly with an explicit `{apiBase, walletUiBase}`.
 */
export const cauriAdapterFactory = {
    providerId: 'cauri' as const,
    create(walletUiBase: string): ProviderAdapter {
        return createCauriAdapter({
            walletUiBase,
            apiBase: resolveApiBase(walletUiBase),
        })
    },
}
