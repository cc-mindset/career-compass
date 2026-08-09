import { describe, expect, it } from 'vitest';
import {
  assertUsablePosting,
  validateJobAnalysisResult,
} from './jobAnalyzerService.js';

describe('assertUsablePosting', () => {
  it('rejects empty or missing posting', () => {
    expect(() => assertUsablePosting('')).toThrow(/too short|required/i);
    expect(() => assertUsablePosting('short')).toThrow(/too short/i);
    expect(() => assertUsablePosting(null)).toThrow(/required/i);
  });

  it('accepts a complete posting', () => {
    const text =
      'Senior Product Manager — Own roadmap, align teams, deliver measurable outcomes in a regulated environment.';
    expect(assertUsablePosting(text)).toBe(text);
  });
});

describe('validateJobAnalysisResult', () => {
  it('normalizes stated vs hidden with evidence and confidence', () => {
    const result = validateJobAnalysisResult({
      roleFocus: 'Reliable delivery',
      roleFocusSummary: 'Ownership and cadence dominate the posting.',
      statedRequirements: [
        {
          category: 'required',
          title: 'Roadmap ownership',
          summary: 'Own the product roadmap.',
          evidence: [{ quote: 'own product strategy and roadmap' }],
        },
      ],
      hiddenExpectations: [
        {
          title: 'Stabilize delivery',
          summary: 'Cadence language implies stabilization.',
          implication: 'Show an example of restoring momentum.',
          confidence: 'high',
          evidence: [{ quote: 'cross-functional delivery' }],
        },
      ],
      questionsWorthAsking: ['Where does delivery lose momentum?'],
    });

    expect(result.statedRequirements).toHaveLength(1);
    expect(result.statedRequirements[0].category).toBe('required');
    expect(result.hiddenExpectations).toHaveLength(1);
    expect(result.hiddenExpectations[0].confidence).toBe('high');
    expect(result.hiddenExpectations[0].evidence[0].quote).toContain(
      'cross-functional',
    );
  });

  it('drops hidden expectations without evidence', () => {
    const result = validateJobAnalysisResult({
      role_focus: 'Focus',
      role_focus_summary: 'Summary',
      stated_requirements: [
        {
          title: 'Strategy',
          summary: 'Lead strategy',
          category: 'required',
          evidence: ['strategy'],
        },
      ],
      hidden_expectations: [
        {
          title: 'No evidence',
          summary: 'Should be dropped',
          confidence: 'low',
          evidence: [],
        },
        {
          title: 'With evidence',
          summary: 'Kept',
          confidence: 'medium',
          evidence: ['alignment'],
        },
      ],
    });

    expect(result.hiddenExpectations).toHaveLength(1);
    expect(result.hiddenExpectations[0].title).toBe('With evidence');
  });

  it('rejects empty analysis inventing nothing usable', () => {
    expect(() =>
      validateJobAnalysisResult({
        roleFocus: 'x',
        statedRequirements: [],
        hiddenExpectations: [],
      }),
    ).toThrow(/no stated requirements/i);
  });
});
