import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // NeXTSTEP aesthetic: square corners, 3D bevel, blue focus ring
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-mono",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-border [box-shadow:var(--shadow-raised)] active:bg-primary/90 active:[box-shadow:var(--shadow-sunken)]",
        destructive:
          "bg-destructive text-destructive-foreground border border-border [box-shadow:var(--shadow-raised)] active:bg-destructive/90 active:[box-shadow:var(--shadow-sunken)]",
        outline:
          "border border-border bg-secondary [box-shadow:var(--shadow-raised)] hover:bg-muted active:[box-shadow:var(--shadow-sunken)]",
        secondary:
          "bg-secondary text-secondary-foreground border border-border [box-shadow:var(--shadow-raised)] active:[box-shadow:var(--shadow-sunken)]",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
