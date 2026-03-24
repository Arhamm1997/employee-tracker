"""
blocker.py — System-level website blocking via the Windows hosts file.

Domains in the server's blockedSites list are redirected to 127.0.0.1 so
browsers (and every other app) cannot reach them at all.  We fence our own
entries between two sentinel comment lines so removal is clean and precise
— we never touch anything outside that block.

Requirements: the agent must run as Administrator so it can write to the
hosts file (standard requirement for monitoring agents).
"""

import os
import re
from logger import log

HOSTS_FILE = r"C:\Windows\System32\drivers\etc\hosts"
MARKER_START = "# EmployeeMonitor Blocked Sites - START"
MARKER_END   = "# EmployeeMonitor Blocked Sites - END"


# ── Internal helpers ──────────────────────────────────────────────────────────

def _extract_domain(site: str) -> str:
    """Strip protocol, path, and port — return a bare lower-case domain."""
    domain = site.lower().strip()
    domain = re.sub(r"^https?://", "", domain)
    domain = domain.split("/")[0]   # strip path
    domain = domain.split(":")[0]   # strip port
    return domain.strip()


def _read_hosts() -> str:
    try:
        with open(HOSTS_FILE, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        log.error("blocker: cannot read hosts file: %s", e)
        return ""


def _write_hosts(content: str) -> bool:
    try:
        with open(HOSTS_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    except PermissionError:
        log.error("blocker: permission denied writing hosts file — agent must run as Administrator")
        return False
    except Exception as e:
        log.error("blocker: cannot write hosts file: %s", e)
        return False


def _strip_our_block(content: str) -> str:
    """Remove our marker section (including trailing newline) from content."""
    pattern = re.compile(
        rf"[ \t]*{re.escape(MARKER_START)}.*?{re.escape(MARKER_END)}[ \t]*\n?",
        re.DOTALL,
    )
    return pattern.sub("", content)


# ── Public API ────────────────────────────────────────────────────────────────

def apply_blocked_sites(sites: list) -> None:
    """Write (or refresh) the blocked-sites section in the hosts file.

    Calling with an empty list is equivalent to calling clear_blocked_sites().
    Domains are blocked with both bare and www. variants.
    """
    if not sites:
        clear_blocked_sites()
        return

    domains: list[str] = []
    for site in sites:
        d = _extract_domain(site)
        if not d:
            continue
        domains.append(d)
        if not d.startswith("www."):
            domains.append(f"www.{d}")

    if not domains:
        clear_blocked_sites()
        return

    base = _strip_our_block(_read_hosts()).rstrip("\n")

    lines = [MARKER_START]
    for d in domains:
        lines.append(f"127.0.0.1\t{d}")
    lines.append(MARKER_END)

    new_content = base + "\n" + "\n".join(lines) + "\n"

    if _write_hosts(new_content):
        log.info("blocker: applied %d blocked domain entries (%d sites)", len(domains), len(sites))
    # flush DNS cache so browsers see the change immediately
    _flush_dns()


def clear_blocked_sites() -> None:
    """Remove every EmployeeMonitor entry from the hosts file."""
    content = _read_hosts()
    stripped = _strip_our_block(content)
    if stripped == content:
        return  # nothing to remove
    if _write_hosts(stripped):
        log.info("blocker: cleared blocked sites from hosts file")
    _flush_dns()


def _flush_dns() -> None:
    """Ask Windows to reload the DNS resolver cache."""
    try:
        import subprocess
        subprocess.run(
            ["ipconfig", "/flushdns"],
            capture_output=True,
            timeout=5,
            check=False,
        )
    except Exception:
        pass  # not critical