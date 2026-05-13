import { cn } from "@/lib/utils";

type Variant = "default" | "strong" | "dark";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const variantClass: Record<Variant, string> = {
  default: "glass",
  strong: "glass-strong",
  dark: "glass-dark",
};

export function GlassCard({
  variant = "default",
  className,
  children,
  ...rest
}: GlassCardProps) {
  return (
    <div className={cn(variantClass[variant], className)} {...rest}>
      {children}
    </div>
  );
}
