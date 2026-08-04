import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import DashboardView from "@/components/DashboardView";
import TaskListView from "@/components/TaskListView";
import TaskFormDialog from "@/components/TaskFormDialog";
import ClientListView from "@/components/ClientListView";
import CollaboratorListView from "@/components/CollaboratorListView";
import FiscalCalendarView from "@/components/FiscalCalendarView";
import ObrigacoesView from "@/components/ObrigacoesView";
import ContabilidadesView from "@/components/ContabilidadesView";
import ExtratosBancariosView from "@/components/ExtratosBancariosView";
import AdminWeeklySummary from "@/components/AdminWeeklySummary";
import ClientAnalysisView from "@/components/ClientAnalysisView";
import AnaliseFinanceiraView from "@/components/AnaliseFinanceiraView";
import NotificationBell from "@/components/NotificationBell";
import BusinessOverviewView from "@/components/BusinessOverviewView";

const Index = () => {
  const [activeView, setActiveView] = useState("business");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [analysisClientId, setAnalysisClientId] = useState<string | null>(null);

  const handleNewTask = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar activeView={activeView} onViewChange={setActiveView} onNewTask={handleNewTask} />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="flex justify-end mb-4">
          <NotificationBell />
        </div>
        {activeView === "business" && <BusinessOverviewView onNavigate={setActiveView} />}
        {activeView === "dashboard" && <DashboardView />}

        {activeView === "tasks" && <TaskListView onEditTask={handleEditTask} onNewTask={handleNewTask} />}
        {activeView.startsWith("obrigacoes") && <ObrigacoesView subPage={activeView.replace("obrigacoes_", "")} onEditTask={handleEditTask} />}
        {activeView.startsWith("contabilidades") && <ContabilidadesView subPage={activeView.replace("contabilidades_", "")} />}
        {activeView.startsWith("analise_") && <AnaliseFinanceiraView subPage={activeView.replace("analise_", "")} />}
        {activeView === "clients" && !analysisClientId && <ClientListView onOpenAnalysis={(id) => setAnalysisClientId(id)} />}
        {activeView === "clients" && analysisClientId && <ClientAnalysisView clientId={analysisClientId} onBack={() => setAnalysisClientId(null)} />}
        {activeView === "extratos" && <ExtratosBancariosView />}
        {activeView === "resumo" && <AdminWeeklySummary />}
        {activeView === "collaborators" && <CollaboratorListView />}
        {activeView === "calendar" && <FiscalCalendarView />}
      </main>
      <TaskFormDialog open={dialogOpen} task={editingTask} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

export default Index;
