import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { apiGetConversations, type Conversation } from "../lib/api";
import { useSocket } from "../lib/socket-context";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function ConversationCard({ conv, onClick }: { conv: Conversation; onClick: () => void }) {
  const emp = conv.employee;
  const initials = emp?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  const time = conv.lastSentAt
    ? formatDistanceToNow(new Date(conv.lastSentAt), { addSuffix: true })
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border last:border-0 text-left"
    >
      <Avatar className="h-10 w-10 shrink-0 mt-0.5">
        <AvatarFallback className="bg-[#6366f1] text-white text-sm">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">{emp?.name ?? "Unknown"}</span>
          {time && <span className="text-xs text-muted-foreground shrink-0">{time}</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {emp?.department && <span className="mr-1">{emp.department} ·</span>}
          {conv.lastMessage ?? "No messages yet"}
        </p>
      </div>
      {conv.unreadCount > 0 && (
        <Badge className="bg-[#6366f1] hover:bg-[#6366f1] text-white shrink-0 min-w-[20px] h-5 flex items-center justify-center px-1.5 text-[10px]">
          {conv.unreadCount}
        </Badge>
      )}
    </button>
  );
}

export function MessagesPage() {
  const navigate = useNavigate();
  const { setUnreadMessages } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  const loadConversations = useCallback(async (q?: string) => {
    try {
      const data = await apiGetConversations(q);
      setConversations(data);
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
    // Clear sidebar badge when visiting this page
    setUnreadMessages(0);
  }, [loadConversations, setUnreadMessages]);

  // Debounced search
  useEffect(() => {
    if (!search) {
      loadConversations();
      return;
    }
    setSearching(true);
    const t = setTimeout(() => loadConversations(search), 400);
    return () => clearTimeout(t);
  }, [search, loadConversations]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (loading) {
    return (
      <div className="space-y-0 rounded-lg border border-border overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 border-b border-border last:border-0">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Messages</h2>
          {totalUnread > 0 && (
            <p className="text-sm text-muted-foreground">{totalUnread} unread message{totalUnread !== 1 ? "s" : ""}</p>
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
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground opacity-40" />
            <div>
              <p className="font-medium">
                {search ? "No conversations found" : "No conversations yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search
                  ? "Try a different search term"
                  : "Go to an employee's profile and click 'Send Message' to start."}
              </p>
            </div>
          </div>
        ) : (
          conversations.map(conv => (
            <ConversationCard
              key={conv.id}
              conv={conv}
              onClick={() => navigate(`/dashboard/messages/${conv.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
