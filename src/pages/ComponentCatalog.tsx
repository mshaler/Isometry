/**
 * ComponentCatalog - Documentation page for shadcn/ui components
 *
 * Showcases all shadcn/ui components with NeXTSTEP theme applied.
 * Each component includes:
 * - Visual example (rendered component)
 * - Code snippet (copy-pasteable usage)
 * - Props documentation
 *
 * Accessible via /components route in dev mode.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';

export function ComponentCatalog() {
  const [sliderValue, setSliderValue] = useState([50]);
  const [togglePressed, setTogglePressed] = useState(false);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header */}
        <header className="border-b border-border pb-6">
          <h1 className="text-3xl font-bold font-mono">shadcn/ui Component Catalog</h1>
          <p className="mt-2 text-muted-foreground">
            NeXTSTEP-themed components for Isometry's Interface Builder-inspired control plane
          </p>
        </header>

        {/* Button Component */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-mono">Button</h2>
            <p className="text-sm text-muted-foreground">
              Square corners, 3D bevel effect, blue focus ring
            </p>
          </div>

          <div className="space-y-6 rounded border border-border bg-secondary p-6">
            {/* Variants */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold font-mono">Variants</h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>

            {/* Sizes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold font-mono">Sizes</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">⚙</Button>
              </div>
            </div>

            {/* Code Example */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold font-mono">Usage</h3>
              <pre className="rounded bg-background p-3 text-xs font-mono overflow-x-auto">
{`<Button variant="default" size="default">
  Click me
</Button>`}
              </pre>
            </div>
          </div>
        </section>

        {/* Select Component */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-mono">Select</h2>
            <p className="text-sm text-muted-foreground">
              Dropdown with triangle chevron, flat menu, blue selected items
            </p>
          </div>

          <div className="space-y-6 rounded border border-border bg-secondary p-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold font-mono">Example</h3>
              <Select>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid View</SelectItem>
                  <SelectItem value="list">List View</SelectItem>
                  <SelectItem value="kanban">Kanban View</SelectItem>
                  <SelectItem value="timeline">Timeline View</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold font-mono">Usage</h3>
              <pre className="rounded bg-background p-3 text-xs font-mono overflow-x-auto">
{`<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>`}
              </pre>
            </div>
          </div>
        </section>

        {/* Slider Component */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-mono">Slider</h2>
            <p className="text-sm text-muted-foreground">
              Square thumb, flat track with border, blue filled portion
            </p>
          </div>

          <div className="space-y-6 rounded border border-border bg-secondary p-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold font-mono">Example</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono">Zoom Level</span>
                  <span className="font-mono text-muted-foreground">{sliderValue[0]}%</span>
                </div>
                <Slider
                  value={sliderValue}
                  onValueChange={setSliderValue}
                  min={0}
                  max={200}
                  step={10}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold font-mono">Usage</h3>
              <pre className="rounded bg-background p-3 text-xs font-mono overflow-x-auto">
{`const [value, setValue] = useState([50])

<Slider
  value={value}
  onValueChange={setValue}
  min={0}
  max={100}
  step={1}
/>`}
              </pre>
            </div>
          </div>
        </section>

        {/* Toggle Component */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-mono">Toggle</h2>
            <p className="text-sm text-muted-foreground">
              Binary state switch with crisp on/off states
            </p>
          </div>

          <div className="space-y-6 rounded border border-border bg-secondary p-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold font-mono">Example</h3>
              <div className="flex items-center gap-4">
                <Toggle pressed={togglePressed} onPressedChange={setTogglePressed}>
                  {togglePressed ? 'On' : 'Off'}
                </Toggle>
                <span className="text-sm font-mono text-muted-foreground">
                  State: {togglePressed ? 'Pressed' : 'Unpressed'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold font-mono">Usage</h3>
              <pre className="rounded bg-background p-3 text-xs font-mono overflow-x-auto">
{`const [pressed, setPressed] = useState(false)

<Toggle pressed={pressed} onPressedChange={setPressed}>
  Toggle
</Toggle>`}
              </pre>
            </div>
          </div>
        </section>

        {/* Separator Component */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-mono">Separator</h2>
            <p className="text-sm text-muted-foreground">
              Visual divider between sections
            </p>
          </div>

          <div className="space-y-6 rounded border border-border bg-secondary p-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold font-mono">Example</h3>
              <div className="space-y-3">
                <div>Section 1</div>
                <Separator />
                <div>Section 2</div>
                <Separator />
                <div>Section 3</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold font-mono">Usage</h3>
              <pre className="rounded bg-background p-3 text-xs font-mono overflow-x-auto">
{`<Separator />
<Separator orientation="vertical" />`}
              </pre>
            </div>
          </div>
        </section>

        {/* Theme Variables */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold font-mono">NeXTSTEP Theme Variables</h2>
            <p className="text-sm text-muted-foreground">
              CSS variables used throughout the component library
            </p>
          </div>

          <div className="space-y-4 rounded border border-border bg-secondary p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold font-mono">Colors</h3>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border border-border bg-background" />
                    <span>--background: #ebebeb</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border border-border bg-foreground" />
                    <span>--foreground: #000000</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border border-border bg-primary" />
                    <span>--primary: #0055ff</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border border-border bg-border" />
                    <span>--border: #8a8a8a</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold font-mono">Effects</h3>
                <div className="space-y-1 text-xs font-mono">
                  <div>--radius: 0 (square)</div>
                  <div>--shadow-raised: 3D bevel</div>
                  <div>--shadow-sunken: inverted</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>
            Components from{' '}
            <a href="https://ui.shadcn.com" className="text-primary underline">
              shadcn/ui
            </a>
            , customized with NeXTSTEP aesthetic
          </p>
        </footer>
      </div>
    </div>
  );
}

export default ComponentCatalog;
