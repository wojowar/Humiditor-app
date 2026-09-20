"use client";

import { Field, Input, Select } from "@/components/ui";
import { ORIGINS, STRENGTHS, VITOLAS, WRAPPERS } from "@/lib/types";

export interface CigarDraft {
  brand: string;
  line: string;
  vitola: string;
  lengthIn: string;
  ringGauge: string;
  wrapper: string;
  origin: string;
  strength: string;
}

export const EMPTY_DRAFT: CigarDraft = {
  brand: "",
  line: "",
  vitola: "",
  lengthIn: "",
  ringGauge: "",
  wrapper: "",
  origin: "",
  strength: "",
};

/** The blend's own attributes - shared by the scan confirm step and manual add. */
export function CigarFields({
  draft,
  onChange,
}: {
  draft: CigarDraft;
  onChange: (next: CigarDraft) => void;
}) {
  const set = (key: keyof CigarDraft) => (value: string) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="space-y-3">
      <Field label="Brand">
        <Input
          value={draft.brand}
          onChange={(e) => set("brand")(e.target.value)}
          placeholder="Padron"
          autoCapitalize="words"
        />
      </Field>
      <Field label="Line">
        <Input
          value={draft.line}
          onChange={(e) => set("line")(e.target.value)}
          placeholder="1964 Anniversary"
          autoCapitalize="words"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Vitola">
          <Select value={draft.vitola} onChange={(e) => set("vitola")(e.target.value)}>
            <option value="">--</option>
            {VITOLAS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Length in">
          <Input
            type="number"
            inputMode="decimal"
            step="0.125"
            min="0"
            value={draft.lengthIn}
            onChange={(e) => set("lengthIn")(e.target.value)}
            placeholder="5"
          />
        </Field>
        <Field label="Ring">
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={draft.ringGauge}
            onChange={(e) => set("ringGauge")(e.target.value)}
            placeholder="50"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Wrapper">
          <Select value={draft.wrapper} onChange={(e) => set("wrapper")(e.target.value)}>
            <option value="">--</option>
            {WRAPPERS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Origin">
          <Select value={draft.origin} onChange={(e) => set("origin")(e.target.value)}>
            <option value="">--</option>
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Strength">
        <Select value={draft.strength} onChange={(e) => set("strength")(e.target.value)}>
          <option value="">--</option>
          {STRENGTHS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
