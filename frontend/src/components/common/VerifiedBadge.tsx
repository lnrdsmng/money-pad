import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface VerifiedBadgeProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  className = '',
  size = 15,
  showText = false,
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 text-blue-500 align-middle ${className}`}
      title="Verified Author"
    >
      <CheckCircle2 size={size} className="fill-blue-500 text-white shrink-0" />
      {showText && <span className="text-xs font-medium text-blue-600">Verified</span>}
    </span>
  );
};

export default VerifiedBadge;
