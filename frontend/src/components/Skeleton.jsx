import React from 'react';

export function Skeleton({ className = '', style = {} }) {
  return (
    <div className={`skeleton-base ${className}`} style={style} />
  );
}

export function CardSkeleton() {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="skeleton-text w-24" />
        <Skeleton className="skeleton-circle h-6 w-6" />
      </div>
      <Skeleton className="skeleton-text h-8 w-16 mt-2" />
      <Skeleton className="skeleton-text h-4 w-32 mt-3" />
    </div>
  );
}

export function FormSectionSkeleton() {
  return (
    <div className="form-section">
      <div className="flex items-center justify-between">
        <Skeleton className="skeleton-text h-5 w-48" />
        <Skeleton className="skeleton-text h-6 w-20 rounded-lg" />
      </div>
      <Skeleton className="skeleton-text h-3 w-32 mt-2" />
      
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="skeleton-text h-4 w-24" />
            <Skeleton className="skeleton-text h-4 w-32" />
          </div>
        ))}
      </div>
      
      <div className="mt-5 pt-4 border-t border-black/5">
        <Skeleton className="skeleton-text h-3 w-40 mb-2" />
        <Skeleton className="skeleton-base h-24 w-full rounded-xl" />
      </div>
      
      <div className="mt-5 flex gap-3">
        <Skeleton className="skeleton-base h-10 w-28 rounded-xl" />
        <Skeleton className="skeleton-base h-10 w-28 rounded-xl" />
      </div>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="skeleton-text h-5 w-48" />
        <Skeleton className="skeleton-text h-6 w-20 rounded-lg" />
      </div>
      <Skeleton className="skeleton-text h-3 w-24 mt-3" />
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <Skeleton className="skeleton-text h-4 w-40" />
        <Skeleton className="skeleton-text h-4 w-32" />
        <Skeleton className="skeleton-text h-4 w-48" />
        <Skeleton className="skeleton-text h-4 w-36" />
      </div>
    </div>
  );
}

export function DashboardSkeleton({ activeTab }) {
  if (activeTab === "Overview") {
    return (
      <div className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <Skeleton className="skeleton-text h-6 w-48" />
              <Skeleton className="skeleton-text h-3 w-64 mt-2" />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl p-4 border border-black/5">
               <div className="flex justify-between mb-3">
                 <Skeleton className="skeleton-text h-4 w-20" />
                 <Skeleton className="skeleton-text h-5 w-10" />
               </div>
               <Skeleton className="skeleton-base h-2 w-full rounded-full" />
            </div>
            <div className="rounded-2xl p-4 border border-black/5">
               <div className="flex justify-between mb-3">
                 <Skeleton className="skeleton-text h-4 w-20" />
                 <Skeleton className="skeleton-text h-5 w-10" />
               </div>
               <Skeleton className="skeleton-base h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "Pending Applications" || activeTab === "My Applications" || activeTab === "Total Applications") {
    return (
      <div className="mt-6 animate-slide-up">
        <div className="form-section-header" style={{marginBottom:"1.25rem"}}>
          <div>
            <Skeleton className="skeleton-text h-7 w-56" />
            <Skeleton className="skeleton-text h-3 w-40 mt-2" />
          </div>
        </div>
        <div className="mt-4 grid gap-5">
           <FormSectionSkeleton />
           <FormSectionSkeleton />
        </div>
      </div>
    );
  }
  
  if (activeTab === "My Approved Applications" || activeTab === "Notifications" || activeTab === "Notice") {
    return (
       <div className="mt-8 animate-slide-up">
          <Skeleton className="skeleton-text h-7 w-64 mb-4" />
          <div className="mt-4 grid gap-4">
            <PanelSkeleton />
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
       </div>
    );
  }

  return (
    <div className="mt-8 animate-slide-up">
      <Skeleton className="skeleton-text h-7 w-48 mb-4" />
      <Skeleton className="skeleton-base h-40 w-full rounded-2xl" />
    </div>
  );
}
