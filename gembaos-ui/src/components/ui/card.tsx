import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  bodyClassName?: string;
}

export function Card({ className, glow, bodyClassName, children, ...props }: CardProps) {
  return (
    <div
      className={cn("card bg-base-200 shadow-sm", glow && "ring-1 ring-primary/20", className)}
      {...props}
    >
      <div className={cn("card-body p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-[11px] font-semibold text-base-content/40 uppercase tracking-widest", className)} {...props}>
      {children}
    </h3>
  );
}
