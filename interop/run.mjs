import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const version = "0.11.8";
const checksum = "17ace571b012ff0228b276e09c83f28114824596279f86234f7a55e3773ad7df";
const directory = await mkdtemp(join(tmpdir(), "json-meta-client-interop-"));
let server;
let activeChild;
let output = "";
let interrupted = false;
const stop = () => {
  interrupted = true;
  server?.kill("SIGTERM");
  activeChild?.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

async function waitReady(baseUrl, deadline) {
  if (interrupted || server.exitCode !== null || server.signalCode !== null)
    throw new Error("Stalwart exited during setup");
  try {
    const response = await fetch(`${baseUrl}/.well-known/jmap`, {
      signal: AbortSignal.timeout(1000),
    });
    if (response.status === 401) return;
  } catch {}
  if (Date.now() > deadline) throw new Error("Stalwart readiness timed out after 30 seconds");
  await new Promise((resolve) => setTimeout(resolve, 200));
  return waitReady(baseUrl, deadline);
}

async function run(command, args, options = {}) {
  const child = spawn(command, args, { stdio: "inherit", ...options });
  activeChild = child;
  const [code, signal] = await once(child, "exit");
  activeChild = undefined;
  if (code !== 0) throw new Error(`${command} failed (${signal ?? code})`);
}

try {
  let binary = process.env.STALWART_BINARY;
  if (!binary) {
    if (process.platform !== "linux" || process.arch !== "x64") {
      throw new Error(
        "Automatic download requires Linux x64; provide STALWART_BINARY for Stalwart 0.11.8 on other platforms.",
      );
    }
    console.log(`Server setup: downloading Stalwart ${version}`);
    const url = `https://github.com/stalwartlabs/stalwart/releases/download/v${version}/stalwart-mail-x86_64-unknown-linux-gnu.tar.gz`;
    const archivePath = join(directory, "server.tar.gz");
    await run("curl", [
      "--fail",
      "--location",
      "--silent",
      "--show-error",
      "--max-time",
      "120",
      url,
      "--output",
      archivePath,
    ]);
    const archive = await readFile(archivePath);
    if (createHash("sha256").update(archive).digest("hex") !== checksum) {
      throw new Error("Stalwart archive SHA-256 mismatch");
    }
    await run("tar", ["--no-same-owner", "-xzf", archivePath, "-C", directory]);
    binary = join(directory, "stalwart-mail");
    await chmod(binary, 0o755);
  }
  const versionProcess = spawn(binary, ["--version"]);
  let actualVersion = "";
  versionProcess.stdout.on("data", (chunk) => {
    actualVersion += chunk;
  });
  const [versionCode] = await once(versionProcess, "exit");
  if (versionCode !== 0 || actualVersion.trim() !== version) {
    throw new Error(`Expected Stalwart ${version}, received ${actualVersion.trim()}`);
  }
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  const webAdminPath = join(directory, "empty-webadmin.zip");
  await writeFile(
    webAdminPath,
    Buffer.from("504b05060000000000000000000000000000000000000000", "hex"),
  );
  const config = (await readFile(new URL("./stalwart.toml", import.meta.url), "utf8"))
    .replaceAll("{URL}", baseUrl)
    .replaceAll("{PORT}", String(port))
    .replaceAll("{DATA}", join(directory, "data"))
    .replaceAll("{WEBADMIN}", webAdminPath);
  const configPath = join(directory, "config.toml");
  await writeFile(configPath, config);
  server = spawn(binary, ["--config", configPath], { stdio: ["ignore", "pipe", "pipe"] });
  const serverExit = once(server, "exit");
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => {
      output = (output + chunk).slice(-32_000);
    });
  }
  await waitReady(baseUrl, Date.now() + 30_000);
  async function json(path, body, authorization, form = false) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": form ? "application/x-www-form-urlencoded" : "application/json",
        ...(authorization ? { authorization } : {}),
      },
      body: form ? new URLSearchParams(body) : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json();
    if (!response.ok || result.error)
      throw new Error(`Server provisioning ${path} failed: ${JSON.stringify(result)}`);
    return result;
  }
  await json(
    "/api/principal",
    {
      type: "individual",
      name: "interop",
      secrets: ["interop-password"],
      roles: ["user"],
    },
    basic("admin", "interop-admin-password"),
  );
  const redirectUri = "https://localhost/interop";
  const registration = await json(
    "/auth/register",
    { redirect_uris: [redirectUri] },
    basic("admin", "interop-admin-password"),
  );
  const clientId = registration.client_id;
  const authorization = await json(
    "/api/oauth",
    {
      type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
    },
    basic("interop", "interop-password"),
  );
  const token = await json(
    "/auth/token",
    {
      grant_type: "authorization_code",
      code: authorization.data.code,
      client_id: clientId,
      redirect_uri: redirectUri,
    },
    undefined,
    true,
  );
  if (typeof token.access_token !== "string")
    throw new Error("Server provisioning returned no bearer token");
  console.log(`Server ready: Stalwart ${version}; running public API interoperability checks`);
  await run(process.execPath, ["--test", "--test-timeout=30000", "interop/client.test.mjs"], {
    env: { ...process.env, JMAP_INTEROP_URL: baseUrl, JMAP_INTEROP_TOKEN: token.access_token },
  });
  server.kill("SIGTERM");
  const shutdownTimeout = setTimeout(() => server.kill("SIGKILL"), 5000);
  await serverExit;
  clearTimeout(shutdownTimeout);
} catch (error) {
  console.error("Interoperability setup or test failure:", error);
  if (output) console.error("Stalwart logs:\n" + output);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
  await rm(directory, { recursive: true, force: true });
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
