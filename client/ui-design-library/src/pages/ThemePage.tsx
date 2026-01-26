import React from 'react';
import { Card } from '@ui-kit';

const ThemePage: React.FC = () => {
  const colorPalette = {
    indigo: {
      50: '#eef2ff',
      100: '#e0e7ff',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      950: '#1e1b4b',
    },
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    emerald: {
      50: '#ecfdf5',
      500: '#10b981',
      600: '#059669',
      950: '#022c22',
    },
    rose: {
      50: '#fff1f2',
      500: '#f43f5e',
      600: '#e11d48',
      950: '#4c1d24',
    },
    amber: {
      50: '#fffbeb',
      500: '#f59e0b',
      600: '#d97706',
      950: '#451a03',
    },
  };

  const gradients = [
    { name: 'Indigo Gradient', classes: 'bg-gradient-to-br from-indigo-500 via-indigo-700 to-slate-900' },
    { name: 'Emerald Gradient', classes: 'bg-gradient-to-r from-emerald-500 to-emerald-600' },
    { name: 'Rose Gradient', classes: 'bg-gradient-to-r from-rose-500 to-rose-600' },
    { name: 'Amber Gradient', classes: 'bg-gradient-to-r from-amber-500 to-amber-600' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold mb-2 text-slate-900 dark:text-white">Theme & Colors</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Our color system and design tokens used throughout the application.
        </p>
      </div>

      {/* Primary Colors */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Primary Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(colorPalette.indigo).map(([shade, color]) => (
            <Card key={shade} className="p-4" padding="sm">
              <div
                className="w-full h-24 rounded-xl mb-3"
                style={{ backgroundColor: color }}
              />
              <div className="text-sm">
                <p className="font-bold text-slate-900 dark:text-white">Indigo {shade}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-mono">{color}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Neutral Colors */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Neutral Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(colorPalette.slate).map(([shade, color]) => (
            <Card key={shade} className="p-4" padding="sm">
              <div
                className="w-full h-24 rounded-xl mb-3 border border-slate-200 dark:border-slate-700"
                style={{ backgroundColor: color }}
              />
              <div className="text-sm">
                <p className="font-bold text-slate-900 dark:text-white">Slate {shade}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-mono">{color}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Semantic Colors */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Semantic Colors</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['emerald', 'rose', 'amber'].map((colorName) => {
            const colors = colorPalette[colorName as keyof typeof colorPalette];
            return (
              <Card key={colorName} className="p-6" padding="md">
                <h3 className="text-lg font-bold mb-4 capitalize text-slate-900 dark:text-white">{colorName}</h3>
                <div className="space-y-3">
                  {Object.entries(colors).map(([shade, color]) => (
                    <div key={shade} className="flex items-center gap-3">
                      <div
                        className="w-16 h-16 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white capitalize">
                          {colorName} {shade}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-mono">{color}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Gradients */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Gradients</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gradients.map((gradient) => (
            <Card key={gradient.name} className="p-6" padding="md">
              <h3 className="text-lg font-bold mb-3 text-slate-900 dark:text-white">{gradient.name}</h3>
              <div className={`w-full h-32 rounded-xl ${gradient.classes}`} />
              <p className="mt-3 text-xs font-mono text-slate-500 dark:text-slate-400">{gradient.classes}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ThemePage;
