// Permissive placeholder yang masih biarin .from('any_table').select(...) compile.
// Regenerate dengan strict types saat siap (Docker Desktop atau `supabase login`):
//   supabase gen types typescript --project-id rczzlvlprbttaqyxthkm > src/lib/types/database.ts
// Sampai itu, kita pakai casting manual (.single<RowType>()) di tempat yang butuh type safety.

type GenericRow = { [key: string]: unknown };
type GenericTable = {
  Row: GenericRow;
  Insert: GenericRow;
  Update: GenericRow;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: { [table: string]: GenericTable };
    Views: { [view: string]: GenericTable };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
