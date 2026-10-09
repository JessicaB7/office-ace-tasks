import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Bloco de notas pessoal da Visão geral — cada utilizador só vê as suas notas (RLS). */
const PersonalNotesCard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["user_notes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notes")
        .select("content")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.content ?? "";
    },
  });

  useEffect(() => {
    if (data !== undefined && !loadedRef.current) {
      setText(data);
      loadedRef.current = true;
    }
  }, [data]);

  const save = async (content: string) => {
    if (!user) return;
    pendingRef.current = null;
    setSaveState("saving");
    const { error } = await supabase
      .from("user_notes")
      .upsert({ user_id: user.id, content }, { onConflict: "user_id" });
    if (error) {
      setSaveState("error");
      return;
    }
    queryClient.setQueryData(["user_notes", user.id], content);
    setSaveState("saved");
  };

  // Grava o que ficar por gravar ao sair da página
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    if (pendingRef.current !== null) void save(pendingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (value: string) => {
    setText(value);
    pendingRef.current = value;
    setSaveState("idle");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(value), 800);
  };

  const handleBlur = () => {
    if (pendingRef.current === null) return;
    clearTimeout(timerRef.current);
    void save(pendingRef.current);
  };

  return (
    <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "30ms" }}>
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">As Minhas Notas</h3>
        <span className="text-xs text-muted-foreground ml-1">(só visíveis para si)</span>
        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          {saveState === "saving" && (<><Loader2 className="w-3 h-3 animate-spin" /> A guardar…</>)}
          {saveState === "saved" && (<><Check className="w-3 h-3 text-success" /> Guardado</>)}
          {saveState === "error" && <span className="text-destructive">Erro ao guardar</span>}
        </span>
      </div>
      <Textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        disabled={!user || isLoading}
        placeholder={isLoading ? "A carregar…" : "Escreva aqui as suas notas, lembretes ou pendentes…"}
        className="min-h-[120px] resize-y"
      />
    </div>
  );
};

export default PersonalNotesCard;
