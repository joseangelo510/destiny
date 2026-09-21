import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

function fixturePdf() {
  const stream = "BT /F1 12 Tf 72 720 Td (Production PDF fixture text) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  return Buffer.from(`${pdf}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}

test("PDF text extraction works after a production Next webpack build", async () => {
  const productRoot = fileURLToPath(new URL("../..", import.meta.url));
  const sandbox = await mkdtemp(path.join(tmpdir(), "rebound-pdf-runtime-"));
  const next = path.join(productRoot, "node_modules/next/dist/bin/next");
  const env = { PATH: process.env.PATH, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  let server: ChildProcess | undefined;
  let output = "";
  try {
    await mkdir(path.join(sandbox, "app/api/parse"), { recursive: true });
    await symlink(path.join(productRoot, "node_modules"), path.join(sandbox, "node_modules"), "dir");
    await writeFile(path.join(sandbox, "package.json"), JSON.stringify({ name: "pdf-runtime-fixture", private: true }));
    await writeFile(path.join(sandbox, "app/layout.tsx"), "export default function Layout({children}: {children: React.ReactNode}) { return <html><body>{children}</body></html>; }");
    await writeFile(path.join(sandbox, "app/page.tsx"), "export default function Page() { return <main>Disposable parser fixture</main>; }");
    const parser = JSON.stringify(path.join(productRoot, "src/lib/content/repurpose-source"));
    // This disposable route tests packaging and parsing only, without production auth, data or providers.
    await writeFile(path.join(sandbox, "app/api/parse/route.ts"), `
      import { ingestSourceFile } from ${parser};
      export const runtime = "nodejs";
      export async function POST(request: Request) {
        try { return Response.json(await ingestSourceFile("fixture.pdf", "application/pdf", new Uint8Array(await request.arrayBuffer()))); }
        catch (error) { return Response.json({error: error instanceof Error ? error.message : String(error)}, {status: 422}); }
      }
    `);
    const build = spawnSync(process.execPath, [next, "build", sandbox, "--webpack"], { env, encoding: "utf8", timeout: 120_000 });
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
    server = spawn(process.execPath, [next, "start", sandbox, "--hostname", "127.0.0.1", "--port", String(port)], { env, stdio: "pipe" });
    server.stdout?.on("data", chunk => { output += chunk; });
    server.stderr?.on("data", chunk => { output += chunk; });
    const url = `http://127.0.0.1:${port}`;
    await expect.poll(async () => {
      if (server?.exitCode !== null) throw new Error(output);
      try { return (await fetch(url)).status; } catch { return 0; }
    }, { timeout: 15_000 }).toBe(200);
    const response = await fetch(`${url}/api/parse`, { method: "POST", body: fixturePdf(), headers: { "Content-Type": "application/pdf" } });
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    expect(result.text).toContain("Production PDF fixture text");
    expect(result.extension).toBe("pdf");
  } finally {
    if (server && server.exitCode === null) {
      const stopped = once(server, "exit");
      server.kill("SIGTERM");
      await stopped;
    }
    await rm(sandbox, { recursive: true, force: true });
  }
}, 150_000);
