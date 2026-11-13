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

import { defineCapability, JsonMetaClient } from "../../index.ts";
import type { MethodSet } from "../../rfc-types/core/index.ts";

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

interface Domain {
  id: string;
  name: string;
}

interface Account {
  id: string;
  "@type": "User";
  name: string;
  domainId: string;
  credentials: Record<string, { "@type": "Password"; secret: string }>;
}

/** The parts of Stalwart's management API that provisioning uses */
const stalwartManagement = defineCapability({
  urn: "urn:stalwart:jmap",
  entities: ["x:Domain", "x:Account"],
}).withMethods<{
  "x:Domain": { set: { input: MethodSet.Input<Domain>; output: MethodSet.Output<Domain> } };
  "x:Account": { set: { input: MethodSet.Input<Account>; output: MethodSet.Output<Account> } };
}>();

const admin = { username: "admin", password: "integration-admin-password" };

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
      STALWART_RECOVERY_ADMIN: `${admin.username}:${admin.password}`,
      STALWART_PUBLIC_URL: baseUrl,
    })
    .withExposedPorts({ container: 8080, host: port })
    .withWaitStrategy(Wait.forHttp("/healthz/live", 8080).forStatusCode(200))
    .withStartupTimeout(120_000)
    .start();

  try {
    const username = "integration@example.test";
    const password = "integration-user-password";

    // Management calls only provision fixtures; protocol assertions live in the tests.
    const client = new JsonMetaClient({
      sessionUrl: `${baseUrl}/.well-known/jmap`,
      capabilities: [stalwartManagement],
      auth: admin,
    });
    const domains = client.api["x:Domain"].set({
      create: { domain: { name: "example.test" } },
    });
    const accounts = client.api["x:Account"].set({
      create: {
        user: {
          "@type": "User",
          name: "integration",
          domainId: domains.createdRef("domain"),
          credentials: { 0: { "@type": "Password", secret: password } },
        },
      },
    });
    for (const result of await Promise.all([domains, accounts])) {
      if (result.notCreated) {
        throw new Error(
          `Stalwart fixture provisioning failed: ${JSON.stringify(result.notCreated)}`,
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
