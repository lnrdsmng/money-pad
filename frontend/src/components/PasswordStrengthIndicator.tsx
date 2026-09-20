import React from 'react';
import { getPasswordStrength } from '../utils/password';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  if (!password) return null;

  const label = getPasswordStrength(password);
  const { color, width } = label === 'Weak'
    ? { color: 'bg-red-500', width: 'w-1/3' }
    : label === 'Moderate'
      ? { color: 'bg-yellow-500', width: 'w-2/3' }
      : { color: 'bg-green-500', width: 'w-full' };

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Password Strength</span>
        <span className={`text-xs font-bold ${color.replace('bg-', 'text-')}`}>{label}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
        <div className={`${color} ${width} h-1.5 rounded-full transition-all duration-300`}></div>
      </div>
      {label === 'Weak' && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Must be at least 8 characters with uppercase, lowercase, and numbers.
        </p>
      )}
    </div>
  );
};
