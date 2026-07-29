import React, { useMemo, useState } from 'react';
import { SKILL_OPTIONS } from '../consts';
import { useClarity } from '../state/contexts/ClarityContext';

interface SkillMatch {
  value: string;
  isNew: boolean;
}

interface SkillPickerProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

const sameSkill = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

/** Autocomplete used by both the guest Career Pivot form and the new-account pivot step. */
export const SkillPicker: React.FC<SkillPickerProps> = ({ skills, onChange }) => {
  const { toast } = useClarity();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = useMemo<SkillMatch[]>(() => {
    const q = query.trim().toLowerCase();
    const available = SKILL_OPTIONS.filter(
      (option) =>
        !skills.some((skill) => sameSkill(skill, option)) &&
        (!q || option.toLowerCase().includes(q)),
    ).map<SkillMatch>((value) => ({ value, isNew: false }));

    const exact =
      SKILL_OPTIONS.some((option) => option.toLowerCase() === q) ||
      skills.some((skill) => skill.toLowerCase() === q);

    if (q && !exact) {
      return [...available, { value: query.trim(), isNew: true }];
    }
    return available;
  }, [query, skills]);

  const chooseSkill = (skill: string) => {
    const value = skill.trim();
    if (!value) return;
    const known = SKILL_OPTIONS.find((option) => sameSkill(option, value));
    const saved = known ?? value;
    if (skills.some((existing) => sameSkill(existing, saved))) return;
    onChange([...skills, saved]);
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => toast('Skill saved'), 20);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!matches.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((prev) => (prev + step + matches.length) % matches.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const match = matches[Math.min(activeIndex, matches.length - 1)];
      if (match) chooseSkill(match.value);
    }
  };

  const showMenu = open;

  return (
    <div className="field">
      <label>
        Skills you want to transfer <small>Select at least 3</small>
      </label>
      <div className="skillEntry">
        <input
          id="pivot-skill-input"
          className="input"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="skill-menu"
          aria-expanded={showMenu}
          autoComplete="off"
          placeholder="Start typing or view all skills"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <div
          id="skill-menu"
          className={`skillMenu${showMenu ? '' : ' hidden'}`}
          role="listbox"
        >
          {matches.length ? (
            matches.map((match, index) => (
              <button
                key={match.isNew ? `__new__${match.value}` : match.value}
                type="button"
                className={`skillOption${match.isNew ? ' addNew' : ''}${
                  index === activeIndex ? ' active' : ''
                }`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSkill(match.value)}
              >
                {match.isNew ? `Add “${match.value}” as a new skill` : match.value}
              </button>
            ))
          ) : (
            <div className="skillOption">No more matching skills</div>
          )}
        </div>
      </div>
      <div className="chips" style={{ marginTop: 10 }}>
        {skills.map((skill) => (
          <button
            key={skill}
            type="button"
            className="chip selected"
            onClick={() => onChange(skills.filter((existing) => existing !== skill))}
          >
            {skill} ×
          </button>
        ))}
      </div>
    </div>
  );
};
