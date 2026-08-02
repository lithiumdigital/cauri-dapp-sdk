import type { ProviderAdapter } from '@canton-network/core-wallet-discovery'
import { createCauriAdapter } from './adapter'

/**
 * Explicit mapping from the wallet UI origin (the value published in the
 * PartyLayer registry's `networkHosts`) to the corresponding dApp API
 * origin. Hostnames rather than URLs so a stray trailing slash or scheme
 * mismatch doesn't miss the lookup.
 *
 * Kept explicit rather than derived (e.g. by prepending "api.") because
 * mainnet is served from the apex domain (cauri.cc) while its API lives
 * at api.mainnet.cauri.cc — a naive transform breaks that case.
 */
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
 * OfficialAdapterFactory for the PartyLayer generic bridge. The bridge
 * resolves `adapter.networkHosts[activeNetwork]` from the registry entry
 * and calls `create(host)` synchronously on the popup-safe gesture path.
 * `create` returns a fresh ProviderAdapter bound to the resolved host.
 *
 * For local dev or bespoke deployments where the URLs don't match the
 * hosted-Cauri convention, use `createCauriAdapter({apiBase, walletUiBase})`
 * directly and pass it via `additionalAdapters` instead.
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
