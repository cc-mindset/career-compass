import React, { useState } from 'react';
import { Card, Pill, Button, Input, MenuItem } from '@ui-kit';
import { Home, Settings, User, Bell, ArrowRight } from 'lucide-react';

const AtomsPage: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [rangeValue, setRangeValue] = useState(50);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold mb-2 text-slate-900">Atoms</h1>
        <p className="text-slate-600">
          Basic building blocks that cannot be broken down further.
        </p>
      </div>

      {/* Card */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Card</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="sm" rounded="xl" border>
            <p className="text-sm text-slate-600">Small padding, xl rounded</p>
          </Card>
          <Card padding="md" rounded="2xl" border hover>
            <p className="text-sm text-slate-600">Medium padding, 2xl rounded, hover</p>
          </Card>
          <Card padding="lg" rounded="3xl" border shadow>
            <p className="text-sm text-slate-600">Large padding, 3xl rounded, shadow</p>
          </Card>
        </div>
      </section>

      {/* Pill */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Pill / Badge</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-3 text-slate-900">Variants</h3>
            <div className="flex flex-wrap gap-3">
              <Pill variant="default">Default</Pill>
              <Pill variant="success">Success</Pill>
              <Pill variant="warning">Warning</Pill>
              <Pill variant="error">Error</Pill>
              <Pill variant="info">Info</Pill>
              <Pill variant="indigo">Indigo</Pill>
              <Pill variant="emerald">Emerald</Pill>
              <Pill variant="rose">Rose</Pill>
              <Pill variant="amber">Amber</Pill>
              <Pill variant="slate">Slate</Pill>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3 text-slate-900">Sizes</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Pill variant="indigo" size="xs">Extra Small</Pill>
              <Pill variant="indigo" size="sm">Small</Pill>
              <Pill variant="indigo" size="md">Medium</Pill>
            </div>
          </div>
        </div>
      </section>

      {/* Button */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Button</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-3 text-slate-900">Variants</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="indigo">Indigo</Button>
              <Button variant="slate">Slate</Button>
              <Button variant="white">White</Button>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3 text-slate-900">Sizes</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="lg">Large</Button>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3 text-slate-900">With Icons</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" icon={<ArrowRight />} iconPosition="right">
                Next
              </Button>
              <Button variant="secondary" icon={<ArrowRight />} iconPosition="left">
                Previous
              </Button>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3 text-slate-900">States</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Normal</Button>
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="primary" fullWidth>Full Width</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Input */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Input</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-3 text-slate-900">Text Input</h3>
            <div className="max-w-md space-y-3">
              <Input
                type="text"
                placeholder="Enter text..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <Input
                type="email"
                placeholder="Enter email..."
              />
              <Input
                type="password"
                placeholder="Enter password..."
              />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3 text-slate-900">Range Slider</h3>
            <div className="max-w-md">
              <Input
                type="range"
                min={0}
                max={100}
                value={rangeValue}
                onChange={(e) => setRangeValue(parseInt(e.target.value))}
              />
              <p className="text-sm text-slate-600 mt-2">Value: {rangeValue}</p>
            </div>
          </div>
        </div>
      </section>

      {/* MenuItem */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">MenuItem</h2>
        <div className="max-w-md space-y-2">
          <MenuItem
            icon={<Home />}
            label="Home"
            active={true}
            showIndicator
          />
          <MenuItem
            icon={<Settings />}
            label="Settings"
            active={false}
          />
          <MenuItem
            icon={<User />}
            label="Profile"
            active={false}
          />
          <MenuItem
            icon={<Bell />}
            label="Notifications"
            active={false}
            badge={<Pill variant="rose" size="xs">3</Pill>}
          />
        </div>
      </section>
    </div>
  );
};

export default AtomsPage;
