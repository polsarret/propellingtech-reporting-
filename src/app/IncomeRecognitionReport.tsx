"use client";

import { useState } from "react";
import type { ClientReportRow, ProjectReportRow } from "@/lib/bigquery";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number): string {
  if (n === 0) return "—";
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "M";
  if (a >= 1000) return (n / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 }) + "k";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDays(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function fmtPct(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtRate(ir: number, days: number): string {
  if (days === 0 || ir === 0) return "—";
  return fmt(ir / days);
}

type SortKey = "name" | "monthly_id" | "monthly_nid" | "monthly_dev" | "monthly_ir" | "monthly_rate" | "monthly_net_rate" | "accumulated_id" | "accumulated_nid" | "accumulated_dev" | "accumulated_ir" | "accumulated_rate" | "accumulated_net_rate";

interface IncomeRecognitionReportProps {
  clients: ClientReportRow[];
}

export default function IncomeRecognitionReport({ clients }: IncomeRecognitionReportProps) {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const handleClientClick = async (clientName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/income-recognition/projects?client=${encodeURIComponent(clientName)}`);
      const data = await response.json();
      setProjects(data);
      setSelectedClient(clientName);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedClient(null);
    setProjects([]);
  };

  return (
    <div className="space-y-6">
      {selectedClient === null ? (
        <ClientTable clients={clients} onSelectClient={handleClientClick} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="px-3 py-2 rounded border border-line bg-surface text-sm font-medium text-ink hover:bg-pacer transition-colors"
            >
              ← Back to Clients
            </button>
            <h2 className="text-lg font-semibold text-ink">{selectedClient}</h2>
            {loading && <span className="text-xs text-muted">Loading...</span>}
          </div>
          {projects.length > 0 && <ProjectTable projects={projects} />}
        </>
      )}
    </div>
  );
}

function ClientTable({ clients, onSelectClient }: { clients: ClientReportRow[]; onSelectClient: (name: string) => void }) {
  const closingMonth = clients[0]?.closingMonth || 7;
  const monthName = MONTHS[closingMonth - 1];
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const getSortValue = (client: ClientReportRow, key: SortKey): number => {
    switch (key) {
      case "monthly_id": return client.monthly.id;
      case "monthly_nid": return client.monthly.nid;
      case "monthly_dev": return client.monthly.nid / (client.monthly.id || 1);
      case "monthly_ir": return client.monthly.ir;
      case "monthly_rate": return client.monthly.id ? client.monthly.ir / client.monthly.id : 0;
      case "monthly_net_rate": return (client.monthly.id + client.monthly.nid) ? client.monthly.ir / (client.monthly.id + client.monthly.nid) : 0;
      case "accumulated_id": return client.accumulated.id;
      case "accumulated_nid": return client.accumulated.nid;
      case "accumulated_dev": return client.accumulated.nid / (client.accumulated.id || 1);
      case "accumulated_ir": return client.accumulated.ir;
      case "accumulated_rate": return client.accumulated.id ? client.accumulated.ir / client.accumulated.id : 0;
      case "accumulated_net_rate": return (client.accumulated.id + client.accumulated.nid) ? client.accumulated.ir / (client.accumulated.id + client.accumulated.nid) : 0;
      default: return 0;
    }
  };

  const sortedClients = [...clients].sort((a, b) => {
    let aVal: string | number, bVal: string | number;
    if (sortBy === "name") {
      aVal = a.clientName;
      bVal = b.clientName;
    } else {
      aVal = getSortValue(a, sortBy);
      bVal = getSortValue(b, sortBy);
    }
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDirection === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDirection("desc");
    }
  };

  const SortIndicator = ({ column }: { column: SortKey }) =>
    sortBy === column ? <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span> : null;

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">
        Closing Month: <span className="font-semibold text-ink">{monthName} 2026</span>
      </div>
      <div className="overflow-x-auto border border-line rounded-lg bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-pacer border-b border-line">
            <tr>
              <th colSpan={1} className="px-4 py-3"></th>
              <th colSpan={6} className="px-4 py-3 text-left font-semibold text-ink">{monthName} (Monthly)</th>
              <th colSpan={6} className="px-4 py-3 text-left font-semibold text-ink border-l-2 border-slate-300">Accumulated (Jan - {monthName})</th>
            </tr>
            <tr className="text-xs uppercase tracking-wider text-muted border-b border-line/40">
              <th className="sticky left-0 z-10 bg-pacer px-4 py-2 text-left font-medium cursor-pointer hover:text-ink" onClick={() => handleSort("name")}>Client <SortIndicator column="name" /></th>
              <th className="px-2 py-2 text-center font-bold text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_ir")}>IR <SortIndicator column="monthly_ir" /></th>
              <th className="px-2 py-2 text-center font-bold text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_net_rate")}>Net Rate <SortIndicator column="monthly_net_rate" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_id")}>ID <SortIndicator column="monthly_id" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_nid")}>NID <SortIndicator column="monthly_nid" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_dev")}>Dev% <SortIndicator column="monthly_dev" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_rate")}>Rate <SortIndicator column="monthly_rate" /></th>
              <th className="px-2 py-2 text-center font-bold text-[10px] cursor-pointer hover:text-ink border-l-2 border-slate-300" onClick={() => handleSort("accumulated_ir")}>IR <SortIndicator column="accumulated_ir" /></th>
              <th className="px-2 py-2 text-center font-bold text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_net_rate")}>Net Rate <SortIndicator column="accumulated_net_rate" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_id")}>ID <SortIndicator column="accumulated_id" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_nid")}>NID <SortIndicator column="accumulated_nid" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_dev")}>Dev% <SortIndicator column="accumulated_dev" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_rate")}>Rate <SortIndicator column="accumulated_rate" /></th>
            </tr>
          </thead>
          <tbody>
            {sortedClients.map((client, i) => (
              <tr key={i} className="border-b border-line/60 hover:bg-pacer/20 transition-colors cursor-pointer">
                <td
                  className="sticky left-0 z-10 bg-surface px-4 py-2 font-semibold text-ink hover:text-propel-ink"
                  onClick={() => onSelectClient(client.clientName)}
                >
                  {client.clientName}
                </td>
                {/* Monthly Metrics */}
                <td className="px-2 py-2 text-center font-bold text-ink text-sm">{fmt(client.monthly.ir)}</td>
                <td className="px-2 py-2 text-center font-bold text-ink text-xs">
                  {fmtRate(client.monthly.ir, client.monthly.id + client.monthly.nid)}
                </td>
                <td className="px-2 py-2 text-center font-semibold text-ink text-xs">{fmtDays(client.monthly.id)}</td>
                <td className="px-2 py-2 text-center font-semibold text-ink text-xs">{fmtDays(client.monthly.nid)}</td>
                <td className="px-2 py-2 text-center text-muted text-xs">
                  {fmtPct(client.monthly.nid / (client.monthly.id || 1))}
                </td>
                <td className="px-2 py-2 text-center text-xs text-muted">
                  {fmtRate(client.monthly.ir, client.monthly.id)}
                </td>
                {/* Accumulated */}
                <td className="px-2 py-2 text-center font-bold text-ink text-sm bg-slate-50 border-l-2 border-slate-300">{fmt(client.accumulated.ir)}</td>
                <td className="px-2 py-2 text-center font-bold text-ink text-xs bg-slate-50">
                  {fmtRate(client.accumulated.ir, client.accumulated.id + client.accumulated.nid)}
                </td>
                <td className="px-2 py-2 text-center font-semibold text-ink text-xs bg-slate-50">{fmtDays(client.accumulated.id)}</td>
                <td className="px-2 py-2 text-center font-semibold text-ink text-xs bg-slate-50">{fmtDays(client.accumulated.nid)}</td>
                <td className="px-2 py-2 text-center text-muted text-xs bg-slate-50">
                  {fmtPct(client.accumulated.nid / (client.accumulated.id || 1))}
                </td>
                <td className="px-2 py-2 text-center text-xs text-muted bg-slate-50">
                  {fmtRate(client.accumulated.ir, client.accumulated.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectTable({ projects }: { projects: ProjectReportRow[] }) {
  const closingMonth = projects[0]?.closingMonth || 7;
  const monthName = MONTHS[closingMonth - 1];
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const getSortValue = (project: ProjectReportRow, key: SortKey): number => {
    switch (key) {
      case "monthly_id": return project.monthly.id;
      case "monthly_nid": return project.monthly.nid;
      case "monthly_dev": return project.monthly.nid / (project.monthly.id || 1);
      case "monthly_ir": return project.monthly.ir;
      case "monthly_rate": return project.monthly.id ? project.monthly.ir / project.monthly.id : 0;
      case "monthly_net_rate": return (project.monthly.id + project.monthly.nid) ? project.monthly.ir / (project.monthly.id + project.monthly.nid) : 0;
      case "accumulated_id": return project.accumulated.id;
      case "accumulated_nid": return project.accumulated.nid;
      case "accumulated_dev": return project.accumulated.nid / (project.accumulated.id || 1);
      case "accumulated_ir": return project.accumulated.ir;
      case "accumulated_rate": return project.accumulated.id ? project.accumulated.ir / project.accumulated.id : 0;
      case "accumulated_net_rate": return (project.accumulated.id + project.accumulated.nid) ? project.accumulated.ir / (project.accumulated.id + project.accumulated.nid) : 0;
      default: return 0;
    }
  };

  const sortedProjects = [...projects].sort((a, b) => {
    let aVal: string | number, bVal: string | number;
    if (sortBy === "name") {
      aVal = a.projectName || "";
      bVal = b.projectName || "";
    } else {
      aVal = getSortValue(a, sortBy);
      bVal = getSortValue(b, sortBy);
    }
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDirection === "asc" ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDirection("desc");
    }
  };

  const SortIndicator = ({ column }: { column: SortKey }) =>
    sortBy === column ? <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span> : null;

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">
        Closing Month: <span className="font-semibold text-ink">{monthName} 2026</span>
      </div>
      <div className="overflow-x-auto border border-line rounded-lg bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-pacer border-b border-line">
            <tr>
              <th colSpan={1} className="px-4 py-3"></th>
              <th colSpan={6} className="px-4 py-3 text-left font-semibold text-ink">{monthName} (Monthly)</th>
              <th colSpan={6} className="px-4 py-3 text-left font-semibold text-ink border-l-2 border-slate-300">Accumulated (Jan - {monthName})</th>
            </tr>
            <tr className="text-xs uppercase tracking-wider text-muted border-b border-line/40">
              <th className="sticky left-0 z-10 bg-pacer px-4 py-2 text-left font-medium cursor-pointer hover:text-ink" onClick={() => handleSort("name")}>Project <SortIndicator column="name" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_id")}>ID <SortIndicator column="monthly_id" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_nid")}>NID <SortIndicator column="monthly_nid" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_dev")}>Dev% <SortIndicator column="monthly_dev" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_ir")}>IR <SortIndicator column="monthly_ir" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_rate")}>Rate <SortIndicator column="monthly_rate" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("monthly_net_rate")}>Net Rate <SortIndicator column="monthly_net_rate" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink border-l-2 border-slate-300" onClick={() => handleSort("accumulated_id")}>ID <SortIndicator column="accumulated_id" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_nid")}>NID <SortIndicator column="accumulated_nid" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_dev")}>Dev% <SortIndicator column="accumulated_dev" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_ir")}>IR <SortIndicator column="accumulated_ir" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_rate")}>Rate <SortIndicator column="accumulated_rate" /></th>
              <th className="px-2 py-2 text-center font-medium text-[10px] cursor-pointer hover:text-ink" onClick={() => handleSort("accumulated_net_rate")}>Net Rate <SortIndicator column="accumulated_net_rate" /></th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((project, i) => (
              <tr key={i} className="border-b border-line/60 hover:bg-pacer/20 transition-colors">
                <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium text-ink text-sm">
                  {project.projectName}
                  {project.billableFlag === 0 && <span className="block text-xs text-muted">(non-billable)</span>}
                </td>
                {/* Monthly Metrics */}
                <td className="px-2 py-2 text-center font-bold text-ink text-sm">{fmt(project.monthly.ir)}</td>
                <td className="px-2 py-2 text-center font-bold text-ink text-xs">
                  {fmtRate(project.monthly.ir, project.monthly.id + project.monthly.nid)}
                </td>
                <td className="px-2 py-2 text-center font-semibold text-ink text-xs">{fmtDays(project.monthly.id)}</td>
                <td className="px-2 py-2 text-center font-semibold text-ink text-xs">{fmtDays(project.monthly.nid)}</td>
                <td className="px-2 py-2 text-center text-muted text-xs">
                  {fmtPct(project.monthly.nid / (project.monthly.id || 1))}
                </td>
                <td className="px-2 py-2 text-center text-xs text-muted">
                  {fmtRate(project.monthly.ir, project.monthly.id)}
                </td>
                {/* Accumulated */}
                <td className="px-2 py-2 text-center font-bold text-ink text-sm bg-slate-50 border-l-2 border-slate-300">{fmt(project.accumulated.ir)}</td>
                <td className="px-2 py-2 text-center font-bold text-ink text-xs bg-slate-50">
                  {fmtRate(project.accumulated.ir, project.accumulated.id + project.accumulated.nid)}
                </td>
                <td className="px-2 py-2 text-center font-semibold text-ink text-xs bg-slate-50">{fmtDays(project.accumulated.id)}</td>
                <td className="px-2 py-2 text-center font-semibold text-ink text-xs bg-slate-50">{fmtDays(project.accumulated.nid)}</td>
                <td className="px-2 py-2 text-center text-muted text-xs bg-slate-50">
                  {fmtPct(project.accumulated.nid / (project.accumulated.id || 1))}
                </td>
                <td className="px-2 py-2 text-center text-xs text-muted bg-slate-50">
                  {fmtRate(project.accumulated.ir, project.accumulated.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
