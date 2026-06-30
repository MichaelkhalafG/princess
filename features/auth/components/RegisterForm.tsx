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
import {
  authInputClass,
  authLabelClass,
  authSubmitClass,
} from "@/features/auth/components/auth-field-styles";
import { localizeApiError, postJson } from "@/features/auth/client";
import { RoleSelect } from "@/features/auth/components/RoleSelect";
import { buildRegisterSchema, type RegisterInput } from "@/features/auth/schema";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "@/i18n/navigation";

type RegisterResponse = { session: unknown | null };

/**
 * Registration form (COMPONENT_TREE §5; USER_FLOWS §1). Creates the auth user
 * with role in metadata so the DB trigger sets `status` (REQ-AUTH-05). On
 * success: if a session is returned, redirect to the role dashboard (seller/
 * provider land on a pending banner); otherwise prompt to confirm email.
 */
export function RegisterForm() {
  const tf = useTranslations("auth.fields");
  const tr = useTranslations("auth.register");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("auth.errors");
  const router = useRouter();
  const { toast } = useToast();

  const schema = useMemo(() => buildRegisterSchema((key) => tv(key)), [tv]);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "", role: undefined },
  });

  async function onSubmit(values: RegisterInput) {
    const result = await postJson<RegisterResponse>("/api/auth/register", values);
    if (!result.ok) {
      toast({ variant: "destructive", description: localizeApiError(te, result.error) });
      return;
    }

    if (!result.data.session) {
      // Email confirmation required — no active session yet.
      toast({ description: tr("checkEmail") });
      router.replace("/login");
      return;
    }

    toast({ description: tr("success") });
    router.replace(`/dashboard/${values.role}`);
    router.refresh();
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={authLabelClass}>{tf("fullName")}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  placeholder={tf("fullNamePlaceholder")}
                  data-testid="register-name"
                  className={authInputClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={authLabelClass}>{tf("email")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={tf("emailPlaceholder")}
                  data-testid="register-email"
                  className={authInputClass}
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
              <FormLabel className={authLabelClass}>{tf("password")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={tf("passwordPlaceholder")}
                  data-testid="register-password"
                  className={authInputClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={authLabelClass}>{tf("role")}</FormLabel>
              <FormControl>
                <RoleSelect
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className={authSubmitClass}
          disabled={isSubmitting}
          data-testid="register-submit"
        >
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {tr("submit")}
        </Button>
      </form>
    </Form>
  );
}
