import { client } from "./client.ts";

const session = await client.session;
const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (!accountId) throw new Error("No primary mail account");

const uploaded = await client.blob.upload(new Blob(["hello"], { type: "text/plain" }), {
  accountId,
});
const response = await client.blob.download({
  accountId: uploaded.accountId,
  blobId: uploaded.blobId,
  name: "hello.txt",
  type: "text/plain",
});
console.log(await response.text());

const controller = new AbortController();
const subscription = await client.onStateChange(
  (change) => {
    console.log(change.entity, change.accountId, change.state);
  },
  { signal: controller.signal, pingSeconds: 30 },
);
process.once("SIGINT", () => {
  controller.abort();
  subscription[Symbol.dispose]();
});
