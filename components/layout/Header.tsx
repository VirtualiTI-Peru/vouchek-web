'use client';

import { Group, Text, Menu, Avatar, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconLogout, IconUser } from '@tabler/icons-react';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';

interface HeaderProps {
  user?: {
    email?: string;
    user_metadata?: {
      full_name?: string;
    };
  } | null;
  onSignOut?: () => void;
}

export function Header({ user, onSignOut }: HeaderProps) {
  const displayName = user?.user_metadata?.full_name || user?.email || 'User';

  return (
    <Group justify="space-between" h="100%" px="md">
      <Text size="lg" fw={600}>
        VouChek
      </Text>

      <Group>
        <ThemeSwitcher />

        <Menu shadow="md" width={200}>
          <Menu.Target>
            <UnstyledButton>
              <Group gap="xs">
                <Avatar size="sm" radius="xl">
                  {displayName.charAt(0).toUpperCase()}
                </Avatar>
                <Text size="sm" fw={500}>
                  {displayName}
                </Text>
                <IconChevronDown size={16} />
              </Group>
            </UnstyledButton>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item leftSection={<IconUser size={16} />}>
              Profile
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconLogout size={16} />}
              onClick={onSignOut}
              color="red"
            >
              Sign Out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}