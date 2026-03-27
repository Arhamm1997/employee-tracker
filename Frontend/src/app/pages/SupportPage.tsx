import React, { useState, useEffect } from "react";

const BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("monitor_token") || "";
}

interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  replies: Array<{ id: string; adminId?: string; message: string; createdAt: string }>;
}

const priorityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

export function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [replyMsg, setReplyMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New ticket form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const fetchTickets = () => {
    setLoading(true);
    fetch(`${BASE_URL}/support/tickets`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d: { tickets?: Ticket[] }) => setTickets(d.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchDetail = (id: string) => {
    fetch(`${BASE_URL}/support/tickets/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d: { ticket?: Ticket }) => { if (d.ticket) setViewTicket(d.ticket); })
      .catch(() => {});
  };

  useEffect(() => { fetchTickets(); }, []);

  const submitTicket = async () => {
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${BASE_URL}/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ subject, description, priority }),
      });
      setShowNew(false);
      setSubject(""); setDescription(""); setPriority("medium");
      fetchTickets();
    } catch {
      alert("Failed to submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!replyMsg.trim() || !viewTicket) return;
    setSubmitting(true);
    try {
      await fetch(`${BASE_URL}/support/tickets/${viewTicket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message: replyMsg }),
      });
      setReplyMsg("");
      fetchDetail(viewTicket.id);
    } catch {
      alert("Failed to send reply. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support</h1>
          <p className="text-muted-foreground text-sm mt-1">Having an issue? Get in touch with our support team.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          + New Ticket
        </button>
      </div>

      {/* New Ticket Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">🎫 New Support Ticket</h2>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue..."
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={4}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="low">Low — General question</option>
                <option value="medium">Medium — Needs attention</option>
                <option value="high">High — Urgent issue</option>
                <option value="critical">Critical — System down</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitTicket}
                disabled={!subject.trim() || !description.trim() || submitting}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {viewTicket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-bold text-base">{viewTicket.subject}</h2>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[viewTicket.status] ?? "bg-gray-100"}`}>
                    {viewTicket.status.replace("_", " ")}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[viewTicket.priority] ?? "bg-gray-100"}`}>
                    {viewTicket.priority}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewTicket(null)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {/* Original message */}
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Original message · {new Date(viewTicket.createdAt).toLocaleDateString()}</p>
                <p className="text-sm">{viewTicket.description}</p>
              </div>
              {/* Replies */}
              {viewTicket.replies.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-xl p-4 ${r.adminId ? "bg-primary/10 ml-8" : "bg-muted/40 mr-8"}`}
                >
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {r.adminId ? "🛡️ Support Team" : "You"} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm">{r.message}</p>
                </div>
              ))}
            </div>

            {viewTicket.status !== "closed" && (
              <div className="px-6 py-4 border-t border-border space-y-2">
                <textarea
                  value={replyMsg}
                  onChange={(e) => setReplyMsg(e.target.value)}
                  placeholder="Write your reply..."
                  rows={3}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <button
                  onClick={sendReply}
                  disabled={!replyMsg.trim() || submitting}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Sending..." : "Send Reply"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="text-5xl mb-4">🎫</div>
          <p className="font-semibold text-lg">No tickets found</p>
          <p className="text-muted-foreground text-sm mt-1">Click "New Ticket" to get in touch with our support team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => { setViewTicket(ticket); fetchDetail(ticket.id); }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[ticket.status] ?? "bg-gray-100"}`}>
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[ticket.priority] ?? "bg-gray-100"}`}>
                      {ticket.priority}
                    </span>
                    {ticket.replies.some((r) => r.adminId) && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Admin replied</span>
                    )}
                  </div>
                  <p className="font-semibold truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ticket.replies.length} repl{ticket.replies.length === 1 ? "y" : "ies"} · {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-muted-foreground text-lg">›</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
