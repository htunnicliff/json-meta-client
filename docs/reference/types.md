# Types

The client uses its built-in RFC types for method arguments, responses, session metadata, and entities. Import these types from the matching module:

| Module                                  | Types                                                      |
| --------------------------------------- | ---------------------------------------------------------- |
| `json-meta-client/rfc-types/core`       | JMAP Core, WebSocket, Blob, Quota, Sharing, and VAPID      |
| `json-meta-client/rfc-types/mail`       | Mail, Submission, VacationResponse, MDN, S/MIME, and Sieve |
| `json-meta-client/rfc-types/contacts`   | AddressBook and ContactCard                                |
| `json-meta-client/rfc-types/formats`    | JSContact cards and their components                       |
| `json-meta-client/rfc-types/extensions` | Session and account capability metadata interfaces         |

```ts
import type {
  MethodGet,
  Session,
} from "json-meta-client/rfc-types/core";
import type {
  EmailGet,
  ReadableEmail,
} from "json-meta-client/rfc-types/mail";

// Entity-specific namespaces describe method inputs, outputs, and contracts.
type EmailArguments = EmailGet.Input;
type EmailResponse = EmailGet.Output<{
  properties: ["subject"];
}>;

// Generic helpers support custom capabilities.
interface Widget {
  id: string;
  name: string;
}
type WidgetGet = MethodGet.Contract<Widget>;
```

Use `ClientSession` from `json-meta-client` for a session that also includes the capability metadata configured on a client. `Session` describes the RFC session, where the core capability and its limits are required.

Mail types distinguish `ReadableEmail` from `WritableEmail`. Email address names and absent address lists use `null`; creating an email requires `mailboxIds`. Built-in Blob, Contacts, and Sieve methods also use the RFC contracts to check inputs and infer responses.
