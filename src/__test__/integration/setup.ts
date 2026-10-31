// oxlint-disable no-await-in-loop -- Provision the domain before its user.
import { fileURLToPath } from "node:url";

import { GenericContainer, Wait } from "testcontainers";
import type { TestProject } from "vitest/node";

export interface StalwartFixture {
  sessionUrl: string;
  username: string;
  password: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    stalwart: StalwartFixture;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new GenericContainer("stalwartlabs/mail-server:v0.11.8")
    .withCopyFilesToContainer([
      {
        source: fileURLToPath(new URL("./fixtures/stalwart.toml", import.meta.url)),
        target: "/opt/stalwart-mail/etc/config.toml",
      },
    ])
    .withExposedPorts(8080)
    .withWaitStrategy(Wait.forHttp("/healthz/live", 8080).forStatusCode(200))
    .withStartupTimeout(120_000)
    .start();

  try {
    const baseUrl = `http://${container.getHost()}:${container.getMappedPort(8080)}`;
    const username = "integration@example.test";
    const password = "integration-user-password";

    // Management API calls only provision fixtures; protocol assertions use JsonMetaClient.
    for (const principal of [
      { type: "domain", name: "example.test" },
      {
        type: "individual",
        name: username,
        secrets: [password],
        emails: [username],
        roles: ["user"],
      },
    ]) {
      const response = await fetch(`${baseUrl}/api/principal`, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from("admin:integration-admin-password").toString("base64")}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(principal),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(
          `Stalwart fixture provisioning failed (${response.status}): ${await response.text()}`,
        );
      }
    }

    project.provide("stalwart", {
      sessionUrl: `${baseUrl}/.well-known/jmap`,
      username,
      password,
    });
  } catch (error) {
    await container.stop();
    throw error;
  }

  return async () => {
    await container.stop();
  };
}
