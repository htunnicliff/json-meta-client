# Security policy

json-meta-client sends your JMAP credentials with every request it makes,
including session, API, blob, event stream, and WebSocket requests. Please
report anything that could expose those credentials, or let a server or
another party act with them, as a vulnerability.

## Supported versions

Security fixes are released for the latest minor version of the current
major version. After a new major version ships, the previous major version
gets security fixes for six months.

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

Report vulnerabilities privately through GitHub:
[open a security advisory](https://github.com/htunnicliff/json-meta-client/security/advisories/new).
Please don't open a public issue or pull request for a vulnerability.

Include what you can of the following:

- The affected version and runtime (Node.js, Deno, Bun, or a browser).
- The transport (`httpTransport()` or `webSocketTransport()`) and the JMAP
  server, if the issue depends on them.
- Steps or code that reproduce the issue, and what an attacker gains.

You can expect an acknowledgment within a week. Once a fix is ready, it is
released and the advisory is published, crediting you unless you ask
otherwise.
