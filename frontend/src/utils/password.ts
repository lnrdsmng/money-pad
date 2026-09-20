export const passwordRequirements = {
  minimumLength: 8,
  hasUppercase: (password: string) => /[A-Z]/.test(password),
  hasLowercase: (password: string) => /[a-z]/.test(password),
  hasNumber: (password: string) => /[0-9]/.test(password),
};

export function isValidPassword(password: string) {
  return password.length >= passwordRequirements.minimumLength
    && passwordRequirements.hasUppercase(password)
    && passwordRequirements.hasLowercase(password)
    && passwordRequirements.hasNumber(password);
}

export function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return score < 3 || !isValidPassword(password) ? 'Weak' : score < 5 ? 'Moderate' : 'Strong';
}
