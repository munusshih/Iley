#!/usr/bin/env node

/**
 * Asset Download Script for Vercel Build
 *
 * Downloads Google Drive assets at build time and creates a local data file
 * with updated paths for optimal performance on Vercel.
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ASSETS_DIR = path.join(process.cwd(), "public", "assets", "projects");
const DATA_DIR = path.join(process.cwd(), "src", "data");
const OPENSHEET_URL =
  "https://opensheet.elk.sh/1o30Uy7jtfAR2lc20Cycahrk13tq_SDdKkIbNQnQvTRY/Work";
const OUTPUT_DATA_FILE = path.join(
  __dirname,
  "../src/data/projects-local.json"
);

// Check if running in development mode
const isDevelopment =
  process.argv.includes("--dev") || process.env.NODE_ENV === "development";

// Google Drive URL patterns
const GOOGLE_DRIVE_PATTERNS = [
  /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view/,
  /https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /https:\/\/docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/,
];

// Function to extract Google Drive file ID
function extractDriveFileId(url) {
  if (!url || typeof url !== "string") return null;

  for (const pattern of GOOGLE_DRIVE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Function to convert Google Drive URL to direct download URL
function getDirectDownloadUrl(url) {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Function to download a file with better error handling and retries
async function downloadFile(url, filepath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `📥 Downloading (attempt ${attempt}/${retries}): ${path.basename(
          filepath
        )}`
      );

      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);

        const request = https.get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            console.log(`🔄 Redirecting to: ${redirectUrl}`);
            file.destroy();
            downloadFile(redirectUrl, filepath, retries)
              .then(resolve)
              .catch(reject);
            return;
          }

          // Handle large file download confirmation
          if (
            response.statusCode === 200 &&
            response.headers["content-type"]?.includes("text/html")
          ) {
            // This might be a Google Drive confirmation page for large files
            let data = "";
            response.on("data", (chunk) => (data += chunk));
            response.on("end", () => {
              const confirmMatch = data.match(/confirm=([^&"]+)/);
              if (confirmMatch) {
                const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${
                  confirmMatch[1]
                }&id=${extractDriveFileId(url)}`;
                file.destroy();
                downloadFile(confirmUrl, filepath, retries)
                  .then(resolve)
                  .catch(reject);
                return;
              }
              reject(new Error("Received HTML instead of file content"));
            });
            return;
          }

          if (response.statusCode !== 200) {
            file.destroy();
            reject(
              new Error(
                `HTTP ${response.statusCode}: ${response.statusMessage}`
              )
            );
            return;
          }

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            // Verify file was downloaded (not an error page)
            const stats = fs.statSync(filepath);
            if (stats.size < 1000) {
              // Check if it's an HTML error page
              const content = fs.readFileSync(filepath, "utf8");
              if (content.includes("<html") || content.includes("<!DOCTYPE")) {
                fs.unlinkSync(filepath);
                reject(
                  new Error("Downloaded file appears to be an HTML error page")
                );
                return;
              }
            }
            console.log(
              `✅ Downloaded: ${path.basename(filepath)} (${(
                stats.size / 1024
              ).toFixed(1)}KB)`
            );
            resolve(filepath);
          });

          file.on("error", (err) => {
            file.destroy();
            fs.unlink(filepath, () => {});
            reject(err);
          });
        });

        request.on("error", (err) => {
          reject(err);
        });

        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error("Download timeout"));
        });
      });

      return filepath; // Success
    } catch (error) {
      console.log(`⚠️  Attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) {
        throw error;
      }
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Function to get file extension from URL or content type
function getFileExtension(url, contentType = "") {
  // Try to get extension from URL
  const urlPath = new URL(url).pathname;
  const urlExt = path.extname(urlPath);
  if (urlExt) return urlExt;

  // Try to get extension from content type
  const contentTypeMap = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/mov": ".mov",
    "video/avi": ".avi",
    "application/pdf": ".pdf",
  };

  return contentTypeMap[contentType] || ".jpg"; // Default to .jpg
}

// Function to create a safe filename
function createSafeFilename(projectName, fieldName, originalUrl) {
  const fileId = extractDriveFileId(originalUrl);
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const ext = getFileExtension(originalUrl);
  return `${safeName}-${fieldName}-${fileId}${ext}`;
}

// Function to fetch data with error handling
async function fetchProjectData() {
  try {
    const response = await fetch(OPENSHEET_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Expected array of projects from Google Sheets");
    }

    return data;
  } catch (error) {
    console.error("❌ Failed to fetch project data:", error.message);

    // Fallback: check if we have a cached version
    const cacheFile = path.join(__dirname, "../.cache/projects.json");
    if (fs.existsSync(cacheFile)) {
      console.log("� Using cached project data...");
      return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    }

    throw error;
  }
}

// Function to cache project data
function cacheProjectData(data) {
  const cacheDir = path.join(__dirname, "../.cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const cacheFile = path.join(cacheDir, "projects.json");
  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
  console.log("💾 Cached project data for future builds");
}
// Main function
async function downloadAssets() {
  try {
    console.log("🚀 Starting asset download process...");

    // Create assets directory
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
      console.log(`📁 Created directory: ${ASSETS_DIR}`);
    }

    // Create data directory
    const dataDir = path.dirname(OUTPUT_DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`📁 Created directory: ${dataDir}`);
    }

    // Fetch project data
    console.log("📊 Fetching project data...");
    const projects = await fetchProjectData();

    // Cache the data
    cacheProjectData(projects);

    console.log(`📋 Found ${projects.length} projects`);

    let downloadCount = 0;
    let skipCount = 0;

    // Process each project
    for (const [index, project] of projects.entries()) {
      const projectName = project.projectName || `project-${index + 1}`;
      console.log(
        `\n🎯 Processing (${index + 1}/${projects.length}): ${projectName}`
      );

      // Fields that might contain Google Drive URLs
      const mediaFields = [
        "thumbnailImage",
        "workImage1",
        "workImage2",
        "workImage3",
        "workImage4",
        "workImage5",
      ];

      for (const field of mediaFields) {
        const url = project[field];
        if (!url || typeof url !== "string") continue;

        const fileId = extractDriveFileId(url);
        if (!fileId) {
          console.log(`⚠️  Skipping ${field}: Not a Google Drive URL`);
          continue;
        }

        const filename = createSafeFilename(projectName, field, url);
        const filepath = path.join(ASSETS_DIR, filename);

        // Skip if file already exists and is not empty
        if (fs.existsSync(filepath)) {
          const stats = fs.statSync(filepath);
          if (stats.size > 0) {
            console.log(
              `⏭️  Skipping ${field}: File already exists (${(
                stats.size / 1024
              ).toFixed(1)}KB)`
            );
            project[field] = `/assets/projects/${filename}`;
            skipCount++;
            continue;
          }
        }

        try {
          const downloadUrl = getDirectDownloadUrl(url);
          await downloadFile(downloadUrl, filepath);

          // Update project data with local path
          project[field] = `/assets/projects/${filename}`;
          downloadCount++;
        } catch (error) {
          console.error(`❌ Failed to download ${field}:`, error.message);
          // Keep the original URL if download fails
        }
      }
    }

    // Generate updated data file
    fs.writeFileSync(OUTPUT_DATA_FILE, JSON.stringify(projects, null, 2));
    console.log(`\n💾 Saved updated project data to: ${OUTPUT_DATA_FILE}`);

    console.log("\n✅ Asset download complete!");
    console.log(
      `📊 Summary: ${downloadCount} downloaded, ${skipCount} skipped`
    );

    if (downloadCount === 0 && skipCount === 0) {
      console.log("\n📝 No Google Drive assets found to download.");
      console.log(
        "💡 Make sure your Google Sheets contains Google Drive URLs in the media fields."
      );
    }

    return { downloadCount, skipCount };
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadAssets();
}
