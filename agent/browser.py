import os
import shutil
import sqlite3
import tempfile
import glob
from datetime import datetime, timedelta, timezone
from logger import log


def _chrome_timestamp_to_datetime(chrome_ts: int) -> datetime | None:
    """Convert Chrome/Edge timestamp (microseconds since 1601-01-01) to datetime.
    Returns None for invalid/zero timestamps so callers can skip those rows."""
    if not chrome_ts:
        return None  # Timestamp 0 means "never visited" — skip silently
    epoch_diff = 11644473600  # seconds between 1601-01-01 and 1970-01-01
    try:
        ts = (chrome_ts / 1_000_000) - epoch_diff
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    except (OSError, ValueError):
        return None  # Invalid timestamp — skip silently


def _firefox_timestamp_to_datetime(moz_ts: int) -> datetime:
    """Convert Firefox timestamp (microseconds since epoch) to datetime."""
    try:
        return datetime.fromtimestamp(moz_ts / 1_000_000, tz=timezone.utc)
    except (OSError, ValueError):
        log.debug("Failed to convert Firefox timestamp %s", moz_ts)
        return datetime.now(tz=timezone.utc)


def _safe_read_db(db_path: str, query: str, browser: str, profile: str, since: datetime) -> list:
    """Copy DB to temp file (browser locks it), then query. Profile info for better logging."""
    if not os.path.exists(db_path):
        log.debug("%s history DB not found: %s", browser, db_path)
        return []

    # Create unique temp file with profile info
    profile_safe = profile.replace("\\", "_").replace("/", "_")
    tmp = os.path.join(tempfile.gettempdir(), f"em_{browser}_{profile_safe}_history.db")

    try:
        shutil.copy2(db_path, tmp)
        log.debug("Copied %s DB from %s to temp", browser, db_path)
    except (PermissionError, OSError) as e:
        log.warning("Cannot copy %s DB from %s (likely browser running) - trying direct read: %s",
                    browser, db_path, e)
        tmp = db_path

    results = []
    try:
        conn = sqlite3.connect(f"file:{tmp}?mode=ro&immutable=1", uri=True)
        conn.execute("PRAGMA query_only=ON")
        rows = conn.execute(query).fetchall()
        conn.close()

        for row in rows:
            url, title, visit_ts = row[0], row[1] or "", row[2]
            duration = row[3] if len(row) > 3 else 0

            if browser == "firefox":
                visited_at = _firefox_timestamp_to_datetime(visit_ts)
            else:
                visited_at = _chrome_timestamp_to_datetime(visit_ts)

            # Skip rows with invalid/zero timestamps
            if visited_at is None:
                continue

            if visited_at < since:
                continue

            results.append({
                "browser": browser,
                "url": url,
                "title": title,
                "visitedAt": visited_at.isoformat(),
                "duration": duration or 0,
            })

        log.debug("Read %d entries from %s (%s profile)", len(results), browser, profile)
    except sqlite3.DatabaseError as e:
        log.warning("Database error reading %s history from %s: %s (DB may be locked)",
                    browser, db_path, e)
    except Exception as e:
        log.error("Failed to read %s history from %s: %s", browser, db_path, e)
    finally:
        if tmp != db_path and os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError as e:
                log.debug("Failed to remove temp DB %s: %s", tmp, e)

    return results


def _get_chrome_profiles(browser_name: str) -> list[str]:
    """Get all Chrome/Edge profiles by scanning the User Data directory."""
    local_appdata = os.environ.get("LOCALAPPDATA", "")

    if browser_name == "chrome":
        user_data_dir = os.path.join(local_appdata, r"Google\Chrome\User Data")
    elif browser_name == "edge":
        user_data_dir = os.path.join(local_appdata, r"Microsoft\Edge\User Data")
    else:
        return []

    if not os.path.isdir(user_data_dir):
        log.debug("%s User Data directory not found: %s", browser_name, user_data_dir)
        return []

    profiles = []
    try:
        for item in os.listdir(user_data_dir):
            item_path = os.path.join(user_data_dir, item)
            # Look for directories like "Default", "Profile 1", "Profile 2", etc.
            if os.path.isdir(item_path) and (item == "Default" or item.startswith("Profile")):
                history_db = os.path.join(item_path, "History")
                if os.path.exists(history_db):
                    profiles.append(item)
                    log.debug("Found %s profile: %s", browser_name, item)

        if not profiles:
            log.debug("No %s profiles found with History DB in %s", browser_name, user_data_dir)
    except (OSError, PermissionError) as e:
        log.warning("Failed to scan %s profiles in %s: %s", browser_name, user_data_dir, e)

    return profiles if profiles else ["Default"]  # Fallback to Default if scan fails


def collect_browser_history(since_minutes: int = 30) -> list:
    """Collect browser history from Chrome, Edge, and Firefox with all profiles."""
    since = datetime.now(tz=timezone.utc) - timedelta(minutes=since_minutes)
    all_history = []

    local_appdata = os.environ.get("LOCALAPPDATA", "")
    appdata = os.environ.get("APPDATA", "")

    log.info("Starting browser history collection (last %d minutes)", since_minutes)

    # Chrome - scan all profiles
    chrome_profiles = _get_chrome_profiles("chrome")
    for profile in chrome_profiles:
        chrome_db = os.path.join(local_appdata, r"Google\Chrome\User Data", profile, "History")
        chrome_query = "SELECT url, title, last_visit_time, 0 as visit_duration FROM urls ORDER BY last_visit_time DESC LIMIT 500"
        history = _safe_read_db(chrome_db, chrome_query, "chrome", profile, since)
        all_history.extend(history)
        log.info("Chrome profile '%s': collected %d entries", profile, len(history))

    # Edge - scan all profiles
    edge_profiles = _get_chrome_profiles("edge")
    for profile in edge_profiles:
        edge_db = os.path.join(local_appdata, r"Microsoft\Edge\User Data", profile, "History")
        edge_query = "SELECT url, title, last_visit_time, 0 as visit_duration FROM urls ORDER BY last_visit_time DESC LIMIT 500"
        history = _safe_read_db(edge_db, edge_query, "edge", profile, since)
        all_history.extend(history)
        log.info("Edge profile '%s': collected %d entries", profile, len(history))

    # Firefox - scan all profiles
    ff_profiles = os.path.join(appdata, r"Mozilla\Firefox\Profiles")
    ff_pattern = os.path.join(ff_profiles, "*.default-release", "places.sqlite")
    ff_dbs = glob.glob(ff_pattern)
    if ff_dbs:
        for ff_db in ff_dbs:
            profile_name = os.path.basename(os.path.dirname(ff_db))
            ff_query = "SELECT url, title, last_visit_date FROM moz_places WHERE last_visit_date IS NOT NULL ORDER BY last_visit_date DESC LIMIT 500"
            history = _safe_read_db(ff_db, ff_query, "firefox", profile_name, since)
            all_history.extend(history)
            log.info("Firefox profile '%s': collected %d entries", profile_name, len(history))
    else:
        log.debug("No Firefox profiles found in %s", ff_profiles)

    log.info("Browser history collection complete: %d total entries from last %d minutes",
             len(all_history), since_minutes)
    return all_history
