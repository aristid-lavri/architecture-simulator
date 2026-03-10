import type { ComponentType, ConnectionProtocol } from '@/types';
import { getSupportedProtocols, suggestProtocol } from '@/data/connector-compatibility';

export interface ConnectionValidation {
  valid: boolean;
  warning?: string;
  suggestion?: ConnectionProtocol;
}

/**
 * Valide une connexion entre deux types de noeuds avec un protocole donné.
 * Retourne un objet indiquant si la connexion est valide, un warning éventuel
 * et une suggestion de protocole.
 */
export function validateConnection(
  sourceType: ComponentType,
  targetType: ComponentType,
  protocol?: ConnectionProtocol
): ConnectionValidation {
  const sourceProtos = getSupportedProtocols(sourceType);
  const targetProtos = getSupportedProtocols(targetType);

  // Connexion directe (database, cache, mq) — toujours valide, pas de protocole app-level
  if (sourceProtos.length === 0 || targetProtos.length === 0) {
    return { valid: true };
  }

  // Pas de protocole spécifié — valide mais suggérer
  if (!protocol) {
    const suggested = suggestProtocol(sourceType, targetType);
    if (suggested) {
      return { valid: true, suggestion: suggested };
    }
    // Aucun protocole commun
    return {
      valid: false,
      warning: `Aucun protocole commun entre ${sourceType} et ${targetType}`,
      suggestion: sourceProtos[0],
    };
  }

  // Vérifier compatibilité du protocole choisi
  const sourceSupports = sourceProtos.includes(protocol);
  const targetSupports = targetProtos.includes(protocol);

  if (sourceSupports && targetSupports) {
    return { valid: true };
  }

  const suggested = suggestProtocol(sourceType, targetType);

  if (!sourceSupports && !targetSupports) {
    return {
      valid: false,
      warning: `${protocol.toUpperCase()} n'est supporté ni par ${sourceType} ni par ${targetType}`,
      suggestion: suggested || undefined,
    };
  }

  const unsupported = !sourceSupports ? sourceType : targetType;
  return {
    valid: false,
    warning: `${protocol.toUpperCase()} n'est pas supporté par ${unsupported}`,
    suggestion: suggested || undefined,
  };
}
