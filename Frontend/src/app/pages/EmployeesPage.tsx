import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Search, Download, ChevronLeft, ChevronRight, Users, ArrowUpDown, UserPlus, Copy, Check, Trash2, AlertTriangle, Bot } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Skeleton } from "../components/ui/skeleton";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import {
  apiGetEmployees,
  apiCreateEmployee,
  apiDeleteEmployee,
  apiGetAgentDownload,
} from "../lib/api";
import type { CreateEmployeeResponse, AgentDownloadInfo } from "../lib/api";
import type { Employee } from "../lib/types";
import { formatDistanceToNow } from "date-fns";
import Papa from "papaparse";
import {
  SeatLimitCard,
  SeatLimitWarning,
  SeatLimitButton,
} from "../components/SeatLimit";
import { useSubscription } from "../lib/subscription-context";

const departments = ["All", "Engineering", "Design", "Marketing", "Sales", "HR", "Finance"];
const deptOptions = ["Engineering", "Design", "Marketing", "Sales", "HR", "Finance"];
const statuses = ["All", "online", "idle", "offline"];

type SortField = "name" | "department" | "status" | "hoursToday" | "productivityPercent";
type SortDir = "asc" | "desc";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">{value}</code>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export function EmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const perPage = 10;

  // Add Employee modal state
  const [addOpen, setAddOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDept, setFormDept] = useState("");
  const [customDept, setCustomDept] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Success modal state
  const [createdEmployee, setCreatedEmployee] = useState<CreateEmployeeResponse | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Download Agent modal state
  const [downloadTarget, setDownloadTarget] = useState<Employee | null>(null);
  const [downloadInfo, setDownloadInfo] = useState<AgentDownloadInfo | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  // Employee limit from subscription plan
  const { seatInfo, refreshSeatInfo } = useSubscription();
  const maxEmployees = seatInfo
    ? (seatInfo.employee_seats.limit === -1 ? null : seatInfo.employee_seats.limit)
    : null;

  useEffect(() => {
    apiGetEmployees()
      .then(setEmployees)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDeleteEmployee(deleteTarget.id);
      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete employee");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenDownload = async (emp: Employee) => {
    setDownloadTarget(emp);
    setDownloadInfo(null);
    setDownloadError("");
    setDownloadLoading(true);
    try {
      const info = await apiGetAgentDownload(emp.id);
      setDownloadInfo(info);
    } catch (err: any) {
      setDownloadError(err.message || "Failed to fetch download info");
    } finally {
      setDownloadLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let data = [...employees];
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(e => e.name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) || e.code.toLowerCase().includes(s));
    }
    if (dept !== "All") data = data.filter(e => e.department === dept);
    if (status !== "All") data = data.filter(e => e.status === status);
    data.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
    return data;
  }, [employees, search, dept, status, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const exportCSV = () => {
    const csv = Papa.unparse(filtered.map(e => ({
      Name: e.name,
      Code: e.code,
      Email: e.email,
      Department: e.department,
      Status: e.status,
      "Hours Today": e.hoursToday,
      "Productivity %": e.productivityPercent,
    })));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddEmployee = async () => {
    if (!formName.trim() || !formEmail.trim() || !formDept.trim()) {
      setFormError("All fields are required");
      return;
    }
    setFormError("");
    setFormSubmitting(true);
    try {
      const result = await apiCreateEmployee({
        name: formName.trim(),
        email: formEmail.trim(),
        department: formDept.trim(),
      });
      setCreatedEmployee(result);
      setAddOpen(false);
      setFormName("");
      setFormEmail("");
      setFormDept("");
      setCustomDept(false);
      const updated = await apiGetEmployees();
      setEmployees(updated);
      await refreshSeatInfo();
    } catch (err: any) {
      setFormError(err.message || "Failed to create employee");
    } finally {
      setFormSubmitting(false);
    }
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      online: "bg-[#22c55e] hover:bg-[#22c55e]",
      idle: "bg-[#f59e0b] hover:bg-[#f59e0b]",
      offline: "bg-[#ef4444] hover:bg-[#ef4444]",
    };
    return (
      <Badge className={`${colors[s]} text-white`} style={{ fontSize: "11px" }}>
        {s}
      </Badge>
    );
  };

  const SortableHead = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SeatLimitCard />
      <SeatLimitWarning type="employee" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, code..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={dept} onValueChange={v => { setDept(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map(s => <SelectItem key={s} value={s}>{s === "All" ? "All Status" : s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV} disabled={employees.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <SeatLimitButton type="employee" onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Employee
        </SeatLimitButton>
      </div>

      {maxEmployees !== null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{employees.length} / {maxEmployees} employees</span>
          {employees.length >= maxEmployees && (
            <Badge variant="destructive" style={{ fontSize: "11px" }}>Limit reached — increase in Settings</Badge>
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avatar</TableHead>
                  <SortableHead field="name" label="Name" />
                  <TableHead className="hidden md:table-cell">Code</TableHead>
                  <SortableHead field="department" label="Department" />
                  <SortableHead field="status" label="Status" />
                  <TableHead className="hidden lg:table-cell">Last Active</TableHead>
                  <SortableHead field="hoursToday" label="Hours" />
                  <SortableHead field="productivityPercent" label="Productivity" />
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((emp, i) => (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="cursor-pointer hover:bg-muted/50 border-b"
                    onClick={() => navigate(`/dashboard/employees/${emp.id}`)}
                  >
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={emp.avatar} />
                        <AvatarFallback style={{ fontSize: "10px" }}>{emp.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p style={{ fontSize: "14px" }}>{emp.name}</p>
                        <p className="text-muted-foreground" style={{ fontSize: "12px" }}>{emp.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground" style={{ fontSize: "13px" }}>{emp.code}</TableCell>
                    <TableCell style={{ fontSize: "13px" }}>{emp.department}</TableCell>
                    <TableCell>{statusBadge(emp.status)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground" style={{ fontSize: "12px" }}>
                      {emp.lastSeen ? formatDistanceToNow(new Date(emp.lastSeen), { addSuffix: true }) : "Never"}
                    </TableCell>
                    <TableCell style={{ fontSize: "13px" }}>{emp.hoursToday}h</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${emp.productivityPercent}%`,
                              backgroundColor: emp.productivityPercent >= 70 ? "#22c55e" : emp.productivityPercent >= 50 ? "#f59e0b" : "#ef4444"
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "13px" }}>{emp.productivityPercent}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/employees/${emp.id}`); }}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          title="Download Agent"
                          onClick={(e) => { e.stopPropagation(); handleOpenDownload(emp); }}
                        >
                          <Bot className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(emp); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No employees found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground" style={{ fontSize: "13px" }}>
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i}
                variant={page === i + 1 ? "default" : "outline"}
                size="sm"
                onClick={() => setPage(i + 1)}
                className={page === i + 1 ? "bg-[#6366f1] hover:bg-[#5558e6]" : ""}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new employee. Code and agent token will be auto-generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="emp-name">Full Name</Label>
              <Input id="emp-name" placeholder="e.g. Ahmed Khan" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-email">Email</Label>
              <Input id="emp-email" type="email" placeholder="e.g. ahmed@company.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              {customDept ? (
                <div className="flex gap-2">
                  <Input placeholder="Enter custom department" value={formDept} onChange={e => setFormDept(e.target.value)} />
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => { setCustomDept(false); setFormDept(""); }}>
                    Back
                  </Button>
                </div>
              ) : (
                <Select value={formDept} onValueChange={(v) => {
                  if (v === "__custom__") { setCustomDept(true); setFormDept(""); }
                  else setFormDept(v);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {deptOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    <SelectItem value="__custom__">+ Custom Department</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddEmployee} disabled={formSubmitting} className="bg-[#6366f1] hover:bg-[#5558e6] text-white">
              {formSubmitting ? "Creating..." : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog — Shows Code & Token */}
      <Dialog open={!!createdEmployee} onOpenChange={() => setCreatedEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Employee Created Successfully</DialogTitle>
            <DialogDescription>
              Share the following credentials with the employee to set up their agent (.exe).
            </DialogDescription>
          </DialogHeader>
          {createdEmployee && (
            <div className="space-y-3 py-2">
              <CopyField label="Employee Name" value={createdEmployee.name} />
              <CopyField label="Employee Code" value={createdEmployee.code} />
              <CopyField label="Agent Token" value={createdEmployee.agentToken} />
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-4">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Save the agent token now — it cannot be retrieved later.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedEmployee(null)} className="bg-[#6366f1] hover:bg-[#5558e6] text-white">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Agent Dialog */}
      <Dialog
        open={!!downloadTarget}
        onOpenChange={(open) => { if (!open) { setDownloadTarget(null); setDownloadInfo(null); setDownloadError(""); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              Download Agent — {downloadTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Installer pre-configured for this employee. Run as Administrator on their PC.
            </DialogDescription>
          </DialogHeader>

          {downloadLoading && (
            <div className="py-6 text-center text-muted-foreground text-sm">Loading...</div>
          )}

          {downloadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {downloadError}
            </div>
          )}

          {downloadInfo && !downloadLoading && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Version</Label>
                  <div className="bg-muted px-3 py-2 rounded text-sm font-mono">{downloadInfo.version ?? "—"}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">SHA256</Label>
                  <div className="bg-muted px-3 py-2 rounded text-sm font-mono truncate" title={downloadInfo.checksum ?? ""}>
                    {downloadInfo.checksum ? downloadInfo.checksum.slice(0, 16) + "…" : "—"}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Employee Code</Label>
                <div className="bg-muted px-3 py-2 rounded text-sm font-mono">{downloadInfo.config.employeeCode}</div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-blue-800">Setup Instructions</p>
                <ol className="text-xs text-blue-700 list-decimal list-inside space-y-0.5">
                  <li>Click <strong>Download Installer</strong> below</li>
                  <li>Run as Administrator on the employee's PC</li>
                  <li>Agent will configure itself automatically</li>
                  <li>It will connect to the dashboard automatically</li>
                </ol>
              </div>

              {!downloadInfo.downloadUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  No installer published yet. Ask your Master Admin to upload an agent version.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDownloadTarget(null); setDownloadInfo(null); setDownloadError(""); }}>
              Close
            </Button>
            {downloadInfo?.downloadUrl && (
              <Button asChild className="bg-[#6366f1] hover:bg-[#5558e6] text-white">
                <a href={downloadInfo.downloadUrl} target="_blank" rel="noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  Download Installer
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Employee
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all their monitoring data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
