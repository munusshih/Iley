# Asset Management for Iley Portfolio

This document explains how to manage Google Drive assets locally for your Iley portfolio.

## Why Local Assets?

Google Drive links have several limitations:

- They may not display properly as direct images/videos
- They can be slow to load
- They may have access restrictions
- They're not optimized for web delivery

## Asset Download Process

### Method 1: Using the Download Script

1. **Run the download script:**

   ```bash
   cd scripts
   ./download-assets.sh
   ```

2. **The script will:**
   - Create `/public/assets/projects/` directory
   - Provide instructions for manual download if needed
   - Show you the format for downloading files

### Method 2: Manual Download

1. **For each Google Drive URL in your spreadsheet:**

   Example URL: `https://drive.google.com/file/d/1ABC123DEF456/view`

   Extract the file ID: `1ABC123DEF456`

2. **Download using curl:**

   ```bash
   curl -L -o "project-name-thumbnail.jpg" "https://drive.google.com/uc?export=download&id=1ABC123DEF456"
   ```

3. **Move the file to the assets directory:**
   ```bash
   mv "project-name-thumbnail.jpg" public/assets/projects/
   ```

### Method 3: Browser Download

1. Open the Google Drive URL
2. Click "Download"
3. Save to `public/assets/projects/`
4. Rename to a descriptive filename

## File Naming Convention

Use descriptive filenames that include:

- Project name (lowercase, dashes instead of spaces)
- Asset type (thumbnail, work1, work2, etc.)
- File extension

Examples:

- `eadem-mami-wata-thumbnail.jpg`
- `eadem-mami-wata-work1.mp4`
- `jelly-tint-hero.jpg`

## Updating Your Google Sheets

After downloading assets locally, update your Google Sheets to use local paths:

**Before (Google Drive URL):**

```
https://drive.google.com/file/d/1ABC123DEF456/view
```

**After (Local Path):**

```
/assets/projects/eadem-mami-wata-thumbnail.jpg
```

## Directory Structure

```
public/
  assets/
    projects/
      eadem-mami-wata-thumbnail.jpg
      eadem-mami-wata-work1.mp4
      eadem-mami-wata-work2.jpg
      jelly-tint-thumbnail.jpg
      jelly-tint-hero.mp4
      ... etc
```

## Testing

After updating your assets:

1. **Check that files exist:**

   ```bash
   ls -la public/assets/projects/
   ```

2. **Test local URLs in browser:**
   Visit: `http://localhost:4321/assets/projects/your-file.jpg`

3. **Rebuild and check projects:**
   - Your Astro site will automatically pick up the new paths
   - Check individual project pages to ensure images/videos load

## Automation Ideas

For future automation, you could:

1. **Create a Google Apps Script** that exports your sheet data with local paths
2. **Use Google Drive API** to automatically download files
3. **Set up a GitHub Action** to sync assets periodically
4. **Create a simple web interface** for asset management

## Tips

- **Optimize images** before uploading (compress for web)
- **Use appropriate formats** (WebP for images, MP4 for videos)
- **Keep original filenames** in a separate column for reference
- **Version control** your assets directory if files are not too large
- **Consider using a CDN** for production deployment

## Troubleshooting

**Download fails:**

- Check if the Google Drive file is publicly accessible
- Try the alternative download method with confirmation token
- Download manually through browser

**Images don't display:**

- Check file paths are correct (case-sensitive)
- Ensure files are in the correct directory
- Test direct URL access in browser

**Large files:**

- Consider compressing videos
- Use appropriate formats (MP4 for videos, WebP for images)
- Check if there are file size limits in your hosting
