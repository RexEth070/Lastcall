import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-transform duration-100 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-4 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-[#1d4ed8] text-white hover:bg-[#1e40af]",
        secondary:
          "bg-white text-slate-900 border border-[#e4e1da] hover:bg-[#efece5]",
        dark:
          "bg-[#0b1220] text-white hover:bg-[#1b2842]",
        ghost:
          "bg-transparent text-slate-700 hover:bg-[#efece5] hover:text-slate-950",
        danger:
          "bg-[#b91c1c] text-white hover:bg-[#991b1b]",
      },
      size: {
        default: "min-h-[44px] px-4 py-2.5",
        sm: "min-h-[44px] px-3.5 py-2 text-xs",
        lg: "min-h-[48px] px-6 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
