import { Calendar, ShieldCheck } from "lucide-react";

export default function Topbar({ title, subtitle, module = "Enterprise Portal" }) {
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());

  return (
    <div className="portal-topbar animate-fade">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="portal-topbar-breadcrumb">
            <span>{module}</span>
            <span className="text-slate-300">/</span>
            <span>{title}</span>
          </div>
          <h1 className="portal-topbar-title">{title}</h1>
          {subtitle && <p className="portal-topbar-subtitle">{subtitle}</p>}
        </div>

        <div className="portal-topbar-meta shrink-0">
          <div className="claim-pill gap-2">
            <span className="portal-status-dot" />
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
            Secure Session
          </div>
          <div className="claim-pill gap-2 text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
            {today}
          </div>
        </div>
      </div>
    </div>
  );
}
