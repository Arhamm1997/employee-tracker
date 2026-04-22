import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Search, MessageSquare, Loader2, Slack, Settings, Send, ArrowLeft
} from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Textarea } from "../components/ui/textarea";
import {
  apiGetSlackConversations,
  apiGetSlackEmployeeMessages,
  apiSendSlackDirectMessage,
  type SlackConversation,
  type SlackDmMessage,
  type SlackConversationEmployee,
} from "../lib/api";
import { useSocket } from "../lib/socket-context";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

// ─── Conversation list item ───────────────────────────────────────────────────

function ConversationItem({
  conv,
  selected,
  onClick,
}: {
  conv: SlackConversation;
  selected: boolean;
  onClick: () => void;
}) {
  const emp = conv.employee;
  const initials = emp.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  const time = conv.lastSentAt
    ? formatDistanceToNow(new Date(conv.lastSentAt), { addSuffix: true })
    : null;
  const isIncoming = conv.lastMessageDirection === "inbound";

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-4 border-b border-border last:border-0 text-left transition-colors ${
        selected
          ? "bg-[#4A154B]/10 border-l-2 border-l-[#4A154B]"
          : "hover:bg-muted/50"
      }`}
    >
      <Avatar className="h-10 w-10 shrink-0 mt-0.5">
        <AvatarFallback className="bg-[#4A154B] text-white text-sm">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate text-foreground">{emp.name}</span>
          {time && <span className="text-xs text-muted-foreground shrink-0">{time}</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {emp.department && (
            <span className="mr-1 text-[10px] uppercase tracking-wide opacity-60">
              {emp.department} ·
            </span>
          )}
          {isIncoming && <span className="text-[#4A154B] font-medium">↩ </span>}
          {conv.lastMessage ?? "No messages yet"}
        </p>
      </div>
      {conv.unreadCount > 0 && (
        <Badge className="bg-[#4A154B] hover:bg-[#4A154B] text-white shrink-0 min-w-[20px] h-5 flex items-center justify-center px-1.5 text-[10px]">
          {conv.unreadCount}
        </Badge>
      )}
    </button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function SlackBubble({
  msg,
  employeeName,
}: {
  msg: SlackDmMessage;
  employeeName: string;
}) {
  const isOwn = msg.direction === "outbound";
  // Slack member IDs look like U0AU8P1U41J — fall back to employee name when that's all we have
  const isRawSlackId = (s: string | null) => !!s && /^U[A-Z0-9]{6,}$/.test(s);
  const senderLabel = isOwn
    ? "You (Admin)"
    : (!isRawSlackId(msg.slackUserName) && msg.slackUserName) ? msg.slackUserName : employeeName;

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

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose?: () => void;
}) {
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

  const loadMessages = useCallback(
    async (p = 1) => {
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
        toast.error(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [employeeId]
  );

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setPage(1);
    loadMessages(1);
  }, [loadMessages]);

  useEffect(() => {
    if (!loading && page === 1) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [loading, page]);

  useEffect(() => {
    const unsub = subscribeToMessage("slackMessage:new", (data: unknown) => {
      const d = data as { direction: string };
      if (d.direction === "inbound") loadMessages(1);
    });
    return unsub;
  }, [subscribeToMessage, loadMessages]);

  const handleSend = async () => {
    const content = reply.trim();
    if (!content || sending || !employee) return;
    setSending(true);
    try {
      await apiSendSlackDirectMessage(employeeId, content);
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
      toast.error(err instanceof Error ? err.message : "Failed to send message");
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

  const initials = employee?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 md:hidden">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
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
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
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
            <SlackBubble key={msg.id} msg={msg} employeeName={employee?.name ?? "Employee"} />
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
            className="shrink-0 bg-[#4A154B] hover:bg-[#3d0f3d]"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main MessagesPage ────────────────────────────────────────────────────────

export function MessagesPage() {
  const navigate = useNavigate();
  // Support direct URL access: /dashboard/messages/:id
  const { conversationId: urlEmployeeId } = useParams<{ conversationId?: string }>();
  const { setUnreadMessages } = useSocket();

  const [conversations, setConversations] = useState<SlackConversation[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(urlEmployeeId ?? null);

  const loadConversations = useCallback(async (q?: string) => {
    try {
      const data = await apiGetSlackConversations(q);
      setConnected(data.connected);
      setConversations(data.conversations ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    setUnreadMessages(0);
  }, [loadConversations, setUnreadMessages]);

  // Sync URL param → selected state
  useEffect(() => {
    if (urlEmployeeId) setSelectedId(urlEmployeeId);
  }, [urlEmployeeId]);

  // Debounced search
  useEffect(() => {
    if (!search) { loadConversations(); return; }
    setSearching(true);
    const t = setTimeout(() => loadConversations(search), 400);
    return () => clearTimeout(t);
  }, [search, loadConversations]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    navigate(`/dashboard/messages/${id}`, { replace: true });
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  // ── Slack not connected ──────────────────────────────────────────────────────
  if (!loading && connected === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#4A154B]/10 flex items-center justify-center">
          <Slack className="w-8 h-8 text-[#4A154B]" />
        </div>
        <div>
          <p className="font-semibold text-lg">Slack not connected</p>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your Slack workspace to see employee DM conversations here.
          </p>
        </div>
        <Button
          onClick={() => navigate("/dashboard/settings?tab=integrations")}
          className="gap-2 bg-[#4A154B] hover:bg-[#3d0f3d]"
        >
          <Settings className="w-4 h-4" />
          Connect Slack
        </Button>
      </div>
    );
  }

  // ── Split panel layout ───────────────────────────────────────────────────────
  return (
    <div
      className="flex border border-border rounded-xl overflow-hidden bg-card"
      style={{ height: "calc(100vh - 7rem)" }}
    >
      {/* Left panel — conversation list */}
      <div
        className={`flex flex-col border-r border-border bg-card shrink-0 ${
          selectedId ? "hidden md:flex w-80" : "flex w-full md:w-80"
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Slack className="w-5 h-5 text-[#4A154B]" />
            <span className="font-semibold text-sm text-foreground">Slack Messages</span>
            {totalUnread > 0 && (
              <Badge className="bg-[#4A154B] hover:bg-[#4A154B] text-white text-[10px] ml-auto">
                {totalUnread} new
              </Badge>
            )}
          </div>
          <div className="relative">
            {searching ? (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            )}
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-52" />
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <MessageSquare className="w-10 h-10 text-muted-foreground opacity-40" />
              <div>
                <p className="font-medium text-sm">
                  {search ? "No conversations found" : "No Slack DMs yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search
                    ? "Try a different search term"
                    : "Go to an employee profile and use the 'Message' button to start a DM."}
                </p>
              </div>
            </div>
          ) : (
            conversations.map(conv => (
              <ConversationItem
                key={conv.employee.id}
                conv={conv}
                selected={selectedId === conv.employee.id}
                onClick={() => handleSelect(conv.employee.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — chat or empty state */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedId ? "flex" : "hidden md:flex"}`}>
        {selectedId ? (
          <ChatPanel
            key={selectedId}
            employeeId={selectedId}
            onClose={() => {
              setSelectedId(null);
              navigate("/dashboard/messages", { replace: true });
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-[#4A154B]/10 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-[#4A154B] opacity-60" />
            </div>
            <div>
              <p className="font-semibold text-lg">Select a conversation</p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose an employee from the list to view their Slack DM thread.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
