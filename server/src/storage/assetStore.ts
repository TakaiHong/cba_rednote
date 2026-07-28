import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { storageBucket, usesCloudStorage } from "./firebaseAdmin.js";

const supportedContentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function contentTypeFor(filename: string) {
  return supportedContentTypes[extname(filename).toLowerCase()] ?? "application/octet-stream";
}

function safeFilename(filename: string) {
  return basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function cloudObjectPath(postId: string, filename: string) {
  return `posts/${postId}/${Date.now()}-${randomUUID()}-${safeFilename(filename)}`;
}

export function isCloudAssetPath(path: string) {
  return path.startsWith("gcs://");
}

function parseCloudAssetPath(path: string) {
  const match = /^gcs:\/\/([^/]+)\/(posts\/.+)$/.exec(path);
  if (!match) throw new Error("Invalid cloud image path.");
  return { bucket: match[1], objectPath: match[2] };
}

export async function saveImageAsset(postId: string, filename: string, bytes: Buffer, localDirectory = join(".tmp", "uploaded-images")) {
  const contentType = contentTypeFor(filename);
  if (usesCloudStorage()) {
    const bucket = storageBucket();
    if (!bucket) throw new Error("Cloud Storage is not configured.");
    const objectPath = cloudObjectPath(postId, filename);
    await bucket.file(objectPath).save(bytes, {
      resumable: false,
      contentType,
      metadata: { cacheControl: "private, max-age=3600" }
    });
    return `gcs://${bucket.name}/${objectPath}`;
  }

  const outputDirectory = join(localDirectory, postId);
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = join(outputDirectory, `${Date.now()}-${safeFilename(filename)}`);
  await writeFile(outputPath, bytes);
  return outputPath;
}

export async function saveLocalImageAsset(postId: string, localPath: string) {
  if (!usesCloudStorage()) return localPath;
  return saveImageAsset(postId, basename(localPath), await readFile(localPath), "generated-covers");
}

export async function readImageAsset(path: string) {
  if (isCloudAssetPath(path)) {
    const { bucket: bucketName, objectPath } = parseCloudAssetPath(path);
    const bucket = storageBucket();
    if (!bucket || bucket.name !== bucketName) throw new Error("Image not found.");
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) throw new Error("Image not found.");
    const [bytes] = await file.download();
    const [metadata] = await file.getMetadata();
    return { bytes, contentType: metadata.contentType ?? contentTypeFor(objectPath) };
  }

  const projectRoot = resolve(process.cwd());
  const resolvedPath = resolve(projectRoot, path);
  const relativePath = relative(projectRoot, resolvedPath);
  const normalizedPath = relativePath.replace(/\\/g, "/");
  if (!relativePath || relativePath.startsWith("..") || !(normalizedPath.startsWith(".tmp/") || normalizedPath.startsWith("assets/"))) {
    throw new Error("Image not found.");
  }
  return { bytes: await readFile(resolvedPath), contentType: contentTypeFor(resolvedPath) };
}

export const supportedImageContentTypes = new Set(Object.values(supportedContentTypes));
