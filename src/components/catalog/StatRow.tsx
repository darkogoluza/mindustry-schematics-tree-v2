import type { ReactNode } from "react";

interface StatRowProps {
  label: string;
  value: ReactNode;
}

export function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
