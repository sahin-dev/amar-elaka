import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as createPOST } from "@/app/api/issues/route";
import { GET as photoGET } from "@/app/api/photos/[id]/route";
import { POST as modPhotoPOST } from "@/app/api/moderation/photos/[id]/route";
import { processPhoto } from "@/server/services/photos";
import { collections, getDb } from "@/server/db";
import { baseReport, makeUser, params, req, resetDb } from "../helpers/fixtures";

async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: "TestCam", Model: "Secret Model", Copyright: "Jane Doe" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "23/1 48/1 4/1", GPSLongitudeRef: "E", GPSLongitude: "90/1 22/1 4/1" },
    })
    .toBuffer();
}

beforeEach(resetDb);

describe("photo processing", () => {
  it("test image really contains EXIF before processing", async () => {
    const meta = await sharp(await jpegWithGps()).metadata();
    expect(meta.exif).toBeDefined();
  });

  it("strips EXIF/GPS metadata and re-encodes to WebP", async () => {
    const out = await processPhoto(await jpegWithGps(), "image/jpeg");
    for (const buf of [out.main, out.thumb]) {
      const meta = await sharp(buf).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(buf.toString("latin1")).not.toContain("Secret Model");
    }
  });

  it("rejects files whose bytes are not an allowed image, regardless of declared type", async () => {
    await expect(processPhoto(Buffer.from("<svg onload=alert(1)>"), "image/jpeg")).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).gif().toBuffer();
    await expect(processPhoto(gif, "image/jpeg")).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    await expect(processPhoto(await jpegWithGps(), "image/svg+xml")).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
  });

  it("rejects oversized files", async () => {
    await expect(processPhoto(Buffer.alloc(6 * 1024 * 1024), "image/jpeg")).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });
});

describe("photo upload and review flow", () => {
  it("keeps photos private until a moderator approves them", async () => {
    const u = await makeUser();
    const mod = await makeUser("moderator");
    const r = baseReport();
    const f = new FormData();
    for (const [k, v] of Object.entries({ category: r.category, title: r.title, description: r.description, lat: String(r.lat), lng: String(r.lng) })) f.set(k, v);
    f.set("photo", new File([new Uint8Array(await jpegWithGps())], "IMG_0001.jpg", { type: "image/jpeg" }));

    const res = await createPOST(req("/api/issues", { method: "POST", token: u.token, body: f }));
    expect(res.status).toBe(201);
    const { id, photoPending } = await res.json();
    expect(photoPending).toBe(true);

    const c = collections(await getDb());
    const photo = await c.issuePhotos.findOne({ issueId: id });
    expect(photo).toBeTruthy();
    // Stored filename is server-generated, never the user's filename.
    const file = await (await getDb()).collection("photos.files").findOne({ _id: photo!.fileId });
    expect(file!.filename).toBe(`issues/${id}/${photo!._id}.webp`);

    expect((await photoGET(req(`/api/photos/${photo!._id}`), params({ id: photo!._id }))).status).toBe(404);
    expect((await photoGET(req(`/api/photos/${photo!._id}`, { token: mod.token }), params({ id: photo!._id }))).status).toBe(200);

    const approve = await modPhotoPOST(
      req(`/api/moderation/photos/${photo!._id}`, { method: "POST", token: mod.token, json: { decision: "approve" } }),
      params({ id: photo!._id }),
    );
    expect(approve.status).toBe(200);
    const pub = await photoGET(req(`/api/photos/${photo!._id}?v=thumb`), params({ id: photo!._id }));
    expect(pub.status).toBe(200);
    expect(pub.headers.get("content-type")).toBe("image/webp");
    expect((await c.issues.findOne({ _id: id }))!.publicPhotoId).toBe(photo!._id);
  });
});
