"use client";

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

interface RoleSelectProps {
  value: RegisterRole | undefined;
  onChange: (value: RegisterRole) => void;
  disabled?: boolean;
}

/**
 * Account-type picker for registration (COMPONENT_TREE §1) — customer / seller /
 * provider only (admin is not self-registerable). Radix Select keeps a11y; the
 * selected role's description renders below to build trust at the choice point.
 */
export function RoleSelect({ value, onChange, disabled }: RoleSelectProps) {
  const t = useTranslations("auth.roles");

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={value}
        onValueChange={(next) => onChange(next as RegisterRole)}
        disabled={disabled}
      >
        <SelectTrigger aria-label={t("label")} data-testid="register-role" className={authInputClass}>
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
}
