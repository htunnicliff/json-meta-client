## Agent skills

`docs/` is the VitePress site. When skills refer to `docs/agents/`, use
`.agents/docs/` in this repo; when they refer to `docs/adr/`, use root `adr/`.

- GitHub issues: before reading or changing issues, read
  [.agents/docs/issue-tracker.md](.agents/docs/issue-tracker.md).
- Triage: before triaging issues or changing triage labels, read
  [.agents/docs/triage-labels.md](.agents/docs/triage-labels.md).
- Domain: before exploring code, naming domain concepts, or proposing
  design changes, read [.agents/docs/domain.md](.agents/docs/domain.md).
- Contributing: before changing code, configuration, or documentation, read
  [.agents/docs/contributing.md](.agents/docs/contributing.md).
- Agent attribution: before attributing work to an agent, read
  [.agents/docs/agent-attribution.md](.agents/docs/agent-attribution.md).

## Documentation examples

Code examples in `docs/` and `README.md` show the happy path:

- Let the client fill in `accountId` from the primary account. Pass it only in
  examples about working with multiple accounts.
- Assume the server provides everything the example needs: capabilities,
  accounts, mailboxes, identities, and created objects. Read those values
  directly, using a non-null assertion (`!`) where the type checker requires
  one. Show a check only when the check itself is the example's subject, such
  as the error-handling and capability pages.
- Let batching group calls, since it is a core feature of the library. Create
  the calls together and await only the results the example uses. A call that
  only feeds a result reference needs no `await`; prefix a call statement
  whose unused result is a promise with `void`. Other unused results, such as
  a constructed client, need no `void`. Reserve `Promise.all` for examples
  that use several results, and create the calls inline inside it.
