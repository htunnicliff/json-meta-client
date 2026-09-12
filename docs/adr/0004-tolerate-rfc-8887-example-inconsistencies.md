# Tolerate RFC 8887 example inconsistencies

The client will emit frames that follow the formal RFC 8620 and RFC 8887 definitions, but its decoder will accept the RFC 8887 examples that use a null `requestId` or omit `sessionState`. Strictly rejecting those published examples would reduce interoperability, while this narrowly scoped receive-side tolerance does not weaken outbound conformance.
