'use client';

import { useId, useState, useEffect, type FocusEventHandler } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldHelp } from './FieldHelp';
import { cn } from '@/lib/utils';
import type { FieldValidator } from '@/lib/field-validation';

/**
 * Champ numérique avec validation field-level (A4.2) + tooltip d'aide
 * intégré (A4.4).
 *
 * Why : avant cette couche, des valeurs manifestement invalides (`port:
 * 100000`, `clients: -5`, `cpuMillis: 0`) n'étaient détectées qu'à la
 * simulation — voire silencieusement avalées par les formules. On rend la
 * validation visible *au moment de la saisie* avec un message FR sous le champ
 * et `aria-invalid` pour les screen readers.
 *
 * Le `onChange` est appelé même quand la valeur est invalide (le store accepte
 * l'erreur, on alerte l'utilisateur visuellement) — cela évite le piège du
 * « pourquoi mon input refuse mes touches » et garde le state in-sync avec ce
 * que voit le user. La simulation rejette ou clamp les valeurs hors plage de
 * son côté.
 *
 * Design choice : valider à chaque keystroke (pas au blur) — feedback immédiat
 * vaut le ré-render léger pour ce cas d'usage.
 */
export interface ValidatedNumberInputProps {
  /** Texte du label (FR/EN). Si omis, le label n'est pas rendu (utile en grille bulk-edit). */
  label?: string;
  /** Valeur courante. */
  value: number;
  /** Callback appelé à chaque change avec le nombre parsé. */
  onChange: (value: number) => void;
  /** Validator pur (cf. lib/field-validation.ts). */
  validate?: FieldValidator<number>;
  /** Clé i18n pour le tooltip d'aide à droite du label. */
  helpKey?: string;
  /** Bornes natives de l'input HTML — `min`, `max`, `step`. */
  min?: number;
  max?: number;
  step?: number | 'any';
  /** Placeholder si vide. */
  placeholder?: string;
  /** Désactivé. */
  disabled?: boolean;
  /** Forcer un id ; sinon généré via useId. */
  id?: string;
  /** Classe sur le wrapper (utile pour grilles 2 colonnes). */
  className?: string;
  /** Callback blur. */
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

export function ValidatedNumberInput({
  label,
  value,
  onChange,
  validate,
  helpKey,
  min,
  max,
  step,
  placeholder,
  disabled,
  id,
  className,
  onBlur,
}: ValidatedNumberInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  // L'erreur est dérivée de `value` à chaque render — pas besoin de la stocker
  // sauf pour le visuel "touched" (n'afficher l'erreur qu'après une saisie ou
  // un blur, pour ne pas crier dès le mount).
  const [touched, setTouched] = useState(false);

  // Quand la valeur passe de invalide → valide (par changement programmatique
  // depuis le parent, ex: reset), on retire le surlignage erreur.
  useEffect(() => {
    if (!validate) return;
    const err = validate(value);
    if (err === null) {
      // valid : reset touched seulement si on n'avait pas d'erreur visible
    }
  }, [value, validate]);

  const error = validate ? validate(value) : null;
  const showError = touched && error !== null;

  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && (
        <div className="flex items-center gap-1">
          <Label htmlFor={inputId} className="text-xs">
            {label}
          </Label>
          {helpKey && <FieldHelp i18nKey={helpKey} />}
        </div>
      )}
      <Input
        id={inputId}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errorId : undefined}
        onChange={(e) => {
          setTouched(true);
          const raw = e.target.value;
          const parsed = raw === '' ? NaN : Number(raw);
          onChange(parsed);
        }}
        onBlur={(e) => {
          setTouched(true);
          onBlur?.(e);
        }}
        className={cn(
          showError && 'border-destructive focus-visible:ring-destructive',
        )}
      />
      {showError && (
        <p id={errorId} role="alert" className="text-[11px] text-destructive leading-tight flex items-start gap-1">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
