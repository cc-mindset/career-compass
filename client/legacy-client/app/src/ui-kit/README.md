# UI Kit

This UI kit follows atomic design principles, organizing components into three levels: **atoms**, **molecules**, and **organisms**.

## Structure

```
ui-kit/
├── atom/          # Basic, reusable components
├── molecule/     # Components built from atoms
├── organism/     # Complex components built from atoms and molecules
└── index.ts      # Main export file
```

## Atoms

Basic building blocks that cannot be broken down further.

### Card
A flexible container component with customizable styling.

**Props:**
- `children`: React.ReactNode
- `className?: string`
- `onClick?: () => void`
- `hover?: boolean` - Enable hover effects
- `padding?: 'sm' | 'md' | 'lg'`
- `rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'`
- `border?: boolean`
- `shadow?: boolean`
- `dark?: boolean`

**Example:**
```tsx
import { Card } from '@/ui-kit';

<Card padding="lg" rounded="2xl" hover>
  Content here
</Card>
```

### Pill
Badge/pill component for status indicators and labels.

**Props:**
- `children`: React.ReactNode
- `variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate'`
- `size?: 'xs' | 'sm' | 'md'`
- `className?: string`
- `uppercase?: boolean`
- `border?: boolean`

**Example:**
```tsx
import { Pill } from '@/ui-kit';

<Pill variant="success" size="sm" uppercase>
  Active
</Pill>
```

### Button
Flexible button component with multiple variants.

**Props:**
- `children`: React.ReactNode
- `variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'indigo' | 'slate' | 'white'`
- `size?: 'sm' | 'md' | 'lg'`
- `onClick?: () => void`
- `disabled?: boolean`
- `className?: string`
- `icon?: React.ReactNode`
- `iconPosition?: 'left' | 'right'`
- `fullWidth?: boolean`
- `rounded?: 'md' | 'lg' | 'xl' | '2xl'`

**Example:**
```tsx
import { Button } from '@/ui-kit';
import { ArrowRight } from 'lucide-react';

<Button variant="primary" icon={<ArrowRight />} iconPosition="right">
  Click Me
</Button>
```

### Input
Text input and range slider component.

**Props:**
- `type?: 'text' | 'email' | 'password' | 'number' | 'range'`
- `value?: string | number`
- `onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void`
- `placeholder?: string`
- `className?: string`
- `disabled?: boolean`
- `autoFocus?: boolean`
- `min?: number`
- `max?: number`
- `step?: number`
- `onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void`
- `onClick?: (e: React.MouseEvent<HTMLInputElement>) => void`

**Example:**
```tsx
import { Input } from '@/ui-kit';

<Input
  type="text"
  placeholder="Enter text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### MenuItem
Navigation menu item component.

**Props:**
- `icon?: React.ReactNode`
- `label: string`
- `active?: boolean`
- `onClick?: () => void`
- `className?: string`
- `badge?: React.ReactNode`
- `showIndicator?: boolean`

**Example:**
```tsx
import { MenuItem } from '@/ui-kit';
import { Home } from 'lucide-react';

<MenuItem
  icon={<Home />}
  label="Home"
  active={currentView === 'home'}
  onClick={() => navigate('home')}
  showIndicator
/>
```

## Molecules

Components built from atoms that form simple, reusable UI elements.

### InsightsCard
Card component for displaying insights with icon, category, title, description, and action.

**Props:**
- `icon?: React.ReactNode`
- `category?: string`
- `title: string`
- `description: string`
- `actionLabel?: string`
- `onAction?: () => void`
- `className?: string`

**Example:**
```tsx
import { InsightsCard } from '@/ui-kit';
import { Lightbulb } from 'lucide-react';

<InsightsCard
  icon={<Lightbulb />}
  category="Strategy"
  title="Career Growth"
  description="Strategic insights for your career path"
  actionLabel="Learn More"
  onAction={() => handleAction()}
/>
```

### PivotCard
Card component for strategic pivot information with gradient background.

**Props:**
- `title?: string`
- `description: string`
- `tags?: string[]`
- `stats?: Array<{ label: string; value: string }>`
- `compact?: boolean`
- `className?: string`

**Example:**
```tsx
import { PivotCard } from '@/ui-kit';

<PivotCard
  title="Strategic Pivot Pillar"
  description="Based on your current role..."
  tags={['AI Workflow', 'Systems Thinking']}
  stats={[
    { label: 'Market Velocity', value: '+24% YoY' },
    { label: 'Resiliency Score', value: '8.4 / 10' }
  ]}
/>
```

## Organisms

Complex components built from atoms and molecules for specific use cases.

### NewsCard
Card component for displaying news articles with image, category, title, excerpt, and author.

**Props:**
- `image?: string`
- `category: string`
- `title: string`
- `excerpt: string`
- `author: string`
- `onClick?: () => void`
- `className?: string`

**Example:**
```tsx
import { NewsCard } from '@/ui-kit';

<NewsCard
  image="/path/to/image.jpg"
  category="Technology"
  title="Article Title"
  excerpt="Article excerpt text..."
  author="John Doe"
  onClick={() => handleClick()}
/>
```

### TrendCard
Card component for displaying trend reports with icon, gradient bar, title, excerpt, and author.

**Props:**
- `icon: React.ReactNode`
- `title: string`
- `excerpt: string`
- `author?: string`
- `colorGradient?: string` - Tailwind gradient classes (e.g., "from-emerald-500 to-emerald-600")
- `accentColor?: 'emerald' | 'rose' | 'amber' | 'indigo' | 'slate'`
- `onClick?: () => void`
- `className?: string`

**Example:**
```tsx
import { TrendCard } from '@/ui-kit';
import { Rocket } from 'lucide-react';

<TrendCard
  icon={<Rocket />}
  title="High Growth Trends"
  excerpt="Trend description..."
  author="CareerCompass AI"
  colorGradient="from-emerald-500 to-emerald-600"
  accentColor="emerald"
  onClick={() => handleClick()}
/>
```

## Usage

Import components from the main ui-kit index:

```tsx
import { Card, Pill, Button, InsightsCard, NewsCard } from '@/ui-kit';
```

Or import from specific folders:

```tsx
import { Card } from '@/ui-kit/atom';
import { InsightsCard } from '@/ui-kit/molecule';
import { NewsCard } from '@/ui-kit/organism';
```

## Design Principles

1. **Atomic Design**: Components are organized by complexity (atom → molecule → organism)
2. **Reusability**: All components are designed to be reusable across the application
3. **Consistency**: Components follow consistent styling patterns using Tailwind CSS
4. **Flexibility**: Components accept props for customization while maintaining defaults
5. **Dark Mode**: All components support dark mode via Tailwind's dark mode classes

## Extending the UI Kit

When adding new components:

1. **Atoms**: Basic, single-purpose components (e.g., Icon, Divider, Avatar)
2. **Molecules**: Combinations of atoms (e.g., SearchBar, FormField, StatCard)
3. **Organisms**: Complex, feature-specific components (e.g., Header, Sidebar, Dashboard)

Always:
- Export types/interfaces for props
- Include TypeScript types
- Support dark mode
- Make components responsive
- Add to appropriate index.ts file
