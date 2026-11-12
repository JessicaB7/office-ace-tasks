import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ComercialView from "@/components/ComercialView";
import ConsultoriasPanelView from "@/components/ConsultoriasPanelView";

export type ComercialTab = "pipeline" | "consultorias";

interface Props {
  /** Separador pedido por ligação (?view=comercial&tab=consultorias ou o antigo ?view=consultorias_painel). */
  initialTab?: string | null;
}

/** Página «Comercial» (Gestão de negócio, admin): separadores «Pipeline» e «Consultorias». */
const ComercialPainelView = ({ initialTab }: Props) => {
  const [tab, setTab] = useState<ComercialTab>(initialTab === "consultorias" ? "consultorias" : "pipeline");
  useEffect(() => {
    if (initialTab === "consultorias" || initialTab === "pipeline") setTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Comercial</h2>
      <Tabs value={tab} onValueChange={(v) => setTab(v as ComercialTab)}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="consultorias">Consultorias</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-4"><ComercialView /></TabsContent>
        <TabsContent value="consultorias" className="mt-4"><ConsultoriasPanelView /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ComercialPainelView;
