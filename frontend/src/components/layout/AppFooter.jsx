export default function AppFooter() {
  return (
    <footer className="mt-auto glass app-chrome border-t border-[color:var(--border-subtle)] py-4">
      <div className="app-container">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="SB Jain"
              className="h-8 w-8 rounded-xl border border-[color:var(--border-subtle)] bg-white object-contain shadow-sm sm:h-9 sm:w-9"
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--primary)] sm:text-[11px]">
                Incentive Claim System
              </div>
              <div className="text-[9px] text-black/35 sm:text-[10px]">
                Version 1.0
              </div>
            </div>
          </div>
          <div className="text-center text-[10px] uppercase tracking-wider text-black/45 sm:text-[11px]">
            Developed by{" "}
            <span className="font-bold text-[color:var(--primary)] transition-colors hover:text-[color:var(--primary-deep)]">
              Vinay Ninave
            </span>
          </div>
          <div className="text-[10px] text-black/35 sm:text-[11px]">
            &copy; {new Date().getFullYear()} All rights reserved
          </div>
        </div>
      </div>
    </footer>
  );
}
