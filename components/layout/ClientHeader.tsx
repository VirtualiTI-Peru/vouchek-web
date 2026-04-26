'use client';

import { Header } from '../layout/Header';

interface ClientHeaderProps {
  user: any;
}

export function ClientHeader({ user }: ClientHeaderProps) {
  return <Header user={user} />;
}