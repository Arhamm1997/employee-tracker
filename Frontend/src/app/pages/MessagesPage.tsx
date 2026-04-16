import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Search, MessageSquare, Loader2, Slack, Settings } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { apiGetSlackConversations, type SlackConversation } from "../lib/api";
import { useSocket } from "../lib/socket-context";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function ConversationCard({ conv, onClick }: { conv: SlackConversation; onClick: () => void }) {
  const emp = conv.employee;
  const initials = emp.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  const time = conv.lastSentAt
    ? formatDistanceToNow(new Date(conv.lastSentAt), { addSuffix: true })
    : null;
  const isIncoming = conv.lastMessageDirection === "inbound";

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border last:border-0 text-left"
    >
      <Avatar className="h-10 w-10 shrink-0 mt-0.5">
        <AvatarFallback className="bg-[#4A154B] text-white text-sm">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">{emp.name}</span>
          {time && <span className="text-xs text-muted-foreground shrink-0">{time}</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {emp.department && <span className="mr-1 text-[10px] uppercase tracking-wide opacity-60">{emp.department} ·</span>}
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

export function MessagesPage() {
  const navigate = useNavigate();
  const { setUnreadMessages } = useSocket();
  const [conversations, setConversations] = useState<SlackConversation[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null); // null = loading
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const loadConversations = useCallback(async (q?: string) => {
    try {
      const data = await apiGetSlackConversations(q);
      setConnected(data.connected);
      setConversations(data.conversations ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load conversations";
      toast.error(msg);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    setUnreadMessages(0);
  }, [loadConversations, setUnreadMessages]);

  // Debounced search
  useEffect(() => {
    if (!search) { loadConversations(); return; }
    setSearching(true);
    const t = setTimeout(() => loadConversations(search), 400);
    return () => clearTimeout(t);
  }, [search, loadConversations]);

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="rounded-lg border border-border overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Slack not connected ───────────────────────────────────────────────────────
  if (connected === false) {
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
          className="gap-2 bg-[#4A154B] hover:bg-[#6A254B]"
        >
          <Settings className="w-4 h-4" />
          Connect Slack
        </Button>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Slack className="w-5 h-5 text-[#4A154B]" />
          <h2 className="text-lg font-semibold">Slack Messages</h2>
          {totalUnread > 0 && (
            <Badge className="bg-[#4A154B] hover:bg-[#4A154B] text-white text-[10px]">
              {totalUnread} new
            </Badge>
          )}
        </div>
      </div>

      {/* Search */}
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
          className="pl-9"
        />
      </div>

      {/* Conversation list */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
            <MessageSquare className="w-10 h-10 text-muted-foreground opacity-40" />
            <div>
              <p className="font-medium">
                {search ? "No conversations found" : "No Slack DMs yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search
                  ? "Try a different search term"
                  : "Go to an employee profile and use the 'Slack' button to start a DM."}
              </p>
            </div>
          </div>
        ) : (
          conversations.map(conv => (
            <ConversationCard
              key={conv.employee.id}
              conv={conv}
              onClick={() => navigate(`/dashboard/messages/${conv.employee.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
