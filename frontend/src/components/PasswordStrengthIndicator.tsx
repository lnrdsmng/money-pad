import React from 'react';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score < 3 || password.length < 8) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' };
    if (score < 5) return { label: 'Moderate', color: 'bg-yellow-500', width: 'w-2/3' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  };

  if (!password) return null;

  const { label, color, width } = getStrength();

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
