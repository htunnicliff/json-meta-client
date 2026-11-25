# Versioning

json-meta-client follows [semantic versioning](https://semver.org/) from
1.0.0 on. Most of the library's value is in its types, so this page says
how changes to types, as well as to runtime behavior, map to version
numbers.

In short: code that compiles and runs against a 1.x release keeps compiling
and running on later 1.x releases, as long as it uses the library as the
JMAP specifications and this documentation describe. The exceptions are
listed under [Type corrections](#type-corrections).

## Major versions

A major version can:

- Remove or rename an export, method, option, or type.
- Change runtime behavior that the documentation describes, such as a
  default, an error class, or when the client sends a request.
- Make an argument type reject input that the specifications allow, or make
  a result type wider in a way that code reading it must handle.
- Raise the minimum supported Node.js or TypeScript version, or drop
  support for a runtime.
- Remove a built-in capability.

## Minor versions

A minor version can:

- Add capabilities, entities, methods, options, optional arguments, error
  classes, or exports.
- Add types for an RFC or extension, including on the `json-meta-client/rfc-types`
  entry point.
- Narrow a result type from `unknown`, or from a wider type, to what the
  specification defines. Parsed `header:` properties on `Email` are an
  example.
- Make a [type correction](#type-corrections).
- Deprecate an API. It keeps working until the next major version.

## Patch versions

A patch version fixes bugs without changing documented behavior. It can
also update dependencies, as long as the published types and the supported
runtimes stay the same.

## Type corrections

A type that disagrees with a JMAP specification is a bug. When code that
compiles today can only fail at runtime, or be rejected by the server,
fixing the type to reject that code is a type correction, not a breaking
change. Type corrections ship in minor versions, and the changelog lists
each one under its own heading, so you can find the code it affects.

For example, if an argument accepts a property path that no server could
resolve, a later minor version can make that path a type error.

A change that makes code that works against a real server stop compiling is
not a correction. It waits for a major version.

## TypeScript

Type checking depends on the TypeScript version, and new TypeScript versions
sometimes infer differently. A change in TypeScript itself that affects how
the library's types check isn't a breaking change in the library, but it is
treated as a bug and fixed when it's found.

Types that are not exported, including those under internal paths, aren't
part of the API and can change in any version. So can the exact way a type
is written, such as whether it's an interface or an alias, as long as the
same code still compiles.

## RFC types

The `json-meta-client/rfc-types` entry point follows the published RFCs.
Types for an Internet-Draft, or for a vendor extension under `community:`,
follow that document and can change in a minor version when the document
changes.

## Pre-releases

Versions with a pre-release tag, such as `2.0.0-alpha.0`, make no
compatibility promises between each other.
