#!/bin/bash

## Configuration
ASSETS_DIR="../public/assets/projects"
OPENSHEET_URL="https://opensheet.elk.sh/1o30Uy7jtfAR2lc20Cycahrk13tq_SDdKkIbNQnQvTRY/Work"set Download Script for Iley Portfolio
# Downloads Google Drive assets and saves them locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ASSETS_DIR="../public/assets/projects"
OPENSHEET_URL="https://opensheet.elk.sh/1Vr6aMfBgNrpTFa8xwR5OMSKwTXzlXHfZMY6aQI9dBzU/Work"

echo -e "${BLUE}🚀 Starting asset download process...${NC}"

# Create assets directory
mkdir -p "$ASSETS_DIR"
echo -e "${GREEN}📁 Created directory: $ASSETS_DIR${NC}"

# Function to extract Google Drive file ID
extract_drive_id() {
    local url="$1"
    if [[ $url =~ https://drive\.google\.com/file/d/([a-zA-Z0-9_-]+)/view ]]; then
        echo "${BASH_REMATCH[1]}"
    elif [[ $url =~ https://drive\.google\.com/open\?id=([a-zA-Z0-9_-]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    elif [[ $url =~ https://docs\.google\.com/.*/d/([a-zA-Z0-9_-]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo ""
    fi
}

# Function to download a file from Google Drive
download_drive_file() {
    local file_id="$1"
    local output_path="$2"
    local filename=$(basename "$output_path")

    echo -e "${YELLOW}📥 Downloading: $filename${NC}"

    # Try direct download first
    local download_url="https://drive.google.com/uc?export=download&id=$file_id"

    if curl -L -o "$output_path" "$download_url" 2>/dev/null; then
        # Check if file was downloaded successfully (not an error page)
        if [[ $(file --mime-type "$output_path" | grep -c "text/html") -eq 0 ]]; then
            echo -e "${GREEN}✅ Successfully downloaded: $filename${NC}"
            return 0
        else
            rm -f "$output_path"
        fi
    fi

    # If direct download failed, try with confirmation token
    echo -e "${YELLOW}🔄 Trying alternative download method...${NC}"

    # Get confirmation token
    local confirm_url="https://drive.google.com/uc?export=download&id=$file_id"
    local confirm_token=$(curl -s -c /tmp/cookies "$confirm_url" | grep -o 'confirm=[^&]*' | head -1)

    if [[ -n "$confirm_token" ]]; then
        local final_url="https://drive.google.com/uc?export=download&$confirm_token&id=$file_id"
        if curl -L -b /tmp/cookies -o "$output_path" "$final_url" 2>/dev/null; then
            echo -e "${GREEN}✅ Successfully downloaded: $filename${NC}"
            rm -f /tmp/cookies
            return 0
        fi
    fi

    echo -e "${RED}❌ Failed to download: $filename${NC}"
    rm -f /tmp/cookies
    return 1
}

# Fetch project data and process
echo -e "${BLUE}📊 Fetching project data...${NC}"

if ! curl -s "$OPENSHEET_URL" -o /tmp/projects.json; then
    echo -e "${RED}❌ Failed to fetch project data${NC}"
    exit 1
fi

echo -e "${GREEN}📋 Successfully fetched project data${NC}"

# Process each project (this is a simplified version - you may need to adapt based on your JSON structure)
echo -e "${BLUE}🎯 Processing projects...${NC}"

# Example URLs to download (you'll need to manually extract these from your Google Sheets)
# Replace these with actual URLs from your projects

declare -a SAMPLE_URLS=(
    # Add your Google Drive URLs here, one per line
    # "https://drive.google.com/file/d/YOUR_FILE_ID/view"
)

if [[ ${#SAMPLE_URLS[@]} -eq 0 ]]; then
    echo -e "${YELLOW}ℹ️  No URLs configured for download.${NC}"
    echo -e "${YELLOW}📝 To use this script:${NC}"
    echo -e "${YELLOW}   1. Edit this script and add your Google Drive URLs to the SAMPLE_URLS array${NC}"
    echo -e "${YELLOW}   2. Run the script again${NC}"
    echo -e "${YELLOW}   3. Or use the manual download instructions below${NC}"
    echo ""
    echo -e "${BLUE}📖 Manual Download Instructions:${NC}"
    echo -e "${BLUE}1. Open your Google Sheets project data${NC}"
    echo -e "${BLUE}2. For each Google Drive URL, extract the file ID${NC}"
    echo -e "${BLUE}3. Use this format to download: curl -L -o 'filename.ext' 'https://drive.google.com/uc?export=download&id=FILE_ID'${NC}"
    echo -e "${BLUE}4. Save files to: $ASSETS_DIR${NC}"
    echo -e "${BLUE}5. Update your project data to use local paths like: /assets/projects/filename.ext${NC}"
else
    # Download each file
    for url in "${SAMPLE_URLS[@]}"; do
        file_id=$(extract_drive_id "$url")
        if [[ -n "$file_id" ]]; then
            # Create a filename (you may want to customize this)
            filename="asset_${file_id}.jpg"
            output_path="$ASSETS_DIR/$filename"

            if [[ ! -f "$output_path" ]]; then
                download_drive_file "$file_id" "$output_path"
            else
                echo -e "${YELLOW}⏭️  File already exists: $filename${NC}"
            fi
        else
            echo -e "${RED}❌ Could not extract file ID from: $url${NC}"
        fi
    done
fi

echo -e "${GREEN}✅ Asset download process complete!${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo -e "${BLUE}1. Check the downloaded files in: $ASSETS_DIR${NC}"
echo -e "${BLUE}2. Update your Google Sheets to use local paths like: /assets/projects/filename.ext${NC}"
echo -e "${BLUE}3. Re-sync your content collections${NC}"

rm -f /tmp/projects.json
