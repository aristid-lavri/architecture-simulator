import type { RulePack } from '@/lib/rules-engine/core';

import dbCannotInitiate from './rules/physical/db-cannot-initiate';
import cacheCannotInitiate from './rules/physical/cache-cannot-initiate';
import cdnCannotTargetClient from './rules/physical/cdn-cannot-target-client';
import cacheCannotTargetClient from './rules/physical/cache-cannot-target-client';
import dbCannotTargetClient from './rules/physical/db-cannot-target-client';
import clientCannotTargetClient from './rules/physical/client-cannot-target-client';
import firewallCannotInitiate from './rules/physical/firewall-cannot-initiate';
import dnsCannotBeTargetOfData from './rules/physical/dns-cannot-be-target-of-data';
import identityProviderCannotInitiate from './rules/physical/identity-provider-cannot-initiate';

import queueDirectToQueue from './rules/routing/queue-direct-to-queue';
import clientDirectToDb from './rules/routing/client-direct-to-db';
import clientDirectToCache from './rules/routing/client-direct-to-cache';
import lbTargetsLb from './rules/routing/lb-targets-lb';
import serverlessTargetsClient from './rules/routing/serverless-targets-client';

import orphanCircuitBreaker from './rules/topology/orphan-circuit-breaker';

export const coreSanityPack: RulePack = {
  id: 'core-sanity',
  rules: [
    dbCannotInitiate,
    cacheCannotInitiate,
    cdnCannotTargetClient,
    cacheCannotTargetClient,
    dbCannotTargetClient,
    clientCannotTargetClient,
    firewallCannotInitiate,
    dnsCannotBeTargetOfData,
    identityProviderCannotInitiate,
    queueDirectToQueue,
    clientDirectToDb,
    clientDirectToCache,
    lbTargetsLb,
    serverlessTargetsClient,
    orphanCircuitBreaker,
  ],
};
