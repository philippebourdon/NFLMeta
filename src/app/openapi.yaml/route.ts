import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const specPath = path.join(process.cwd(), "docs", "openapi.yaml");
  const body = await fs.readFile(specPath, "utf8");

  return new Response(body, {
    headers: {
      "content-type": "application/yaml; charset=utf-8",
      "content-disposition": 'inline; filename="openapi.yaml"',
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
