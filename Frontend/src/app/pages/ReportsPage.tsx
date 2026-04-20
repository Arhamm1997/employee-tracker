import React, { useState, useEffect, useCallback } from "react";
import {
  Clock, TrendingUp, Camera, AlertTriangle, Download, FileText,
  Globe, Shield, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend
} from "recharts";
import { apiGetReports, apiGetEmployees, type ReportData } from "../lib/api";
import type { Employee } from "../lib/types";
import { format } from "date-fns";
import Papa from "papaparse";
import jsPDF from "jspdf";
import { toast } from "sonner";

const datePresets = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

function fmt12(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${day}, ${time}`;
  } catch {
    return "—";
  }
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ReportsPage() {
  const [dateRange, setDateRange] = useState("week");
  const [selectedEmployee, setSelectedEmployee] = useState("All");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showBrowserHistory, setShowBrowserHistory] = useState(true);
  const [browserFilter, setBrowserFilter] = useState("All");

  useEffect(() => {
    apiGetEmployees().then(setEmployees).catch(console.error);
  }, []);

  const fetchReports = useCallback(() => {
    setLoading(true);
    setReportError(null);
    apiGetReports({ dateRange, employeeId: selectedEmployee })
      .then(data => { setReportData(data); })
      .catch((err: any) => {
        setReportData(null);
        setReportError(err?.message || "Failed to load report data. Make sure the backend is running.");
      })
      .finally(() => setLoading(false));
  }, [dateRange, selectedEmployee]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const hasNoData = reportData && reportData.dailyBreakdown.every(d => d.hours === 0) && reportData.topApps.length === 0;

  const summaryCards = reportData ? [
    { label: "Total Hours", value: reportData.summary.totalHours, icon: Clock, color: "#6366f1" },
    { label: "Productive", value: reportData.summary.productive, icon: TrendingUp, color: "#22c55e" },
    { label: "Idle Time", value: reportData.summary.idleTime, icon: Clock, color: "#f59e0b" },
    { label: "Screenshots", value: reportData.summary.screenshots, icon: Camera, color: "#8b5cf6" },
    { label: "Alerts", value: reportData.summary.alerts, icon: AlertTriangle, color: "#ef4444" },
  ] : [];

  const filteredBrowserHistory = reportData?.browserHistory?.filter(b =>
    browserFilter === "All" || b.browser.toLowerCase() === browserFilter.toLowerCase()
  ) || [];

  const browsers = reportData?.browserHistory
    ? [...new Set(reportData.browserHistory.map(b => b.browser))]
    : [];

  const exportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Employee Monitoring Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Period: ${dateRange} | Generated: ${format(new Date(), "PPpp")}`, 14, 32);
    doc.setFontSize(12);
    doc.text("Summary:", 14, 45);
    summaryCards.forEach((card, i) => {
      doc.text(`${card.label}: ${card.value}`, 14, 55 + i * 8);
    });
    doc.text("Daily Breakdown:", 14, 105);
    reportData.dailyBreakdown.forEach((day, i) => {
      doc.setFontSize(10);
      doc.text(`${day.date} - Hours: ${day.hours}h, Screenshots: ${day.screenshots}, Alerts: ${day.alerts}`, 14, 115 + i * 7);
    });
    doc.save("monitoring-report.pdf");
    toast.success("PDF downloaded!");
  };

  const exportCSV = () => {
    if (!reportData) return;
    const csv = Papa.unparse(reportData.dailyBreakdown);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded!");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-3 flex-wrap">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {datePresets.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Employees</SelectItem>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF} disabled={!reportData}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!reportData}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      ) : reportData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {summaryCards.map(card => (
              <Card key={card.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                    <card.icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <div>
                    <p className="text-muted-foreground" style={{ fontSize: "12px" }}>{card.label}</p>
                    <p className="font-semibold" style={{ fontSize: "20px", color: card.color }}>{card.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* No-data banner */}
          {hasNoData && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">No monitoring data for this period.</p>
                <p className="text-xs mt-0.5 opacity-80">
                  Make sure the Employee Monitor agent is installed and running on employee computers. Download it from <strong>Settings → Downloads</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Stacked Bar: Productive vs Idle per Day */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle style={{ fontSize: "16px" }}>Productive vs Idle (by Day)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={reportData.weeklyProductivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                  <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                  <RTooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                  <Bar dataKey="productive" stackId="a" fill="#22c55e" name="Productive" />
                  <Bar dataKey="idle" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Idle" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 Apps Horizontal Bar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle style={{ fontSize: "16px" }}>Top 10 Applications (Hours)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={reportData.topApps} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                    <YAxis type="category" dataKey="name" width={90} stroke="var(--muted-foreground)" style={{ fontSize: "11px" }} />
                    <RTooltip formatter={(v: number) => [`${v}h`, "Hours"]} contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                    <Bar dataKey="hours" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Employee Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle style={{ fontSize: "16px" }}>Employee Productivity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={reportData.employeeComparison} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={90} stroke="var(--muted-foreground)" style={{ fontSize: "11px" }} />
                    <RTooltip formatter={(v: number) => [`${v}%`, "Productivity"]} contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                    <Bar dataKey="productivity" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Radar Chart: Department Comparison */}
          {reportData.deptComparison.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle style={{ fontSize: "16px" }}>Department Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={reportData.deptComparison}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                    <PolarRadiusAxis stroke="var(--muted-foreground)" style={{ fontSize: "10px" }} />
                    <Radar name="Productivity %" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Daily Breakdown Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle style={{ fontSize: "16px" }}>Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Productive %</TableHead>
                    <TableHead>Idle %</TableHead>
                    <TableHead>Screenshots</TableHead>
                    <TableHead>Alerts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.dailyBreakdown.map(day => (
                    <TableRow key={day.date}>
                      <TableCell style={{ fontSize: "13px" }}>{day.date}</TableCell>
                      <TableCell style={{ fontSize: "13px" }}>{day.hours}h</TableCell>
                      <TableCell style={{ fontSize: "13px", color: "#22c55e" }}>{day.productive}%</TableCell>
                      <TableCell style={{ fontSize: "13px", color: "#f59e0b" }}>{day.idle}%</TableCell>
                      <TableCell style={{ fontSize: "13px" }}>{day.screenshots}</TableCell>
                      <TableCell style={{ fontSize: "13px", color: day.alerts > 3 ? "#ef4444" : undefined }}>{day.alerts}</TableCell>
                    </TableRow>
                  ))}
                  {reportData.dailyBreakdown.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No data available for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Browser History Section */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2" style={{ fontSize: "16px" }}>
                  <Globe className="w-4 h-4 text-[#6366f1]" />
                  Browser History
                  <Badge variant="outline" style={{ fontSize: "11px" }}>
                    {filteredBrowserHistory.length} entries
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  {browsers.length > 0 && (
                    <Select value={browserFilter} onValueChange={setBrowserFilter}>
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Browsers</SelectItem>
                        {browsers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowBrowserHistory(v => !v)}>
                    {showBrowserHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {showBrowserHistory && (
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Browser</TableHead>
                        <TableHead>Title / URL</TableHead>
                        <TableHead>Date &amp; Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBrowserHistory.map(item => (
                        <TableRow key={item.id} className={item.isBlocked ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell style={{ fontSize: "12px" }}>{item.employeeName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" style={{ fontSize: "10px" }}>{item.browser}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="truncate font-medium" style={{ fontSize: "12px" }}>{item.title}</p>
                            <p className="truncate text-muted-foreground" style={{ fontSize: "11px" }}>
                              {item.url}
                            </p>
                          </TableCell>
                          <TableCell style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                            {fmt12(item.visitedAt)}
                          </TableCell>
                          <TableCell style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                            {fmtDuration(item.duration)}
                          </TableCell>
                          <TableCell>
                            {item.isBlocked ? (
                              <Badge className="bg-red-500 hover:bg-red-500 text-white" style={{ fontSize: "10px" }}>
                                <Shield className="w-3 h-3 mr-1" />
                                Blocked
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-300" style={{ fontSize: "10px" }}>
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredBrowserHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No browser history for this period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        </>
      ) : reportError ? (
        <div className="text-center py-20 space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm font-medium">{reportError}</p>
          <Button variant="outline" size="sm" onClick={fetchReports} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
