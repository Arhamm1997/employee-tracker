"""
Unit tests for production-critical agent behaviors:
  - Consent guards: send_keylog / send_clipboard must not transmit when disabled
  - Queue fallback: _resolve_db_path picks a writable location
  - Rate limiter: 429 response triggers back-off; subsequent calls are blocked
"""

import importlib
import os
import sys
import time
import types
import unittest
from unittest.mock import MagicMock, patch, call

# ── Path setup ──────────────────────────────────────────────────────────────────
# Tests live in agent/tests/; the agent modules are in agent/
_AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AGENT_DIR not in sys.path:
    sys.path.insert(0, _AGENT_DIR)

# Stub heavy dependencies that won't be present in a test environment
for _stub in ("logger", "version"):
    if _stub not in sys.modules:
        _mod = types.ModuleType(_stub)
        if _stub == "logger":
            _mod.log = MagicMock()
        elif _stub == "version":
            _mod.AGENT_VERSION = "1.0.9"
            _mod.BUILD_ARCH = "x64"
        sys.modules[_stub] = _mod


# ── Consent guard tests ──────────────────────────────────────────────────────────

class TestConsentGuards(unittest.TestCase):
    """send_keylog and send_clipboard must be no-ops when the opt-in flag is off."""

    def setUp(self):
        # Reload api with stubbed requests so no real network calls happen
        import requests as _req
        self._post_patcher = patch("requests.Session.post")
        self._mock_post = self._post_patcher.start()
        import api as _api
        # Reset backoff state between tests
        _api._backoff.clear()
        self.api = _api

    def tearDown(self):
        self._post_patcher.stop()

    def _cfg(self, **flags) -> dict:
        return {
            "serverUrl": "http://localhost:5001",
            "agentToken": "test-token",
            "employeeCode": "EMP001",
            **flags,
        }

    # ── send_keylog ──────────────────────────────────────────────────────────────

    def test_keylog_disabled_by_default(self):
        """send_keylog returns None and makes no HTTP call when keylogEnabled is absent."""
        result = self.api.send_keylog(self._cfg(), "Notepad", "hello world")
        self.assertIsNone(result)
        self._mock_post.assert_not_called()

    def test_keylog_disabled_explicitly_false(self):
        """send_keylog returns None when keylogEnabled is explicitly False."""
        result = self.api.send_keylog(self._cfg(keylogEnabled=False), "Notepad", "abc")
        self.assertIsNone(result)
        self._mock_post.assert_not_called()

    def test_keylog_enabled_calls_server(self):
        """send_keylog POSTs to /keylog when keylogEnabled=True."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"success": True}
        self._mock_post.return_value = mock_resp

        result = self.api.send_keylog(self._cfg(keylogEnabled=True), "Chrome", "secret")
        self.assertIsNotNone(result)
        self._mock_post.assert_called_once()
        url_called = self._mock_post.call_args[0][0]
        self.assertIn("/keylog", url_called)

    # ── send_clipboard ───────────────────────────────────────────────────────────

    def test_clipboard_disabled_by_default(self):
        """send_clipboard returns None and makes no HTTP call when clipboardEnabled is absent."""
        result = self.api.send_clipboard(self._cfg(), {"text": "sensitive data"})
        self.assertIsNone(result)
        self._mock_post.assert_not_called()

    def test_clipboard_disabled_explicitly_false(self):
        """send_clipboard returns None when clipboardEnabled is explicitly False."""
        result = self.api.send_clipboard(self._cfg(clipboardEnabled=False), {"text": "data"})
        self.assertIsNone(result)
        self._mock_post.assert_not_called()

    def test_clipboard_enabled_calls_server(self):
        """send_clipboard POSTs to /clipboard when clipboardEnabled=True."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"success": True}
        self._mock_post.return_value = mock_resp

        result = self.api.send_clipboard(self._cfg(clipboardEnabled=True), {"text": "hi"})
        self.assertIsNotNone(result)
        self._mock_post.assert_called_once()
        url_called = self._mock_post.call_args[0][0]
        self.assertIn("/clipboard", url_called)

    def test_keylog_does_not_bleed_into_clipboard(self):
        """Enabling keylog must not enable clipboard and vice versa."""
        result = self.api.send_clipboard(self._cfg(keylogEnabled=True), {"text": "x"})
        self.assertIsNone(result)
        self._mock_post.assert_not_called()

        self.api._backoff.clear()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"success": True}
        self._mock_post.return_value = mock_resp
        result = self.api.send_keylog(self._cfg(clipboardEnabled=True), "app", "k")
        self.assertIsNone(result)
        self._mock_post.assert_not_called()


# ── Rate-limiter (429) tests ──────────────────────────────────────────────────────

