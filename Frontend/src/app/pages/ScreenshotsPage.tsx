import React, { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { Camera, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import { apiGetScreenshots, apiGetEmployees } from "../lib/api";
import type { Screenshot, Employee } from "../lib/types";
import { format } from "date-fns";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";

const departments = ["All", "Engineering", "Design", "Marketing", "Sales", "HR", "Finance"];

export function ScreenshotsPage() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState("All");
  const [dept, setDept] = useState("All");
  const [date, setDate] = useState("");
  const [modal, setModal] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    apiGetEmployees()
      .then(setEmployees)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    apiGetScreenshots({ employeeId: employee, department: dept, date })
      .then(data => {
        setScreenshots(data);
        setVisibleCount(20);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [employee, dept, date]);

  const visible = screenshots.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={employee} onValueChange={v => { setEmployee(v); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Employees</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={v => { setDept(v); }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full sm:w-44"
        />
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : visible.length > 0 ? (
        <ResponsiveMasonry columnsCountBreakPoints={{ 350: 1, 640: 2, 900: 3, 1200: 4 }}>
          <Masonry gutter="12px">
            {visible.map((ss, i) => (
              <motion.div
                key={ss.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer rounded-lg overflow-hidden border border-border bg-card"
                onClick={() => setModal(i)}
              >
                <img src={ss.imageUrl} alt="" className="w-full object-cover" />
                <div className="p-3 flex items-center gap-2">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={ss.avatar} />
                    <AvatarFallback style={{ fontSize: "9px" }}>{ss.employeeName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: "12px" }}>{ss.employeeName}</p>
                    <p className="text-muted-foreground truncate" style={{ fontSize: "10px" }}>{ss.app}</p>
                  </div>
                  <span className="text-muted-foreground shrink-0" style={{ fontSize: "10px" }}>
                    {format(new Date(ss.timestamp), "HH:mm")}
                  </span>
                </div>
              </motion.div>
            ))}
          </Masonry>
        </ResponsiveMasonry>
      ) : (
        <div className="text-center py-20">
          <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No screenshots match your filters</p>
        </div>
      )}

      {/* Load More */}
      {!loading && visibleCount < screenshots.length && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setVisibleCount(c => c + 20)}>
            Load More ({screenshots.length - visibleCount} remaining)
          </Button>
        </div>
      )}

      {/* Fullscreen Modal */}
      <Dialog open={modal !== null} onOpenChange={() => setModal(null)}>
        <DialogContent className="max-w-5xl p-0">
          {modal !== null && visible[modal] && (
            <div>
              <img src={visible[modal].imageUrl} alt="" className="w-full rounded-t-lg" />
              <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={visible[modal].avatar} />
                    <AvatarFallback style={{ fontSize: "10px" }}>{visible[modal].employeeName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p style={{ fontSize: "14px" }}>{visible[modal].employeeName}</p>
                    <p className="text-muted-foreground" style={{ fontSize: "12px" }}>
                      {visible[modal].app} - {visible[modal].windowTitle}
                    </p>
                    <p className="text-muted-foreground" style={{ fontSize: "12px" }}>
                      {format(new Date(visible[modal].timestamp), "PPpp")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={modal === 0} onClick={() => setModal(p => p !== null ? p - 1 : null)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={modal === visible.length - 1} onClick={() => setModal(p => p !== null ? p + 1 : null)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(visible[modal!].imageUrl, "_blank")}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
