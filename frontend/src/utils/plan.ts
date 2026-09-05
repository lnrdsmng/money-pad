export const formatPlanName = (plan?: string): string => {
  if (!plan) return '';
  return plan
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
