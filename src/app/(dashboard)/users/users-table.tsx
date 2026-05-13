'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Power, PowerOff, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS, type Role } from '@/config/roles';
import { toggleUserActive } from '@/lib/actions/users.actions';
import { UserFormDialog } from './user-form-dialog';

export interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: Role;
  outlet_ids: string[];
  is_active: boolean;
  created_at: string | null;
}

interface Props {
  users: UserRow[];
  outlets: Array<{ id: string; name: string }>;
  currentUserId: string;
  fetchError: string | null;
}

function roleBadgeVariant(role: Role) {
  switch (role) {
    case 'admin':
      return 'channelDineIn';
    case 'manager':
      return 'poApproved';
    case 'spv':
      return 'poOrdered';
    case 'senior_staff':
      return 'syncOk';
    case 'viewer':
      return 'poDraft';
    default:
      return 'poDraft';
  }
}

export function UsersTable({ users, outlets, currentUserId, fetchError }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [actionPending, startActionTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const outletNameById = new Map(outlets.map((o) => [o.id, o.name]));

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: UserRow) {
    setEditing(row);
    setDialogOpen(true);
  }
  function toggleActive(row: UserRow) {
    setActionError(null);
    startActionTransition(async () => {
      const res = await toggleUserActive(row.id, !row.is_active);
      if ('error' in res && res.error) {
        setActionError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-midnight dark:text-cream">Users</h1>
          <p className="text-sm text-text-secondary">
            {users.length.toLocaleString('id-ID')} user · admin/manager/spv/senior staff/viewer
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Tambah User
        </Button>
      </header>

      {fetchError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Gagal load: {fetchError}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>
      ) : null}

      <div className="rounded-xl bg-warning/5 border border-warning/30 p-3">
        <p className="flex items-start gap-2 text-xs text-text-secondary">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" strokeWidth={1.5} />
          <span>
            <strong>Catatan keamanan:</strong> Setiap user baru langsung punya akses sesuai role.
            Berikan password ke user lewat channel aman (jangan WA/SMS biasa). User bisa ubah
            sendiri setelah login pertama.
          </span>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-cream/50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Outlet Scope</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <p className="text-base font-medium text-forest dark:text-cream">
                      Belum ada user
                    </p>
                    <Button size="sm" className="mt-3" onClick={openCreate}>
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                      Tambah User Pertama
                    </Button>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const outletNames =
                    u.outlet_ids.length === 0
                      ? 'Semua outlet'
                      : u.outlet_ids
                          .map((oid) => outletNameById.get(oid) ?? oid)
                          .join(', ');
                  return (
                    <tr
                      key={u.id}
                      className={`border-b border-border-default/50 text-sm hover:bg-mint/30 ${
                        !u.is_active ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-text-primary">
                          {u.full_name ?? '—'}
                          {isSelf ? (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-teal">
                              · kamu
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-text-secondary">
                        {u.email ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-text-secondary">
                        {u.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={roleBadgeVariant(u.role)}>{ROLE_LABELS[u.role]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary max-w-xs truncate">
                        {outletNames}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <Badge variant="syncOk">Active</Badge>
                        ) : (
                          <Badge variant="poDraft">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={actionPending}
                            onClick={() => openEdit(u)}
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" strokeWidth={1.5} />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={actionPending || isSelf}
                            onClick={() => toggleActive(u)}
                            title={
                              isSelf
                                ? 'Tidak bisa nonaktifkan diri sendiri'
                                : u.is_active
                                  ? 'Nonaktifkan'
                                  : 'Aktifkan'
                            }
                          >
                            {u.is_active ? (
                              <PowerOff className="h-3 w-3 text-danger" strokeWidth={1.5} />
                            ) : (
                              <Power className="h-3 w-3 text-success" strokeWidth={1.5} />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormDialog
        key={editing?.id ?? 'create'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        outlets={outlets}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
