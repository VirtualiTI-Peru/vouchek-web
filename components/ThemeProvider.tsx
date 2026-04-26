"use client";

import { MantineProvider } from "@mantine/core";
import { theme } from "../lib/theme";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      {children}
    </MantineProvider>
  );
}
