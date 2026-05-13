'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type Permission, type Role } from '@/config/roles';

type ActionResult<T = unknown> =
  | { data: T; error?: never }
  | { error: string; data?: never };

export type POStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'ordered'
  | 'partial_received'
  | 'received'
  | 'wa_sent'
  | 'cancelled';

const POItemSchema = z.object({
  bahan_id: z.string().trim().min(1, 'Bahan wajib').max(20),
  qty: z.number().min(0.001, 'Qty harus > 0'),
  satuan: z.string().trim().max(50).optional().nullable(),
  harga_satuan: z.number().min(0).optional().nullable(),
});

const POSchema = z.object({
  supplier_id: z.string().trim().min(1, 'Supplier wajib').max(20),
  outlet_ids: z.array(z.string().trim().max(20)).default([]),
  notes: z.string().trim().max(2000).optional().nullable(),
  expected_delivery: z.string().optional().nullable(),
  items: z.array(POItemSchema).min(1, 'Minimal 1 item'),
});

const ReceiveSchema = z.object({
  receipts: z.array(
    z.object({
      item_id: z.string().uuid(),
      qty_received: z.number().min(0),
    }),
  ),
  notes: z.string().optional().nullable(),
});

export type POInput = z.infer<typeof POSchema>;
export type POItemInput = z.infer<typeof POItemSchema>;
export type ReceiveInput = z.infer<typeof ReceiveSchema>;

interface AuthCtx {
  userId: string;
  role: Role;
}

async function authorize(perm: Permission): Promise<{ ok: AuthCtx } | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Tidak terautentikasi' };
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single<{ role: Role }>();
  const role = profile?.role ?? null;
  if (!hasPermission(role, perm)) {
    return { error: `Role kamu tidak punya akses (butuh ${perm})` };
  }
  return { ok: { userId: userData.user.id, role: role! } };
}

