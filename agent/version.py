"""
Single source of truth for agent version information.
All modules must import VERSION from here — never hardcode version strings.
"""

import struct
import os
import sys

AGENT_VERSION = "1.0.9"
MINIMUM_SUPPORTED_VERSION = "1.0.0"  # Server enforces this; agents older than this are force-upgraded

# Build metadata — overwritten by build.bat at compile time
BUILD_DATE = "2026-04-30"
BUILD_ARCH = "x64" if struct.calcsize("P") * 8 == 64 else "x86"

# ── Semantic version comparison helpers ────────────────────────────────────────

def _parse(v: str) -> tuple:
    try:
        parts = v.strip().lstrip("v").split(".")
        return tuple(int(x) for x in parts[:3])
    except Exception:
        return (0, 0, 0)


def is_older_than(version_a: str, version_b: str) -> bool:
    """Return True if version_a < version_b."""
    return _parse(version_a) < _parse(version_b)


def is_at_least(version_a: str, minimum: str) -> bool:
    """Return True if version_a >= minimum."""
    return _parse(version_a) >= _parse(minimum)
