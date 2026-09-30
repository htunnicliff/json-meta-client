import {
  Client,
  JmapAbortError,
  JmapClientError,
  JmapConfigurationError,
  JmapError,
  JmapHttpError,
  JmapMethodError,
  JmapProtocolError,
  JmapRequestLimitError,
  JmapTransportError,
  type JmapRequestContext,
  type JmapResponseContext,
  defineCapability,
  ref,
  type Apply,
  type Capability,
  type CapabilityMethods,
  type ClientOptions,
  type ConfigurableCapability,
  type EffectiveMethodInput,
  type InferMethodsFromCapability,
  type MethodArguments,
  type MethodContract,
  type Middleware,
  type MethodCallContext,
  type MethodCallOptions,
  type PendingMethodCall,
  type Ref,
  type AllowRefs,
  type UnpackRefs,
  type OnStateChangeOptions,
  type StateChangePayload,
} from "json-meta-client";
import {
  core,
  mail,
  blob,
  contacts,
  sieve,
  submission,
  vacationResponse,
} from "json-meta-client/capabilities";
import {
  maskedEmail,
  type MaskedEmail,
  type MaskedEmailContracts,
} from "json-meta-client/capabilities/community";

const request: JmapRequestContext = { url: "https://example.test/api", method: "POST" };
const responseContext: JmapResponseContext = { request, response: new Response(), payload: {} };
const errors: JmapClientError[] = [
  new JmapAbortError("reason"),
  new JmapClientError("custom", "custom"),
  new JmapConfigurationError("configuration"),
  new JmapError("method", { type: "invalidArguments" }),
  new JmapMethodError("method", { type: "invalidArguments" }),
  new JmapHttpError(new Response(null, { status: 503 }), request),
  new JmapProtocolError("protocol", responseContext),
  new JmapRequestLimitError("maxCallsInRequest", 1, 2, ["call"], request),
  new JmapTransportError("transport", request, new Error("offline")),
];

interface EchoContract {
  input: { accountId: string; value: string };
  output: this["input"]["value"];
}

const example = defineCapability({ urn: "test:packed", entities: ["Example"] }).withMethods<{
  Example: { echo: EchoContract };
}>();

const options: ClientOptions<[typeof mail, typeof example]> = {
  sessionUrl: "https://example.test/.well-known/jmap",
  bearerToken: "token",
  capabilities: [mail, example],
};

const client = new Client(options);
const callOptions: MethodCallOptions = { signal: new AbortController().signal };
const pending = client.api.Email.get({ properties: ["id", "subject"] }, callOptions);
const publicPending: PendingMethodCall<
  { accountId: string; properties: ("id" | "subject")[] },
  Awaited<typeof pending>
> = pending;
const id: string = (await pending).list[0].id;
const subject: string | undefined = (await pending).list[0].subject;
const ids = ref(pending, "/list/*/id");
const refValue: Ref<string[]> = ids;
const supplied = { value: "literal" } as const;
const narrowed = client.api.Example.echo(supplied);
const literal: "literal" = await narrowed;
const echo = client.api.Core.echo({ hello: true, high: 5, nested: { id: ids } });
const echoed: { hello: boolean; high: number; nested: { id: string[] } } = await echo;
let methodContext: MethodCallContext | undefined;
const middleware: Middleware = (payload, context) => {
  methodContext = context;
  return payload;
};
const allowed: AllowRefs<string[]> = refValue;
const unpacked: UnpackRefs<typeof allowed> = [];
const state: StateChangePayload = {
  accountId: "account",
  entity: "Email",
  state: "state",
  isPrimaryAccount: true,
};
const stateOptions: OnStateChangeOptions = {
  signal: new AbortController().signal,
  pingSeconds: 15,
};
const record: MaskedEmail = (
  await new Client({ ...options, capabilities: [maskedEmail] }).api.MaskedEmail.get({})
).list[0];
const contract: MaskedEmailContracts.Get.Input = { accountId: "account" };
const capability: Capability<"Example"> = example;
const configurable: ConfigurableCapability<"Example"> = defineCapability({
  urn: "test:packed",
  entities: ["Example"],
});
const contracts: CapabilityMethods<"Example"> = {
  Example: { echo: { input: { accountId: "account", value: "value" }, output: "value" } },
};
const method: MethodContract = contracts.Example.echo;
const args: MethodArguments<EchoContract> = { value: "literal" };
const effective: EffectiveMethodInput<EchoContract, typeof args> = {
  accountId: "account",
  value: "literal",
};
const applied: Apply<EchoContract, typeof effective> = "literal";
const methods: InferMethodsFromCapability<typeof example> = {
  Example: { echo: { input: { accountId: "account", value: "value" }, output: "value" } },
};

export {
  errors,
  request,
  responseContext,
  core,
  mail,
  blob,
  contacts,
  sieve,
  submission,
  vacationResponse,
  maskedEmail,
  publicPending,
  id,
  subject,
  literal,
  echoed,
  middleware,
  methodContext,
  allowed,
  unpacked,
  state,
  stateOptions,
  record,
  contract,
  capability,
  configurable,
  contracts,
  method,
  args,
  effective,
  applied,
  methods,
};
