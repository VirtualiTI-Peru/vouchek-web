import { createTheme, MantineThemeOverride } from '@mantine/core';

export const theme: MantineThemeOverride = createTheme({
  fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  primaryColor: 'blue',
  defaultRadius: 'md',
  colors: {
    blue: [
      '#e7f5ff',
      '#d0ebff',
      '#a5d8ff',
      '#74c0fc',
      '#4dabf7',
      '#339af0',
      '#228be6',
      '#1c7ed6',
      '#1971c2',
      '#1864ab',
    ],
    dark: [
      '#d5d7e0',
      '#acaebf',
      '#8c8fa3',
      '#666980',
      '#4d4f66',
      '#34354a',
      '#232339',
      '#18191A', // sidebar/table background
      '#101113',
      '#0c0d0e',
    ],
  },
  components: {
    Button: {
      defaultProps: {
        size: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'md',
      },
    },
    Select: {
      defaultProps: {
        size: 'md',
      },
    },
    Table: {
      defaultProps: {
        striped: true,
        withTableBorder: true,
        withColumnBorders: true,
      },
      styles: (
        theme: import('@mantine/core').MantineTheme,
        params: Record<string, any>,
        opts?: { colorScheme?: 'light' | 'dark' }
      ) => {
        const colorScheme = opts?.colorScheme ?? 'light';
        return {
          root: {
            backgroundColor: colorScheme === 'dark' ? '#18191A' : '#fff',
          },
          th: {
            backgroundColor: colorScheme === 'dark' ? '#23272b' : '#f8f9fa',
          },
          td: {
            backgroundColor: colorScheme === 'dark' ? '#18191A' : '#fff',
          },
        };
      },
    },
    // Example: Sidebar color override (if you have a Sidebar component)
    // Sidebar: {
    //   styles: (theme, params, { colorScheme }) => ({
    //     root: {
    //       backgroundColor: colorScheme === 'dark' ? '#18191A' : '#fff',
    //     },
    //   }),
    // },
  },
});