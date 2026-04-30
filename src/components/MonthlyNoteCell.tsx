import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  clientId: string;
  referenceMonth: string;
  obligationId?: string;
  initialNotes: string;
}

const MonthlyNoteCell = ({ clientId, referenceMonth, obligationId, initialNotes }: Props) => {
  const [value, setValue] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const lastSavedRef = useRef(initialNotes || "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(initialNotes || "");
    lastSavedRef.current = initialNotes || "";
  }, [initialNotes, clientId, referenceMonth]);

  const persist = async (next: string) => {
    if (next === lastSavedRef.current) return;
    setSaving(true);
    try {
      if (obligationId) {
        await supabase.from("monthly_obligations").update({ notes: next }).eq("id", obligationId);
      } else {
        await supabase.from("monthly_obligations").insert({
          client_id: clientId,
          obligation_type: "empresa_notes",
          reference_month: referenceMonth,
          status: "pendente",
          notes: next,
        });
      }
      lastSavedRef.current = next;
      qc.invalidateQueries({ queryKey: ["monthly_obligations", referenceMonth] });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(v), 600);
  };

  const handleBlur = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    persist(value);
  };

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Notas do mês..."
        rows={2}
        className="w-full min-w-[200px] text-xs rounded border bg-background px-2 py-1 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {saving && <span className="absolute top-1 right-1 text-[10px] text-muted-foreground">a guardar…</span>}
    </div>
  );
};

export default MonthlyNoteCell;
