import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { apiGetAlertSlackMessages, apiMarkSlackMessageRead, type SlackMessage } from "../../lib/api";
import { useSocket } from "../../lib/socket-context";
import { toast } from "sonner";

interface SlackMessagesPanelProps {
  alertId: string;
  onClose?: () => void;
}

function MessageBubble({ msg }: { msg: SlackMessage }) {
  const isInbound = msg.direction === "inbound";
  const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex flex-col gap-1 ${isInbound ? "items-start" : "items-end"}`}>
      {isInbound && msg.slackUserName && (
        <span className="text-xs text-muted-foreground ml-1">{msg.slackUserName}</span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
          isInbound
            ? "bg-muted text-foreground rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-tr-sm"
        }`}
      >
        {msg.content}
      </div>
      <span className="text-[10px] text-muted-foreground px-1">{timeStr}</span>
    </div>
  );
}

export function SlackMessagesPanel({ alertId, onClose }: SlackMessagesPanelProps) {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { subscribeToMessage } = useSocket();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiGetAlertSlackMessages(alertId)
      .then(({ messages: msgs }) => {
        if (!cancelled) {
          setMessages(msgs);
          // Mark inbound unread messages as read
          msgs.filter((m) => m.direction === "inbound" && !m.isRead).forEach((m) => {
            apiMarkSlackMessageRead(m.id).catch(() => {});
          });
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load Slack messages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [alertId]);

  // Listen for new Slack messages via WebSocket
  useEffect(() => {
    const unsubscribe = subscribeToMessage("slackMessage:new", (data: SlackMessage) => {
      if (data.alertId === alertId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
        if (data.direction === "inbound") {
          apiMarkSlackMessageRead(data.id).catch(() => {});
        }
      }
    });
    return unsubscribe;
  }, [alertId, subscribeToMessage]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading Slack thread...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <MessageSquare className="w-4 h-4 text-[#4A154B]" />
        <span className="text-sm font-medium">Slack Thread</span>
        <span className="ml-auto text-xs text-muted-foreground">{messages.length} message{messages.length !== 1 ? "s" : ""}</span>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No Slack messages yet. Replies to the alert in Slack will appear here.
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Compact badge shown in alerts list ───────────────────────────────────────
// NOTE: Does NOT fetch data itself — count comes from the parent via the alerts
// list API (which batch-fetches slackUnreadCount). WebSocket increments it live.

interface SlackRepliesBadgeProps {
  alertId: string;
  initialUnreadCount?: number;
  onClick: () => void;
}

export function SlackRepliesBadge({ alertId, initialUnreadCount = 0, onClick }: SlackRepliesBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const { subscribeToMessage } = useSocket();

  // Keep in sync if parent re-renders with a fresh count (e.g. after page reload)
  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  // Real-time: increment on new inbound Slack messages via WebSocket
  useEffect(() => {
    const unsubscribe = subscribeToMessage("slackMessage:new", (data: SlackMessage) => {
      if (data.alertId === alertId && data.direction === "inbound") {
        setUnreadCount((prev) => prev + 1);
      }
    });
    return unsubscribe;
  }, [alertId, subscribeToMessage]);

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#4A154B]/10 text-[#4A154B] hover:bg-[#4A154B]/20 transition-colors"
    >
      <MessageSquare className="w-3 h-3" />
      Slack
      {unreadCount > 0 && (
        <span className="bg-[#4A154B] text-white rounded-full text-[10px] px-1.5 py-0.5 min-w-[16px] text-center leading-none">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
