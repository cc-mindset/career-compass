import React from 'react';
import { FeatureCard, NewsCard, TrendCard, UnderConstruction } from '@ui-kit';
import { Rocket, AlertTriangle, Shield, Zap, Lightbulb, Target } from 'lucide-react';

const OrganismsPage: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold mb-2 text-slate-900 dark:text-white">Organisms</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Complex components built from atoms and molecules for specific use cases.
        </p>
      </div>

      {/* FeatureCard */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">FeatureCard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Lightbulb />}
            category="Strategy"
            title="Career Growth Opportunities"
            description="Strategic insights for advancing your career path with actionable recommendations."
            actionLabel="Explore Implementation"
            onAction={() => alert('Action clicked')}
          />
          <FeatureCard
            icon={<Target />}
            category="Skills"
            title="Skill Gap Analysis"
            description="Identify areas for improvement and recommended learning paths."
            actionLabel="View Details"
            onAction={() => alert('Action clicked')}
          />
          <FeatureCard
            icon={<Zap />}
            category="Market"
            title="Market Trends"
            description="Stay informed about industry trends and demand signals."
          />
        </div>
      </section>

      {/* NewsCard */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">NewsCard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NewsCard
            image="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800"
            category="Technology"
            title="AI Revolution in Product Design"
            excerpt="How artificial intelligence is transforming the way we approach product design and user experience."
            author="Sarah Johnson"
            onClick={() => alert('News card clicked')}
          />
          <NewsCard
            image="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800"
            category="Career"
            title="Remote Work Trends 2025"
            excerpt="Exploring the latest trends in remote work and how they're shaping the future of employment."
            author="Michael Chen"
            onClick={() => alert('News card clicked')}
          />
          <NewsCard
            image="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800"
            category="Market"
            title="Tech Job Market Analysis"
            excerpt="A comprehensive analysis of the current tech job market and what to expect in the coming months."
            author="Emily Rodriguez"
            onClick={() => alert('News card clicked')}
          />
        </div>
      </section>

      {/* TrendCard */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">TrendCard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TrendCard
            icon={<Rocket />}
            title="High Growth Industries"
            excerpt="Industries experiencing rapid growth and high demand for skilled professionals. These sectors offer excellent career opportunities."
            author="CareerCompass AI"
            colorGradient="from-emerald-500 to-emerald-600"
            accentColor="emerald"
            onClick={() => alert('Trend card clicked')}
          />
          <TrendCard
            icon={<AlertTriangle />}
            title="At-Risk Roles"
            excerpt="Roles that may face challenges due to automation and market shifts. Consider upskilling or pivoting."
            author="CareerCompass AI"
            colorGradient="from-rose-500 to-rose-600"
            accentColor="rose"
            onClick={() => alert('Trend card clicked')}
          />
          <TrendCard
            icon={<Shield />}
            title="Market Risks"
            excerpt="Key risks and challenges in the current job market that professionals should be aware of."
            author="CareerCompass AI"
            colorGradient="from-amber-500 to-amber-600"
            accentColor="amber"
            onClick={() => alert('Trend card clicked')}
          />
          <TrendCard
            icon={<Zap />}
            title="Top Skills in Demand"
            excerpt="The most sought-after skills in today's job market. Focus on these to increase your marketability."
            author="CareerCompass AI"
            colorGradient="from-indigo-500 to-indigo-600"
            accentColor="indigo"
            onClick={() => alert('Trend card clicked')}
          />
        </div>
      </section>

      {/* UnderConstruction */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">UnderConstruction</h2>
        <div className="max-w-2xl">
          <UnderConstruction
            viewName="settings"
            onBack={() => alert('Back clicked')}
          />
        </div>
      </section>
    </div>
  );
};

export default OrganismsPage;