async function generatePOId(): Promise<string> {
  const supabase = await createClient();
  const today = new Date();
  const yyMMdd = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const prefix = `PO-${yyMMdd}-`;
  const { data } = await supabase
    .from('os_purchase_orders')
    .select('id')
    .like('id', `${prefix}%`)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  let next = 1;
  if (data?.id) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(data.id);
    if (match) next = Number.parseInt(match[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function calcTotal(items: POItemInput[]): number {
  return items.reduce((s, it) => s + (it.qty || 0) * (it.harga_satuan ?? 0), 0);
}

async function logPO(opts: {
  poId: string;
  action: string;
  ctx: AuthCtx;
  oldStatus?: POStatus | null;
  newStatus?: POStatus | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  await supabase.from('os_po_logs').insert({
    po_id: opts.poId,
    action: opts.action,
    actor_id: opts.ctx.userId,
    actor_role: opts.ctx.role,
    old_status: opts.oldStatus ?? null,
    new_status: opts.newStatus ?? null,
    notes: opts.notes ?? null,
  });
}

async function fetchUserName(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle<{ full_name: string | null }>();
  return data?.full_name ?? null;
}

async function fetchPoStatus(poId: string): Promise<POStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('os_purchase_orders')
    .select('status')
    .eq('id', poId)
    .maybeSingle<{ status: POStatus }>();
  return data?.status ?? null;
}

export async function createPO(input: POInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize('po.create');
  if ('error' in auth) return { error: auth.error };
  const parsed = POSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const id = await generatePOId();
  const total = calcTotal(parsed.data.items);
  const createdByName = await fetchUserName(auth.ok.userId);

  const { error: hErr } = await supabase.from('os_purchase_orders').insert({
    id,
    supplier_id: parsed.data.supplier_id,
    outlet_ids: parsed.data.outlet_ids,
    status: 'draft',
    total_amount: total,
    notes: parsed.data.notes?.trim() || null,
    created_by: auth.ok.userId,
    created_by_name: createdByName,
    expected_delivery: parsed.data.expected_delivery || null,
  });
  if (hErr) return { error: hErr.message };

  const itemsPayload = parsed.data.items.map((it) => ({
    po_id: id,
    bahan_id: it.bahan_id,
    qty: it.qty,
    satuan: it.satuan?.trim() || null,
    harga_satuan: it.harga_satuan ?? null,
    subtotal: (it.harga_satuan ?? 0) * it.qty,
  }));
  const { error: iErr } = await supabase.from('os_po_items').insert(itemsPayload);
  if (iErr) {
    await supabase.from('os_purchase_orders').delete().eq('id', id);
    return { error: `Items insert gagal: ${iErr.message}` };
  }

  await logPO({ poId: id, action: 'create', ctx: auth.ok, newStatus: 'draft' });
  revalidatePath('/procurement/purchase-orders');
  return { data: { id } };
}

export async function updatePODraft(
  id: string,
  input: POInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize('po.create');
  if ('error' in auth) return { error: auth.error };
  const status = await fetchPoStatus(id);
  if (status !== 'draft') {
    return { error: `PO tidak bisa di-edit di status "${status}". Hanya draft.` };
  }
  const parsed = POSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const total = calcTotal(parsed.data.items);
  const { error: hErr } = await supabase
    .from('os_purchase_orders')
    .update({
      supplier_id: parsed.data.supplier_id,
      outlet_ids: parsed.data.outlet_ids,
      total_amount: total,
      notes: parsed.data.notes?.trim() || null,
      expected_delivery: parsed.data.expected_delivery || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (hErr) return { error: hErr.message };

  await supabase.from('os_po_items').delete().eq('po_id', id);
  const itemsPayload = parsed.data.items.map((it) => ({
    po_id: id,
    bahan_id: it.bahan_id,
    qty: it.qty,
    satuan: it.satuan?.trim() || null,
    harga_satuan: it.harga_satuan ?? null,
    subtotal: (it.harga_satuan ?? 0) * it.qty,
  }));
  const { error: iErr } = await supabase.from('os_po_items').insert(itemsPayload);
  if (iErr) return { error: `Items insert gagal: ${iErr.message}` };

  await logPO({ poId: id, action: 'update', ctx: auth.ok });
  revalidatePath('/procurement/purchase-orders');
  revalidatePath(`/procurement/purchase-orders/${id}`);
  return { data: { id } };
}

async function transition(
  id: string,
  expected: POStatus[],
  next: POStatus,
  perm: Permission,
  action: string,
  extra: Record<string, unknown> = {},
  notes?: string | null,
): Promise<ActionResult<{ id: string; status: POStatus }>> {
  const auth = await authorize(perm);
  if ('error' in auth) return { error: auth.error };
  const current = await fetchPoStatus(id);
  if (!current) return { error: 'PO tidak ditemukan' };
  if (!expected.includes(current)) {
    return { error: `Status saat ini "${current}", tidak bisa transition ke "${next}"` };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('os_purchase_orders')
    .update({ status: next, ...extra, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };

  await logPO({
    poId: id,
    action,
    ctx: auth.ok,
    oldStatus: current,
    newStatus: next,
    notes,
  });
  revalidatePath('/procurement/purchase-orders');
  revalidatePath(`/procurement/purchase-orders/${id}`);
  revalidatePath('/procurement/po-logs');
  return { data: { id, status: next } };
}

export async function submitPO(id: string, notes?: string | null) {
  return transition(id, ['draft'], 'submitted', 'po.create', 'submit', {}, notes);
}

export async function approvePO(id: string, notes?: string | null) {
  const auth = await authorize('po.approve');
  if ('error' in auth) return { error: auth.error };
  const supabase = await createClient();
  return transition(
    id,
    ['submitted'],
    'approved',
    'po.approve',
    'approve',
    { approved_by: auth.ok.userId, approved_at: new Date().toISOString() },
    notes,
  );
}

export async function rejectPO(id: string, notes?: string | null) {
  return transition(id, ['submitted'], 'draft', 'po.approve', 'reject', {}, notes ?? 'Rejected back to draft');
}

export async function markPOOrdered(id: string, notes?: string | null) {
  return transition(
    id,
    ['approved', 'wa_sent'],
    'ordered',
    'po.create',
    'mark_ordered',
    { ordered_at: new Date().toISOString() },
    notes,
  );
}

export async function cancelPO(id: string, notes?: string | null) {
  return transition(
    id,
    ['draft', 'submitted', 'approved', 'ordered', 'wa_sent'],
    'cancelled',
    'po.approve',
    'cancel',
    {},
    notes ?? 'Dibatalkan',
  );
}

export async function receivePO(
  id: string,
  input: ReceiveInput,
): Promise<ActionResult<{ id: string; status: POStatus }>> {
  const auth = await authorize('delivery.receive');
  if ('error' in auth) return { error: auth.error };
  const parsed = ReceiveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid' };

  const supabase = await createClient();
  const current = await fetchPoStatus(id);
  if (!current) return { error: 'PO tidak ditemukan' };
  if (!['ordered', 'partial_received', 'wa_sent'].includes(current)) {
    return { error: `Status saat ini "${current}", tidak bisa receive` };
  }

  // Update qty_received per item
  for (const r of parsed.data.receipts) {
    const { error } = await supabase
      .from('os_po_items')
      .update({ qty_received: r.qty_received })
      .eq('id', r.item_id)
      .eq('po_id', id);
    if (error) return { error: `Update item ${r.item_id} gagal: ${error.message}` };
  }

  // Determine new status based on whether ALL items fully received
  const { data: items } = await supabase
    .from('os_po_items')
    .select('qty,qty_received')
    .eq('po_id', id);
  const allFull =
    !!items &&
    items.every(
      (it) => Number(it.qty_received ?? 0) >= Number(it.qty ?? 0) && Number(it.qty ?? 0) > 0,
    );
  const anyReceived = !!items && items.some((it) => Number(it.qty_received ?? 0) > 0);
  const newStatus: POStatus = allFull
    ? 'received'
    : anyReceived
      ? 'partial_received'
      : current;

  const { error: stErr } = await supabase
    .from('os_purchase_orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (stErr) return { error: stErr.message };

  await logPO({
    poId: id,
    action: allFull ? 'receive_full' : 'receive_partial',
    ctx: auth.ok,
    oldStatus: current,
    newStatus,
    notes: parsed.data.notes ?? null,
  });

  revalidatePath('/procurement/purchase-orders');
  revalidatePath(`/procurement/purchase-orders/${id}`);
  revalidatePath('/procurement/delivery');
  revalidatePath('/procurement/po-logs');
  return { data: { id, status: newStatus } };
}

export async function getPOItems(id: string): Promise<
  ActionResult<
    Array<{
      bahan_id: string;
      qty: number;
      satuan: string | null;
      harga_satuan: number | null;
    }>
  >
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('os_po_items')
    .select('bahan_id,qty,satuan,harga_satuan')
    .eq('po_id', id)
    .order('created_at');
  if (error) return { error: error.message };
  return {
    data: (data ?? []).map((it) => ({
      bahan_id: (it.bahan_id as string) ?? '',
      qty: Number(it.qty),
      satuan: (it.satuan as string | null) ?? null,
      harga_satuan: it.harga_satuan != null ? Number(it.harga_satuan) : null,
    })),
  };
}

export async function getPOItemsForReceive(id: string): Promise<
  ActionResult<
    Array<{
      id: string;
      bahan_id: string | null;
      bahan_name: string | null;
      qty: number;
      qty_received: number;
      satuan: string | null;
    }>
  >
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('os_po_items')
    .select('id,bahan_id,qty,qty_received,satuan,os_bahan_baku(name)')
    .eq('po_id', id)
    .order('created_at');
  if (error) return { error: error.message };
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    bahan_id: string | null;
    qty: number | string;
    qty_received: number | string | null;
    satuan: string | null;
    os_bahan_baku: { name: string } | null;
  }>;
  return {
    data: rows.map((it) => ({
      id: it.id,
      bahan_id: it.bahan_id,
      bahan_name: it.os_bahan_baku?.name ?? null,
      qty: Number(it.qty),
      qty_received: Number(it.qty_received ?? 0),
      satuan: it.satuan,
    })),
  };
}
