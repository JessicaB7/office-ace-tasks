import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

const Auth = () => {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Email enviado", description: "Verifique a sua caixa de entrada para repor a password." });
      setIsForgotPassword(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Contabilista Explica" className="h-16 mb-2" />
          <p className="text-sm text-muted-foreground mt-1">Gestor de Tarefas</p>
        </div>

        <div className="bg-card rounded-2xl border p-6 shadow-sm">
          {isForgotPassword ? (
            <>
              <h2 className="text-lg font-semibold mb-1">Recuperar Password</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Introduza o seu email para receber o link de recuperação
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@gabinete.pt"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "A enviar..." : "Enviar Link de Recuperação"}
                </button>
              </form>
              <div className="mt-4 text-center">
                <button
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-1">Entrar</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Aceda à sua conta de administrador
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@gabinete.pt"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1.5"
                  >
                    Esqueceu a password?
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "A processar..." : "Entrar"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
