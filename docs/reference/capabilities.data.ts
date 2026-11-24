import { fileURLToPath } from "node:url";

import ts from "typescript";
// cspell:words Fastmail

import * as builtIns from "../../src/capabilities/index.ts";

/** A field of a capability's account or session details */
export interface DetailField {
  name: string;
  type: string;
  optional: boolean;
}

export interface BuiltInCapability {
  urn: string;
  entities: string[];
  dependsOn?: string[];
  defaultAccount?: Record<string, "primary" | null>;
  /** The URN of the capability whose method contracts this one extends */
  extends?: string;
  /** Method names by entity, read from the capability's type */
  methods: Record<string, string[]>;
  accountDetails: DetailField[];
  sessionDetails: DetailField[];
  /** The specification that defines the capability */
  spec: { title: string; url: string };
}

const specs: Record<string, BuiltInCapability["spec"]> = {
  "urn:ietf:params:jmap:core": {
    title: "RFC 8620",
    url: "https://www.rfc-editor.org/info/rfc8620/",
  },
  "urn:ietf:params:jmap:mail": {
    title: "RFC 8621",
    url: "https://www.rfc-editor.org/info/rfc8621/",
  },
  "urn:ietf:params:jmap:submission": {
    title: "RFC 8621",
    url: "https://www.rfc-editor.org/info/rfc8621/",
  },
  "urn:ietf:params:jmap:vacationresponse": {
    title: "RFC 8621",
    url: "https://www.rfc-editor.org/info/rfc8621/",
  },
  "urn:ietf:params:jmap:mdn": {
    title: "RFC 9007",
    url: "https://www.rfc-editor.org/info/rfc9007/",
  },
  "urn:ietf:params:jmap:smimeverify": {
    title: "RFC 9219",
    url: "https://www.rfc-editor.org/info/rfc9219/",
  },
  "urn:ietf:params:jmap:blob": {
    title: "RFC 9404",
    url: "https://www.rfc-editor.org/info/rfc9404/",
  },
  "urn:ietf:params:jmap:quota": {
    title: "RFC 9425",
    url: "https://www.rfc-editor.org/info/rfc9425/",
  },
  "urn:ietf:params:jmap:contacts": {
    title: "RFC 9610",
    url: "https://www.rfc-editor.org/info/rfc9610/",
  },
  "urn:ietf:params:jmap:sieve": {
    title: "RFC 9661",
    url: "https://www.rfc-editor.org/info/rfc9661/",
  },
  "urn:ietf:params:jmap:principals": {
    title: "RFC 9670",
    url: "https://www.rfc-editor.org/info/rfc9670/",
  },
  "https://www.fastmail.com/dev/maskedemail": {
    title: "Fastmail developer documentation",
    url: "https://www.fastmail.com/dev/",
  },
};

/** The type of a property in a type literal */
const memberType = (literal: ts.TypeLiteralNode, name: string): ts.TypeNode | undefined =>
  literal.members.find(
    (member): member is ts.PropertySignature =>
      ts.isPropertySignature(member) && member.name.getText() === name,
  )?.type;

/**
 * Reads what exists only in each built-in capability's type annotation: its
 * methods and its account and session details. The annotation is
 * `Capability<Entity, Methods, Urn, AccountDetails, SessionDetails, ...>`
 * or `ExtendingCapability<{ ..., accountCapabilities, sessionCapabilities }>`.
 */
function readTypes(): Map<
  string,
  Pick<BuiltInCapability, "methods" | "accountDetails" | "sessionDetails">
> {
  const entry = fileURLToPath(new URL("../../src/capabilities/index.ts", import.meta.url));
  const program = ts.createProgram([entry], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowImportingTsExtensions: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  });
  const checker = program.getTypeChecker();
  const entrySymbol = checker.getSymbolAtLocation(program.getSourceFile(entry)!)!;

  const fields = (node: ts.TypeNode | undefined): DetailField[] => {
    if (!node) return [];
    const type = checker.getTypeFromTypeNode(node);
    return checker.getPropertiesOfType(type).map((property) => ({
      name: property.name,
      // The declared type, as its author wrote it
      type:
        property.declarations
          ?.find(ts.isPropertySignature)
          ?.type?.getText()
          .replaceAll(/\s+/g, " ") ??
        checker.typeToString(
          checker.getTypeOfSymbol(property),
          undefined,
          ts.TypeFormatFlags.NoTruncation,
        ),
      optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
    }));
  };

  const result = new Map<
    string,
    Pick<BuiltInCapability, "methods" | "accountDetails" | "sessionDetails">
  >();
  for (const exported of checker.getExportsOfModule(entrySymbol)) {
    const symbol =
      exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declaration = symbol.valueDeclaration;
    if (!declaration || !ts.isVariableDeclaration(declaration)) continue;
    const annotation = declaration.type;
    if (!annotation || !ts.isTypeReferenceNode(annotation)) continue;

    const [first, methodsNode, , accountNode, sessionNode] = annotation.typeArguments ?? [];
    const methods: Record<string, string[]> = {};
    let accountDetails: DetailField[] = [];
    let sessionDetails: DetailField[] = [];

    if (
      annotation.typeName.getText() === "ExtendingCapability" &&
      first &&
      ts.isTypeLiteralNode(first)
    ) {
      accountDetails = fields(memberType(first, "accountCapabilities"));
      sessionDetails = fields(memberType(first, "sessionCapabilities"));
    } else {
      if (methodsNode && ts.isTypeLiteralNode(methodsNode)) {
        for (const member of methodsNode.members) {
          if (!ts.isPropertySignature(member) || !member.type || !ts.isTypeLiteralNode(member.type))
            continue;
          methods[member.name.getText()] = member.type.members
            .map((method) => method.name?.getText() ?? "")
            .filter(Boolean);
        }
      }
      accountDetails = fields(accountNode);
      sessionDetails = fields(sessionNode);
    }
    result.set(exported.name, { methods, accountDetails, sessionDetails });
  }
  return result;
}

export default {
  load(): Record<string, BuiltInCapability> {
    const types = readTypes();
    return Object.fromEntries(
      Object.entries(builtIns).map(([name, capability]) => [
        name,
        {
          ...structuredClone(capability),
          methods: {},
          accountDetails: [],
          sessionDetails: [],
          ...types.get(name),
          spec: specs[capability.urn],
        },
      ]),
    );
  },
};
