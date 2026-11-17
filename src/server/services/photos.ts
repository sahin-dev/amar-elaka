import "server-only";
import { randomUUID } from "node:crypto";
import { GridFSBucket, type Db, type ObjectId } from "mongodb";
import sharp from "sharp";
import { APP_CONFIG } from "@/config/app-config";
import { AppError } from "@/lib/errors";
import type { IssuePhotoDoc, PhotoState } from "@/server/types";

const P = APP_CONFIG.photos;
const BUCKET = "photos";

export interface ProcessedPhoto {
  main: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

/**
 * Validate and re-encode an uploaded image.
 *
 * - Checks declared MIME type AND the actual decoded format (magic bytes via sharp).
 * - Applies EXIF orientation, then re-encodes to WebP. sharp does not copy
 *   input metadata unless `.withMetadata()` / `.keepMetadata()` is called, so
 *   EXIF (including GPS), XMP, IPTC and ICC data are dropped.
 * - Downscales to limit storage and bandwidth on slow networks.
 */
export async function processPhoto(input: Buffer, declaredMime: string): Promise<ProcessedPhoto> {
  if (input.byteLength === 0) throw new AppError("VALIDATION", "The photo file is empty.", { fields: { photo: "Empty file" } });
  if (input.byteLength > P.maxBytes) {
    throw new AppError("PAYLOAD_TOO_LARGE", "The photo is too large.", { fields: { photo: "Photo is too large" } });
  }
  if (!(P.allowedMime as readonly string[]).includes(declaredMime)) {
    throw new AppError("UNSUPPORTED_MEDIA", "Only JPG, PNG or WebP photos are allowed.", { fields: { photo: "Unsupported file type" } });
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: P.maxInputPixels, failOn: "error" }).metadata();
  } catch {
    throw new AppError("UNSUPPORTED_MEDIA", "The photo could not be read.", { fields: { photo: "Unreadable image" } });
  }
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
    throw new AppError("UNSUPPORTED_MEDIA", "Only JPG, PNG or WebP photos are allowed.", { fields: { photo: "Unsupported file type" } });
  }
  if ((meta.pages ?? 1) > 1) {
    throw new AppError("UNSUPPORTED_MEDIA", "Animated images are not allowed.", { fields: { photo: "Animated images are not allowed" } });
  }

  const base = () => sharp(input, { limitInputPixels: P.maxInputPixels }).rotate();
  const { data: main, info } = await base()
    .resize(P.maxDimension, P.maxDimension, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base()
    .resize(P.thumbDimension, P.thumbDimension, { fit: "cover", position: "attention" })
    .webp({ quality: 65, effort: 4 })
    .toBuffer();

  return { main, thumb, width: info.width, height: info.height };
}

function bucket(db: Db) {
  return new GridFSBucket(db, { bucketName: BUCKET });
}

function upload(db: Db, filename: string, data: Buffer, metadata: Record<string, unknown>): Promise<ObjectId> {
  return new Promise((resolve, reject) => {
    const stream = bucket(db).openUploadStream(filename, { metadata: { ...metadata, contentType: "image/webp" } });
    stream.once("error", reject);
    stream.once("finish", () => resolve(stream.id));
    stream.end(data);
  });
}

/** Store a processed photo. Paths are generated server-side, never from user filenames. */
export async function storePhoto(
  db: Db,
  issueId: string,
  photo: ProcessedPhoto,
  uploadedBy: string | null,
  state: PhotoState,
): Promise<IssuePhotoDoc> {
  const id = randomUUID();
  const fileId = await upload(db, `issues/${issueId}/${id}.webp`, photo.main, { photoId: id, variant: "main" });
  const thumbFileId = await upload(db, `issues/${issueId}/${id}-thumb.webp`, photo.thumb, { photoId: id, variant: "thumb" });
  const doc: IssuePhotoDoc = {
    _id: id,
    issueId,
    fileId,
    thumbFileId,
    width: photo.width,
    height: photo.height,
    bytes: photo.main.byteLength,
    moderationState: state,
    uploadedBy,
    createdAt: new Date(),
    reviewedAt: state === "pending" ? null : new Date(),
  };
  await db.collection<IssuePhotoDoc>("issue_photos").insertOne(doc);
  return doc;
}

export async function readPhotoFile(db: Db, fileId: ObjectId): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of bucket(db).openDownloadStream(fileId)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * Return photo bytes only if the viewer may see them: approved photos on
 * public reports for everyone; anything for moderators.
 */
export async function getPhotoForViewer(
  db: Db,
  photoId: string,
  variant: "main" | "thumb",
  viewerIsModerator: boolean,
): Promise<{ data: Buffer; isPublic: boolean } | null> {
  const photo = await db.collection<IssuePhotoDoc>("issue_photos").findOne({ _id: photoId });
  if (!photo) return null;
  const issue = await db
    .collection<{ _id: string; moderationState: string }>("issues")
    .findOne({ _id: photo.issueId }, { projection: { moderationState: 1 } });
  const isPublic = photo.moderationState === "approved" && (issue?.moderationState === "visible" || issue?.moderationState === "merged");
  if (!isPublic && !viewerIsModerator) return null;
  if (photo.moderationState === "rejected") return null;
  const data = await readPhotoFile(db, variant === "thumb" ? photo.thumbFileId : photo.fileId);
  return { data, isPublic };
}

export async function deletePhotoFiles(db: Db, photo: Pick<IssuePhotoDoc, "fileId" | "thumbFileId">): Promise<void> {
  const b = bucket(db);
  for (const id of [photo.fileId, photo.thumbFileId]) {
    try {
      await b.delete(id);
    } catch {
      /* already gone */
    }
  }
}
