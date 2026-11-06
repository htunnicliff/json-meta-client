---
layout: home

hero:
  name: JSON Meta Client
  text: A typed JMAP client for your application.
  tagline: Work with mail, contacts, and server extensions in TypeScript. Built for Node.js and modern browsers, with automatic batching and typed results.
  actions:
    - theme: brand
      text: Make your first request
      link: /getting-started
    - theme: alt
      text: API reference
      link: /reference/api
    - theme: alt
      text: View on GitHub
      link: https://github.com/htunnicliff/json-meta-client

features:
  - title: Typed method calls
    details: Call JMAP methods with typed arguments and results. Select the properties you need and get result types that reflect your selection.
    link: /features/method-calls
    linkText: Make method calls
  - title: Automatic batching
    details: Queue calls together in one request and pass results between them with JMAP result references. Use isolated queues when work needs its own batch.
    link: /advanced/batching
    linkText: Control request batches
  - title: Choose your capabilities
    details: Configure built-in support for mail, submission, contacts, and more. Check server and account capabilities before using a feature.
    link: /features/capabilities
    linkText: Choose capabilities and accounts
  - title: State change events
    details: Subscribe to server-sent state changes, then fetch changes for the affected data. Dispose of subscriptions when their owner finishes.
    link: /features/events
    linkText: Listen for changes
  - title: Blob transfers
    details: Upload attachments and download blobs through the URLs advertised by your JMAP server, using the client's authentication.
    link: /features/blobs
    linkText: Transfer files
  - title: Server extensions
    details: Describe custom capabilities and method contracts for your server. Keep typed arguments, results, and metadata alongside the built-in capabilities.
    link: /advanced/extending
    linkText: Add an extension
---
