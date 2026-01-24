#!/bin/bash
# Fix Git Remote URL

echo "🔧 Fixing Git Remote URL"
echo ""

# Get current remote
CURRENT=$(git config --get remote.origin.url)
echo "Current remote: $CURRENT"
echo ""

if [[ $CURRENT == *"USERNAME/REPO"* ]]; then
    echo "⚠️  Detected placeholder text in remote URL"
    echo ""

    # Try to determine the correct repo from git history
    echo "Searching git history for clues..."

    # Check if there's a .git/config.backup or look at reflog
    if [ -f .git/config ]; then
        # Look for any github URLs in git config
        GITHUB_URLS=$(git config --list | grep -i "github.com" | grep -v "USERNAME/REPO" | head -1)

        if [ -n "$GITHUB_URLS" ]; then
            echo "Found: $GITHUB_URLS"
        fi
    fi

    echo ""
    echo "📝 Please enter your GitHub username and repository name:"
    echo ""

    read -p "GitHub username (default: mshaler): " USERNAME
    USERNAME=${USERNAME:-mshaler}

    read -p "Repository name (default: Isometry): " REPO
    REPO=${REPO:-Isometry}

    NEW_URL="git@github.com:${USERNAME}/${REPO}.git"

    echo ""
    echo "Setting remote to: $NEW_URL"
    git remote set-url origin "$NEW_URL"

    echo ""
    echo "✅ Updated!"
    echo ""
    echo "New remote:"
    git remote -v

else
    echo "✅ Remote URL looks correct"
    git remote -v
fi

echo ""
echo "🧪 Testing connection..."
ssh -T git@github.com 2>&1 | grep -i "successfully authenticated" && echo "✅ GitHub SSH works!" || echo "⚠️ SSH authentication failed"
