/**
 * Cloudinary helper — shared upload storage for multer.
 *
 * Usage in a controller:
 *   const { makeCloudinaryStorage } = require("../utils/cloudinary");
 *   const upload = multer({ storage: makeCloudinaryStorage("fleetcc/gps") });
 *
 * Falls back to local disk storage when CLOUDINARY_* env vars are not set
 * (keeps local dev working without a Cloudinary account).
 */

const path    = require("path");
const multer  = require("multer");

const hasCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY    &&
  process.env.CLOUDINARY_API_SECRET;

/**
 * Returns a multer StorageEngine that uploads to Cloudinary when credentials
 * are present, or falls back to disk at /uploads for local development.
 *
 * @param {string} folder - Cloudinary folder path, e.g. "fleetcc/gps"
 * @param {string} [localPrefix="upload"] - prefix for local filenames
 */
function makeCloudinaryStorage(folder, localPrefix = "upload") {
  if (hasCloudinary) {
    const { v2: cloudinary }         = require("cloudinary");
    const { CloudinaryStorage }      = require("multer-storage-cloudinary");

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    return new CloudinaryStorage({
      cloudinary,
      params: {
        folder,
        allowed_formats: ["jpg", "jpeg", "png", "webp", "heic"],
        // Return the secure HTTPS URL; no format conversion needed
        format: undefined,
      },
    });
  }

  // Local fallback for development
  return multer.diskStorage({
    destination: (_req, _file, cb) =>
      cb(null, path.join(__dirname, "../../uploads")),
    filename: (_req, _file, cb) => {
      const ext = path.extname(_file.originalname).toLowerCase() || ".jpg";
      cb(null, `${localPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
}

/**
 * Extract a usable URL from the multer file object.
 * Cloudinary puts the URL in file.path; disk storage puts the filename in file.filename.
 */
function photoUrl(file) {
  if (!file) return null;
  // Cloudinary: file.path is the full secure URL
  if (file.path && file.path.startsWith("http")) return file.path;
  // Disk fallback: build a relative URL
  return `/uploads/${file.filename}`;
}

module.exports = { makeCloudinaryStorage, photoUrl, hasCloudinary };
