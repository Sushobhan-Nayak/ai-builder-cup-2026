import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  primary:   "btn btn-primary",
  secondary: "btn btn-ghost",
  success:   "btn btn-success btn-outline",
  danger:    "btn btn-error btn-outline",
  ghost:     "btn btn-ghost",
};

const sizes: Record<string, string> = {
  sm: "btn-sm text-xs",
  md: "",
  lg: "btn-lg",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export function Button({ variant = "secondary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(variants[variant], sizes[size], "gap-1.5", className)} {...props}>
      {children}
    </button>
  );
}
