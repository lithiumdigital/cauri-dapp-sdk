# Changelog

All notable changes to `@lithiumdigital/cauri-dapp-sdk` are documented in
this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

_No changes yet._

## 0.1.1 — 2026-08-03

Documentation improvements. No API or runtime changes.

- README expanded with clearer usage examples for both entry points
  (`createCauriAdapter` for explicit URLs, `cauriAdapterFactory` for
  wallet-discovery frameworks).
- Documented the full list of supported CIP-103 methods.
- Documented the SSE event names forwarded on the adapter.

## 0.1.0 — 2026-08-03

Initial release.

- `createCauriAdapter({apiBase, walletUiBase})` for explicit-URL wiring
- `cauriAdapterFactory` for wallet-discovery frameworks
- CIP-103 method dispatch: `connect`, `disconnect`, `isConnected`,
  `status`, `getActiveNetwork`, `listAccounts`, `getPrimaryAccount`,
  `signMessage`, `prepareExecute`, `ledgerApi`
- SSE stream forwarding: `txChanged`, `statusChanged`,
  `accountsChanged`, `messageSignature`
- Popup approval flow with `ev.origin` + `ev.source` enforcement
- Session persistence in `localStorage` with restore across page reloads
- `CauriRpcError` shape compatible with `@canton-network/core-types`
  `ErrorResponse`
