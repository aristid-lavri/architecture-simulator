import type { ComponentType, ConnectionProtocol, ConnectorCompatibility } from '@/types';
import { pluginRegistry } from '@/plugins';

/**
 * Matrice de compatibilité : protocoles supportés par chaque type de noeud.
 * Utilisée pour la validation des connexions et la suggestion de protocoles.
 */
export const connectorCompatibility: ConnectorCompatibility = {
  'http-server': ['rest', 'graphql', 'websocket'],
  'api-gateway': ['rest', 'grpc', 'graphql', 'websocket'],
  'database': [],       // connexion directe uniquement (pas de protocole app-level)
  'cache': [],          // connexion directe uniquement (redis-protocol interne)
  'message-queue': [],  // protocole interne (amqp/kafka)
  'load-balancer': ['rest', 'grpc', 'websocket'],
  'http-client': ['rest', 'graphql', 'websocket'],
  'client-group': ['rest', 'graphql', 'websocket'],
  'serverless': ['rest', 'grpc'],
  'cloud-function': ['rest', 'grpc'],
  'cdn': ['rest'],
  'circuit-breaker': ['rest', 'grpc', 'graphql', 'websocket'],
  'waf': ['rest', 'graphql', 'websocket'],
  'firewall': ['rest', 'grpc', 'graphql', 'websocket'],
  'dns': ['rest'],
  'service-discovery': ['rest', 'grpc'],
  'cloud-storage': ['rest'],
  'container': ['rest', 'grpc', 'graphql', 'websocket'],
  'network-zone': [],   // zone conteneur, pas de protocole direct
  'host-server': ['rest', 'grpc', 'graphql', 'websocket'],
  'microservice': ['rest', 'grpc', 'graphql', 'websocket'],
  'api-service': ['rest', 'grpc', 'graphql'],
  'background-job': [],  // connexion directe (consomme depuis queue ou émet vers services)
  'identity-provider': ['rest', 'grpc'],
};

/**
 * Retourne les protocoles supportés par un type de noeud.
 * Les noeuds sans protocoles listés (database, cache, mq) acceptent toute connexion directe.
 */
export function getSupportedProtocols(nodeType: ComponentType | string): ConnectionProtocol[] {
  // Check built-in compatibility first
  if (nodeType in connectorCompatibility) {
    return connectorCompatibility[nodeType as ComponentType];
  }
  // Check plugin-provided protocols
  const pluginProtos = pluginRegistry.getProtocols(nodeType);
  if (pluginProtos) return pluginProtos as ConnectionProtocol[];
  return [];
}

/**
 * Suggère le meilleur protocole par défaut pour une connexion entre deux types de noeuds.
 * Retourne le premier protocole commun, ou null si aucun.
 */
export function suggestProtocol(
  sourceType: ComponentType,
  targetType: ComponentType
): ConnectionProtocol | null {
  const sourceProtos = getSupportedProtocols(sourceType);
  const targetProtos = getSupportedProtocols(targetType);

  // Si l'un des deux n'a pas de protocoles listés, c'est une connexion directe — pas de suggestion
  if (sourceProtos.length === 0 || targetProtos.length === 0) return null;

  // Trouver le premier protocole commun (priorité : rest > grpc > graphql > websocket)
  const priority: ConnectionProtocol[] = ['rest', 'grpc', 'graphql', 'websocket'];
  for (const proto of priority) {
    if (sourceProtos.includes(proto) && targetProtos.includes(proto)) {
      return proto;
    }
  }

  return null;
}
