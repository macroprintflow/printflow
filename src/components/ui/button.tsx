
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 active:scale-[0.98] hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:transform-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary/30 backdrop-blur-lg text-primary-foreground hover:bg-primary/40 shadow-md shadow-black/10 [box-shadow:inset_0_0_0_1.5px_hsla(var(--primary-hsl)/0.4)]",
        destructive:
          "bg-destructive/30 backdrop-blur-lg text-destructive-foreground hover:bg-destructive/40 shadow-md shadow-black/10 [box-shadow:inset_0_0_0_1.5px_hsla(var(--destructive-hsl)/0.4)]",
        outline:
          "bg-foreground/5 backdrop-blur-lg text-foreground hover:bg-foreground/10 shadow-sm shadow-black/5 [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.12)] border border-white/10",
        secondary:
          "bg-secondary/30 backdrop-blur-lg text-secondary-foreground hover:bg-secondary/40 shadow-md shadow-black/10 [box-shadow:inset_0_0_0_1.5px_hsla(var(--secondary-hsl)/0.4)]",
        ghost:
          "hover:bg-accent/20 hover:text-accent-foreground shadow-none active:bg-accent/30 backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-md px-4",
        lg: "h-14 rounded-lg px-8",
        icon: "h-12 w-12",
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
