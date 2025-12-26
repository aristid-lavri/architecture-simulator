'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useArchitectureStore } from '@/store/architecture-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X, Settings, Trash2, Server, Monitor, Users, Cpu } from 'lucide-react';
import type { HttpMethod, RequestMode, LoadDistribution, RampUpCurve, ServerResources, DegradationSettings } from '@/types';
import { defaultServerResources, defaultDegradation, serverPresets, loadPresets } from '@/types';
import type { HttpServerNodeData } from '@/components/nodes/HttpServerNode';
import type { HttpClientNodeData } from '@/components/nodes/HttpClientNode';
import type { ClientGroupNodeData } from '@/components/nodes/ClientGroupNode';
import type { Node } from '@xyflow/react';

export function PropertiesPanel() {
  const { isPropertiesPanelOpen, setPropertiesPanelOpen, selectedNodeId, setSelectedNodeId } =
    useAppStore();
  const { nodes, updateNode, removeNode } = useArchitectureStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const updateNodeData = useCallback(
    (updates: Partial<HttpServerNodeData | HttpClientNodeData | ClientGroupNodeData>) => {
      if (!selectedNodeId) return;
      updateNode(selectedNodeId, updates);
    },
    [selectedNodeId, updateNode]
  );

  const deleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    removeNode(selectedNodeId);
    setSelectedNodeId(null);
    setPropertiesPanelOpen(false);
  }, [selectedNodeId, removeNode, setSelectedNodeId, setPropertiesPanelOpen]);

  if (!isPropertiesPanelOpen || !selectedNode) {
    return null;
  }

  const isHttpServer = selectedNode.type === 'http-server';
  const isHttpClient = selectedNode.type === 'http-client';
  const isClientGroup = selectedNode.type === 'client-group';

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Propriétés</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPropertiesPanelOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-4 space-y-6 pb-6">
          {/* Node Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Information
              </span>
              <Badge variant="outline" className="flex items-center gap-1">
                {isHttpServer && <Server className="h-3 w-3" />}
                {isHttpClient && <Monitor className="h-3 w-3" />}
                {isClientGroup && <Users className="h-3 w-3" />}
                {isHttpServer ? 'HTTP Server' : isHttpClient ? 'HTTP Client' : isClientGroup ? 'Client Group' : 'Component'}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="node-label">Nom</Label>
              <Input
                id="node-label"
                value={(selectedNode.data as { label?: string }).label || ''}
                onChange={(e) => updateNodeData({ label: e.target.value })}
                placeholder="Nom du composant"
              />
            </div>
          </div>

          {/* HTTP Server Configuration */}
          {isHttpServer && (
            <>
              <HttpServerConfig
                data={selectedNode.data as HttpServerNodeData}
                onUpdate={updateNodeData}
              />
              <ServerResourcesConfig
                data={selectedNode.data as HttpServerNodeData}
                onUpdate={updateNodeData}
              />
            </>
          )}

          {/* HTTP Client Configuration */}
          {isHttpClient && (
            <HttpClientConfig
              data={selectedNode.data as HttpClientNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Client Group Configuration */}
          {isClientGroup && (
            <ClientGroupConfig
              data={selectedNode.data as ClientGroupNodeData}
              onUpdate={updateNodeData}
            />
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 border-t shrink-0">
        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-2"
          onClick={deleteNode}
        >
          <Trash2 className="h-4 w-4" />
          Supprimer le composant
        </Button>
      </div>
    </div>
  );
}

interface HttpServerConfigProps {
  data: HttpServerNodeData;
  onUpdate: (updates: Partial<HttpServerNodeData>) => void;
}

function HttpServerConfig({ data, onUpdate }: HttpServerConfigProps) {
  const [responseDelay, setResponseDelay] = useState(data.responseDelay || 100);
  const [errorRate, setErrorRate] = useState(data.errorRate || 0);

  useEffect(() => {
    setResponseDelay(data.responseDelay || 100);
    setErrorRate(data.errorRate || 0);
  }, [data.responseDelay, data.errorRate]);

  return (
    <>
      {/* Response Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Configuration de la réponse
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              value={data.port || 8080}
              onChange={(e) => onUpdate({ port: parseInt(e.target.value) || 8080 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Code de statut</Label>
            <Select
              value={String(data.responseStatus || 200)}
              onValueChange={(value) => onUpdate({ responseStatus: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="200">200 - OK</SelectItem>
                <SelectItem value="201">201 - Created</SelectItem>
                <SelectItem value="204">204 - No Content</SelectItem>
                <SelectItem value="400">400 - Bad Request</SelectItem>
                <SelectItem value="401">401 - Unauthorized</SelectItem>
                <SelectItem value="403">403 - Forbidden</SelectItem>
                <SelectItem value="404">404 - Not Found</SelectItem>
                <SelectItem value="500">500 - Internal Error</SelectItem>
                <SelectItem value="503">503 - Service Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="response-body">Corps de la réponse</Label>
            <Input
              id="response-body"
              value={data.responseBody || ''}
              onChange={(e) => onUpdate({ responseBody: e.target.value })}
              placeholder='{"success": true}'
            />
          </div>
        </div>
      </div>

      {/* Latency */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Latence
        </span>
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label>Délai de réponse</label>
            <span className="text-muted-foreground">{responseDelay}ms</span>
          </div>
          <Slider
            value={[responseDelay]}
            onValueChange={([value]) => setResponseDelay(value)}
            onValueCommit={([value]) => onUpdate({ responseDelay: value })}
            max={2000}
            step={50}
          />
        </div>
      </div>

      {/* Error Rate */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Simulation d'erreurs
        </span>
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label>Taux d'erreur</label>
            <span className="text-muted-foreground">{errorRate}%</span>
          </div>
          <Slider
            value={[errorRate]}
            onValueChange={([value]) => setErrorRate(value)}
            onValueCommit={([value]) => onUpdate({ errorRate: value })}
            max={100}
            step={5}
          />
          <p className="text-xs text-muted-foreground">
            Pourcentage de requêtes qui échoueront avec une erreur 500
          </p>
        </div>
      </div>
    </>
  );
}

interface HttpClientConfigProps {
  data: HttpClientNodeData;
  onUpdate: (updates: Partial<HttpClientNodeData>) => void;
}

function HttpClientConfig({ data, onUpdate }: HttpClientConfigProps) {
  const [interval, setInterval] = useState(data.interval || 1000);

  useEffect(() => {
    setInterval(data.interval || 1000);
  }, [data.interval]);

  return (
    <>
      {/* Request Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Configuration de la requête
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="method">Méthode HTTP</Label>
            <Select
              value={data.method || 'GET'}
              onValueChange={(value) => onUpdate({ method: value as HttpMethod })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="path">Chemin</Label>
            <Input
              id="path"
              value={data.path || '/api'}
              onChange={(e) => onUpdate({ path: e.target.value })}
              placeholder="/api/data"
            />
          </div>
        </div>
      </div>

      {/* Request Mode */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Mode de requête
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mode">Mode</Label>
            <Select
              value={data.requestMode || 'single'}
              onValueChange={(value) => onUpdate({ requestMode: value as RequestMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Requête unique</SelectItem>
                <SelectItem value="loop">Boucle continue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {data.requestMode === 'loop' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label>Intervalle</label>
                <span className="text-muted-foreground">{interval}ms</span>
              </div>
              <Slider
                value={[interval]}
                onValueChange={([value]) => setInterval(value)}
                onValueCommit={([value]) => onUpdate({ interval: value })}
                min={100}
                max={5000}
                step={100}
              />
              <p className="text-xs text-muted-foreground">
                Temps entre chaque requête
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================
// Client Group Configuration
// ============================================

interface ClientGroupConfigProps {
  data: ClientGroupNodeData;
  onUpdate: (updates: Partial<ClientGroupNodeData>) => void;
}

function ClientGroupConfig({ data, onUpdate }: ClientGroupConfigProps) {
  const [virtualClients, setVirtualClients] = useState(data.virtualClients || 10);
  const [concurrentRequests, setConcurrentRequests] = useState(data.concurrentRequests || 5);
  const [baseInterval, setBaseInterval] = useState(data.baseInterval || 1000);
  const [intervalVariance, setIntervalVariance] = useState(data.intervalVariance || 20);
  const [rampUpDuration, setRampUpDuration] = useState((data.rampUpDuration || 30000) / 1000);
  const [burstSize, setBurstSize] = useState(data.burstSize || 5);
  const [burstInterval, setBurstInterval] = useState((data.burstInterval || 5000) / 1000);

  useEffect(() => {
    setVirtualClients(data.virtualClients || 10);
    setConcurrentRequests(data.concurrentRequests || 5);
    setBaseInterval(data.baseInterval || 1000);
    setIntervalVariance(data.intervalVariance || 20);
    setRampUpDuration((data.rampUpDuration || 30000) / 1000);
    setBurstSize(data.burstSize || 5);
    setBurstInterval((data.burstInterval || 5000) / 1000);
  }, [data]);

  return (
    <>
      {/* Load Preset */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Preset de charge
        </span>
        <Separator />
        <Select
          onValueChange={(value) => {
            const preset = loadPresets[value as keyof typeof loadPresets];
            if (preset) {
              onUpdate(preset as Partial<ClientGroupNodeData>);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choisir un preset..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Charge légère (10 clients)</SelectItem>
            <SelectItem value="medium">Charge moyenne (50 clients)</SelectItem>
            <SelectItem value="heavy">Charge lourde (200 clients)</SelectItem>
            <SelectItem value="spike">Test de pic (500 clients)</SelectItem>
            <SelectItem value="stress">Test de stress (1000 clients)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Virtual Clients */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Clients virtuels
        </span>
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label>Nombre de clients</label>
            <span className="text-muted-foreground">{virtualClients}</span>
          </div>
          <Slider
            value={[virtualClients]}
            onValueChange={([value]) => setVirtualClients(value)}
            onValueCommit={([value]) => onUpdate({ virtualClients: value })}
            min={1}
            max={1000}
            step={1}
          />
        </div>
      </div>

      {/* Request Mode (Sequential/Parallel) */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Mode d'exécution des requêtes
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select
              value={data.requestMode || 'parallel'}
              onValueChange={(value) => onUpdate({ requestMode: value as 'sequential' | 'parallel' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Séquentiel (1 requête à la fois)</SelectItem>
                <SelectItem value="parallel">Parallèle (plusieurs simultanées)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {data.requestMode === 'sequential'
                ? 'Chaque client attend la réponse avant d\'envoyer la requête suivante'
                : 'Les clients envoient plusieurs requêtes simultanément'}
            </p>
          </div>

          {data.requestMode === 'parallel' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label>Requêtes parallèles/client</label>
                <span className="text-muted-foreground">{concurrentRequests}</span>
              </div>
              <Slider
                value={[concurrentRequests]}
                onValueChange={([value]) => setConcurrentRequests(value)}
                onValueCommit={([value]) => onUpdate({ concurrentRequests: value })}
                min={1}
                max={100}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Nombre de requêtes simultanées par client virtuel
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Distribution */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Distribution des requêtes
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type de distribution</Label>
            <Select
              value={data.distribution || 'uniform'}
              onValueChange={(value) => onUpdate({ distribution: value as LoadDistribution })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uniform">Uniforme (intervalle fixe)</SelectItem>
                <SelectItem value="random">Aléatoire (avec variance)</SelectItem>
                <SelectItem value="burst">Burst (par vagues)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Intervalle de base</label>
              <span className="text-muted-foreground">{baseInterval}ms</span>
            </div>
            <Slider
              value={[baseInterval]}
              onValueChange={([value]) => setBaseInterval(value)}
              onValueCommit={([value]) => onUpdate({ baseInterval: value })}
              min={50}
              max={10000}
              step={50}
            />
          </div>

          {data.distribution === 'random' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label>Variance</label>
                <span className="text-muted-foreground">±{intervalVariance}%</span>
              </div>
              <Slider
                value={[intervalVariance]}
                onValueChange={([value]) => setIntervalVariance(value)}
                onValueCommit={([value]) => onUpdate({ intervalVariance: value })}
                min={0}
                max={100}
                step={5}
              />
            </div>
          )}

          {data.distribution === 'burst' && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label>Taille du burst</label>
                  <span className="text-muted-foreground">{burstSize} req</span>
                </div>
                <Slider
                  value={[burstSize]}
                  onValueChange={([value]) => setBurstSize(value)}
                  onValueCommit={([value]) => onUpdate({ burstSize: value })}
                  min={1}
                  max={100}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label>Intervalle entre bursts</label>
                  <span className="text-muted-foreground">{burstInterval}s</span>
                </div>
                <Slider
                  value={[burstInterval]}
                  onValueChange={([value]) => setBurstInterval(value)}
                  onValueCommit={([value]) => onUpdate({ burstInterval: value * 1000 })}
                  min={1}
                  max={60}
                  step={1}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ramp-up Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Montée en charge (Ramp-up)
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="rampup-enabled">Activer le ramp-up</Label>
            <Switch
              id="rampup-enabled"
              checked={data.rampUpEnabled || false}
              onCheckedChange={(checked) => onUpdate({ rampUpEnabled: checked })}
            />
          </div>

          {data.rampUpEnabled && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label>Durée</label>
                  <span className="text-muted-foreground">{rampUpDuration}s</span>
                </div>
                <Slider
                  value={[rampUpDuration]}
                  onValueChange={([value]) => setRampUpDuration(value)}
                  onValueCommit={([value]) => onUpdate({ rampUpDuration: value * 1000 })}
                  min={1}
                  max={300}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <Label>Courbe de montée</Label>
                <Select
                  value={data.rampUpCurve || 'linear'}
                  onValueChange={(value) => onUpdate({ rampUpCurve: value as RampUpCurve })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linéaire</SelectItem>
                    <SelectItem value="exponential">Exponentielle</SelectItem>
                    <SelectItem value="step">Par paliers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* HTTP Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Configuration HTTP
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Méthode</Label>
            <Select
              value={data.method || 'GET'}
              onValueChange={(value) => onUpdate({ method: value as HttpMethod })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="path">Chemin</Label>
            <Input
              id="path"
              value={data.path || '/api/data'}
              onChange={(e) => onUpdate({ path: e.target.value })}
              placeholder="/api/data"
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// Server Resources Configuration (Extended)
// ============================================

interface ServerResourcesConfigProps {
  data: HttpServerNodeData;
  onUpdate: (updates: Partial<HttpServerNodeData>) => void;
}

function ServerResourcesConfig({ data, onUpdate }: ServerResourcesConfigProps) {
  const resources = data.resources || defaultServerResources;
  const degradation = data.degradation || defaultDegradation;

  // Local state for sliders to update display while dragging
  const [cpuCores, setCpuCores] = useState(resources.cpu.cores);
  const [cpuProcessingTime, setCpuProcessingTime] = useState(resources.cpu.processingTimePerRequest);
  const [memoryTotal, setMemoryTotal] = useState(resources.memory.totalMB);
  const [memoryPerRequest, setMemoryPerRequest] = useState(resources.memory.memoryPerRequestMB);
  const [networkBandwidth, setNetworkBandwidth] = useState(resources.network.bandwidthMbps);
  const [networkLatency, setNetworkLatency] = useState(resources.network.baseLatencyMs);
  const [maxConcurrent, setMaxConcurrent] = useState(resources.connections.maxConcurrent);
  const [queueSize, setQueueSize] = useState(resources.connections.queueSize);

  // Sync local state when data changes externally (e.g., preset selection)
  useEffect(() => {
    setCpuCores(resources.cpu.cores);
    setCpuProcessingTime(resources.cpu.processingTimePerRequest);
    setMemoryTotal(resources.memory.totalMB);
    setMemoryPerRequest(resources.memory.memoryPerRequestMB);
    setNetworkBandwidth(resources.network.bandwidthMbps);
    setNetworkLatency(resources.network.baseLatencyMs);
    setMaxConcurrent(resources.connections.maxConcurrent);
    setQueueSize(resources.connections.queueSize);
  }, [resources]);

  const updateResources = (updates: Partial<ServerResources>) => {
    onUpdate({
      resources: {
        ...resources,
        ...updates,
      },
    });
  };

  const updateCpu = (updates: Partial<ServerResources['cpu']>) => {
    updateResources({
      cpu: { ...resources.cpu, ...updates },
    });
  };

  const updateMemory = (updates: Partial<ServerResources['memory']>) => {
    updateResources({
      memory: { ...resources.memory, ...updates },
    });
  };

  const updateNetwork = (updates: Partial<ServerResources['network']>) => {
    updateResources({
      network: { ...resources.network, ...updates },
    });
  };

  const updateConnections = (updates: Partial<ServerResources['connections']>) => {
    updateResources({
      connections: { ...resources.connections, ...updates },
    });
  };

  return (
    <>
      {/* Server Preset */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Preset serveur
          </span>
        </div>
        <Separator />
        <Select
          onValueChange={(value) => {
            const preset = serverPresets[value as keyof typeof serverPresets];
            if (preset) {
              onUpdate({ resources: preset });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choisir un preset..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Petit (1 CPU, 512MB)</SelectItem>
            <SelectItem value="medium">Moyen (4 CPU, 8GB)</SelectItem>
            <SelectItem value="large">Grand (16 CPU, 32GB)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* CPU Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          CPU
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Coeurs</label>
              <span className="text-muted-foreground">{cpuCores}</span>
            </div>
            <Slider
              value={[cpuCores]}
              onValueChange={([value]) => setCpuCores(value)}
              onValueCommit={([value]) => updateCpu({ cores: value })}
              min={1}
              max={64}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Temps traitement/req</label>
              <span className="text-muted-foreground">{cpuProcessingTime}ms</span>
            </div>
            <Slider
              value={[cpuProcessingTime]}
              onValueChange={([value]) => setCpuProcessingTime(value)}
              onValueCommit={([value]) => updateCpu({ processingTimePerRequest: value })}
              min={1}
              max={500}
              step={5}
            />
          </div>
        </div>
      </div>

      {/* Memory Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Mémoire
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>RAM totale</label>
              <span className="text-muted-foreground">{memoryTotal}MB</span>
            </div>
            <Slider
              value={[memoryTotal]}
              onValueChange={([value]) => setMemoryTotal(value)}
              onValueCommit={([value]) => updateMemory({ totalMB: value })}
              min={256}
              max={65536}
              step={256}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Mémoire/requête</label>
              <span className="text-muted-foreground">{memoryPerRequest}MB</span>
            </div>
            <Slider
              value={[memoryPerRequest]}
              onValueChange={([value]) => setMemoryPerRequest(value)}
              onValueCommit={([value]) => updateMemory({ memoryPerRequestMB: value })}
              min={1}
              max={100}
              step={1}
            />
          </div>
        </div>
      </div>

      {/* Network Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Réseau
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Bande passante</label>
              <span className="text-muted-foreground">{networkBandwidth}Mbps</span>
            </div>
            <Slider
              value={[networkBandwidth]}
              onValueChange={([value]) => setNetworkBandwidth(value)}
              onValueCommit={([value]) => updateNetwork({ bandwidthMbps: value })}
              min={10}
              max={10000}
              step={10}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Latence de base</label>
              <span className="text-muted-foreground">{networkLatency}ms</span>
            </div>
            <Slider
              value={[networkLatency]}
              onValueChange={([value]) => setNetworkLatency(value)}
              onValueCommit={([value]) => updateNetwork({ baseLatencyMs: value })}
              min={0}
              max={100}
              step={1}
            />
          </div>
        </div>
      </div>

      {/* Connections Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Connexions
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Max concurrent</label>
              <span className="text-muted-foreground">{maxConcurrent}</span>
            </div>
            <Slider
              value={[maxConcurrent]}
              onValueChange={([value]) => setMaxConcurrent(value)}
              onValueCommit={([value]) => updateConnections({ maxConcurrent: value })}
              min={1}
              max={1000}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Taille file d'attente</label>
              <span className="text-muted-foreground">{queueSize}</span>
            </div>
            <Slider
              value={[queueSize]}
              onValueChange={([value]) => setQueueSize(value)}
              onValueCommit={([value]) => updateConnections({ queueSize: value })}
              min={0}
              max={500}
              step={1}
            />
          </div>
        </div>
      </div>

      {/* Degradation Settings */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Dégradation sous charge
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="degradation-enabled">Activer la dégradation</Label>
            <Switch
              id="degradation-enabled"
              checked={degradation.enabled}
              onCheckedChange={(checked) =>
                onUpdate({ degradation: { ...degradation, enabled: checked } })
              }
            />
          </div>

          {degradation.enabled && (
            <div className="space-y-2">
              <Label>Formule de dégradation</Label>
              <Select
                value={degradation.formula}
                onValueChange={(value) =>
                  onUpdate({
                    degradation: {
                      ...degradation,
                      formula: value as DegradationSettings['formula'],
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linéaire</SelectItem>
                  <SelectItem value="quadratic">Quadratique</SelectItem>
                  <SelectItem value="exponential">Exponentielle</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Latence = base × (1 + utilisation^puissance)
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
