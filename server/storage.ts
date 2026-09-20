// Storage helpers backed by Supabase Storage (uses the service-role key that
// the Supabase-Vercel integration already syncs — no separate setup needed).
// Uploads go straight to Supabase's REST endpoint; the bucket is public, so
// storagePut returns a permanent, directly-embeddable URL (useful for email
// <img> tags, which must be absolute anyway).

import crypto from "node:crypto";
import { ENV } from "./_core/env.js";

const BUCKET = "email-media";

function supabaseConfig(): { baseUrl: string; serviceKey: string } {
  const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!baseUrl || !serviceKey) {
    throw new Error(
      "Storage config missing: connect the Supabase-Vercel integration (syncs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), or set them manually.",
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), serviceKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function publicUrl(baseUrl: string, key: string): string {
  return `${baseUrl}/storage/v1/object/public/${BUCKET}/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { baseUrl, serviceKey } = supabaseConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);

  const uploadResp = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body,
  });

  if (!uploadResp.ok) {
    const msg = await uploadResp.text().catch(() => uploadResp.statusText);
    throw new Error(`Storage upload failed (${uploadResp.status}): ${msg}`);
  }

  return { key, url: publicUrl(baseUrl, key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { baseUrl } = supabaseConfig();
  const key = normalizeKey(relKey);
  return { key, url: publicUrl(baseUrl, key) };
}

// Historically this returned a short-lived signed URL for a relative Forge
// key (referenced as /manus-storage/{key}). The bucket is public now, so a
// fresh Supabase-hosted key just resolves to its permanent public URL. Three
// shapes can show up here, depending on how old the referencing row is:
//  - an absolute URL (every new upload) -> already usable, pass through
//  - a legacy "/manus-storage/{key}" reference -> that file lives in Forge,
//    not Supabase, so it's presigned the old way (only reachable if Forge
//    credentials are still configured)
//  - a bare relative key -> treated as a Supabase key (shouldn't occur for
//    anything storagePut produced, since that always returns an absolute URL)
export async function storageGetSignedUrl(relKeyOrUrl: string): Promise<string> {
  if (/^https?:\/\//i.test(relKeyOrUrl)) return relKeyOrUrl;

  if (relKeyOrUrl.startsWith("/manus-storage/")) {
    const forgeUrl = ENV.forgeApiUrl;
    const forgeKey = ENV.forgeApiKey;
    if (!forgeUrl || !forgeKey) {
      throw new Error("This file was uploaded before the Supabase Storage migration and Forge credentials are no longer configured to retrieve it. Re-upload it to move it to Supabase Storage.");
    }
    const presignUrl = new URL("v1/storage/presign/get", forgeUrl.replace(/\/+$/, "") + "/");
    presignUrl.searchParams.set("path", relKeyOrUrl.replace(/^\/manus-storage\//, ""));
    const resp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
    if (!resp.ok) throw new Error(`Legacy storage signed URL failed (${resp.status})`);
    const { url } = (await resp.json()) as { url: string };
    return url;
  }

  const { baseUrl } = supabaseConfig();
  return publicUrl(baseUrl, normalizeKey(relKeyOrUrl));
}
