"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    {/* NeXTSTEP aesthetic: flat gray track with darker border */}
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden border border-border bg-muted">
      {/* Filled portion: blue (primary) */}
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    {/* NeXTSTEP aesthetic: square thumb (not rounded) with 3D bevel */}
    <SliderPrimitive.Thumb className="block h-4 w-4 border border-border bg-secondary [box-shadow:var(--shadow-raised)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:[box-shadow:var(--shadow-sunken)] disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
