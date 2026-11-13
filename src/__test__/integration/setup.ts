// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { resolve } from "node:path";

import {
  GenericContainer,
  getContainerRuntimeClient,
  RandomPortGenerator,
  Wait,
} from "testcontainers";
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

const adminCredentials = "admin:integration-admin-password";

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  // Stalwart advertises JMAP URLs from STALWART_PUBLIC_URL, which must be known
  // before the container starts, so pick the host port up front.
  const host = (await getContainerRuntimeClient()).info.containerRuntime.host;
  const port = await new RandomPortGenerator().generatePort();
  const baseUrl = `http://${host}:${port}`;

  const container = await new GenericContainer("stalwartlabs/stalwart:v1.1.0")
    .withCopyFilesToContainer([
      {
        source: resolve(import.meta.dirname, "fixtures/stalwart.json"),
        target: "/etc/stalwart/config.json",
      },
    ])
    .withEnvironment({
      STALWART_RECOVERY_ADMIN: adminCredentials,
      STALWART_PUBLIC_URL: baseUrl,
    })
    .withExposedPorts({ container: 8080, host: port })
    .withWaitStrategy(Wait.forHttp("/healthz/live", 8080).forStatusCode(200))
    .withStartupTimeout(120_000)
    .start();

  try {
    const username = "integration@example.test";
    const password = "integration-user-password";

    // Management API calls only provision fixtures; protocol assertions use JsonMetaClient.
    const response = await fetch(`${baseUrl}/jmap/`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(adminCredentials).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        using: ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
        methodCalls: [
          ["x:Domain/set", { create: { domain: { name: "example.test" } } }, "domain"],
          [
            "x:Account/set",
            {
              create: {
                user: {
                  "@type": "User",
                  name: "integration",
                  domainId: "#domain",
                  credentials: { 0: { "@type": "Password", secret: password } },
                },
              },
            },
            "user",
          ],
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    if (!response.ok || body.includes('"notCreated"') || !body.includes('"created"')) {
      throw new Error(`Stalwart fixture provisioning failed (${response.status}): ${body}`);
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
