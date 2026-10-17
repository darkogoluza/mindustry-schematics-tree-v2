import { useState } from "react";
import { cn } from "cn";

interface EntityIconProps {
  icon: string;
  name: string;
  size?: number;
  className?: string;
}

export function EntityIcon({ icon, name, size = 32, className }: EntityIconProps) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (failed) {
    return (
      <div
        className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground", className)}
        style={style}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted p-1", className)} style={style}>
      <img src={icon} alt={name} width={size - 8} height={size - 8} className="object-contain" onError={() => setFailed(true)} />
    </div>
  );
}
