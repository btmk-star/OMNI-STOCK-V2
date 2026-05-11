import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// === BAHAN BAKU ===
export const BahanBakuSchema = z.object({
  id: z.string().regex(/^BP-[A-Z]+-\d{3}$/, 'Format: BP-BTMK-001'),
  name: z.string().min(3, 'Minimal 3 karakter').max(255),
  tipe: z.enum(['packaged', 'raw_bulk']),
  kategori: z.string().min(1, 'Kategori wajib diisi'),
  kemasan_beli: z.string().min(1),
  satuan_dapur: z.string().min(1),
  min_stok: z.number().positive('Min stok harus > 0'),
  harga_beli: z.number().nonnegative('Harga tidak boleh negatif'),
  isi_yield: z.number().positive('Yield harus > 0'),
  outlet_id: z.string().min(1),
  supplier_id: z.string().optional(),
  pawoon_product_id: z.string().optional(),
});

// === SUPPLIER ===
const PHONE_REGEX = /^(\+62|62|0)8[1-9][0-9]{7,10}$/;
export const SupplierSchema = z.object({
  name: z.string().min(2).max(255),
  contact_person: z.string().max(255).optional(),
  phone: z.string().regex(PHONE_REGEX, 'Format nomor tidak valid').optional(),
  whatsapp: z.string().regex(PHONE_REGEX, 'Format WA tidak valid').optional(),
  email: z.string().email('Email tidak valid').optional(),
  type: z.enum(['kerjasama', 'non_kerjasama', 'online_shop']),
  payment_terms: z.string().optional(),
  lead_time_days: z.number().int().nonnegative().optional(),
});

// === PURCHASE ORDER ===
export const CreatePOSchema = z.object({
  supplier_id: z.string().min(1, 'Pilih supplier'),
  outlet_ids: z.array(z.string()).min(1, 'Pilih minimal 1 outlet'),
  notes: z.string().max(500).optional(),
  expected_delivery: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        bahan_id: z.string().min(1),
        qty: z.number().positive('Qty harus > 0'),
        satuan: z.string().min(1),
        harga_satuan: z.number().nonnegative(),
      }),
    )
    .min(1, 'Minimal 1 item'),
});
