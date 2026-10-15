import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  default:  "badge badge-neutral",
  scenario: "badge badge-warning badge-outline",
  ok:       "badge badge-success badge-outline",
  warn:     "badge badge-warning badge-outline",
  crit:     "badge badge-error badge-outline",
  info:     "badge badge-info badge-outline",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(variants[variant], "text-[10px]", className)} {...props}>
      {children}
    </span>
  );
}
