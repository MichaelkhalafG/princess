import { Crown } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Footer line (e.g. the link to the other auth page). */
  footer: ReactNode;
}

/**
 * Centered auth shell card (COMPONENT_TREE §1, reference: Notion auth — §9).
 * Brand mark + title/subtitle header, form body, footer link. Server component.
 */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <Card className="shadow-raised">
      <CardHeader className="items-center text-center">
        <span
          className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary shadow-soft"
          aria-hidden
        >
          <Crown className="h-7 w-7" />
        </span>
        <CardTitle className="font-serif text-h3">{title}</CardTitle>
        <CardDescription className="text-body-sm">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {children}
        <p className="text-center text-body-sm text-muted-foreground">{footer}</p>
      </CardContent>
    </Card>
  );
}
