import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import DashboardView from "@/components/DashboardView";
import TaskListView from "@/components/TaskListView";
import TaskFormDialog from "@/components/TaskFormDialog";
import ClientListView from "@/components/ClientListView";
import CollaboratorListView from "@/components/CollaboratorListView";
import FiscalCalendarView from "@/components/FiscalCalendarView";
import NotasView from "@/components/NotasView";
import ObrigacoesView, { type ObrigacoesNav } from "@/components/ObrigacoesView";
import ContabilidadesView, { type ContabilidadesNav } from "@/components/ContabilidadesView";
import ObrigacoesControloView, { type ObrigacoesControloNav } from "@/components/ObrigacoesControloView";
import ObrigacoesPrazoReminder from "@/components/ObrigacoesPrazoReminder";
import GestaoMensalEmFaltaView from "@/components/GestaoMensalEmFaltaView";
import ExtratosBancariosView from "@/components/ExtratosBancariosView";
import AdminWeeklySummary from "@/components/AdminWeeklySummary";
import ClientAnalysisView from "@/components/ClientAnalysisView";
import AnaliseFinanceiraView from "@/components/AnaliseFinanceiraView";
import NotificationBell from "@/components/NotificationBell";
import BusinessOverviewView from "@/components/BusinessOverviewView";
import ComercialView from "@/components/ComercialView";
import ConsultoriasPanelView from "@/components/ConsultoriasPanelView";
import LeadsView from "@/components/comercial/LeadsView";
import PropostasView from "@/components/comercial/PropostasView";
import FollowUpsView from "@/components/comercial/FollowUpsView";
import ScriptsView from "@/components/comercial/ScriptsView";
import NovosClientesView from "@/components/comercial/NovosClientesView";
import ToconlineFilaView from "@/components/toconline/ToconlineFilaView";
import ToconlineProcedimentosView from "@/components/toconline/ToconlineProcedimentosView";
import DailyTasksReminderDialog from "@/components/DailyTasksReminderDialog";
import AssociatedTasksDialog from "@/components/AssociatedTasksDialog";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { isAdmin } = useAuth();
  const [activeView, setActiveView] = useState("dashboard");


  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [analysisClientId, setAnalysisClientId] = useState<string | null>(null);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [contabNav, setContabNav] = useState<ContabilidadesNav | null>(null);
  const [obrigNav, setObrigNav] = useState<ObrigacoesNav | null>(null);
  const [obrigCtlNav, setObrigCtlNav] = useState<ObrigacoesControloNav | null>(null);

  const handleOpenClient = (clientId: string) => {
    setAnalysisClientId(null);
    setOpenClientId(clientId);
    setActiveView("clients");
  };

  // Navegar pelo menu limpa os pedidos de navegação (mês/pesquisa) vindos dos Controlos internos.
  const handleSidebarNav = (view: string) => {
    setContabNav(null);
    setObrigNav(null);
    setObrigCtlNav(null);
    setActiveView(view);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const isContabRegimes = activeView.startsWith("contabilidades_") || activeView === "obrigacoes_controlo";

  return (
    <div className="flex min-h-screen">
      <AppSidebar activeView={activeView} onViewChange={handleSidebarNav} onNewTask={handleNewTask} />
      <main className="relative flex-1 p-6 lg:p-8 overflow-auto">
        {/* Na Gestão Mensal o sino flutua no canto, para o título não perder uma linha. */}
        <div className={isContabRegimes ? "absolute right-6 top-6 lg:right-8 lg:top-8" : "flex justify-end mb-4"}>
          <NotificationBell />
        </div>
        {activeView === "business" && isAdmin && <BusinessOverviewView onNavigate={setActiveView} />}
        {activeView === "dashboard" && <DashboardView />}
        {activeView === "comercial" && isAdmin && <ComercialView />}
        {activeView === "leads" && <LeadsView />}
        {activeView === "propostas" && <PropostasView />}
        {activeView === "followups" && <FollowUpsView />}
        {activeView === "scripts" && <ScriptsView />}
        {activeView === "novos_clientes" && <NovosClientesView onOpenClient={handleOpenClient} />}
        {activeView === "consultorias_painel" && isAdmin && <ConsultoriasPanelView />}
        {activeView === "consultoria_leads" && <LeadsView segment="consultoria" />}
        {activeView === "consultoria_followups" && <FollowUpsView segment="consultoria" />}



        {activeView === "tasks" && <TaskListView onEditTask={handleEditTask} onNewTask={handleNewTask} />}
        {activeView === "obrigacoes_controlo" && isAdmin && <ObrigacoesControloView nav={obrigCtlNav} onOpenObrigacao={(g, month, search) => { setObrigNav({ month, search }); setActiveView(`obrigacoes_${g}`); }} />}
        {activeView.startsWith("obrigacoes") && activeView !== "obrigacoes_controlo" && <ObrigacoesView subPage={activeView.replace("obrigacoes_", "")} onEditTask={handleEditTask} nav={obrigNav} />}
        {activeView === "contabilidades_painel" && isAdmin && <GestaoMensalEmFaltaView onOpenRegime={(t, month, search) => { setContabNav({ month, search }); setActiveView(`contabilidades_${t}`); }} />}
        {activeView.startsWith("contabilidades") && activeView !== "contabilidades_painel" && <ContabilidadesView subPage={activeView.replace("contabilidades_", "")} onSubPageChange={(t) => setActiveView(`contabilidades_${t}`)} nav={contabNav} />}
        {activeView.startsWith("analise_") && <AnaliseFinanceiraView subPage={activeView.replace("analise_", "")} />}
        {activeView === "clients" && !analysisClientId && (
          <ClientListView
            onOpenAnalysis={(id) => setAnalysisClientId(id)}
            openClientId={openClientId}
            onClientOpened={() => setOpenClientId(null)}
          />
        )}
        {activeView === "clients" && analysisClientId && <ClientAnalysisView clientId={analysisClientId} onBack={() => setAnalysisClientId(null)} />}
        {activeView === "extratos" && <ExtratosBancariosView />}
        {activeView === "toconline_fila" && <ToconlineFilaView />}
        {activeView === "toconline_procedimentos" && <ToconlineProcedimentosView />}
        {activeView === "resumo" && <AdminWeeklySummary />}
        {activeView === "collaborators" && <CollaboratorListView />}
        {activeView === "calendar" && <FiscalCalendarView />}
        {activeView === "notas" && <NotasView />}
      </main>
      <TaskFormDialog open={dialogOpen} task={editingTask} onClose={() => setDialogOpen(false)} />
      <DailyTasksReminderDialog onViewTasks={() => setActiveView("tasks")} />
      <AssociatedTasksDialog />
      {isAdmin && (
        <ObrigacoesPrazoReminder onOpen={(group, month) => { setObrigCtlNav({ month, group }); setActiveView("obrigacoes_controlo"); }} />
      )}
    </div>
  );
};

export default Index;
