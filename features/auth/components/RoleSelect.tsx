"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authInputClass } from "@/features/auth/components/auth-field-styles";
import { REGISTER_ROLES, type RegisterRole } from "@/features/auth/schema";
import { cn } from "@/lib/utils";

interface RoleSelectProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SelectTrigger>, "onChange" | "value"> {
  value: RegisterRole | undefined;
  onChange: (value: RegisterRole) => void;
}

/**
 * Account-type picker for registration (COMPONENT_TREE §1) — customer / seller /
 * provider only (admin is not self-registerable). Radix Select keeps a11y; the
 * selected role's description renders below to build trust at the choice point.
 *
 * `forwardRef` + prop spread is REQUIRED: this renders inside shadcn's `FormControl`,
 * a Radix `Slot` that injects `ref` + `id`/`aria-describedby`/`aria-invalid` onto its
 * child. A plain function component drops them (and logs "Function components cannot
 * be given refs"), so the trigger loses its `id` (the `<FormLabel htmlFor>` + focus
 * target) and error wiring. We forward all of it onto the real `SelectTrigger`.
 */
export const RoleSelect = forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  RoleSelectProps
>(function RoleSelect({ value, onChange, disabled, className, ...triggerProps }, ref) {
  const t = useTranslations("auth.roles");

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={value}
        onValueChange={(next) => onChange(next as RegisterRole)}
        disabled={disabled}
      >
        <SelectTrigger
          ref={ref}
          aria-label={t("label")}
          data-testid="register-role"
          className={cn(authInputClass, className)}
          {...triggerProps}
        >
          <SelectValue placeholder={t("placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {REGISTER_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {t(`${role}.label`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value ? (
        <p className="text-body-sm text-muted-foreground">{t(`${value}.description`)}</p>
      ) : null}
    </div>
  );
});
