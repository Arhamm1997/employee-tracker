import { Monitor, Server, Cpu, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { useSocket } from "../../lib/socket-context";

function StatusDot({ status }: { status: "connected" | "disconnected" }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        status === "connected"
          ? "bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.6)]"
          : "bg-[#ef4444] shadow-[0_0_6px_rgba(239,68,68,0.6)]"
      }`}
    />
  );
}

function StatusRow({
  icon: Icon,
  label,
  status,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  status: "connected" | "disconnected";
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <StatusDot status={status} />
        <span
          className={`text-xs font-medium ${
            status === "connected" ? "text-[#22c55e]" : "text-[#ef4444]"
          }`}
        >
          {status === "connected" ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}

export function ConnectionStatus() {
  const { connectionStatus } = useSocket();

  const { backend, websocket, agentOnline, agentTotal } = connectionStatus;
  const agentStatus = agentOnline > 0 ? "connected" : "disconnected";

  const allConnected = backend === "connected" && websocket === "connected" && agentOnline > 0;
  const someConnected = backend === "connected" || websocket === "connected";

  const overallColor = allConnected
    ? "text-[#22c55e]"
    : someConnected
      ? "text-[#f59e0b]"
      : "text-[#ef4444]";

  const overallDotColor = allConnected
    ? "bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.6)]"
    : someConnected
      ? "bg-[#f59e0b] shadow-[0_0_6px_rgba(245,158,11,0.6)]"
      : "bg-[#ef4444] shadow-[0_0_6px_rgba(239,68,68,0.6)]";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-2 px-2.5 h-9 ${overallColor}`}
        >
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${overallDotColor}`} />
          <span className="text-xs font-medium hidden sm:inline">
            {allConnected ? "All Systems Online" : someConnected ? "Partial" : "Offline"}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0" sideOffset={8}>
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Connection Status</p>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time system health</p>
        </div>
        <div className="px-4 py-1 divide-y divide-border">
          <StatusRow
            icon={Monitor}
            label="Frontend"
            status="connected"
            detail="Dashboard active"
          />
          <StatusRow
            icon={Server}
            label="Backend Server"
            status={backend}
            detail={
              backend === "connected"
                ? `API & WebSocket${websocket === "connected" ? " live" : " (WS reconnecting)"}`
                : "Cannot reach server"
            }
          />
          <StatusRow
            icon={Cpu}
            label="Agent (.exe)"
            status={agentStatus}
            detail={
              agentOnline > 0
                ? `${agentOnline}/${agentTotal} agent${agentTotal !== 1 ? "s" : ""} reporting`
                : agentTotal > 0
                  ? `0/${agentTotal} agents connected`
                  : "No agents registered"
            }
          />
        </div>
        <div className="px-4 py-2.5 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground text-center">
            Status refreshes every 30 seconds
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
