'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLES, ROLE_LABELS, type Role } from '@/config/roles';
import {
  inviteUser,
  resetUserPassword,
  updateUser,
  type InviteUserInput,
  type UpdateUserInput,
} from '@/lib/actions/users.actions';
import type { UserRow } from './users-table';

interface OutletOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: UserRow | null;
  outlets: OutletOption[];
  onSuccess?: () => void;
}

export function UserFormDialog({ open, onOpenChange, initial, outlets, onSuccess }: Props) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resetPwOpen, setResetPwOpen] = useState(false);

  const [email, setEmail] = useState(initial?.email ?? '');
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [role, setRole] = useState<Role>(initial?.role ?? 'viewer');
  const [outletIds, setOutletIds] = useState<string[]>(initial?.outlet_ids ?? []);
  const [password, setPassword] = useState('');

  function toggleOutlet(id: string) {
    setOutletIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (isEdit) {
        const payload: UpdateUserInput = {
          full_name: fullName,
          phone: phone || null,
          role,
          outlet_ids: outletIds,
        };
        const res = await updateUser(initial!.id, payload);
        if ('error' in res && res.error) {
          setError(res.error);
          return;
        }
      } else {
        const payload: InviteUserInput = {
          email,
          full_name: fullName,
          phone: phone || null,
          role,
          outlet_ids: outletIds,
          password,
        };
        const res = await inviteUser(payload);
        if ('error' in res && res.error) {
          setError(res.error);
          return;
        }
      }
      onOpenChange(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit User · ${initial!.email ?? initial!.id}` : 'Tambah User Baru'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Ubah profil + role + outlet scope. Password reset di bawah.'
              : 'Set email + password untuk user baru. Mereka langsung bisa login.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email *" htmlFor="uemail" full>
              <Input
                id="uemail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@egggroup.id"
                required
                disabled={isEdit}
                maxLength={255}
              />
            </Field>

            <Field label="Nama Lengkap *" htmlFor="ufullname">
              <Input
                id="ufullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Budi Santoso"
                required
                minLength={2}
                maxLength={255}
              />
            </Field>

            <Field label="Phone" htmlFor="uphone">
              <Input
                id="uphone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxx"
                maxLength={20}
                inputMode="tel"
              />
            </Field>

            <Field label="Role *" htmlFor="urole">
              <select
                id="urole"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary"
                required
              >
                {Object.values(ROLES).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>

            {!isEdit ? (
              <Field label="Password *" htmlFor="upass">
                <Input
                  id="upass"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min. 8 karakter"
                  required
                  minLength={8}
                  maxLength={72}
                />
              </Field>
            ) : null}

            <Field label="Outlet Scope (kosong = semua outlet)" htmlFor="uoutlets" full>
              <div className="flex flex-wrap gap-2">
                {outlets.length === 0 ? (
                  <span className="text-xs text-text-muted">— belum ada outlet —</span>
                ) : (
                  outlets.map((o) => (
                    <label
                      key={o.id}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                        outletIds.includes(o.id)
                          ? 'border-teal bg-teal text-white'
                          : 'border-border-default bg-surface text-text-muted hover:border-teal/40'
                      }`}
                      title={o.id}
                    >
                      <input
                        type="checkbox"
                        checked={outletIds.includes(o.id)}
                        onChange={() => toggleOutlet(o.id)}
                        className="hidden"
                      />
                      {o.name || o.id}
                    </label>
                  ))
                )}
              </div>
            </Field>
          </div>

          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <DialogFooter>
            {isEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setResetPwOpen(true)}
              >
                <KeyRound className="h-4 w-4" strokeWidth={1.5} />
                Reset Password
              </Button>
            ) : null}
            <div className="flex flex-1 justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={1.5} />
                )}
                {isEdit ? 'Simpan Perubahan' : 'Tambah User'}
              </Button>
            </div>
          </DialogFooter>
        </form>

        {isEdit && resetPwOpen ? (
          <ResetPasswordPanel
            userId={initial!.id}
            email={initial!.email}
            onClose={() => setResetPwOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordPanel({
  userId,
  email,
  onClose,
}: {
  userId: string;
  email: string | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function handleReset() {
    setMsg(null);
    startTransition(async () => {
      const res = await resetUserPassword(userId, pw);
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error });
        return;
      }
      setMsg({ type: 'ok', text: `Password diubah. Kasih tahu user (${email ?? userId}).` });
      setPw('');
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-warning">
          Reset Password
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Tutup
        </button>
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password baru (min. 8)"
          minLength={8}
          className="flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || pw.length < 8}
          onClick={handleReset}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : null}
          Set Password
        </Button>
      </div>
      {msg ? (
        <p
          className={`text-xs ${
            msg.type === 'ok' ? 'text-success' : 'text-danger'
          }`}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  full,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${full ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}
