# @lithiumdigital/cauri-dapp-sdk

Cauri Wallet dApp SDK. Ships a `ProviderAdapter` conforming to the Canton
Network wallet-discovery standard, for use with the PartyLayer generic
bridge (Path B — Discovery Adapter).

**Status: WIP, not yet published.**

## Usage (target)

```ts
import { createPartyLayer } from '@partylayer/sdk'
import { createCauriAdapter } from '@lithiumdigital/cauri-dapp-sdk'

const cauri = createCauriAdapter({
    apiBase: 'https://api.devnet.cauri.cc',
    walletUiBase: 'https://devnet.cauri.cc',
})

const pl = createPartyLayer({
    network: 'devnet',
    app: { name: 'My dApp' },
    adapters: [cauri],
})
```

## Development

```
npm install
npm run build
npm test
npm run typecheck
```

## References

- Standard: `@canton-network/core-wallet-discovery` (v1.8.0)
- Generic bridge docs: https://partylayer.xyz/docs/generic-bridge
- Reference adapter: `@k2flabs/walley-dapp-sdk`
