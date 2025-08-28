#!/usr/bin/env node

/**
 * Build-time Asset Management Script
 *
 * This script automatically:
 * 1. Fetches project data from Google Sheets
 * 2. Downloads all Google Drive assets to local storage
 * 3. Updates project data to use local asset paths (saved under public/assets/projects)
 *
 * It is optimized to run at build-time (for example, on Vercel) and includes
 * logic to handle Google Drive download redirects and virus-scan confirmation pages.
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

// Additional sheet tabs to fetch
const BASE_OPENSHEET_URL = OPENSHEET_URL.replace(/\/[^^/]+$/, "");
const HOME_PAGE_TAB = "Home Page";
const ABOUT_PAGE_TAB = "About Page";
const OUTPUT_HOME_FILE = path.join(
  __dirname,
  "../src/data/homepage-local.json"
);
const OUTPUT_ABOUT_FILE = path.join(
  __dirname,
  "../src/data/aboutpage-local.json"
);

// File size limits (in bytes)
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

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
  // Check for video formats first

  // Check for MP4/video formats (ISO Base Media File Format)
  const ftypIndex = buffer.indexOf("ftyp");
  if (ftypIndex !== -1 && ftypIndex <= 12) {
    // Check the brand after 'ftyp'
    const brand = buffer.slice(ftypIndex + 4, ftypIndex + 8).toString();
    console.log(`🔍 Video brand detected: ${brand}`);
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

  // Check for other video format signatures
  if (buffer.slice(0, 3).toString() === "AVI") return ".avi";
  if (
    buffer.slice(0, 4).toString() === "RIFF" &&
    buffer.slice(8, 12).toString() === "AVI "
  )
    return ".avi";

  // WebM format
  if (buffer.slice(0, 4).toString("hex") === "1a45dfa3") return ".webm";

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

  // If we can't detect, check file size and content
  // Large files (>1MB) are likely videos if they're not images
  if (buffer.length > 1024 * 1024) {
    console.log(
      `🔍 Large file detected (${(buffer.length / 1024 / 1024).toFixed(
        1
      )}MB), assuming video format`
    );
    return ".mp4";
  }

  // Default fallback - be more conservative about defaulting to .jpg
  // If we can't detect the type, assume it might be a video if the file is large
  const bufferSize = buffer.length;
  if (bufferSize > 10000) {
    // If file is larger than 10KB, it's likely not an HTML error page
    // Check if this might be a video based on common video patterns
    const bufferStr = buffer.toString("hex", 0, Math.min(100, bufferSize));
    if (
      bufferStr.includes("66747970") || // 'ftyp' in hex (common in video files)
      bufferStr.includes("6d6f6f76") || // 'moov' in hex
      bufferStr.includes("6d646174")
    ) {
      // 'mdat' in hex
      return ".mp4";
    }
  }

  // For very small files, check if it's HTML (error page)
  if (bufferSize < 5000) {
    const textContent = buffer.toString("ascii", 0, Math.min(100, bufferSize));
    if (textContent.includes("<html>") || textContent.includes("<!DOCTYPE")) {
      throw new Error(
        "Downloaded file appears to be an HTML error page, not media content"
      );
    }
  }

  console.log(`⚠️ Could not detect file type, defaulting to .jpg`);
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
async function downloadFile(url, filepath, retries = 2, fileId = null) {
  // Extract fileId from URL if not provided
  if (!fileId) {
    fileId = extractDriveFileId(url);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `📥 Downloading (${attempt}/${retries}): ${path.basename(filepath)}`
      );

      const _finalPath = await new Promise((resolve, reject) => {
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
            downloadFile(redirectUrl, filepath, retries, fileId)
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

          let totalSize = 0;

          response.on("data", (chunk) => {
            totalSize += chunk.length;

            // Check file size limit
            if (totalSize > MAX_FILE_SIZE) {
              file.destroy();
              fs.unlink(filepath, () => {});
              reject(
                new Error(
                  `File too large: ${(totalSize / 1024 / 1024).toFixed(
                    1
                  )}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
                )
              );
              return;
            }

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

            // Read the file to detect its actual type
            const fileBuffer = fs.readFileSync(filepath);

            // Check if file is HTML (failed download or virus warning)
            const fileContent = fileBuffer.toString(
              "utf8",
              0,
              Math.min(1000, fileBuffer.length)
            );
            if (
              fileContent.includes("<html") ||
              fileContent.includes("<!DOCTYPE") ||
              fileContent.includes("<title>")
            ) {
              console.log(
                `⚠️  Got HTML response, checking for virus scan warning...`
              );

              // Check for Google Drive virus scan warning
              if (
                fileContent.includes("virus scan warning") ||
                fileContent.includes("Google Drive can't scan this file")
              ) {
                console.log(`🔄 Handling Google Drive virus scan warning...`);

                // Extract the direct download URL from the HTML form
                const confirmMatch = fileContent.match(
                  /name="confirm"\s+value="([^"]+)"/
                );
                const uuidMatch = fileContent.match(
                  /name="uuid"\s+value="([^"]+)"/
                );

                if (confirmMatch && uuidMatch) {
                  const confirmValue = confirmMatch[1];
                  const uuidValue = uuidMatch[1];
                  const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmValue}&uuid=${uuidValue}`;

                  console.log(`🔄 Retrying with direct download URL...`);
                  fs.unlinkSync(filepath);

                  // Retry download with the direct URL
                  downloadFile(directUrl, filepath, 1, fileId)
                    .then(resolve)
                    .catch(reject);
                  return;
                } else {
                  console.log(
                    `⚠️  Could not extract confirm/uuid values from virus warning page`
                  );
                  console.log(
                    `HTML content sample: ${fileContent.substring(0, 300)}...`
                  );
                }
              }

              console.error(
                `❌ Downloaded HTML instead of media file. Google Drive may have restricted access.`
              );
              fs.unlinkSync(filepath);
              reject(new Error("Downloaded HTML instead of media file"));
              return;
            }

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

      return _finalPath || filepath; // Success - prefer final path returned from promise
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
    role: row["Role"] || "",
    description: row["Description (Optional)"] || "",
    credit: row["Credit"] || "",
    heroMoment: row["Hero Moment"] || "",
    thumbnailImage: row["Thumbnail Image"] || "",
    workImage1: row["Work Image/Video 1"] || "",
    workImage1Description:
      row["Work Image/Video 1 Description"] ||
      row["Work Image 1 Description"] ||
      "",
    workImage2: row["Work Image/Video 2"] || "",
    workImage2Description:
      row["Work Image/Video 2 Description"] ||
      row["Work Image 2 Description"] ||
      "",
    workImage3: row["Work Image/Video 3"] || "",
    workImage3Description:
      row["Work Image/Video 3 Description"] ||
      row["Work Image 3 Description"] ||
      "",
    workImage4: row["Work Image/Video 4"] || "",
    workImage4Description:
      row["Work Image/Video 4 Description"] ||
      row["Work Image 4 Description"] ||
      "",
    workImage5: row["Work Image/Video 5"] || "",
    workImage5Description:
      row["Work Image/Video 5 Description"] ||
      row["Work Image 5 Description"] ||
      "",
  }));
}

// Generic fetcher for an OpenSheet tab by name
async function fetchSheetTab(tabName) {
  const url = `${BASE_OPENSHEET_URL}/${encodeURIComponent(tabName)}`;
  console.log(`📊 Fetching sheet tab: ${tabName} -> ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch sheet tab ${tabName}: ${response.status} ${response.statusText}`
    );
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Expected array from sheet tab ${tabName}`);
  }
  console.log(`✅ Fetched ${data.length} rows from tab: ${tabName}`);
  return data;
}

// Process a sheet tab and optionally download media fields (Google Drive links)
async function processSheetTab(
  tabName,
  outputFile,
  { downloadMedia = false } = {}
) {
  try {
    const rows = await fetchSheetTab(tabName);

    // Fields that likely contain media
    const mediaKeyRegex = /video|media|asset|thumbnail|image/i;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      for (const key of Object.keys(row)) {
        const value = row[key];
        if (!value || typeof value !== "string") continue;

        // If the key looks like media or the value looks like a drive url
        if (mediaKeyRegex.test(key) || extractDriveFileId(value)) {
          const fileId = extractDriveFileId(value);
          if (fileId && downloadMedia) {
            // Make a safe base name using tabName + index
            const baseName = `${tabName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}-${i + 1}`;
            const filename = createSafeFilename(baseName, key, value, ".tmp");
            const filepath = path.join(ASSETS_DIR, filename);

            // Skip if already downloaded
            if (fs.existsSync(filepath)) {
              const stats = fs.statSync(filepath);
              if (stats.size > 0) {
                row[key] = `/assets/projects/${path.basename(filepath)}`;
                continue;
              }
            }

            try {
              const downloadUrl = getDirectDownloadUrl(value);
              const finalPath = await downloadFile(
                downloadUrl,
                filepath,
                2,
                fileId
              );
              const finalName = path.basename(finalPath);
              row[key] = `/assets/projects/${finalName}`;
            } catch (err) {
              console.error(
                `❌ Failed to download media for ${tabName}[${i}].${key}:`,
                err.message
              );
              // leave original value
            }
          } else {
            // Not a Drive URL or not downloading media: keep as-is
          }
        }
      }
    }

    // Ensure output directory exists
    const outDir = path.dirname(outputFile);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(rows, null, 2));
    console.log(`💾 Saved ${tabName} data to: ${outputFile}`);
    return rows;
  } catch (error) {
    console.error(`❌ Error processing sheet tab ${tabName}:`, error.message);
    throw error;
  }
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

    // Also fetch and process Home Page and About Page tabs
    try {
      // Home Page: download media assets (videos) and save local paths
      await processSheetTab(HOME_PAGE_TAB, OUTPUT_HOME_FILE, {
        downloadMedia: true,
      });
    } catch (err) {
      console.warn(`⚠️  Unable to fully process Home Page tab: ${err.message}`);
    }

    try {
      // About Page: just save the JSON, no media downloads
      await processSheetTab(ABOUT_PAGE_TAB, OUTPUT_ABOUT_FILE, {
        downloadMedia: false,
      });
    } catch (err) {
      console.warn(`⚠️  Unable to fetch About Page tab: ${err.message}`);
    }

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
