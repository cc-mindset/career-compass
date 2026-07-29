import React from 'react';
import { Card } from '@ui-kit';

const TypographyPage: React.FC = () => {
  const textSizes = [
    { name: 'Extra Small', class: 'text-[9px]', example: '9px - Labels, badges' },
    { name: 'Extra Small', class: 'text-[10px]', example: '10px - Small labels' },
    { name: 'Extra Small', class: 'text-[11px]', example: '11px - Small text' },
    { name: 'Small', class: 'text-xs', example: '12px - Body small' },
    { name: 'Base', class: 'text-sm', example: '14px - Body text' },
    { name: 'Base', class: 'text-base', example: '16px - Default body' },
    { name: 'Large', class: 'text-lg', example: '18px - Large body' },
    { name: 'XL', class: 'text-xl', example: '20px - Headings' },
    { name: '2XL', class: 'text-2xl', example: '24px - Large headings' },
    { name: '3XL', class: 'text-3xl', example: '30px - Section titles' },
    { name: '4XL', class: 'text-4xl', example: '36px - Page titles' },
  ];

  const fontWeights = [
    { name: 'Normal', class: 'font-normal', weight: 400 },
    { name: 'Medium', class: 'font-medium', weight: 500 },
    { name: 'Semibold', class: 'font-semibold', weight: 600 },
    { name: 'Bold', class: 'font-bold', weight: 700 },
    { name: 'Extrabold', class: 'font-extrabold', weight: 800 },
  ];

  const textStyles = [
    {
      name: 'Heading 1',
      classes: 'text-4xl font-extrabold text-slate-900',
      example: 'CareerCompass Design System',
    },
    {
      name: 'Heading 2',
      classes: 'text-3xl font-extrabold text-slate-900',
      example: 'Component Library',
    },
    {
      name: 'Heading 3',
      classes: 'text-2xl font-bold text-slate-900',
      example: 'Section Title',
    },
    {
      name: 'Heading 4',
      classes: 'text-xl font-bold text-slate-900',
      example: 'Subsection Title',
    },
    {
      name: 'Body Large',
      classes: 'text-lg text-slate-700',
      example: 'This is large body text used for important content and descriptions.',
    },
    {
      name: 'Body',
      classes: 'text-base text-slate-600',
      example: 'This is standard body text used throughout the application for regular content.',
    },
    {
      name: 'Body Small',
      classes: 'text-sm text-slate-500',
      example: 'This is small body text for secondary information and captions.',
    },
    {
      name: 'Label',
      classes: 'text-xs font-bold uppercase tracking-widest text-slate-400',
      example: 'LABEL TEXT',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold mb-2 text-slate-900">Typography</h1>
        <p className="text-slate-600">
          Text styles, sizes, weights, and typography tokens used in the design system.
        </p>
      </div>

      {/* Text Styles */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Text Styles</h2>
        <div className="space-y-4">
          {textStyles.map((style) => (
            <Card key={style.name} className="p-6" padding="md">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-500 mb-1">{style.name}</h3>
                  <p className="text-xs font-mono text-slate-400">{style.classes}</p>
                </div>
              </div>
              <p className={style.classes}>{style.example}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Font Sizes */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Font Sizes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {textSizes.map((size) => (
            <Card key={size.class} className="p-4" padding="sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900">{size.name}</span>
                <span className="text-xs font-mono text-slate-500">{size.class}</span>
              </div>
              <p className={`${size.class} text-slate-900 mb-1`}>
                The quick brown fox jumps over the lazy dog
              </p>
              <p className="text-xs text-slate-500">{size.example}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Font Weights */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Font Weights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fontWeights.map((weight) => (
            <Card key={weight.class} className="p-4" padding="sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900">{weight.name}</span>
                <span className="text-xs font-mono text-slate-500">
                  {weight.class} ({weight.weight})
                </span>
              </div>
              <p className={`text-lg ${weight.class} text-slate-900`}>
                The quick brown fox
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TypographyPage;
