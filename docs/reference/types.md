# Types

The client uses the standards types included in this package. Import their namespaces from the package root:

```ts
import type { JmapCore, JmapMail } from "json-meta-client";

type Email = JmapMail.ReadableEmail;
type Upload = JmapCore.BlobUpload.Input;
```

Built-in Core, Mail, Submission, VacationResponse, and Blob methods use these contracts directly. Contacts and Sieve still have incomplete entity types; their methods use the shared Core contracts until their standards types are implemented. MaskedEmail also uses the shared contracts.

`/get` results follow the requested properties and include `id`. Omit `properties`, or pass `null`, to get all modeled fields. Email address fields such as `to` and `from` are nullable.

Core exposes the standard `Core.echo` method (replacing the previous `Core.get` typing). Echo and PushSubscription calls do not receive an injected account ID.

Request middleware may accept an optional second argument, `{ entity, method }`, to identify the method being transformed. Existing one-argument middleware continues to work.

The standards coverage is still partial. The exported namespaces describe the declarations implemented so far; they do not imply full support for every RFC.
