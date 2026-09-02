export const COIN_TO_PHP_RATE = 0.01;

export const formatCoins = (value: number | string) =>
  `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} coins`;

export const formatPesoFromCoins = (value: number | string) =>
  `₱${(Number(value || 0) * COIN_TO_PHP_RATE).toFixed(2)}`;
