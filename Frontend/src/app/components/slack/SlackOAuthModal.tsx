import { useState } from "react";
import { ExternalLink, Slack, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { apiGetSlackOAuthUrl } from "../../lib/api";
import { toast } from "sonner";

interface SlackOAuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function SlackOAuthModal({ open, onClose }: SlackOAuthModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const { url } = await apiGetSlackOAuthUrl();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Failed to get Slack authorization URL. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Slack className="w-5 h-5 text-[#4A154B]" />
            Connect Slack Workspace
          </DialogTitle>
          <DialogDescription>
            Connect your Slack workspace to receive employee monitoring alerts directly in Slack and send messages to employees.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">This integration will allow you to:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Receive real-time alerts in your Slack channels</li>
              <li>Reply to alerts directly from Slack</li>
              <li>Send direct messages to employees via Slack</li>
            </ul>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Required Slack permissions:</p>
            <p className="font-mono text-xs">
              chat:write, channels:read, groups:read, users:read, im:write, team:read
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            Connect to Slack
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
