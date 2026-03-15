import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { format } from 'date-fns';
import { Bot, Plus, Star, Trash2, CheckCircle, Upload, FileCheck, Loader2 } from 'lucide-react';

interface AgentVersion {
  id: string;
  version: string;
  fileName: string;
  filePath: string;
  checksum: string;
  isLatest: boolean;
  releaseNotes: string | null;
  createdAt: string;
}

interface UploadedFile {
  fileName: string;
  filePath: string;
  checksum: string;
}

export default function AgentVersions() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchdogInputRef = useRef<HTMLInputElement>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploadedWatchdog, setUploadedWatchdog] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingWatchdog, setUploadingWatchdog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentVersion | null>(null);

  const { data, isLoading } = useQuery<AgentVersion[]>({
    queryKey: ['agent-versions'],
    queryFn: async () => {
      const res = await api.get('/admin/agent-versions');
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      version: string; fileName: string; filePath: string; checksum: string; releaseNotes: string;
      watchdogFileName?: string; watchdogFilePath?: string; watchdogChecksum?: string;
    }) => api.post('/admin/agent-versions', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-versions'] });
      handleClose();
      toast.success('Version published successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to publish version');
    },
  });

  const setLatestMutation = useMutation({
    mutationFn: (id: string) => api.put(`/admin/agent-versions/${id}/set-latest`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-versions'] });
      toast.success('Latest version updated');
    },
    onError: () => toast.error('Failed to update latest'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/agent-versions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-versions'] });
      setDeleteTarget(null);
      toast.success('Version deleted');
    },
    onError: () => toast.error('Failed to delete version'),
  });

  const handleClose = () => {
    setUploadOpen(false);
    setVersion('');
    setReleaseNotes('');
    setUploadedFile(null);
    setUploadedWatchdog(null);
    setUploading(false);
    setUploadingWatchdog(false);
  };

  const uploadExe = async (file: File): Promise<UploadedFile | null> => {
    if (!file.name.toLowerCase().endsWith('.exe')) {
      toast.error('Only .exe files are accepted');
      return null;
    }
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/admin/agent-versions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { fileName: res.data.fileName, filePath: res.data.filePath, checksum: res.data.checksum };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadedFile(null);
    try {
      const result = await uploadExe(file);
      if (result) { setUploadedFile(result); toast.success('EmployeeMonitor.exe uploaded'); }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); e.target.value = ''; }
  };

  const handleWatchdogChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWatchdog(true);
    setUploadedWatchdog(null);
    try {
      const result = await uploadExe(file);
      if (result) { setUploadedWatchdog(result); toast.success('EMWatchdog.exe uploaded'); }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Watchdog upload failed');
    } finally { setUploadingWatchdog(false); e.target.value = ''; }
  };

  const handleSubmit = () => {
    if (!version.trim()) { toast.error('Version is required'); return; }
    if (!uploadedFile) { toast.error('Please upload EmployeeMonitor.exe first'); return; }
    createMutation.mutate({
      version: version.trim(),
      fileName: uploadedFile.fileName,
      filePath: uploadedFile.filePath,
      checksum: uploadedFile.checksum,
      releaseNotes: releaseNotes.trim(),
      watchdogFileName: uploadedWatchdog?.fileName,
      watchdogFilePath: uploadedWatchdog?.filePath,
      watchdogChecksum: uploadedWatchdog?.checksum,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Versions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage monitoring agent installer releases</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Upload New Version
        </Button>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            Published Versions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
          ) : !data?.length ? (
            <div className="py-12 text-center">
              <Bot className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No agent versions published yet</p>
              <p className="text-gray-400 text-xs mt-1">Click "Upload New Version" to publish the first release</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Version</th>
                    <th className="text-left px-6 py-3">File Name</th>
                    <th className="text-left px-6 py-3 hidden md:table-cell">Checksum (SHA256)</th>
                    <th className="text-left px-6 py-3">Latest</th>
                    <th className="text-left px-6 py-3">Published</th>
                    <th className="text-left px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((v) => (
                    <tr key={v.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-gray-900">{v.version}</td>
                      <td className="px-6 py-4 text-gray-700 font-mono text-xs">{v.fileName}</td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="font-mono text-xs text-gray-500" title={v.checksum}>
                          {v.checksum.slice(0, 20)}…
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {v.isLatest ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Latest
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400 text-xs">—</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {format(new Date(v.createdAt), 'dd MMM yyyy, HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {!v.isLatest && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 text-xs"
                              onClick={() => setLatestMutation.mutate(v.id)}
                              disabled={setLatestMutation.isPending}
                            >
                              <Star className="w-3.5 h-3.5 mr-1" />
                              Set Latest
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteTarget(v)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Upload New Agent Version
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" accept=".exe" className="hidden" onChange={handleFileChange} />
            <input ref={watchdogInputRef} type="file" accept=".exe" className="hidden" onChange={handleWatchdogChange} />

            {/* Step 1: EmployeeMonitor.exe */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 1 — EmployeeMonitor.exe *</Label>
              {uploadedFile ? (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                  <FileCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-green-800 truncate">{uploadedFile.fileName}</p>
                    <p className="text-xs text-green-600 font-mono mt-0.5 truncate" title={uploadedFile.checksum}>
                      SHA256: {uploadedFile.checksum.slice(0, 24)}…
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 shrink-0 h-7 px-2 text-xs"
                    onClick={() => fileInputRef.current?.click()}>Replace</Button>
                </div>
              ) : (
                <Button type="button" variant="outline"
                  className="w-full h-14 border-dashed flex-col gap-1 text-gray-500 hover:text-blue-600 hover:border-blue-400"
                  onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Uploading…</span></> :
                    <><Upload className="w-4 h-4" /><span className="text-xs">Select EmployeeMonitor.exe</span></>}
                </Button>
              )}
            </div>

            {/* Step 2: EMWatchdog.exe */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 2 — EMWatchdog.exe (optional)</Label>
              {uploadedWatchdog ? (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                  <FileCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-green-800 truncate">{uploadedWatchdog.fileName}</p>
                    <p className="text-xs text-green-600 font-mono mt-0.5 truncate" title={uploadedWatchdog.checksum}>
                      SHA256: {uploadedWatchdog.checksum.slice(0, 24)}…
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 shrink-0 h-7 px-2 text-xs"
                    onClick={() => watchdogInputRef.current?.click()}>Replace</Button>
                </div>
              ) : (
                <Button type="button" variant="outline"
                  className="w-full h-14 border-dashed flex-col gap-1 text-gray-500 hover:text-blue-600 hover:border-blue-400"
                  onClick={() => watchdogInputRef.current?.click()} disabled={uploadingWatchdog}>
                  {uploadingWatchdog ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Uploading…</span></> :
                    <><Upload className="w-4 h-4" /><span className="text-xs">Select EMWatchdog.exe</span></>}
                </Button>
              )}
            </div>

            {/* Step 3: Version */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Step 3 — Version number *</Label>
              <Input placeholder="e.g. 1.0.0" value={version} onChange={e => setVersion(e.target.value)} />
            </div>

            {/* Step 4: Release notes */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">Step 4 — Release Notes (optional)</Label>
              <Textarea placeholder="What changed in this version..." value={releaseNotes}
                onChange={e => setReleaseNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || uploading || uploadingWatchdog || !uploadedFile}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing…</>
              ) : 'Publish Version'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Version
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Delete <strong>{deleteTarget?.version}</strong> ({deleteTarget?.fileName})? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
