#!/bin/bash

# ============================================================================
# SUPABASE API-BASED AUTO-MIGRATION (macOS/Linux)
# ============================================================================
# Run this script to migrate your entire Supabase database using APIs
# No database passwords required!
#
# Usage:
#   bash migrate-api.sh -s <sourceId> -k <sourceKey> -t <targetId> -K <targetKey>
#
# Or interactive mode (just run the script):
#   bash migrate-api.sh
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
while getopts "s:k:t:K:huS" opt; do
  case $opt in
    s) sourceProjectId="$OPTARG" ;;
    k) sourceApiKey="$OPTARG" ;;
    t) targetProjectId="$OPTARG" ;;
    K) targetApiKey="$OPTARG" ;;
    h) noUsers=true ;;
    u) noStorage=true ;;
    S) noFunctions=true ;;
  esac
done

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  SUPABASE AUTO-MIGRATION (API-BASED)   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# If not provided, prompt user
if [ -z "$sourceProjectId" ]; then
  echo -e "${CYAN}👉 Source Supabase Configuration${NC}"
  read -p "Enter source project ID: " sourceProjectId
  read -sp "Enter source API key: " sourceApiKey
  echo ""
fi

if [ -z "$targetProjectId" ]; then
  echo ""
  echo -e "${CYAN}👉 Target Supabase Configuration${NC}"
  read -p "Enter target project ID: " targetProjectId
  read -sp "Enter target API key: " targetApiKey
  echo ""
fi

# Validate
if [ -z "$sourceProjectId" ] || [ -z "$targetProjectId" ] || [ -z "$sourceApiKey" ] || [ -z "$targetApiKey" ]; then
  echo -e "${RED}❌ Error: Missing required credentials${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Credentials validated${NC}"
echo ""

# Show configuration
echo -e "${CYAN}📋 Migration Configuration${NC}"
echo "  Source Project:   $sourceProjectId"
echo "  Target Project:   $targetProjectId"
echo "  Include Users:    $([ "$noUsers" = true ] && echo 'No' || echo 'Yes')"
echo "  Include Storage:  $([ "$noStorage" = true ] && echo 'No' || echo 'Yes')"
echo "  Include Functions: $([ "$noFunctions" = true ] && echo 'No' || echo 'Yes')"
echo ""

# Confirm
read -p "Proceed with migration? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo -e "${YELLOW}⚠️  Migration cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}ℹ️  Starting migration...${NC}"
echo ""

# Build command
cmd="SOURCE_API_KEY='$sourceApiKey' TARGET_API_KEY='$targetApiKey' npm run migrate:auto -- --source $sourceProjectId --target $targetProjectId"

if [ "$noUsers" = true ]; then cmd="$cmd --no-users"; fi
if [ "$noStorage" = true ]; then cmd="$cmd --no-storage"; fi
if [ "$noFunctions" = true ]; then cmd="$cmd --no-functions"; fi

# Run migration
eval "$cmd"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✨ MIGRATION COMPLETED SUCCESSFULLY  ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}ℹ️  Your data has been successfully migrated to $targetProjectId${NC}"
  echo -e "${BLUE}ℹ️  Verify the data in your Supabase dashboard${NC}"
else
  echo ""
  echo -e "${RED}❌ Migration failed. Check the error messages above.${NC}"
  exit 1
fi
