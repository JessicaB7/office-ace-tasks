import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [status, setStatus] = useState<"loading" | "valid" | "used" | "invalid" | "success" | "error">("loading");
  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") setStatus("used");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      setStatus(data?.success ? "success" : "error");
    } catch { setStatus("error"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-2xl border p-8 text-center space-y-4">
        <h1 className="text-xl font-bold">Cancelar subscrição</h1>
        {status === "loading" && <p className="text-muted-foreground">A verificar...</p>}
        {status === "valid" && (
          <>
            <p className="text-muted-foreground">Tem a certeza que deseja cancelar a subscrição de emails?</p>
            <button onClick={handleUnsubscribe} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
              Confirmar cancelamento
            </button>
          </>
        )}
        {status === "used" && <p className="text-muted-foreground">Esta subscrição já foi cancelada anteriormente.</p>}
        {status === "invalid" && <p className="text-destructive">Link inválido ou expirado.</p>}
        {status === "success" && <p className="text-green-600 font-medium">Subscrição cancelada com sucesso.</p>}
        {status === "error" && <p className="text-destructive">Ocorreu um erro. Tente novamente.</p>}
      </div>
    </div>
  );
};

export default Unsubscribe;
