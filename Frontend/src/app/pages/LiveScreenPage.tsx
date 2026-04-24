import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Navigate } from "react-router";
import { Monitor, Maximize, Minimize } from "lucide-react";
import { useSocket } from "../lib/socket-context";
import { useQuery } from "@tanstack/react-query";
import { apiGetEmployee } from "../lib/api";

// STUN servers — same config as EmployeeDetailPage
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function LiveScreenPage() {
  const { id } = useParams<{ id: string }>();
  const { subscribeToMessage, sendWsMessage } = useSocket();

  // Simple auth guard — redirect to login if no token
  const token = localStorage.getItem("monitor_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const [viewState, setViewState] = useState<"connecting" | "connected" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Listen for fullscreen changes (including F11 / Esc)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Double-click video to toggle fullscreen
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => toggleFullscreen();
    video.addEventListener("dblclick", handler);
    return () => video.removeEventListener("dblclick", handler);
  }, [toggleFullscreen]);

  const { data: employee } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => apiGetEmployee(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;

    setViewState("connecting");
    setError(null);

    let offerTimer: ReturnType<typeof setTimeout> | null = null;
    let iceTimer: ReturnType<typeof setTimeout> | null = null;

    // Delay the request so any previous session (from the dialog) has time to fully stop
    const startDelay = setTimeout(() => {
      sendWsMessage("webrtc:request", { employeeId: id });
      // Timeout: if no offer arrives in 15s the agent is likely unreachable
      offerTimer = setTimeout(() => {
        setViewState("error");
        setError("No response from agent. Ensure it is running and aiortc is installed.");
      }, 15000);
    }, 1000);

    const unsubs: Array<() => void> = [];

    unsubs.push(subscribeToMessage("webrtc:session", (_data) => {
      const { sessionId } = _data as { sessionId: string };
      sessionIdRef.current = sessionId;
    }));

    unsubs.push(subscribeToMessage("webrtc:offer", async (raw) => {
      if (offerTimer) { clearTimeout(offerTimer); offerTimer = null; }

      const { sessionId, sdp } = raw as { sessionId: string; sdp: RTCSessionDescriptionInit; employeeId: string };

      if (sessionIdRef.current && sessionIdRef.current !== sessionId) return;
      sessionIdRef.current = sessionId;

      if (pcRef.current) {
        // Null out handlers BEFORE close — otherwise onconnectionstatechange
        // fires "disconnected"/"failed" and queues a spurious retry request.
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
      }
      // Cancel any pending retry timer that may have been queued
      if (autoRetryTimer.current) {
        clearTimeout(autoRetryTimer.current);
        autoRetryTimer.current = null;
      }

      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (iceTimer) { clearTimeout(iceTimer); iceTimer = null; }
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setViewState("connected");
        }
      };

      pc.onconnectionstatechange = () => {
        // "disconnected" is transient — WebRTC can self-recover, don't retry yet.
        // Only "failed" is permanent and requires a new offer/answer cycle.
        if (pc.connectionState === "failed") {
          if (iceTimer) { clearTimeout(iceTimer); iceTimer = null; }
          setRetryCount((prev) => {
            const next = prev + 1;
            if (next <= 5) {
              setViewState("connecting");
              setError(null);
              autoRetryTimer.current = setTimeout(() => {
                sendWsMessage("webrtc:request", { employeeId: id });
              }, 2000);
            } else {
              setViewState("error");
              setError("WebRTC connection lost after multiple retries. Check agent status.");
            }
            return next;
          });
        }
        if (pc.connectionState === "connected") {
          setRetryCount(0);
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Boost video bitrate to 4 Mbps for higher quality
        const senders = pc.getSenders();
        for (const sender of senders) {
          if (sender.track?.kind === "video") {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 4_000_000;
            params.encodings[0].maxFramerate = 20;
            sender.setParameters(params).catch(() => {});
          }
        }

        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") { resolve(); return; }
          const check = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", check);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", check);
          setTimeout(resolve, 5000);
        });

        sendWsMessage("webrtc:answer", {
          sessionId,
          sdp: {
            type: pc.localDescription!.type,
            sdp: pc.localDescription!.sdp,
          },
        });

        // ICE timeout: if P2P doesn't connect within 20s, show error
        iceTimer = setTimeout(() => {
          if (pc.connectionState !== "connected") {
            setViewState("error");
            setError("Connection timed out. Agent may be unreachable due to NAT or firewall.");
          }
        }, 20000);
      } catch (err) {
        console.error("WebRTC answer failed:", err);
        setViewState("error");
        setError("Failed to establish WebRTC connection.");
      }
    }));

    unsubs.push(subscribeToMessage("webrtc:disconnected", (raw) => {
      const { employeeId: empId } = raw as { employeeId: string };
      if (empId === id) {
        setViewState("error");
        setError("Agent disconnected from the server.");
      }
    }));

    unsubs.push(subscribeToMessage("webrtc:error", (raw) => {
      if (offerTimer) { clearTimeout(offerTimer); offerTimer = null; }
      if (iceTimer) { clearTimeout(iceTimer); iceTimer = null; }
      const { message } = raw as { message: string };
      setViewState("error");
      setError(message || "Failed to start live view.");
    }));

    return () => {
      clearTimeout(startDelay);
      if (offerTimer) clearTimeout(offerTimer);
      if (iceTimer) clearTimeout(iceTimer);
      if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current);
      unsubs.forEach((u) => u());
      if (pcRef.current) {
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
      }
      if (sessionIdRef.current) {
        sendWsMessage("webrtc:stop", { sessionId: sessionIdRef.current });
        sessionIdRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [id, subscribeToMessage, sendWsMessage]);

  return (
    <div ref={containerRef} className="min-h-screen h-screen bg-black flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#0f0f1a] border-b border-white/10 shrink-0">
        <Monitor className="w-5 h-5 text-[#6366f1]" />
        <span className="text-white font-medium">
          Live Screen — {employee?.name ?? "Loading…"}
        </span>
        {viewState === "connected" && (
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-white/30">
            WebRTC P2P — video streams directly from agent
          </span>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (double-click video)"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain ${viewState === "connected" ? "block" : "hidden"}`}
        />

        {viewState === "connecting" && (
          <div className="text-center text-white/60">
            <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm">Connecting to agent via WebRTC…</p>
            <p className="text-xs mt-1 opacity-50">This usually takes 1–3 seconds on a local network.</p>
          </div>
        )}

        {viewState === "error" && (
          <div className="text-center text-white/60 px-6">
            <Monitor className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p className="text-sm text-red-400">{error || "Connection failed."}</p>
            <p className="text-xs mt-2 opacity-50">Make sure the agent is online and has aiortc installed.</p>
            <button
              className="mt-4 px-4 py-1.5 text-xs rounded border border-white/20 hover:bg-white/10 transition-colors text-white"
              onClick={() => {
                setRetryCount(0);
                setViewState("connecting");
                setError(null);
                sendWsMessage("webrtc:request", { employeeId: id });
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
