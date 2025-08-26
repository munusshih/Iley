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
const ASSETS_DIR = path.join(__dirname, "../public/assets/projects");
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

console.log("🚀 Starting asset download process...");

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

// Function to get alternative Google Drive download URL with confirmation
function getConfirmDownloadUrl(fileId, confirmToken) {
  return `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${fileId}`;
}

// Function to download Google Drive file with confirmation handling
async function downloadGoogleDriveFile(url, filepath, retries = 2) {
  const fileId = extractDriveFileId(url);
  if (!fileId) {
    throw new Error("Could not extract Google Drive file ID");
  }

  // First, try the standard download URL
  const directUrl = getDirectDownloadUrl(url);

  try {
    await downloadFile(directUrl, filepath, retries);
    return;
  } catch (error) {
    console.log(`⚠️  Direct download failed, trying confirmation method...`);
  }

  // If direct download fails, try to get confirmation token
  try {
    await new Promise((resolve, reject) => {
      const request = https.get(directUrl, (response) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => {
          // Look for confirmation token in the response
          const confirmMatch = data.match(/confirm=([^&]+)/);
          if (confirmMatch) {
            const confirmToken = confirmMatch[1];
            const confirmUrl = getConfirmDownloadUrl(fileId, confirmToken);
            console.log(`🔐 Using confirmation token for download...`);
            downloadFile(confirmUrl, filepath, retries)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error("Could not find confirmation token"));
          }
        });
      });

      request.on("error", reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error("Timeout getting confirmation token"));
      });
    });
  } catch (error) {
    throw new Error(`Failed to download Google Drive file: ${error.message}`);
  }
}

// Function to create a safe filename
function createSafeFilename(projectName, fieldName, originalUrl) {
  const fileId = extractDriveFileId(originalUrl);
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const ext = path.extname(new URL(originalUrl).pathname) || ".jpg";
  return `${safeName}-${fieldName}-${fileId}${ext}`;
}

// Function to download a file
async function downloadFile(url, filepath, retries = 2) {
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
          // Handle redirects (301, 302, 303, 307, 308)
          if (
            response.statusCode === 301 ||
            response.statusCode === 302 ||
            response.statusCode === 303 ||
            response.statusCode === 307 ||
            response.statusCode === 308
          ) {
            const redirectUrl = response.headers.location;
            console.log(
              `🔄 HTTP ${response.statusCode} redirect to: ${redirectUrl}`
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

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            const stats = fs.statSync(filepath);
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

        request.setTimeout(60000, () => {
          request.destroy();
          reject(new Error("Download timeout (60s)"));
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

// Function to fetch project data from multiple possible URLs
async function fetchProjectData() {
  const possibleUrls = [
    "https://opensheet.elk.sh/1o30Uy7jtfAR2lc20Cycahrk13tq_SDdKkIbNQnQvTRY/Work",
    "https://opensheet.elk.sh/1o30Uy7jtfAR2lc20Cycahrk13tq_SDdKkIbNQnQvTRY/1",
    "https://opensheet.elk.sh/1o30Uy7jtfAR2lc20Cycahrk13tq_SDdKkIbNQnQvTRY/Sheet1",
    process.env.GOOGLE_SHEETS_URL,
  ].filter(Boolean);

  let lastError;

  for (const url of possibleUrls) {
    try {
      console.log(`🔍 Trying URL: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
        lastError = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        console.log(`❌ Expected array, got: ${typeof data}`);
        lastError = new Error("Expected array of projects from Google Sheets");
        continue;
      }

      if (data.length === 0) {
        console.log(`❌ Empty array returned`);
        lastError = new Error("No projects found in Google Sheets");
        continue;
      }

      console.log(
        `✅ Successfully fetched ${data.length} projects from: ${url}`
      );
      return data;
    } catch (error) {
      console.log(`❌ Error with ${url}: ${error.message}`);
      lastError = error;
      continue;
    }
  }

  console.error("❌ Failed to fetch project data from all possible URLs");

  // Fallback: check if we have a cached version
  const cacheFile = path.join(__dirname, "../.cache/projects.json");
  if (fs.existsSync(cacheFile)) {
    console.log("💾 Using cached project data...");
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }

  // Last resort: return sample data for development
  if (isDevelopment) {
    console.log("🔧 Development mode: using sample project data");
    return [
      {
        projectName: "Sample Project",
        year: "2024",
        categories: "Design",
        shortDescription: "A sample project for development",
        credit: "Your Name",
        thumbnailImage: "",
        heroMoment: "Sample hero moment",
        workImage1: "",
        description: "Sample description",
        workImage2: "",
        workImage3: "",
        workImage4: "",
        workImage5: "",
      },
    ];
  }

  throw lastError || new Error("Unable to fetch project data");
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
    // Create necessary directories
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
      console.log(`📁 Created directory: ${ASSETS_DIR}`);
    }

    const dataDir = path.dirname(OUTPUT_DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`📁 Created directory: ${dataDir}`);
    }

    // Fetch project data
    console.log("📊 Fetching project data...");
    const rawProjects = await fetchProjectData();

    // Map Google Sheets columns to our expected field names
    const projects = rawProjects.map((project, index) => ({
      projectName: project["Project Name"] || `project-${index + 1}`,
      year: project["Year"] || "",
      categories: project["Categories"] || "",
      shortDescription: project["Short Description"] || "",
      description: project["Description (Optional)"] || "",
      credit: project["Credit"] || "",
      heroMoment: project["Hero Moment"] || "",
      thumbnailImage: project["Thumbnail Image"] || "",
      workImage1: project["Work Image/Video 1"] || "",
      workImage2: project["Work Image/Video 2"] || "",
      workImage3: project["Work Image/Video 3"] || "",
      workImage4: project["Work Image/Video 4"] || "",
      workImage5: project["Work Image/Video 5"] || "",
    }));

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
          await downloadGoogleDriveFile(url, filepath);

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

    // In development, continue with empty data rather than failing
    if (isDevelopment) {
      console.log("🔧 Development mode: creating empty data file");
      const emptyData = [];
      fs.writeFileSync(OUTPUT_DATA_FILE, JSON.stringify(emptyData, null, 2));
      return { downloadCount: 0, skipCount: 0 };
    }

    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadAssets();
}

export { downloadAssets };
