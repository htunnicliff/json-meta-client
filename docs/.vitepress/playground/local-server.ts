/**
 * Steps to run a local Stalwart for the playground's connected mode, using
 * the version the integration suite pins (`src/__test__/integration/setup.ts`).
 * The connect dialog shows these exact commands.
 */

export const LOCAL_SESSION_URL = "http://localhost:8080/.well-known/jmap";
export const LOCAL_USERNAME = "playground@example.test";
export const LOCAL_PASSWORD = "playground-password";

/** Start Stalwart with a local database and a recovery administrator */
export const startCommand = `echo '{"@type":"RocksDb","path":"/var/lib/stalwart/"}' > stalwart.json
docker run -d --name jmap-playground -p 8080:8080 \\
  -v "$PWD/stalwart.json:/etc/stalwart/config.json:ro" \\
  -e STALWART_RECOVERY_ADMIN=admin:playground-admin \\
  -e STALWART_PUBLIC_URL=http://localhost:8080 \\
  stalwartlabs/stalwart:v1.1.0`;

const setupRequest = {
  using: ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
  methodCalls: [
    ["x:Http/set", { update: { singleton: { usePermissiveCors: true } } }, "cors"],
    ["x:Domain/set", { create: { domain: { name: "example.test" } } }, "domain"],
    [
      "x:Account/set",
      {
        create: {
          user: {
            "@type": "User",
            name: "playground",
            domainId: "#domain",
            credentials: { 0: { "@type": "Password", secret: LOCAL_PASSWORD } },
          },
        },
      },
      "account",
    ],
  ],
};

/**
 * Allow cross-origin requests, which takes effect on restart, and create the
 * test account
 */
export const setupCommand = `curl -u admin:playground-admin -H 'content-type: application/json' \\
  http://localhost:8080/jmap/ -d '${JSON.stringify(setupRequest, null, 2)}'
docker restart jmap-playground`;
