import { Client } from "json-meta-client";
import { mail, submission, vacationResponse } from "json-meta-client/capabilities";

const sessionUrl = process.env.JMAP_SESSION_URL;
const bearerToken = process.env.JMAP_BEARER_TOKEN;
if (!sessionUrl || !bearerToken) {
  throw new Error("Set JMAP_SESSION_URL and JMAP_BEARER_TOKEN");
}

export const client = new Client({
  sessionUrl,
  bearerToken,
  capabilities: [mail, submission, vacationResponse],
});
