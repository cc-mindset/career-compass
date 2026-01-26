import React from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'indigo' | 'slate' | 'white';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  rounded?: 'md' | 'lg' | 'xl' | '2xl';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = '',
  icon,
  iconPosition = 'right',
  fullWidth = false,
  rounded = 'xl',
}) => {
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-slate-900 text-white hover:bg-slate-800',
    ghost: 'bg-transparent text-indigo-600 hover:bg-indigo-50',
    outline: 'border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
    slate: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700',
    white: 'bg-white text-indigo-600 hover:bg-indigo-50',
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  const roundedClasses = {
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-[2rem]',
    '2xl': 'rounded-[2.5rem]',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${roundedClasses[rounded]}
        ${fullWidth ? 'w-full' : ''}
        font-bold
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        touch-manipulation
        flex items-center justify-center gap-2
        ${className}
      `}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  );
};

export default Button;
