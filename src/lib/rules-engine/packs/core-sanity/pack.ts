import type { RulePack } from '@/lib/rules-engine/core';

// Physical (edge-scope, 9)
import dbCannotInitiate from './rules/physical/db-cannot-initiate';
import cacheCannotInitiate from './rules/physical/cache-cannot-initiate';
import cdnCannotTargetClient from './rules/physical/cdn-cannot-target-client';
import cacheCannotTargetClient from './rules/physical/cache-cannot-target-client';
import dbCannotTargetClient from './rules/physical/db-cannot-target-client';
import clientCannotTargetClient from './rules/physical/client-cannot-target-client';
import firewallCannotInitiate from './rules/physical/firewall-cannot-initiate';
import dnsCannotBeTargetOfData from './rules/physical/dns-cannot-be-target-of-data';
import identityProviderCannotInitiate from './rules/physical/identity-provider-cannot-initiate';

// Routing (edge-scope, 5)
import queueDirectToQueue from './rules/routing/queue-direct-to-queue';
import clientDirectToDb from './rules/routing/client-direct-to-db';
import clientDirectToCache from './rules/routing/client-direct-to-cache';
import lbTargetsLb from './rules/routing/lb-targets-lb';
import serverlessTargetsClient from './rules/routing/serverless-targets-client';

// Topology (graph-scope, 6 — orphan-circuit-breaker + 5 new)
import orphanCircuitBreaker from './rules/topology/orphan-circuit-breaker';
import orphanNode from './rules/topology/orphan-node';
import cycleDetected from './rules/topology/cycle-detected';
import singleLbSpof from './rules/topology/single-lb-spof';
import singleDbSpof from './rules/topology/single-db-spof';
import mqNoConsumer from './rules/topology/mq-no-consumer';
import containerMissingParent from './rules/topology/container-missing-parent';

// Exposure (graph-scope, 2)
import dbExposedPublicly from './rules/exposure/db-exposed-publicly';
import cacheExposedPublicly from './rules/exposure/cache-exposed-publicly';

// Security (graph-scope, 2)
import crossZoneEdgeNoGateway from './rules/security/cross-zone-edge-no-gateway';
import publicServiceNoAuth from './rules/security/public-service-no-auth';

// Performance (graph-scope, 2)
import noCdnMultiClients from './rules/performance/no-cdn-multi-clients';
import dbWithoutCache from './rules/performance/db-without-cache';

// Hygiene (graph-scope, 3)
import duplicateNodeNames from './rules/hygiene/duplicate-node-names';
import edgeNoProtocol from './rules/hygiene/edge-no-protocol';
import duplicateEdge from './rules/hygiene/duplicate-edge';

export const coreSanityPack: RulePack = {
  id: 'core-sanity',
  rules: [
    // Physical (9)
    dbCannotInitiate,
    cacheCannotInitiate,
    cdnCannotTargetClient,
    cacheCannotTargetClient,
    dbCannotTargetClient,
    clientCannotTargetClient,
    firewallCannotInitiate,
    dnsCannotBeTargetOfData,
    identityProviderCannotInitiate,
    // Routing (5)
    queueDirectToQueue,
    clientDirectToDb,
    clientDirectToCache,
    lbTargetsLb,
    serverlessTargetsClient,
    // Topology (7)
    orphanCircuitBreaker,
    orphanNode,
    cycleDetected,
    singleLbSpof,
    singleDbSpof,
    mqNoConsumer,
    containerMissingParent,
    // Exposure (2)
    dbExposedPublicly,
    cacheExposedPublicly,
    // Security (2)
    crossZoneEdgeNoGateway,
    publicServiceNoAuth,
    // Performance (2)
    noCdnMultiClients,
    dbWithoutCache,
    // Hygiene (3)
    duplicateNodeNames,
    edgeNoProtocol,
    duplicateEdge,
  ],
};
