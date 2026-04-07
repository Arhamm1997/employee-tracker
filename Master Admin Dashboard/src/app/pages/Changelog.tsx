import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Eye, EyeOff, RefreshCw, Loader2, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import api from '../../lib/api';
import { toast } from 'sonner';

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  type: string;
  planTarget: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  _count: { reads: number };
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  feature:     { label: 'New Feature',   color: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
  improvement: { label: 'Improvement',   color: 'bg-purple-500/10 text-purple-700 border-purple-500/30' },
  fix:         { label: 'Bug Fix',       color: 'bg-orange-500/10 text-orange-700 border-orange-500/30' },
  security:    { label: 'Security',      color: 'bg-red-500/10 text-red-700 border-red-500/30' },
};

const EMPTY_FORM = { title: '', description: '', type: 'feature', planTarget: 'all', publish: false };

export default function Changelog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadEntries() {
    setLoading(true);
    try {
      const res = await api.get<{ entries: ChangelogEntry[] }>('/admin/changelog');
      setEntries(res.data.entries);
    } catch {
      toast.error('Failed to load changelog');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEntries(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(entry: ChangelogEntry) {
    setEditId(entry.id);
    setForm({
      title: entry.title,
      description: entry.description,
      type: entry.type,
      planTarget: entry.planTarget,
      publish: entry.isPublished,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/admin/changelog/${editId}`, {
          title: form.title,
          description: form.description,
          type: form.type,
          planTarget: form.planTarget,
        });
        if (form.publish) {
          await api.patch(`/admin/changelog/${editId}/publish`, { publish: true });
        }
        toast.success('Entry updated');
      } else {
        await api.post('/admin/changelog', {
          title: form.title,
          description: form.description,
          type: form.type,
          planTarget: form.planTarget,
          publish: form.publish,
        });
        toast.success('Entry created');
      }
      setDialogOpen(false);
      loadEntries();
    } catch {
      toast.error('Failed to save entry');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(entry: ChangelogEntry) {
    setTogglingId(entry.id);
    try {
      await api.patch(`/admin/changelog/${entry.id}/publish`, { publish: !entry.isPublished });
      setEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, isPublished: !e.isPublished } : e
      ));
      toast.success(entry.isPublished ? 'Unpublished' : 'Published — users will see this now');
    } catch {
      toast.error('Failed to update publish status');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/changelog/${deleteId}`);
      setEntries(prev => prev.filter(e => e.id !== deleteId));
      setDeleteId(null);
      toast.success('Entry deleted');
    } catch {
      toast.error('Failed to delete entry');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Changelog</h1>
            <p className="text-sm text-muted-foreground">Announce new features and updates to all company users</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadEntries} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{entries.length}</p>
            <p className="text-sm text-muted-foreground">Total Entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-emerald-600">{entries.filter(e => e.isPublished).length}</p>
            <p className="text-sm text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-amber-600">{entries.filter(e => !e.isPublished).length}</p>
            <p className="text-sm text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
      </div>

      {/* Entries List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No changelog entries yet. Create your first one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map(entry => {
                const typeInfo = TYPE_LABELS[entry.type] || TYPE_LABELS.feature;
                return (
                  <div key={entry.id} className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-sm">{entry.title}</span>
                        <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</Badge>
                        {entry.planTarget !== 'all' && (
                          <Badge variant="outline" className="text-xs">{entry.planTarget}</Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={entry.isPublished
                            ? 'text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                            : 'text-xs bg-amber-500/10 text-amber-700 border-amber-500/30'}
                        >
                          {entry.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                        {entry.isPublished && (
                          <span className="text-xs text-muted-foreground">
                            {entry._count.reads} read{entry._count.reads !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(entry)}
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => togglePublish(entry)}
                        disabled={togglingId === entry.id}
                        title={entry.isPublished ? 'Unpublish' : 'Publish'}
                      >
                        {togglingId === entry.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : entry.isPublished
                            ? <EyeOff className="w-3.5 h-3.5" />
                            : <Eye className="w-3.5 h-3.5" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(entry.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!saving) setDialogOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Entry' : 'New Changelog Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                placeholder="e.g. Slack Integration is now available"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                placeholder="Describe what's new or improved..."
                rows={4}
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">New Feature</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="fix">Bug Fix</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Target Plan</label>
                <Select value={form.planTarget} onValueChange={(v) => setForm(f => ({ ...f, planTarget: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editId && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.publish}
                  onChange={(e) => setForm(f => ({ ...f, publish: e.target.checked }))}
                  className="rounded"
                />
                Publish immediately (users will see this now)
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? 'Save Changes' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!deleting && !v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the changelog entry and all read records for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
