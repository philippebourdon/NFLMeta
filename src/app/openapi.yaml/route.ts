import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const specPath = path.join(process.cwd(), "docs", "openapi.yaml");
  const body = await fs.readFile(specPath, "utf8");

  return new Response(body, {
    headers: {
      "content-type": "application/yaml; charset=utf-8",
      "content-disposition": 'inline; filename="openapi.yaml"',
      "cache-control": "no-store",
    },
  });
}
