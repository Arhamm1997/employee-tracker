import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Skeleton } from "../components/ui/skeleton";
import {
  apiGetConversation,
  apiReplyMessage,
  apiMarkConversationRead,
  type ConversationMessage,
  type ConversationEmployee,
} from "../lib/api";
import { useSocket } from "../lib/socket-context";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

function MessageBubble({ msg, isOwn }: { msg: ConversationMessage; isOwn: boolean }) {
  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar className="h-7 w-7 shrink-0 mt-1">
        <AvatarFallback className={`text-white text-xs ${isOwn ? "bg-[#6366f1]" : "bg-[#64748b]"}`}>
          {msg.senderName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
        </AvatarFallback>
      </Avatar>
      <div className={`max-w-[70%] space-y-1 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="font-medium">{isOwn ? "You" : msg.senderName}</span>
          <span>{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}</span>
        </div>
        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isOwn
            ? "bg-[#6366f1] text-white rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        }`}>
          {msg.content}
        </div>
        {isOwn && msg.isRead && msg.readAt && (
          <span className="text-[10px] text-muted-foreground">
            Read {format(new Date(msg.readAt), "HH:mm")}
          </span>
        )}
      </div>
    </div>
  );
}

function EmployeeHeader({ employee, onBack }: { employee: ConversationEmployee | null; onBack: () => void }) {
  const initials = employee?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
      <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-[#6366f1] text-white text-sm">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{employee?.name ?? "Unknown"}</p>
        <p className="text-xs text-muted-foreground truncate">
          {employee?.department} · {employee?.email}
        </p>
      </div>
    </div>
  );
}

export function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { subscribeToMessage } = useSocket();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [employee, setEmployee] = useState<ConversationEmployee | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Admin ID from localStorage token (decoded inline, minimal)
  const adminId = (() => {
    try {
      const t = localStorage.getItem("monitor_token");
      if (!t) return null;
      const payload = JSON.parse(atob(t.split(".")[1]));
      return payload.id as string;
    } catch {
      return null;
    }
  })();

  const loadConversation = useCallback(async (p = 1) => {
    if (!conversationId) return;
    try {
      const data = await apiGetConversation(conversationId, p);
      if (p === 1) {
        setMessages(data.messages);
        setEmployee(data.conversation.employee);
      } else {
        setMessages(prev => [...data.messages, ...prev]);
      }
      setTotalPages(data.pages);
      setPage(p);
      // Mark as read
      await apiMarkConversationRead(conversationId).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load messages";
      toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadConversation(1);
  }, [loadConversation]);

  // Scroll to bottom when messages load (first load)
  useEffect(() => {
    if (!loading && page === 1) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading, page]);

  // Real-time incoming messages
  useEffect(() => {
    const unsub = subscribeToMessage("new_message", (data: unknown) => {
      const d = data as { conversationId: string; message: ConversationMessage };
      if (d.conversationId === conversationId) {
        setMessages(prev => [...prev, d.message]);
        // Mark as read immediately since the conversation is open
        if (conversationId) {
          apiMarkConversationRead(conversationId).catch(() => {});
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    });
    return unsub;
  }, [conversationId, subscribeToMessage]);

  const handleSend = async () => {
    const content = reply.trim();
    if (!content || sending || !conversationId) return;

    setSending(true);
    try {
      const msg = await apiReplyMessage(conversationId, content);
      setMessages(prev => [...prev, msg]);
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
      <div className="flex flex-col h-[calc(100vh-10rem)] max-w-2xl border border-border rounded-lg overflow-hidden bg-card">
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
              onClick={() => { setLoadingMore(true); loadConversation(page + 1); }}
              className="text-xs text-muted-foreground"
            >
              {loadingMore ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Load earlier messages
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground opacity-40" />
            <div>
              <p className="font-medium">Start the conversation</p>
              <p className="text-sm text-muted-foreground mt-1">Send your first message to {employee?.name}</p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} isOwn={msg.senderRole === "admin" && msg.senderId === adminId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-border bg-card shrink-0">
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
            className="shrink-0 bg-[#6366f1] hover:bg-[#5558e6]"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
