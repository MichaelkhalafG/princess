// Stub for the `server-only` package in the vitest (Node) environment.
//
// `server-only` throws unless the bundler sets the `react-server` export
// condition (Next does; plain Node/vitest does not). Aliasing it to this empty
// module lets unit tests import server-only modules (e.g. lib/payments,
// lib/notifications). The real server-only guard still applies in the app build.
export {};
