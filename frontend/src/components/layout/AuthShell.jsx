import { FileCheck, Shield, BarChart3 } from "lucide-react";

const DEFAULT_FEATURES = [
  {
    icon: FileCheck,
    title: "Digital Applications",
    description: "Submit and track NPTEL incentive reimbursement claims online."
  },
  {
    icon: Shield,
    title: "Multi-Level Approval",
    description: "Department coordinator, HOD, and institution-level review workflow."
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Real-time dashboards, exports, and audit-ready records."
  }
];

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  wide = false,
  features = DEFAULT_FEATURES
}) {
  return (
    <div className="auth-page">
      <div className={`auth-split ${wide ? "auth-split--wide" : ""}`}>
        <aside className="auth-split-brand">
          <div>
            <div className="auth-split-brand-logo">
              <img src="/logo.jpg" alt="SBJIT" />
              <div>
                <div className="auth-split-brand-title">SBJIT NPTEL Reimburse</div>
              </div>
            </div>

            <h2 className="auth-split-brand-headline">
              Institutional incentive management, simplified.
            </h2>
            <p className="auth-split-brand-copy">
              Secure portal for students, faculty, authorities, and administrators to manage
              NPTEL reimbursement applications with full workflow visibility.
            </p>

            <div className="auth-split-features">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="auth-split-feature">
                    <div className="auth-split-feature-icon">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="auth-split-feature-text">
                      <strong>{feature.title}</strong>
                      <span>{feature.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="auth-split-brand-footer">
            S.B. Jain Institute of Technology &bull; Nagpur
          </div>
        </aside>

        <section className="auth-split-form">
          {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
          {title && <h2 className="section-head">{title}</h2>}
          {subtitle && <p className="section-copy">{subtitle}</p>}
          <div className={title || subtitle ? "mt-8" : ""}>{children}</div>
        </section>
      </div>
    </div>
  );
}
