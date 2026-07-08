#!/bin/bash
# Deploy to Vercel - MANDATORY script for all frontend changes
# This ensures changes go to BOTH main and vercel-test branches

set -e  # Exit on any error

# Check if commit message provided
if [ -z "$1" ]; then
    echo "❌ Error: Commit message required"
    echo "Usage: ./deploy-to-vercel.sh \"Your commit message\""
    exit 1
fi

COMMIT_MSG="$1"
CURRENT_BRANCH=$(git branch --show-current)

echo "🚀 Starting Vercel deployment process..."
echo "📝 Commit message: $COMMIT_MSG"
echo ""

# Step 1: Commit and push to main
echo "1️⃣  Committing to main branch..."
if [ "$CURRENT_BRANCH" != "main" ]; then
    git checkout main
fi
git add .
git commit -m "$COMMIT_MSG" || echo "⚠️  No changes to commit on main"
git push origin main
echo "✅ Main branch pushed"
echo ""

# Step 2: Switch to vercel-test
echo "2️⃣  Switching to vercel-test branch..."
git checkout vercel-test
echo "✅ Switched to vercel-test"
echo ""

# Step 3: Merge main into vercel-test
echo "3️⃣  Merging main into vercel-test..."
git merge main -m "Deploy: $COMMIT_MSG"
echo "✅ Merged main into vercel-test"
echo ""

# Step 4: Push vercel-test (triggers Vercel deployment)
echo "4️⃣  Pushing vercel-test (triggers Vercel)..."
git push origin vercel-test
echo "✅ Vercel-test pushed - Vercel deployment triggered!"
echo ""

# Step 5: Return to main
echo "5️⃣  Returning to main branch..."
git checkout main
echo "✅ Back on main branch"
echo ""

echo "🎉 DEPLOYMENT COMPLETE!"
echo "📍 Vercel will deploy from vercel-test branch in 1-2 minutes"
echo "🌐 Check: https://social-media-saas-psi.vercel.app"
echo ""
echo "⚠️  Remember: ALWAYS use this script for frontend changes!"
