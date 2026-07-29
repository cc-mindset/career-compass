# UI Design Library

The CareerCompass UI Design Library serves as a comprehensive documentation and showcase for all design system components, tokens, and patterns.

## Overview

This design library functions as our "Storybook" - a living style guide that displays:
- **Theme & Colors**: Complete color palette, gradients, and design tokens
- **Typography**: All text styles, sizes, weights, and typography tokens
- **Components**: All UI components organized by atomic design principles
  - **Atoms**: Basic building blocks (Card, Pill, Button, Input, MenuItem)
  - **Molecules**: Simple composite components (InsightsCard, PivotCard, StatCard)
  - **Organisms**: Complex components (NewsCard, TrendCard, UnderConstruction)

## Running the Design Library

### Development Mode

```bash
npm run dev
```

This will start the design library on `http://localhost:3001`

### Building

```bash
npm run build
```

The build output will be in `dist/`

## Structure

```
ui-design-library/
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx                # Main app component
│   └── pages/
│       ├── ThemePage.tsx      # Theme & colors showcase
│       ├── TypographyPage.tsx  # Typography showcase
│       ├── AtomsPage.tsx      # Atom components showcase
│       ├── MoleculesPage.tsx  # Molecule components showcase
│       └── OrganismsPage.tsx  # Organism components showcase
├── index.html
├── vite.config.ts
├── package.json
└── README.md
```

## Relationship with UI-Kit

The design library **uses** the `ui-kit` components directly from `../app/src/ui-kit`. This ensures:

1. **Single Source of Truth**: The ui-kit is the actual implementation used by the app
2. **Always in Sync**: The design library showcases the real components, not copies
3. **Live Documentation**: Any changes to ui-kit components are immediately reflected in the design library

The Vite config includes an alias `@ui-kit` that points to `../app/src/ui-kit`, allowing direct imports:

```tsx
import { Card, Button, Pill } from '@ui-kit';
```

## Features

- **Dark Mode Toggle**: Switch between light and dark themes
- **Interactive Examples**: All components are live and interactive
- **Code Examples**: See the actual component usage
- **Responsive Design**: Works on all screen sizes
- **Navigation**: Easy sidebar navigation between sections

## Adding New Components

When adding new components to the ui-kit:

1. Add the component to the appropriate folder in `app/src/ui-kit/` (`atom/`, `molecule/`, or `organism/`)
2. Export it from the respective `index.ts`
3. Add a showcase section in the corresponding page (`AtomsPage.tsx`, `MoleculesPage.tsx`, or `OrganismsPage.tsx`)
4. The component will automatically be available in both the app and design library

## Best Practices

- Always use components from `@ui-kit` in the design library (never create duplicates)
- Show all variants, sizes, and states of each component
- Include usage examples and prop descriptions
- Keep the design library updated when ui-kit changes
