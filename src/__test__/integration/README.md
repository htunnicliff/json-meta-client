# Stalwart integration tests

Run `pnpm test:integration` with Docker running. The first run pulls the pinned
`stalwartlabs/mail-server:v0.11.8` image. Testcontainers starts one disposable server,
waits for HTTP health, provisions a domain and ordinary user, and stops the
container at the end (including provisioning failures). Ports are assigned by
Docker, and no host data directories are mounted. Credentials in this folder
are test fixtures only. HTTP and Basic authentication are for this local fixture.

The normal `pnpm test` command excludes this folder and does not need Docker.
The integration configuration runs files sequentially against the shared server;
future tests must create unique resources and clean them up.

`stalwart.test.ts` is a real smoke test of session discovery and Mailbox/get
through the public client. `client.ts` creates clients using the public request
hook for Basic authentication. Only fixture provisioning uses the management API.

The other tests are deliberately `it.todo` placeholders, grouped by the standards
files in PR #128. They describe future client assertions, not passing coverage.
When implementing them, use the new standards contracts with `defineCapability`
and `createClient`, then assert both inferred types and real server responses.
The base PR does not yet export or wire the new standards modules into the client;
this test-only PR does not change those production interfaces.

Check the session's advertised capabilities before enabling optional standards.
The pinned Stalwart version is a reproducible baseline, not a guarantee that every
extension is supported. WebSocket transport, external push delivery, multi-user
sharing, and local mail delivery will need additional fixtures or client support.
Contacts, JSContact, MDN, S/MIME, and Sieve also still have placeholder definitions
in the base PR. Keep those tests TODO until their types and runtime support exist;
record explicit skip reasons for unsupported server features when implementing.
