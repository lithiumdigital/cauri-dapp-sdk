# @lithiumdigital/cauri-dapp-sdk

Cauri Wallet dApp SDK. Ships a `ProviderAdapter` conforming to the Canton
Network wallet-discovery standard, for use with the PartyLayer generic
bridge (Path B — Discovery Adapter).

## Installation

```
npm install @lithiumdigital/cauri-dapp-sdk
```

You also need the Canton Network core packages (peer dependencies):

```
npm install \
  @canton-network/core-splice-provider \
  @canton-network/core-types \
  @canton-network/core-wallet-dapp-rpc-client \
  @canton-network/core-wallet-discovery
```

## Usage

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

## Security

- The adapter persists a Cauri session id and session token in
  `localStorage` so that a page reload can restore the connection. XSS
  on the dApp origin can therefore exfiltrate the session token; treat
  the token as sensitive as any bearer credential on your origin.
- Popup replies are only accepted when the message origin matches the
  configured `walletUiBase` and the message source is the popup this
  SDK opened. Cross-origin frames and other windows are ignored.
- The SDK never reads a URL from the backend and navigates the popup
  to it — approval popup destinations are constructed from
  `walletUiBase`.

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
