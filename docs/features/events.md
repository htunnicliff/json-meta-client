# Events

> TODO: Introduce JMAP state-change events and the server eventSourceUrl requirement.

- `onStateChange()`

## Subscribing

> TODO: Show awaiting onStateChange(handler, options) and the error-first callback.

## Change Payload

> TODO: Describe accountId, entity, state, and isPrimaryAccount; note that notifications do not contain updated records.

## Fetching Updates

> TODO: Outline fetching changes after a notification; choose the appropriate changes/queryChanges state token.

## Options and Cleanup

> TODO: Cover pingSeconds, AbortSignal, and the returned disposable; note event streams use a separate connection from HTTP hooks.

## Errors

> TODO: Explain callback StateChangeError versus subscription setup rejection; link to Errors.
