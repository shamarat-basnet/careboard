import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'teal',
  primaryShade: { light: 7, dark: 5 },
  defaultRadius: 'md',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    fontWeight: '650',
    sizes: {
      h1: { fontSize: '1.625rem', lineHeight: '1.25' },
      h2: { fontSize: '1.25rem', lineHeight: '1.3' },
      h3: { fontSize: '1.0625rem', lineHeight: '1.35' },
      h4: { fontSize: '1rem', lineHeight: '1.4' },
    },
  },
  components: {
    Card: { defaultProps: { withBorder: true, padding: 'lg', radius: 'md' } },
    Paper: { defaultProps: { withBorder: true } },
    // Comfortable touch targets (>= 34px) for the controls people tap most.
    ActionIcon: { defaultProps: { size: 'lg' } },
    Pagination: { defaultProps: { size: 'md' } },
    Chip: { defaultProps: { size: 'md' } },
  },
});
