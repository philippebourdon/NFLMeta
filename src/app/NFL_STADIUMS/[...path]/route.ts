import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { stadiumLogoDiskRoot } from "@/lib/stadium-logo-storage";

export const runtime = "nodejs";

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function safeRelativePath(parts: string[]): string | null {
  if (!parts.length) return null;
  const joined = parts.join("/");
  if (!joined || joined.includes("..")) return null;
  return joined.replace(/^\/+/, "");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathParts } = await params;
  const relative = safeRelativePath(pathParts);
  if (!relative) {
    return new NextResponse("Not found", { status: 404 });
  }

  const root = stadiumLogoDiskRoot();
  // turbopackIgnore: this path is built at runtime from a private storage root
  // OUTSIDE the project, so there is nothing here for the build to trace. Without
  // it, static analysis gives up and traces the whole project into this route's
  // file list -- measured at 78,870 node_modules entries, 12,240 under public/,
  // 5,292 under storage/ and the contents of scripts/, sql/, ops/ and docs/.
  // Nothing reads those lists today (the deploy rsyncs the tree and runs
  // next start), but they are what a standalone output would copy.
  const filePath = path.join(/*turbopackIgnore: true*/ root, relative);
  const normalizedRoot = path.resolve(root);
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedRoot + path.sep) && normalizedFile !== normalizedRoot) {
    return new NextResponse("Not found", { status: 404 });
  }

  let file;
  try {
    file = await fs.readFile(/*turbopackIgnore: true*/ normalizedFile);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(normalizedFile),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex",
      "Content-Disposition": "inline",
    },
  });
}
