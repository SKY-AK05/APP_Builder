import { Icons } from "@/components/icons";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-6">
      <div className="container flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Icons.logo className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            AI App Forge
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
