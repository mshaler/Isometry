#!/usr/bin/env python3
"""
Knowledge Base Configuration Reader

Reads .kb-config.yaml for sync script settings
"""

from pathlib import Path
import sys

try:
    import yaml
except ImportError:
    print("⚠️  PyYAML not installed. Using default config.")
    print("   Install with: pip3 install pyyaml")
    yaml = None

# Default configuration (fallback if YAML not available or file missing)
DEFAULT_CONFIG = {
    "alto_index": {
        "base_path": "/Users/mshaler/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index/notes/Learning",
        "folders": ["ClaudeAI", "CardBoard"]
    },
    "github": {
        "repo": "mshaler/Isometry",
        "api_url": "https://api.github.com/repos/mshaler/Isometry/issues"
    },
    "sync": {
        "auto_commit": True,
        "commit_prefix": "docs:",
        "branch": "main"
    },
    "paths": {
        "apple_notes": "notes/apple-notes",
        "github_issues": "issues"
    }
}

def load_config():
    """Load configuration from .kb-config.yaml or use defaults"""
    config_path = Path(".kb-config.yaml")

    if yaml is None:
        return DEFAULT_CONFIG

    if not config_path.exists():
        print(f"⚠️  Config file not found: {config_path}")
        print("   Using default configuration")
        return DEFAULT_CONFIG

    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
            return config if config else DEFAULT_CONFIG
    except Exception as e:
        print(f"⚠️  Error loading config: {e}")
        print("   Using default configuration")
        return DEFAULT_CONFIG

# Load configuration on import
CONFIG = load_config()
