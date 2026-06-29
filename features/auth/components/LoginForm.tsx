"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { buildLoginSchema, type LoginInput } from "@/features/auth/schema";
import { localizeApiError, postJson } from "@/features/auth/client";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "@/i18n/navigation";

/**
 * Login form (COMPONENT_TREE §5; USER_FLOWS §1). On success, fetches the profile
 * and redirects to the role's dashboard. Reference: Linear forms (§9).
 */
export function LoginForm() {
  const tf = useTranslations("auth.fields");
  const tl = useTranslations("auth.login");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");
  const router = useRouter();
  const { toast } = useToast();

  const schema = useMemo(() => buildLoginSchema((key) => tv(key)), [tv]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const result = await postJson("/api/auth/login", values);
    if (!result.ok) {
      toast({ variant: "destructive", description: localizeApiError(te, result.error) });
      return;
    }

    // Role drives the redirect target — read it from the authoritative profile.
    const me = await postJson<{ profile: { role: string } }>("/api/auth/me", undefined, "GET");
    if (!me.ok) {
      toast({ variant: "destructive", description: te("generic") });
      return;
    }

    toast({ description: tl("success") });
    router.replace(`/dashboard/${me.data.profile.role}`);
    router.refresh();
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{tf("email")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={tf("emailPlaceholder")}
                  data-testid="login-email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{tf("password")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  data-testid="login-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={isSubmitting}
          data-testid="login-submit"
        >
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {tl("submit")}
        </Button>
      </form>
    </Form>
  );
}
