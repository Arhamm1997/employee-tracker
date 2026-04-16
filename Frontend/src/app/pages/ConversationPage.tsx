import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Send, Loader2, MessageSquare, Slack } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Skeleton } from "../components/ui/skeleton";
import {
  apiGetSlackEmployeeMessages,
  apiSendSlackDirectMessage,
  type SlackDmMessage,
  type SlackConversationEmployee,
} from "../lib/api";
import { useSocket } from "../lib/socket-context";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

function SlackBubble({ msg, employeeName }: { msg: SlackDmMessage; employeeName: string }) {
  const isOwn = msg.direction === "outbound";
  const senderLabel = isOwn ? "You (Admin)" : (msg.slackUserName ?? employeeName);

  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar className="h-7 w-7 shrink-0 mt-1">
        <AvatarFallback className={`text-white text-xs ${isOwn ? "bg-[#6366f1]" : "bg-[#4A154B]"}`}>
          {isOwn ? "A" : (employeeName[0] ?? "E")}
        </AvatarFallback>
      </Avatar>
      <div className={`max-w-[70%] space-y-1 flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="font-medium">{senderLabel}</span>
          <span>{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}</span>
        </div>
        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isOwn
            ? "bg-[#6366f1] text-white rounded-tr-sm"
            : "bg-[#4A154B]/10 text-foreground rounded-tl-sm border border-[#4A154B]/20"
        }`}>
          {msg.content}
        </div>
        {isOwn && (
          <span className="text-[10px] text-muted-foreground">
            via Slack · {format(new Date(msg.createdAt), "HH:mm")}
          </span>
        )}
      </div>
    </div>
  );
}

function EmployeeHeader({ employee, onBack }: { employee: SlackConversationEmployee | null; onBack: () => void }) {
  const initials = employee?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
      <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-[#4A154B] text-white text-sm">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-sm truncate">{employee?.name ?? "Unknown"}</p>
          <Slack className="w-3.5 h-3.5 text-[#4A154B] shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {employee?.department} · {employee?.email}
        </p>
      </div>
    </div>
  );
}

export function ConversationPage() {
  // Route param is employeeId (not conversationId anymore)
  const { conversationId: employeeId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { subscribeToMessage } = useSocket();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<SlackDmMessage[]>([]);
  const [employee, setEmployee] = useState<SlackConversationEmployee | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async (p = 1) => {
    if (!employeeId) return;
    try {
      const data = await apiGetSlackEmployeeMessages(employeeId, p);
      if (p === 1) {
        setMessages(data.messages);
        setEmployee(data.employee);
      } else {
        setMessages(prev => [...data.messages, ...prev]);
      }
      setTotalPages(data.pages);
      setPage(p);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load messages";
      toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [employeeId]);

  useEffect(() => { loadMessages(1); }, [loadMessages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && page === 1) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [loading, page]);

  // Real-time: listen for new Slack messages
  useEffect(() => {
    const unsub = subscribeToMessage("slackMessage:new", (data: unknown) => {
      const d = data as { direction: string; content: string; slackUserId?: string; slackUserName?: string; slackTs: string; createdAt: string; id: string };
      // Only add if this is a message for the current employee (inbound match by slackUserId)
      // We'll just reload to be safe
      if (d.direction === "inbound") {
        loadMessages(1);
      }
    });
    return unsub;
  }, [subscribeToMessage, loadMessages]);

  const handleSend = async () => {
    const content = reply.trim();
    if (!content || sending || !employeeId || !employee) return;
    setSending(true);
    try {
      await apiSendSlackDirectMessage(employeeId, content);
      // Optimistically add the message
      const newMsg: SlackDmMessage = {
        id: `temp-${Date.now()}`,
        direction: "outbound",
        content,
        slackUserId: null,
        slackUserName: null,
        isRead: true,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMsg]);
      setReply("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to send message";
      toast.error(errMsg);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col max-w-2xl border border-border rounded-lg overflow-hidden bg-card" style={{ height: "calc(100vh - 10rem)" }}>
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-52" : "w-40"}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-2xl border border-border rounded-lg overflow-hidden bg-card" style={{ height: "calc(100vh - 10rem)" }}>
      <EmployeeHeader employee={employee} onBack={() => navigate("/dashboard/messages")} />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {page < totalPages && (
          <div className="text-center pb-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingMore}
              onClick={() => { setLoadingMore(true); loadMessages(page + 1); }}
              className="text-xs text-muted-foreground"
            >
              {loadingMore && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Load earlier messages
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground opacity-40" />
            <div>
              <p className="font-medium">No Slack DMs yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Send your first Slack DM to {employee?.name}
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <SlackBubble
              key={msg.id}
              msg={msg}
              employeeName={employee?.name ?? "Employee"}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Slack className="w-3.5 h-3.5 text-[#4A154B]" />
          <span>Message will be sent as a Slack DM to {employee?.name}</span>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            className="resize-none min-h-[40px] max-h-32 text-sm"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            size="icon"
            className="shrink-0 bg-[#4A154B] hover:bg-[#6A254B]"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
