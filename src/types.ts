export interface CauriAdapterConfig {
    /** Base URL of the Cauri backend dApp API, e.g. https://api.devnet.cauri.cc */
    apiBase: string
    /** Base URL of the Cauri wallet UI (popup host), e.g. https://devnet.cauri.cc */
    walletUiBase: string
}

export interface CauriSessionRecord {
    sessionId: string
    sessionToken: string
}
