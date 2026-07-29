import React from 'react';

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'range';
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  min?: number;
  max?: number;
  step?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

const Input: React.FC<InputProps> = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false,
  autoFocus = false,
  min,
  max,
  step,
  onKeyDown,
  onClick,
}) => {
  const baseClasses = `
    w-full
    px-4 py-2
    bg-white
    border border-slate-200
    rounded-xl
    text-sm font-medium
    focus:outline-none
    focus:ring-4 focus:ring-indigo-500/5
    focus:border-indigo-500/30
    transition-all
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  if (type === 'range') {
    return (
      <input
        type="range"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`
          w-full h-2
          bg-slate-100
          rounded-lg
          appearance-none
          cursor-pointer
          accent-indigo-600
          ${className}
        `}
      />
    );
  }

  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      onClick={onClick}
      className={`${baseClasses} ${className}`}
    />
  );
};

export default Input;
