# Security policy

json-meta-client sends your JMAP credentials with every request it makes,
including session, API, blob, event stream, and WebSocket requests. Please
report anything that could expose those credentials, or let a server or
another party act with them, as a vulnerability.

## Supported versions

Security fixes usually go into the latest release. Whether an older
version also gets a fix is up to the maintainer.

## Reporting a vulnerability

Report vulnerabilities privately through GitHub:
[open a security advisory](https://github.com/htunnicliff/json-meta-client/security/advisories/new).
Please don't open a public issue or pull request for a vulnerability.

Include what you can of the following:

- The affected version and runtime (Node.js, Deno, Bun, or a browser).
- The transport (`httpTransport()` or `webSocketTransport()`) and the JMAP
  server, if the issue depends on them.
- Steps or code that reproduce the issue, and what an attacker gains.
