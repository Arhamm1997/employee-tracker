"""
Live Screen WebRTC module.
Streams screen directly to the admin browser via WebRTC P2P.
Server only handles signaling (SDP offer/answer) — video frames
never pass through the server.

Uses aiortc for WebRTC and websockets for the signaling channel.
"""

import asyncio
import threading
import time
import json
from logger import log

# ── Optional dependency guard ─────────────────────────────────────────────────
try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
    from aiortc.mediastreams import VideoStreamTrack
    from av import VideoFrame
    import numpy as np
    AIORTC_OK = True
except ImportError:
    AIORTC_OK = False
    log.warning("aiortc/av/numpy not installed — live screen feature disabled")
    log.warning("Install with: pip install aiortc av numpy")

try:
    import websockets
    WS_LIB_OK = True
except ImportError:
    WS_LIB_OK = False
    log.warning("websockets not installed — live screen feature disabled")
    log.warning("Install with: pip install websockets")

try:
    from PIL import ImageGrab
    PIL_OK = True
except ImportError:
    PIL_OK = False

AVAILABLE = AIORTC_OK and WS_LIB_OK and PIL_OK

# ── Screen capture track ──────────────────────────────────────────────────────
if AIORTC_OK:
    class ScreenShareTrack(VideoStreamTrack):
        """Video track that continuously captures the screen via PIL."""
        kind = "video"

        async def recv(self) -> "VideoFrame":
            pts, time_base = await self.next_timestamp()
            try:
                img = ImageGrab.grab(all_screens=True)
                # Downscale for bandwidth: max 1280px wide
                max_w = 1280
                if img.width > max_w:
                    ratio = max_w / img.width
                    img = img.resize((max_w, int(img.height * ratio)))
                arr = np.asarray(img.convert("RGB"))
                frame = VideoFrame.from_ndarray(arr, format="rgb24")
                frame.pts = pts
                frame.time_base = time_base
                return frame
            except Exception as e:
                log.error("Screen capture error: %s", e)
                # Return a black frame so the stream doesn't crash
                arr = np.zeros((720, 1280, 3), dtype=np.uint8)
                frame = VideoFrame.from_ndarray(arr, format="rgb24")
                frame.pts = pts
                frame.time_base = time_base
                return frame

