# @lithiumdigital/cauri-dapp-sdk

dApp SDK for [Cauri Wallet](https://cauri.cc) on the Canton Network.
Ships a CIP-103 compliant `ProviderAdapter` that a dApp can drop into
its wallet-selection UI to prompt users for connection, message
signing, and prepared-transaction execution against a live Cauri
wallet session.

## Installation

```
npm install @lithiumdigital/cauri-dapp-sdk
```

Peer dependencies (Canton Network core packages, installed once per
dApp):

```
npm install \
  @canton-network/core-splice-provider \
  @canton-network/core-types \
  @canton-network/core-wallet-dapp-rpc-client \
  @canton-network/core-wallet-discovery
```

## Usage

### `createCauriAdapter` — explicit URLs

Construct an adapter against the Cauri wallet host of your choice.
Use this for local development, staging deployments, or any custom
wiring where you supply the URLs directly.

```ts
import { createCauriAdapter } from '@lithiumdigital/cauri-dapp-sdk'

const cauri = createCauriAdapter({
    apiBase: 'https://api.devnet.cauri.cc',
    walletUiBase: 'https://devnet.cauri.cc',
})

const provider = cauri.provider()
await provider.request({ method: 'connect', params: { ... } })
```

The returned adapter conforms to the
[`ProviderAdapter`](https://www.npmjs.com/package/@canton-network/core-wallet-discovery)
interface and can be handed to any wallet-discovery consumer that
expects that shape.

### `cauriAdapterFactory` — discovery-adapter factory

For discovery frameworks that resolve the wallet host from a registry
entry and pass it into a factory (rather than the dApp author
constructing the adapter directly). The factory maps the resolved
production host (`cauri.cc`, `devnet.cauri.cc`) to the corresponding
Cauri dApp API endpoint internally.

```ts
import { cauriAdapterFactory } from '@lithiumdigital/cauri-dapp-sdk'

// Passed to a wallet-discovery framework alongside other factories.
const factories = [cauriAdapterFactory, /* ... */]
```

## Supported CIP-103 methods

`connect`, `disconnect`, `isConnected`, `status`, `getActiveNetwork`,
`listAccounts`, `getPrimaryAccount`, `signMessage`, `prepareExecute`,
`ledgerApi`.

## SSE events

The adapter forwards Cauri wallet events over the standard
`ProviderAdapter` `on()` surface: `txChanged`, `statusChanged`,
`accountsChanged`, `messageSignature`.

## Security

- The adapter persists a Cauri session id and session token in
  `localStorage` so a page reload can restore the connection. XSS on
  the dApp origin can therefore exfiltrate the session token; treat
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

## Versioning

Semantic versioning. The **public API** is everything exported from
`src/index.ts` (`createCauriAdapter`, `cauriAdapterFactory`,
`CauriRpcError`, `CauriAdapterConfig`, `CauriSessionRecord`) and the
runtime behaviour of those exports (RPC method surface, event names,
storage key). Anything else is internal and may change in any release.

- **Major** — breaking change to any of the above (renamed export,
  removed method, changed event name, changed storage key/shape).
- **Minor** — additive change (new export, new supported method,
  additional optional config).
- **Patch** — bug fix or internal change with no consumer-visible
  behaviour change.

See [CHANGELOG.md](./CHANGELOG.md) for what shipped in each version.

## References

- CIP-103 (Canton Network wallet-discovery standard):
  `@canton-network/core-wallet-discovery`
- Cauri Wallet: https://cauri.cc
