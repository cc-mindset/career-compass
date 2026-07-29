import React from 'react';
import { InsightsCard, PivotCard, StatCard } from '@ui-kit';
import { Newspaper, GraduationCap, MapPin, Lightbulb } from 'lucide-react';

const MoleculesPage: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold mb-2 text-slate-900">Molecules</h1>
        <p className="text-slate-600">
          Components built from atoms that form simple, reusable UI elements.
        </p>
      </div>

      {/* InsightsCard */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">InsightsCard</h2>
        <div className="space-y-4">
          <InsightsCard
            text="While expanding, the sector is highly competitive and subject to rapid technological changes. The demand for continuous learning and adaptation is high."
          />
          <InsightsCard
            text="San Francisco's tech-driven market remains more resilient compared to national averages, which are experiencing broader contractions in various sectors."
            compact
          />
          <InsightsCard
            text="Understanding these regional differences helps you position yourself strategically. Your city may have different opportunities, compensation levels, and work arrangements than the broader region."
            forceBaseSize
          />
        </div>
      </section>

      {/* PivotCard */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">PivotCard</h2>
        <div className="space-y-4">
          <PivotCard
            text="Aim for AI engineering, infra/platform, security engineering, or product management roles that leverage your data science background while moving into higher-impact, strategic positions."
          />
          <PivotCard
            text="Consider transitioning to roles that combine technical depth with business strategy, such as technical product management or AI product design."
            compact
          />
          <PivotCard
            text="Focus on building skills in systems thinking, cross-functional collaboration, and strategic product development to make this pivot successfully."
            forceBaseSize
          />
        </div>
      </section>

      {/* StatCard */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">StatCard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Newspaper />}
            count={24}
            label="New Articles"
            trend="+12%"
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={<GraduationCap />}
            count={16}
            label="Courses"
            trend="+8%"
            color="bg-purple-50 text-purple-600"
          />
          <StatCard
            icon={<Lightbulb />}
            count={8}
            label="Suggestions"
            trend="New"
            color="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={<MapPin />}
            count={3}
            label="Paths"
            status="Active"
            color="bg-emerald-50 text-emerald-600"
          />
        </div>
      </section>
    </div>
  );
};

export default MoleculesPage;
