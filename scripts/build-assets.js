#!/usr/bin/env node

/**
 * Build-time Asset Management Script
 *
 * This script automatically:
 * 1. Fetches project data from Google Sheets
 * 2. Downloads all Google Drive assets to local storage
 * 3. Updates project data to use loca        const fileId = extractDriveFileId(url);
        if (!fileId) {
          console.log(`⚠️  Skipping ${field}: Not a Google Drive URL`);
          continue;
        }

        const tempFilename = createSafeFilename(projectName, field, url, '.tmp');
        const tempFilepath = path.join(ASSETS_DIR, tempFilename);

        // Check if a file with this pattern already exists (any extension)
        const filePattern = tempFilename.replace('.tmp', '');
        const existingFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.startsWith(filePattern));

        if (existingFiles.length > 0) {
          const existingFile = existingFiles[0];
          const existingPath = path.join(ASSETS_DIR, existingFile);
          const stats = fs.statSync(existingPath);
          if (stats.size > 0) {
            console.log(`⏭️  Skipping ${field}: File already exists (${existingFile}, ${(stats.size / 1024).toFixed(1)}KB)`);
            project[field] = `/assets/projects/${existingFile}`;
            skipCount++;
            continue;
          }
        }

        try {
          const downloadUrl = getDirectDownloadUrl(url);
          const finalFilepath = await downloadFile(downloadUrl, tempFilepath);
          const finalFilename = path.basename(finalFilepath);

          // Update project data with local path
          project[field] = `/assets/projects/${finalFilename}`;
          downloadCount++;

        } catch (error) {
          console.error(`❌ Failed to download ${field}:`, error.message);
          errorCount++;
          // Keep the original URL if download fails Optimized for Vercel build process
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OPENSHEET_URL =
  "https://opensheet.elk.sh/1o30Uy7jtfAR2lc20Cycahrk13tq_SDdKkIbNQnQvTRY/Work";
const ASSETS_DIR = path.join(__dirname, "../public/assets/projects");
const OUTPUT_FILE = path.join(__dirname, "../src/data/projects.json");

// Google Drive URL patterns
const GOOGLE_DRIVE_PATTERNS = [
  /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view/,
  /https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /https:\/\/docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/,
];

console.log("🚀 Starting build-time asset processing...");

// Extract Google Drive file ID
function extractDriveFileId(url) {
  if (!url || typeof url !== "string") return null;

  for (const pattern of GOOGLE_DRIVE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Convert Google Drive URL to direct download URL
function getDirectDownloadUrl(url) {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Create safe filename
// Function to detect file type from content
function detectFileType(buffer) {
  // Check for MP4/video formats (ISO Base Media File Format)
  const ftypIndex = buffer.indexOf("ftyp");
  if (ftypIndex !== -1 && ftypIndex <= 8) {
    // Check the brand after 'ftyp'
    const brand = buffer.slice(ftypIndex + 4, ftypIndex + 8).toString();
    if (
      brand.includes("mp4") ||
      brand.includes("isom") ||
      brand.includes("M4V") ||
      brand.includes("mp41") ||
      brand.includes("mp42")
    ) {
      return ".mp4";
    }
    if (brand.includes("qt") || brand.includes("mov")) {
      return ".mov";
    }
    // Default to mp4 for other video formats
    return ".mp4";
  }

  // Check for other video formats
  if (buffer.slice(0, 3).toString() === "AVI") return ".avi";

  // Check for image formats
  if (buffer.slice(0, 2).toString("hex") === "ffd8") return ".jpg";
  if (buffer.slice(0, 8).toString("hex") === "89504e470d0a1a0a") return ".png";
  if (
    buffer.slice(0, 6).toString() === "GIF87a" ||
    buffer.slice(0, 6).toString() === "GIF89a"
  )
    return ".gif";
  if (
    buffer.slice(0, 4).toString() === "RIFF" &&
    buffer.slice(8, 12).toString() === "WEBP"
  )
    return ".webp";

  // Default fallback
  return ".jpg";
}

function createSafeFilename(
  projectName,
  fieldName,
  originalUrl,
  tempExtension = ".tmp"
) {
  const fileId = extractDriveFileId(originalUrl);
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safeName}-${fieldName}-${fileId}${tempExtension}`;
}

// Download file with redirect handling
async function downloadFile(url, filepath, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `📥 Downloading (${attempt}/${retries}): ${path.basename(filepath)}`
      );

      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        let firstChunk = true;
        let fileBuffer = Buffer.alloc(0);

        const request = https.get(url, (response) => {
          // Handle all redirect types
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            const redirectUrl = response.headers.location;
            console.log(
              `🔄 HTTP ${response.statusCode} → ${redirectUrl.substring(
                0,
                80
              )}...`
            );
            file.destroy();
            downloadFile(redirectUrl, filepath, retries)
              .then(resolve)
              .catch(reject);
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

          // Extract filename from Content-Disposition header
          let originalFilename = null;
          const contentDisposition = response.headers["content-disposition"];
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(
              /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
            );
            if (filenameMatch && filenameMatch[1]) {
              originalFilename = filenameMatch[1].replace(/['"]/g, "");
              console.log(`📄 Original filename: ${originalFilename}`);
            }
          }

          response.on("data", (chunk) => {
            if (firstChunk && fileBuffer.length < 1024) {
              fileBuffer = Buffer.concat([fileBuffer, chunk]);
              firstChunk = false;
            }
            file.write(chunk);
          });

          response.on("end", () => {
            file.end();
          });

          file.on("finish", () => {
            file.close();

            // Use original filename if available, otherwise detect file type
            let finalFilepath = filepath;

            if (originalFilename) {
              const originalExt = path.extname(originalFilename);
              if (originalExt) {
                const newFilepath = filepath.replace(
                  path.extname(filepath),
                  originalExt
                );
                if (newFilepath !== filepath) {
                  fs.renameSync(filepath, newFilepath);
                  finalFilepath = newFilepath;
                  console.log(`🔄 Renamed to: ${path.basename(finalFilepath)}`);
                }
              }
            } else {
              // Fallback to file type detection
              const detectedExt = detectFileType(fileBuffer);
              const currentExt = path.extname(filepath);

              if (currentExt !== detectedExt) {
                const newFilepath = filepath.replace(currentExt, detectedExt);
                fs.renameSync(filepath, newFilepath);
                finalFilepath = newFilepath;
                console.log(
                  `🔍 Detected and renamed to: ${path.basename(finalFilepath)}`
                );
              }
            }

            const stats = fs.statSync(finalFilepath);
            console.log(
              `✅ Downloaded: ${path.basename(finalFilepath)} (${(
                stats.size / 1024
              ).toFixed(1)}KB)`
            );
            resolve(finalFilepath);
          });

          file.on("error", (err) => {
            file.destroy();
            fs.unlink(filepath, () => {});
            reject(err);
          });
        });

        request.on("error", reject);
        request.setTimeout(60000, () => {
          request.destroy();
          reject(new Error("Download timeout (60s)"));
        });
      });

      return filepath; // Success
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      if (attempt === retries) throw error;

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Fetch project data from Google Sheets
async function fetchProjectData() {
  console.log("📊 Fetching project data from Google Sheets...");

  const response = await fetch(OPENSHEET_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch project data: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  console.log(`✅ Fetched ${data.length} projects`);

  // Map Google Sheets columns to our field names
  return data.map((row) => ({
    projectName: row["Project Name"] || "",
    year: row["Year"] || "",
    categories: row["Categories"] || "",
    shortDescription: row["Short Description"] || "",
    description: row["Description (Optional)"] || "",
    credit: row["Credit"] || "",
    heroMoment: row["Hero Moment"] || "",
    thumbnailImage: row["Thumbnail Image"] || "",
    workImage1: row["Work Image/Video 1"] || "",
    workImage2: row["Work Image/Video 2"] || "",
    workImage3: row["Work Image/Video 3"] || "",
    workImage4: row["Work Image/Video 4"] || "",
    workImage5: row["Work Image/Video 5"] || "",
  }));
}

// Function to sync project data with actual downloaded filenames
async function syncFilenames(projects) {
  console.log("\n🔄 Syncing filenames with downloaded assets...");

  // Get list of all downloaded files
  const downloadedFiles = fs.readdirSync(ASSETS_DIR);
  console.log(`📂 Found ${downloadedFiles.length} downloaded files`);

  let syncCount = 0;

  for (const project of projects) {
    const mediaFields = [
      "thumbnailImage",
      "workImage1",
      "workImage2",
      "workImage3",
      "workImage4",
      "workImage5",
    ];

    for (const field of mediaFields) {
      const currentPath = project[field];
      if (!currentPath || !currentPath.includes(".tmp")) continue;

      // Extract the base filename (without .tmp extension)
      const baseName = path.basename(currentPath, ".tmp");

      // Find matching downloaded file with any extension
      const matchingFile = downloadedFiles.find((file) =>
        file.startsWith(baseName)
      );

      if (matchingFile) {
        const newPath = `/assets/projects/${matchingFile}`;
        console.log(
          `🔄 ${field}: ${path.basename(currentPath)} → ${matchingFile}`
        );
        project[field] = newPath;
        syncCount++;
      } else {
        console.warn(`⚠️  No matching file found for: ${currentPath}`);
      }
    }
  }

  console.log(`✅ Synced ${syncCount} filenames`);
}

// Main processing function
async function processAssets() {
  try {
    // Create assets directory
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
      console.log(`📁 Created assets directory`);
    }

    // Fetch project data
    const projects = await fetchProjectData();

    let downloadCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Process each project
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const projectName = project.projectName || "untitled";

      console.log(
        `\n🎯 Processing (${i + 1}/${projects.length}): ${projectName}`
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

        // Check if a file with this pattern already exists (any extension)
        const baseFilename = filename.replace(/\.[^.]*$/, ""); // Remove extension
        const existingFiles = fs
          .readdirSync(ASSETS_DIR)
          .filter((file) => file.startsWith(baseFilename) && file !== filename);

        if (existingFiles.length > 0) {
          const existingFile = existingFiles[0];
          const existingPath = path.join(ASSETS_DIR, existingFile);
          const stats = fs.statSync(existingPath);
          if (stats.size > 0) {
            console.log(
              `⏭️  Skipping ${field}: File already exists (${existingFile}, ${(
                stats.size / 1024
              ).toFixed(1)}KB)`
            );
            project[field] = `/assets/projects/${existingFile}`;
            skipCount++;
            continue;
          }
        }

        // Also check if exact filepath exists
        if (fs.existsSync(filepath)) {
          const stats = fs.statSync(filepath);
          if (stats.size > 0) {
            console.log(
              `⏭️  Skipping ${field}: Already exists (${(
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
          errorCount++;
          // Keep the original URL if download fails
        }
      }
    }

    // Sync filenames with actual downloaded files
    await syncFilenames(projects);

    // Save processed project data
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(projects, null, 2));
    console.log(`\n💾 Saved project data to: ${OUTPUT_FILE}`);

    // Summary
    console.log(`\n✅ Build-time asset processing complete!`);
    console.log(
      `📊 Summary: ${downloadCount} downloaded, ${skipCount} skipped, ${errorCount} errors`
    );

    if (errorCount > 0) {
      console.warn(
        `⚠️  ${errorCount} files failed to download but build will continue`
      );
    }
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  processAssets();
}