# ── Signaling client ──────────────────────────────────────────────────────────
class _SignalingClient:
    """
    Maintains a persistent WebSocket connection to the backend for WebRTC
    signaling. When the admin requests live view, the backend sends
    "webrtc:start" here, and this client negotiates the P2P connection.

    Video frames travel directly from this machine to the admin browser
    via WebRTC — they never touch the backend server.
    """

    def __init__(self, cfg: dict):
        self._cfg = cfg
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._running = False
        self._pc: "RTCPeerConnection | None" = None
        self._ws = None  # current websockets connection

    # ── Public API ────────────────────────────────────────────────────────────
    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(
            target=self._run_event_loop, daemon=True, name="WebRTCSignaling"
        )
        self._thread.start()
        log.info("WebRTC signaling client started")

    def stop(self) -> None:
        self._running = False
        if self._loop and not self._loop.is_closed():
            self._loop.call_soon_threadsafe(self._loop.stop)
        log.info("WebRTC signaling client stopped")

    # ── Event loop (runs in background thread) ────────────────────────────────
    def _run_event_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        while self._running:
            try:
                self._loop.run_until_complete(self._connect_and_run())
            except Exception as e:
                if self._running:
                    log.warning("WebRTC signaling disconnected (%s), retrying in 5s…", e)
                    time.sleep(5)

    # ── WebSocket connection ──────────────────────────────────────────────────
    async def _connect_and_run(self) -> None:
        url = self._cfg.get("serverUrl", "").rstrip("/")
        token = self._cfg.get("agentToken", "")
        ws_url = url.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/api/ws?agentToken={token}"

        log.debug("WebRTC: connecting to %s", ws_url)

        async with websockets.connect(
            ws_url,
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
        ) as ws:
            self._ws = ws
            log.info("WebRTC: signaling connected")

            async for raw in ws:
                try:
                    msg = json.loads(raw)
                    await self._dispatch(ws, msg.get("type", ""), msg.get("data", {}))
                except Exception as e:
                    log.error("WebRTC: message error: %s", e)

        self._ws = None

    # ── Message dispatcher ────────────────────────────────────────────────────
    async def _dispatch(self, ws, msg_type: str, data: dict) -> None:
        if msg_type == "webrtc:start":
            await self._on_start(ws, data.get("sessionId", ""))
        elif msg_type == "webrtc:answer":
            await self._on_answer(data.get("sdp"))
        elif msg_type == "webrtc:ice":
            await self._on_ice(data.get("candidate"))
        elif msg_type == "webrtc:stop":
            await self._on_stop()

    # ── WebRTC handlers ───────────────────────────────────────────────────────
    async def _on_start(self, ws, session_id: str) -> None:
        """Admin opened Live Screen — create RTCPeerConnection and send offer."""
        # Close any existing stream first
        await self._on_stop()

        log.info("WebRTC: session %s — creating offer", session_id)

        try:
            ice_config = RTCConfiguration(iceServers=[
                RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
                RTCIceServer(urls=["stun:stun1.l.google.com:19302"]),
            ])
            pc = RTCPeerConnection(configuration=ice_config)
            self._pc = pc

            # Add screen capture video track
            pc.addTrack(ScreenShareTrack())

            # Build offer
            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            # Trickleless ICE: wait until all ICE candidates are embedded in SDP
            # (avoids a separate ICE candidate exchange protocol)
            deadline = time.monotonic() + 10.0
            while pc.iceGatheringState != "complete":
                if time.monotonic() > deadline:
                    log.warning("WebRTC: ICE gather timed out — sending partial SDP")
                    break
                await asyncio.sleep(0.1)

            # Send the complete SDP (offer + embedded candidates)
            await ws.send(json.dumps({
                "type": "webrtc:offer",
                "data": {
                    "sessionId": session_id,
                    "sdp": {
                        "type": pc.localDescription.type,
                        "sdp": pc.localDescription.sdp,
                    },
                },
            }))
            log.info("WebRTC: offer sent — waiting for admin answer")

        except Exception as e:
            log.error("WebRTC: failed to create offer for session %s: %s", session_id, e)
            self._pc = None
            try:
                await ws.send(json.dumps({
                    "type": "webrtc:error",
                    "data": {
                        "sessionId": session_id,
                        "message": f"Agent failed to start stream: {e}",
                    },
                }))
            except Exception:
                pass

    async def _on_answer(self, sdp: dict | None) -> None:
        """Admin accepted the offer — set remote description to complete P2P."""
        if not self._pc or not sdp:
            return
        try:
            desc = RTCSessionDescription(sdp=sdp["sdp"], type=sdp["type"])
            await self._pc.setRemoteDescription(desc)
            log.info("WebRTC: P2P connection established — screen is streaming to admin")
        except Exception as e:
            log.error("WebRTC: setRemoteDescription failed: %s", e)

    async def _on_ice(self, candidate: dict | None) -> None:
        """Handle trickle ICE from admin (optional with trickleless approach)."""
        # We use trickleless ICE so this is usually not needed, but handle
        # gracefully in case the browser sends candidates anyway.
        pass

    async def _on_stop(self) -> None:
        """Admin closed the view — tear down the peer connection."""
        if self._pc:
            try:
                await self._pc.close()
                log.info("WebRTC: peer connection closed")
            except Exception:
                pass
            self._pc = None


# ── Module-level singleton + public API ───────────────────────────────────────
_client: _SignalingClient | None = None


def start_signaling(cfg: dict) -> None:
    """
    Start the persistent WebRTC signaling client.
    Call once at agent startup after network is confirmed available.
    The client reconnects automatically on disconnect.
    """
    global _client
    if not AVAILABLE:
        log.warning(
            "Live Screen disabled — missing deps: aiortc=%s websockets=%s PIL=%s",
            AIORTC_OK, WS_LIB_OK, PIL_OK,
        )
        return
    if _client is not None:
        return
    _client = _SignalingClient(cfg)
    _client.start()


def stop_signaling() -> None:
    """Stop the signaling client. Called on agent shutdown."""
    global _client
    if _client:
        _client.stop()
        _client = None


# ── Legacy shim (keep agent.py import-compatible during transition) ───────────
def start_live_stream(cfg: dict, send_fn) -> None:
    """Deprecated: WebRTC handles this automatically via signaling."""
    log.warning("start_live_stream() called — ignored; WebRTC signaling handles live view")


def stop_live_stream() -> None:
    """Deprecated: WebRTC handles this automatically via signaling."""
    log.warning("stop_live_stream() called — ignored; WebRTC signaling handles live view")


def is_streaming() -> bool:
    """Returns True if an active WebRTC peer connection exists."""
    if _client and _client._pc is not None:
        return True
    return False
