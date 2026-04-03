import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import DashboardView from "@/components/DashboardView";
import TaskListView from "@/components/TaskListView";
import TaskFormDialog from "@/components/TaskFormDialog";
import ClientListView from "@/components/ClientListView";
import CollaboratorListView from "@/components/CollaboratorListView";
import FiscalCalendarView from "@/components/FiscalCalendarView";
import ObrigacoesView from "@/components/ObrigacoesView";

const Index = () => {
  const [activeView, setActiveView] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);

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
        {activeView === "dashboard" && <DashboardView />}
        {activeView === "tasks" && <TaskListView onEditTask={handleEditTask} />}
        {activeView.startsWith("obrigacoes") && <ObrigacoesView subPage={activeView.replace("obrigacoes_", "")} onEditTask={handleEditTask} />}
        {activeView === "clients" && <ClientListView />}
        {activeView === "collaborators" && <CollaboratorListView />}
        {activeView === "calendar" && <FiscalCalendarView />}
      </main>
      <TaskFormDialog open={dialogOpen} task={editingTask} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

export default Index;
