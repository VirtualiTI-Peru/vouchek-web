'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

type UserMenuProps = {
  user?: {
    email?: string;
    user_metadata?: { full_name?: string };
  } | null;
  onProfileClick?: () => void;
};

export function UserMenu({ user, onProfileClick }: UserMenuProps) {
  const router = useRouter();
  const displayName = user?.user_metadata?.full_name || user?.email || 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    router.push('/sign-in');
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto px-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium capitalize hidden lg:inline max-w-[140px] truncate">
            {displayName}
          </span>
          <ChevronDown className="h-4 w-4 hidden lg:inline opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium truncate">{displayName}</span>
            {user?.email && (
              <span className="text-xs font-normal text-muted-foreground truncate">{user.email}</span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onProfileClick}>
          <User className="mr-2 h-4 w-4" />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleSignOut()} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
