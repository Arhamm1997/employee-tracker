import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Shield, Plus, UserCheck, UserX, Loader2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Skeleton } from "../components/ui/skeleton";
import { apiGetAdmins, apiCreateAdmin, apiToggleAdmin } from "../lib/api";
import type { Admin } from "../lib/types";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  SeatLimitButton,
  SeatLimitWarning,
} from "../components/SeatLimit";
import { useSubscription } from "../lib/subscription-context";

export function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "", role: "viewer" as "super_admin" | "viewer" });
  const [saving, setSaving] = useState(false);
  const { refreshSeatInfo } = useSubscription();

  useEffect(() => {
    apiGetAdmins()
      .then(setAdmins)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      toast.error("Please fill in all fields");
      return;
    }
    setSaving(true);
    try {
      const created = await apiCreateAdmin(newAdmin);
      setAdmins((prev) => [...prev, created]);
      setShowAdd(false);
      setNewAdmin({
        name: "",
        email: "",
        password: "",
        role: "viewer",
      });
      await refreshSeatInfo();
      toast.success("Admin added successfully!");
    } catch {
      toast.error("Failed to add admin");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (id: string) => {
    try {
      const updated = await apiToggleAdmin(id);
      setAdmins((prev) => prev.map((a) => (a.id === id ? updated : a)));
      toast.success("Admin status updated");
    } catch {
      toast.error("Failed to update admin status");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#6366f1]" />
          Admin Management
        </h2>
        <SeatLimitButton type="admin" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Admin
        </SeatLimitButton>
      </div>

      <SeatLimitWarning type="admin" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.length > 0 ? admins.map((admin, i) => (
                <motion.tr
                  key={admin.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-[#6366f1] text-white" style={{ fontSize: "11px" }}>
                          {admin.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span style={{ fontSize: "14px" }}>{admin.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground" style={{ fontSize: "13px" }}>{admin.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={admin.role === "super_admin" ? "default" : "secondary"}
                      className={admin.role === "super_admin" ? "bg-[#6366f1] hover:bg-[#6366f1]" : ""}
                      style={{ fontSize: "11px" }}
                    >
                      {admin.role === "super_admin" ? "Super Admin" : "Viewer"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {admin.enabled ? (
                      <Badge className="bg-[#22c55e] hover:bg-[#22c55e] text-white" style={{ fontSize: "11px" }}>
                        <UserCheck className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground" style={{ fontSize: "11px" }}>
                        <UserX className="w-3 h-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground" style={{ fontSize: "12px" }}>
                    {format(new Date(admin.lastLogin), "PPp")}
                  </TableCell>
                  <TableCell>
                    <Switch checked={admin.enabled} onCheckedChange={() => toggleEnabled(admin.id)} />
                  </TableCell>
                </motion.tr>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No admins found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Full name"
                value={newAdmin.name}
                onChange={e => setNewAdmin(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@company.com"
                value={newAdmin.email}
                onChange={e => setNewAdmin(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Password"
                value={newAdmin.password}
                onChange={e => setNewAdmin(p => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newAdmin.role} onValueChange={(v: "super_admin" | "viewer") => setNewAdmin(p => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
