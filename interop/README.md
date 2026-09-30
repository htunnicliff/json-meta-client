# Real JMAP server interoperability

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test:interop
```

The command builds the package, downloads the official Linux x64 Stalwart Mail Server **0.11.8** release, verifies its pinned SHA-256, starts it on an available loopback port, provisions an isolated account and OAuth bearer token, and exercises the built package through its public exports. Linux x64, Node from `.node-version`, `curl`, `tar`, and network access to GitHub for the initial download are required. Docker and personal account credentials are unnecessary.

To use an already downloaded binary, or another supported operating system:

```sh
STALWART_BINARY=/absolute/path/to/stalwart-mail pnpm test:interop
```

The supplied binary must report exactly `0.11.8`. Download the matching platform asset from the [official pinned release](https://github.com/stalwartlabs/stalwart/releases/tag/v0.11.8). Automatic Linux x64 downloads must match SHA-256 `17ace571b012ff0228b276e09c83f28114824596279f86234f7a55e3773ad7df`.

Stalwart is an independently implemented Rust JMAP server. Its [pinned configuration example](https://github.com/stalwartlabs/stalwart/blob/v0.11.8/resources/config/config.toml) and [OAuth integration tests](https://github.com/stalwartlabs/stalwart/blob/v0.11.8/tests/src/jmap/auth_oauth.rs) document the configuration and authorization flow used here. Only server provisioning uses its management HTTP API; every JMAP operation under test uses `Client`, its public `api` and `blob` methods, and `ref()`.

The eight checks cover authenticated discovery and refresh, Core `Blob/copy`, mail query and selected properties, automatic batching, dependent result references, exact upload/download bytes, a method error with subsequent recovery, and a real HTTP 401. A forwarding fetch observer counts real HTTP requests to distinguish batching from separate successful requests. It does not replace server responses.

Every run uses a fresh temporary RocksDB database, a fixed fixture message, and a dedicated mailbox. The tests destroy their email and mailbox; the runner stops the server and removes its entire temporary directory, including accounts and uploaded blobs, on success or failure. The server binds only to loopback. Its optional web interface is initialized with an empty local ZIP so startup does not download an unpinned web interface. Spam reputation lookups are disabled. No external mail delivery occurs.

Setup and readiness failures print their phase and the last server logs. Protocol failures identify the failing test. The suite has a 30-second readiness deadline, a 30-second test deadline, and bounded server shutdown. An interrupted run also terminates the server and removes temporary state.

The separate `JMAP interoperability` GitHub Actions job runs on each pull request, weekly, and manually. Normal unit tests remain fast and independent of the server. Updating the tested server is an explicit change to the version, checksum, configuration, workflow, and this document, followed by a successful real-server run.
