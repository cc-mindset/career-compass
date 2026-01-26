import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  border?: boolean;
  shadow?: boolean;
  dark?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hover = false,
  padding = 'md',
  rounded = 'xl',
  border = true,
  shadow = false,
  dark = false,
}) => {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const roundedClasses = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-[1.5rem]',
    '2xl': 'rounded-[2rem]',
    '3xl': 'rounded-[2.5rem]',
  };

  const baseClasses = `
    bg-white ${dark ? 'dark:bg-[#111]' : ''}
    ${border ? 'border border-slate-200 dark:border-slate-800' : ''}
    ${roundedClasses[rounded]}
    ${paddingClasses[padding]}
    ${shadow ? 'shadow-sm' : ''}
    ${hover ? 'hover:shadow-lg transition-all duration-300' : ''}
    ${onClick ? 'cursor-pointer' : ''}
  `;

  const Component = onClick ? 'div' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`${baseClasses} ${className}`}
    >
      {children}
    </Component>
  );
};

export default Card;
