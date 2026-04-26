'use client';

import { ActionIcon, useMantineColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

export function ThemeSwitcher() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <ActionIcon
      variant="default"
      onClick={toggleColorScheme}
      size="lg"
      aria-label="Toggle color scheme"
    >
      {colorScheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
    </ActionIcon>
  );
}