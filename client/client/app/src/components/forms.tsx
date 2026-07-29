import React from 'react';
import { selectOptions } from '../consts';

interface FieldProps {
  label: React.ReactNode;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);

interface SelectFieldProps {
  label: React.ReactNode;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  extraOptions?: string[];
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  options,
  onChange,
  extraOptions = [],
}) => {
  const items = [...selectOptions(options, value), ...extraOptions.filter((x) => x !== value)];
  const unique = Array.from(new Set(items));
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {unique.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </Field>
  );
};
