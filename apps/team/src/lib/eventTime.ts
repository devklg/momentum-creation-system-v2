/** Event Center instant formatting. Storage stays UTC; display follows the BA. */
export function formatEventDate(
  iso: string,
  options: { timeZone?: string; locale?: string } = {},
): { day: string; time: string } {
  const date = new Date(iso);
  const zone = options.timeZone ? { timeZone: options.timeZone } : {};
  return {
    day: date.toLocaleDateString(options.locale, {
      ...zone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    time: date.toLocaleTimeString(options.locale, {
      ...zone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
  };
}