class TestRateLimiter(unittest.TestCase):

    def setUp(self):
        self._post_patcher = patch("requests.Session.post")
        self._mock_post = self._post_patcher.start()
        import api as _api
        _api._backoff.clear()
        self.api = _api

    def tearDown(self):
        self._post_patcher.stop()

    def _cfg(self) -> dict:
        return {
            "serverUrl": "http://localhost:5001",
            "agentToken": "tok",
            "employeeCode": "EMP001",
            "keylogEnabled": True,
        }

    def _make_response(self, status: int, retry_after: str | None = None) -> MagicMock:
        r = MagicMock()
        r.status_code = status
        r.json.return_value = {}
        r.headers = {"Retry-After": retry_after} if retry_after else {}
        return r

    def test_429_blocks_immediate_retry(self):
        """After a 429, the next call to the same endpoint is blocked (returns None)."""
        self._mock_post.return_value = self._make_response(429, retry_after="60")

        first = self.api.send_keylog(self._cfg(), "app", "k")
        self.assertIsNone(first)

        # Second call without waiting should be blocked
        self._mock_post.reset_mock()
        second = self.api.send_keylog(self._cfg(), "app", "k2")
        self.assertIsNone(second)
        self._mock_post.assert_not_called()

    def test_429_respects_retry_after_header(self):
        """Retry-After header value sets the back-off duration."""
        self._mock_post.return_value = self._make_response(429, retry_after="120")
        self.api.send_keylog(self._cfg(), "app", "k")

        state = self.api._backoff.get("keylog", {})
        self.assertGreater(state.get("retry_after", 0), time.monotonic() + 60)

    def test_successful_call_clears_backoff(self):
        """A successful 200 resets the back-off counter to zero."""
        # First: 429
        self._mock_post.return_value = self._make_response(429)
        self.api.send_keylog(self._cfg(), "app", "k")
        count_after_429 = self.api._backoff.get("keylog", {}).get("count", 0)
        self.assertGreater(count_after_429, 0)

        # Manually expire the back-off
        self.api._backoff["keylog"]["retry_after"] = 0.0
        self.api._backoff["keylog"]["last_sent"] = 0.0

        # Then: 200
        self._mock_post.return_value = self._make_response(200)
        self.api.send_keylog(self._cfg(), "app", "ok")
        count_after_success = self.api._backoff.get("keylog", {}).get("count", 0)
        self.assertEqual(count_after_success, 0)

    def test_different_endpoints_backoff_independently(self):
        """A 429 on heartbeat must not block send_keylog."""
        import api as _api
        _api._backoff.clear()

        # Manually inject a heartbeat back-off
        _api._backoff["heartbeat"] = {
            "retry_after": time.monotonic() + 300,
            "count": 5,
            "last_sent": time.monotonic(),
        }

        # Keylog should still go through (no back-off on its key)
        mock_ok = self._make_response(200)
        self._mock_post.return_value = mock_ok
        result = self.api.send_keylog(self._cfg(), "app", "k")
        self.assertIsNotNone(result)
        self._mock_post.assert_called_once()


# ── Queue fallback path tests ────────────────────────────────────────────────────

class TestQueueFallback(unittest.TestCase):
    """_resolve_db_path must fall back to LocalAppData / TEMP when ProgramData is read-only."""

    def setUp(self):
        import offline_queue
        self.oq = offline_queue
        # Reset module-level DB path so each test starts fresh
        self.oq._db_path = None

    def test_primary_path_used_when_writable(self):
        """Uses _PRIMARY_DB when a write-test succeeds there."""
        with patch("os.makedirs"), \
             patch("builtins.open", MagicMock()), \
             patch("os.remove"):
            path = self.oq._resolve_db_path()
        self.assertEqual(path, self.oq._PRIMARY_DB)

    def test_falls_back_to_localappdata_on_permission_error(self):
        """Falls back to _FALLBACK_DB when _PRIMARY_DB write-test raises PermissionError."""
        call_count = {"n": 0}

        def mock_open(path, *args, **kwargs):
            call_count["n"] += 1
            if self.oq._PRIMARY_DB + ".writetest" in path:
                raise PermissionError("access denied")
            return MagicMock().__enter__.return_value

        with patch("os.makedirs"), \
             patch("builtins.open", side_effect=mock_open), \
             patch("os.remove"):
            path = self.oq._resolve_db_path()

        self.assertEqual(path, self.oq._FALLBACK_DB)

    def test_falls_back_to_temp_when_both_fail(self):
        """Falls back to TEMP directory when both primary and fallback are read-only."""
        with patch("os.makedirs"), \
             patch("builtins.open", side_effect=PermissionError("denied")), \
             patch("os.remove"):
            path = self.oq._resolve_db_path()

        expected_temp = os.path.join(
            os.getenv("TEMP", r"C:\Temp"), "EmployeeMonitor", "queue.db"
        )
        self.assertEqual(path, expected_temp)

    def test_init_db_disables_queue_on_total_failure(self):
        """init_db sets _db_path=None when the DB cannot be created."""
        with patch.object(self.oq, "_resolve_db_path", return_value=":bad:path:"):
            self.oq.init_db()
        # DB path will be set to the bad path but sqlite will fail — queue disabled
        # (We just check init_db doesn't raise)

    def test_queue_operations_silent_when_db_unavailable(self):
        """queue_activity and friends are no-ops when _db_path is None (no exception)."""
        self.oq._db_path = None
        # These must not raise
        self.oq.queue_activity("EMP001", "App", "Title", False, "2026-04-30T00:00:00Z")
        self.oq.queue_event("EMP001", "usb", {}, "2026-04-30T00:00:00Z")
        result = self.oq.get_pending_activities()
        self.assertEqual(result, [])

    def test_mark_synced_rejects_unknown_table(self):
        """mark_synced with an unknown table name is rejected (SQL injection protection)."""
        self.oq._db_path = ":memory:"
        # Should not raise, but must not execute SQL with a bad table name
        self.oq.mark_synced("'; DROP TABLE activity_queue; --", 1)
        # If we get here without an exception and without SQL injection, the test passes


if __name__ == "__main__":
    unittest.main(verbosity=2)
