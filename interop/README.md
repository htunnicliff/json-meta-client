# Real JMAP server interoperability

The interoperability suite runs the built client against Stalwart Mail Server
**0.11.8**, an independent Rust implementation of JMAP. It creates a local server
and test account, so you can run it without Docker or personal credentials.

## Run the suite

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test:interop
```

The runner builds the package, downloads the official Linux x64 server release,
verifies its pinned SHA-256, and starts it on an available loopback port. It then
provisions an isolated account and OAuth bearer token and runs the tests through
the package's public exports.

Automatic downloads require Linux x64, the Node version in `.node-version`,
`curl`, `tar`, and access to GitHub. To use a local binary, including on another
supported operating system:

```sh
STALWART_BINARY=/absolute/path/to/stalwart-mail pnpm test:interop
```

The binary must report version `0.11.8`. Obtain the matching platform asset from
the [official release](https://github.com/stalwartlabs/stalwart/releases/tag/v0.11.8).
The automatic Linux x64 download must have SHA-256
`17ace571b012ff0228b276e09c83f28114824596279f86234f7a55e3773ad7df`.

## What the tests verify

Eight checks cover authenticated discovery and refresh, Core `Blob/copy`, mail
queries and property selection, automatic batching, result references, exact
upload/download bytes, recovery after a method error, and an HTTP 401 response.
A Fetch observer forwards real requests and counts them to verify batching;
responses come from the server.

Server provisioning uses Stalwart's management HTTP API. All tested JMAP
operations use `Client`, its `api` and `blob` methods, and `ref()`. The server's
[pinned configuration example](https://github.com/stalwartlabs/stalwart/blob/v0.11.8/resources/config/config.toml)
and [OAuth tests](https://github.com/stalwartlabs/stalwart/blob/v0.11.8/tests/src/jmap/auth_oauth.rs)
provide the configuration and authorization references.

## Isolation and failures

Each run creates a temporary RocksDB database, a fixture message, and a dedicated
mailbox. Tests delete their email and mailbox; the runner stops the server and
removes all temporary state, including accounts and blobs, on success, failure,
or interruption.

The server binds to loopback. An empty local ZIP initializes its optional web
interface without an additional download. Spam reputation lookups are disabled,
and the suite sends no external mail.

Setup failures report their phase and the last server logs. Test failures name
the failing check. Readiness and tests each have a 30-second deadline, and server
shutdown is also bounded.

The `JMAP interoperability` GitHub Actions job runs on pull requests, weekly, and
on manual dispatch. Unit tests run independently of this server. To update the
tested release, change the version, checksum, configuration, workflow, and this
document together, then complete a successful real-server run.
