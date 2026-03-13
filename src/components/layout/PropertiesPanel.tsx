'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
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
import { X, Settings, Trash2, Server, Monitor, Users, Cpu, Database, Zap, Share2, MessageSquare, Shield, ArrowRight, Plus, GripVertical } from 'lucide-react';
import type { HttpMethod, RequestMode, LoadDistribution, RampUpCurve, ServerResources, DegradationSettings, DatabaseType, DatabaseNodeData, CacheType, CacheNodeData, EvictionPolicy, LoadBalancerAlgorithm, LoadBalancerNodeData, MessageQueueType, MessageQueueMode, MessageQueueNodeData, ApiGatewayAuthType, ApiGatewayNodeData, ApiGatewayRouteRule, CircuitBreakerNodeData, CDNNodeData, WAFNodeData, FirewallNodeData, ServerlessNodeData, ContainerNodeData, ServiceDiscoveryNodeData, DNSNodeData, CloudStorageNodeData, CloudFunctionNodeData, NetworkZoneNodeData, RequestTypeDistribution, HostServerNodeData, HostPortMapping } from '@/types';
import { defaultServerResources, defaultDegradation, serverPresets, loadPresets, defaultDatabaseNodeData, defaultCacheNodeData, defaultLoadBalancerNodeData, defaultMessageQueueNodeData, defaultApiGatewayNodeData, defaultCircuitBreakerData, defaultCDNNodeData, defaultWAFNodeData, defaultFirewallData, defaultServerlessData, defaultContainerData, defaultServiceDiscoveryData, defaultDNSNodeData, defaultCloudStorageData, defaultCloudFunctionData, defaultNetworkZoneData, defaultHostServerData, defaultApiServiceData, defaultBackgroundJobData } from '@/types';
import type { ApiServiceNodeData, BackgroundJobNodeData, ApiServiceProtocol, BackgroundJobType, IdentityProviderNodeData, IdentityProviderType, IdPProtocol, IdPTokenFormat } from '@/types';
import { defaultIdentityProviderData, IDP_PROVIDER_CAPABILITIES } from '@/types';
import type { HttpServerNodeData } from '@/components/nodes/HttpServerNode';
import type { HttpClientNodeData } from '@/components/nodes/HttpClientNode';
import type { ProcessingComplexity } from '@/types';
import { complexityMultipliers } from '@/types';
import type { ClientGroupNodeData } from '@/components/nodes/ClientGroupNode';
import type { AnimatedEdgeData } from '@/components/edges/AnimatedEdge';
import type { ConnectionProtocol, ComponentType } from '@/types';
import { validateConnection } from '@/lib/connection-validator';
import { useTranslation } from '@/i18n';
import type { Node, Edge } from '@xyflow/react';

export function PropertiesPanel() {
  const { t } = useTranslation();
  const { isPropertiesPanelOpen, setPropertiesPanelOpen, selectedNodeId, setSelectedNodeId, selectedEdgeId, setSelectedEdgeId } =
    useAppStore();
  const { nodes, edges, updateNode, removeNode, updateEdge, removeEdge } = useArchitectureStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  const updateNodeData = useCallback(
    (updates: Partial<HttpServerNodeData | HttpClientNodeData | ClientGroupNodeData | DatabaseNodeData | CacheNodeData | LoadBalancerNodeData | MessageQueueNodeData | ApiGatewayNodeData>) => {
      if (!selectedNodeId) return;
      updateNode(selectedNodeId, updates);
    },
    [selectedNodeId, updateNode]
  );

  const updateEdgeData = useCallback(
    (updates: Partial<AnimatedEdgeData>) => {
      if (!selectedEdgeId) return;
      updateEdge(selectedEdgeId, updates);
    },
    [selectedEdgeId, updateEdge]
  );

  const deleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    removeNode(selectedNodeId);
    setSelectedNodeId(null);
    setPropertiesPanelOpen(false);
  }, [selectedNodeId, removeNode, setSelectedNodeId, setPropertiesPanelOpen]);

  const deleteEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    removeEdge(selectedEdgeId);
    setSelectedEdgeId(null);
    setPropertiesPanelOpen(false);
  }, [selectedEdgeId, removeEdge, setSelectedEdgeId, setPropertiesPanelOpen]);

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState(320);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX;
      const newWidth = Math.min(600, Math.max(280, dragStartWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  // Show edge properties panel
  if (isPropertiesPanelOpen && selectedEdge) {
    const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
    const targetNode = nodes.find((n) => n.id === selectedEdge.target);
    const edgeData = (selectedEdge.data || {}) as AnimatedEdgeData;

    return (
      <div className="border-l bg-background flex flex-col h-full overflow-hidden relative" style={{ width: panelWidth }}>
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize z-10 group flex items-center justify-center"
        >
          <div className="w-0.5 h-8 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground group-active:bg-foreground transition-colors" />
        </div>
        {/* Header */}
        <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Propriétés du lien</span>
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
            {/* Edge Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Connexion
                </span>
                <Badge variant="outline" className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Lien
                </Badge>
              </div>
              <Separator />
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">De:</span>
                  <span className="font-medium">{(sourceNode?.data as { label?: string })?.label || sourceNode?.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Vers:</span>
                  <span className="font-medium">{(targetNode?.data as { label?: string })?.label || targetNode?.id}</span>
                </div>
              </div>
            </div>

            {/* Edge Label */}
            <div className="space-y-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Étiquette
              </span>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="edge-label">Texte</Label>
                <Input
                  id="edge-label"
                  value={edgeData.label || ''}
                  onChange={(e) => updateEdgeData({ label: e.target.value })}
                  placeholder="Étiquette du lien"
                />
              </div>
            </div>

            {/* Protocol */}
            <div className="space-y-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                {t('connectors.protocol')}
              </span>
              <Separator />
              <div className="space-y-2">
                <Label>{t('connectors.protocol')}</Label>
                <Select
                  value={edgeData.protocol || ''}
                  onValueChange={(value) => updateEdgeData({ protocol: (value || undefined) as ConnectionProtocol | undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun (direct)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rest">{t('connectors.rest')}</SelectItem>
                    <SelectItem value="grpc">{t('connectors.grpc')}</SelectItem>
                    <SelectItem value="graphql">{t('connectors.graphql')}</SelectItem>
                    <SelectItem value="websocket">{t('connectors.websocket')}</SelectItem>
                  </SelectContent>
                </Select>
                {(() => {
                  const sourceType = sourceNode?.type as ComponentType | undefined;
                  const targetType = targetNode?.type as ComponentType | undefined;
                  if (!sourceType || !targetType || !edgeData.protocol) return null;
                  const validation = validateConnection(sourceType, targetType, edgeData.protocol);
                  if (validation.valid) return null;
                  return (
                    <div className="text-xs text-signal-warning bg-signal-warning/10 border border-signal-warning/20 rounded px-2 py-1.5">
                      {validation.warning}
                      {validation.suggestion && (
                        <button
                          className="block mt-1 text-signal-active underline cursor-pointer"
                          onClick={() => updateEdgeData({ protocol: validation.suggestion })}
                        >
                          {t('connectors.suggestion')}: {validation.suggestion.toUpperCase()}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Target Port */}
            <div className="space-y-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Port cible
              </span>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="edge-target-port">Port</Label>
                <Input
                  id="edge-target-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={edgeData.targetPort ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateEdgeData({ targetPort: val ? parseInt(val, 10) : undefined });
                  }}
                  placeholder="Ex: 80, 443, 8080"
                />
                <p className="text-xs text-muted-foreground">
                  Port de destination utilisé par le firewall et le host-server pour le routage.
                </p>
              </div>
            </div>

            {/* Edge Style */}
            <div className="space-y-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Apparence
              </span>
              <Separator />
              <div className="space-y-4">
                {/* Color */}
                <div className="space-y-2">
                  <Label>Couleur</Label>
                  <div className="flex gap-2">
                    {['#888888', '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6'].map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-md border-2 transition-all ${edgeData.color === color ? 'border-primary scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateEdgeData({ color })}
                      />
                    ))}
                  </div>
                </div>

                {/* Stroke Width */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Épaisseur</Label>
                    <span className="text-muted-foreground">{edgeData.strokeWidth || 3}px</span>
                  </div>
                  <Slider
                    value={[edgeData.strokeWidth || 3]}
                    onValueChange={([value]) => updateEdgeData({ strokeWidth: value })}
                    min={1}
                    max={8}
                    step={1}
                  />
                </div>

                {/* Stroke Style */}
                <div className="space-y-2">
                  <Label>Style de trait</Label>
                  <Select
                    value={edgeData.strokeStyle || 'solid'}
                    onValueChange={(value) => updateEdgeData({ strokeStyle: value as 'solid' | 'dashed' | 'dotted' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Continu</SelectItem>
                      <SelectItem value="dashed">Tirets</SelectItem>
                      <SelectItem value="dotted">Pointillé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Path Type */}
                <div className="space-y-2">
                  <Label>Type de tracé</Label>
                  <Select
                    value={edgeData.pathType || 'bezier'}
                    onValueChange={(value) => updateEdgeData({ pathType: value as 'bezier' | 'smoothstep' | 'straight' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bezier">Courbe (Bézier)</SelectItem>
                      <SelectItem value="smoothstep">Angles arrondis</SelectItem>
                      <SelectItem value="straight">Ligne droite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 border-t shrink-0">
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2"
            onClick={deleteEdge}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer le lien
          </Button>
        </div>
      </div>
    );
  }

  if (!isPropertiesPanelOpen || !selectedNode) {
    return null;
  }

  const isHttpServer = selectedNode.type === 'http-server';
  const isHttpClient = selectedNode.type === 'http-client';
  const isClientGroup = selectedNode.type === 'client-group';
  const isDatabase = selectedNode.type === 'database';
  const isCache = selectedNode.type === 'cache';
  const isLoadBalancer = selectedNode.type === 'load-balancer';
  const isMessageQueue = selectedNode.type === 'message-queue';
  const isApiGateway = selectedNode.type === 'api-gateway';
  const isCircuitBreaker = selectedNode.type === 'circuit-breaker';
  const isCDN = selectedNode.type === 'cdn';
  const isWAF = selectedNode.type === 'waf';
  const isFirewall = selectedNode.type === 'firewall';
  const isServerless = selectedNode.type === 'serverless';
  const isContainer = selectedNode.type === 'container';
  const isServiceDiscovery = selectedNode.type === 'service-discovery';
  const isDNS = selectedNode.type === 'dns';
  const isCloudStorage = selectedNode.type === 'cloud-storage';
  const isCloudFunction = selectedNode.type === 'cloud-function';
  const isNetworkZone = selectedNode.type === 'network-zone';
  const isHostServer = selectedNode.type === 'host-server';
  const isApiService = selectedNode.type === 'api-service';
  const isBackgroundJob = selectedNode.type === 'background-job';
  const isIdentityProvider = selectedNode.type === 'identity-provider';

  return (
    <div className="border-l bg-background flex flex-col h-full overflow-hidden relative" style={{ width: panelWidth }} data-tour="properties-panel">
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize z-10 group flex items-center justify-center"
      >
        <div className="w-0.5 h-8 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground group-active:bg-foreground transition-colors" />
      </div>
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
                {isDatabase && <Database className="h-3 w-3" />}
                {isCache && <Zap className="h-3 w-3" />}
                {isLoadBalancer && <Share2 className="h-3 w-3" />}
                {isMessageQueue && <MessageSquare className="h-3 w-3" />}
                {isApiGateway && <Shield className="h-3 w-3" />}
                {isHttpServer ? 'HTTP Server' : isHttpClient ? 'HTTP Client' : isClientGroup ? 'Client Group' : isDatabase ? 'Database' : isCache ? 'Cache' : isLoadBalancer ? 'Load Balancer' : isMessageQueue ? 'Message Queue' : isApiGateway ? 'API Gateway' : 'Component'}
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

          {/* Database Configuration */}
          {isDatabase && (
            <DatabaseConfig
              data={selectedNode.data as DatabaseNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Cache Configuration */}
          {isCache && (
            <CacheConfig
              data={selectedNode.data as CacheNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Load Balancer Configuration */}
          {isLoadBalancer && (
            <LoadBalancerConfig
              data={selectedNode.data as LoadBalancerNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Message Queue Configuration */}
          {isMessageQueue && (
            <MessageQueueConfig
              data={selectedNode.data as MessageQueueNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* API Gateway Configuration */}
          {isApiGateway && (
            <ApiGatewayConfig
              data={selectedNode.data as ApiGatewayNodeData}
              onUpdate={updateNodeData}
              availableServices={nodes
                .filter((n): n is Node & { data: HttpServerNodeData } =>
                  n.type === 'http-server' &&
                  typeof (n.data as HttpServerNodeData).serviceName === 'string' &&
                  (n.data as HttpServerNodeData).serviceName !== ''
                )
                .map((n) => ({
                  id: n.id,
                  serviceName: n.data.serviceName as string,
                  label: n.data.label,
                }))}
            />
          )}

          {/* Circuit Breaker Configuration */}
          {isCircuitBreaker && (
            <CircuitBreakerConfig
              data={selectedNode.data as CircuitBreakerNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* CDN Configuration */}
          {isCDN && (
            <CDNConfig
              data={selectedNode.data as CDNNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* WAF Configuration */}
          {isWAF && (
            <WAFConfig
              data={selectedNode.data as WAFNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Firewall Configuration */}
          {isFirewall && (
            <FirewallConfig
              data={selectedNode.data as FirewallNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Serverless Configuration */}
          {(isServerless || isCloudFunction) && (
            <ServerlessConfig
              data={selectedNode.data as ServerlessNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Container Configuration */}
          {isContainer && (
            <ContainerConfig
              data={selectedNode.data as ContainerNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Service Discovery Configuration */}
          {isServiceDiscovery && (
            <ServiceDiscoveryConfig
              data={selectedNode.data as ServiceDiscoveryNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* DNS Configuration */}
          {isDNS && (
            <DNSConfig
              data={selectedNode.data as DNSNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Cloud Storage Configuration */}
          {isCloudStorage && (
            <CloudStorageConfig
              data={selectedNode.data as CloudStorageNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Network Zone Configuration */}
          {isNetworkZone && (
            <NetworkZoneConfig
              data={selectedNode.data as NetworkZoneNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Host Server Configuration */}
          {isHostServer && (
            <>
              <HostServerConfig
                data={selectedNode.data as HostServerNodeData}
                onUpdate={updateNodeData}
                childNodes={nodes.filter((n) => (n as Node & { parentId?: string }).parentId === selectedNode.id)}
              />
              <ServerResourcesConfig
                data={selectedNode.data as { resources?: ServerResources; degradation?: DegradationSettings }}
                onUpdate={updateNodeData}
              />
            </>
          )}

          {/* API Service Configuration */}
          {isApiService && (
            <ApiServiceConfig
              data={selectedNode.data as ApiServiceNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Background Job Configuration */}
          {isBackgroundJob && (
            <BackgroundJobConfig
              data={selectedNode.data as BackgroundJobNodeData}
              onUpdate={updateNodeData}
            />
          )}

          {/* Identity Provider Configuration */}
          {isIdentityProvider && (
            <IdentityProviderConfig
              data={selectedNode.data as IdentityProviderNodeData}
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

      {/* Microservice Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Configuration Microservice
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-name">Nom du service</Label>
            <Input
              id="service-name"
              value={(data.serviceName as string) || ''}
              onChange={(e) => onUpdate({ serviceName: e.target.value })}
              placeholder="users, orders, products..."
            />
            <p className="text-xs text-muted-foreground">
              Identifiant utilisé par l'API Gateway pour le routage
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-path">Route de base</Label>
            <Input
              id="base-path"
              value={(data.basePath as string) || ''}
              onChange={(e) => onUpdate({ basePath: e.target.value })}
              placeholder="/api/users"
            />
            <p className="text-xs text-muted-foreground">
              Préfixe des routes gérées par ce service
            </p>
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

      {/* Code Efficiency / Processing Complexity */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Efficacité du code
        </span>
        <Separator />
        <div className="space-y-2">
          <Label>Complexité du traitement</Label>
          <div className="grid grid-cols-4 gap-1">
            {([
              { value: 'light' as ProcessingComplexity, label: 'Léger', mult: '0.5x' },
              { value: 'medium' as ProcessingComplexity, label: 'Moyen', mult: '1x' },
              { value: 'heavy' as ProcessingComplexity, label: 'Lourd', mult: '2.5x' },
              { value: 'very-heavy' as ProcessingComplexity, label: 'Très lourd', mult: '5x' },
            ]).map(({ value, label, mult }) => (
              <Button
                key={value}
                variant={(data.processingComplexity || 'medium') === value ? 'default' : 'outline'}
                size="sm"
                className="text-[10px] px-1 py-1 h-auto flex flex-col"
                onClick={() => onUpdate({ processingComplexity: value })}
              >
                <span>{label}</span>
                <span className="text-[8px] opacity-60">{mult}</span>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Multiplie le temps de traitement par requête ({complexityMultipliers[data.processingComplexity || 'medium']}x).
            Simule l&apos;impact du code applicatif sur les performances.
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
              <SelectTrigger data-tour="request-mode-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Requête unique</SelectItem>
                <SelectItem value="loop" data-tour="request-mode-loop">Boucle continue</SelectItem>
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
  const [rampUpDuration, setRampUpDuration] = useState(data.rampUpDuration || 30000);
  const [burstSize, setBurstSize] = useState(data.burstSize || 5);
  const [burstInterval, setBurstInterval] = useState(data.burstInterval || 5000);

  useEffect(() => {
    setVirtualClients(data.virtualClients || 10);
    setConcurrentRequests(data.concurrentRequests || 5);
    setBaseInterval(data.baseInterval || 1000);
    setIntervalVariance(data.intervalVariance || 20);
    setRampUpDuration(data.rampUpDuration || 30000);
    setBurstSize(data.burstSize || 5);
    setBurstInterval(data.burstInterval || 5000);
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
                  <span className="text-muted-foreground">{burstInterval}ms</span>
                </div>
                <Slider
                  value={[burstInterval]}
                  onValueChange={([value]) => setBurstInterval(value)}
                  onValueCommit={([value]) => onUpdate({ burstInterval: value })}
                  min={1000}
                  max={60000}
                  step={1000}
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
                  <span className="text-muted-foreground">{rampUpDuration}ms</span>
                </div>
                <Slider
                  value={[rampUpDuration]}
                  onValueChange={([value]) => setRampUpDuration(value)}
                  onValueCommit={([value]) => onUpdate({ rampUpDuration: value })}
                  min={1000}
                  max={300000}
                  step={1000}
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
            <Label htmlFor="path">Chemin par défaut</Label>
            <Input
              id="path"
              value={data.path || '/api/data'}
              onChange={(e) => onUpdate({ path: e.target.value })}
              placeholder="/api/data"
            />
          </div>

          {/* Multiple Paths */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Chemins multiples (aléatoire)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 gap-1"
                onClick={() => {
                  const currentPaths = (data.paths as string[] | undefined) || [];
                  onUpdate({ paths: [...currentPaths, '/api/new-path'] });
                }}
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </Button>
            </div>

            {(!data.paths || (data.paths as string[]).length === 0) ? (
              <p className="text-xs text-muted-foreground italic">
                Aucun chemin supplémentaire. Le chemin par défaut sera utilisé.
              </p>
            ) : (
              <div className="space-y-2">
                {(data.paths as string[]).map((pathItem, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={pathItem}
                      onChange={(e) => {
                        const newPaths = [...((data.paths as string[] | undefined) || [])];
                        newPaths[index] = e.target.value;
                        onUpdate({ paths: newPaths });
                      }}
                      placeholder="/api/path"
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const newPaths = ((data.paths as string[] | undefined) || []).filter((_, i) => i !== index);
                        onUpdate({ paths: newPaths.length > 0 ? newPaths : undefined });
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Si des chemins sont définis, chaque requête utilisera un chemin aléatoire parmi ceux-ci.
            </p>
          </div>
        </div>
      </div>

      {/* Request Distribution */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Distribution des requêtes
        </span>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Définissez une distribution pondérée de types de requêtes. Si activée, remplace la méthode/chemin par défaut.
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Types de requêtes</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 gap-1"
              onClick={() => {
                const current = (data.requestDistribution as RequestTypeDistribution[] | undefined) || [];
                onUpdate({
                  requestDistribution: [...current, { method: 'GET' as HttpMethod, path: '/api/data', weight: 10 }],
                });
              }}
            >
              <Plus className="h-3 w-3" />
              Ajouter
            </Button>
          </div>

          {(!data.requestDistribution || (data.requestDistribution as RequestTypeDistribution[]).length === 0) ? (
            <p className="text-xs text-muted-foreground italic">
              Aucune distribution définie. La méthode et le chemin par défaut seront utilisés.
            </p>
          ) : (
            <div className="space-y-2">
              {(data.requestDistribution as RequestTypeDistribution[]).map((dist, index) => {
                const totalWeight = (data.requestDistribution as RequestTypeDistribution[]).reduce((sum, d) => sum + d.weight, 0);
                const pct = totalWeight > 0 ? Math.round((dist.weight / totalWeight) * 100) : 0;
                return (
                  <div key={index} className="flex items-center gap-1.5 p-2 bg-muted/30 rounded-md">
                    <Select
                      value={dist.method}
                      onValueChange={(value) => {
                        const newDist = [...(data.requestDistribution as RequestTypeDistribution[])];
                        newDist[index] = { ...newDist[index], method: value as HttpMethod };
                        onUpdate({ requestDistribution: newDist });
                      }}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={dist.path}
                      onChange={(e) => {
                        const newDist = [...(data.requestDistribution as RequestTypeDistribution[])];
                        newDist[index] = { ...newDist[index], path: e.target.value };
                        onUpdate({ requestDistribution: newDist });
                      }}
                      placeholder="/api/path"
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      value={dist.weight}
                      onChange={(e) => {
                        const newDist = [...(data.requestDistribution as RequestTypeDistribution[])];
                        newDist[index] = { ...newDist[index], weight: Math.max(1, parseInt(e.target.value) || 1) };
                        onUpdate({ requestDistribution: newDist });
                      }}
                      className="h-7 w-14 text-xs text-center"
                      min={1}
                    />
                    <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{pct}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => {
                        const newDist = (data.requestDistribution as RequestTypeDistribution[]).filter((_, i) => i !== index);
                        onUpdate({ requestDistribution: newDist.length > 0 ? newDist : undefined });
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================
// Server Resources Configuration (Extended)
// ============================================

interface ServerResourcesConfigProps {
  data: { resources?: ServerResources; degradation?: DegradationSettings; [key: string]: unknown };
  onUpdate: (updates: Record<string, unknown>) => void;
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

// ============================================
// Database Configuration
// ============================================

interface DatabaseConfigProps {
  data: DatabaseNodeData;
  onUpdate: (updates: Partial<DatabaseNodeData>) => void;
}

function DatabaseConfig({ data, onUpdate }: DatabaseConfigProps) {
  const config = {
    ...defaultDatabaseNodeData,
    ...data,
    connectionPool: { ...defaultDatabaseNodeData.connectionPool, ...data.connectionPool },
    performance: { ...defaultDatabaseNodeData.performance, ...data.performance },
    capacity: { ...defaultDatabaseNodeData.capacity, ...data.capacity },
  };

  // Local state for sliders
  const [maxConnections, setMaxConnections] = useState(config.connectionPool.maxConnections);
  const [minConnections, setMinConnections] = useState(config.connectionPool.minConnections);
  const [readLatency, setReadLatency] = useState(config.performance.readLatencyMs);
  const [writeLatency, setWriteLatency] = useState(config.performance.writeLatencyMs);
  const [transactionLatency, setTransactionLatency] = useState(config.performance.transactionLatencyMs);
  const [maxQps, setMaxQps] = useState(config.capacity.maxQueriesPerSecond);
  const [errorRate, setErrorRate] = useState(config.errorRate);

  // Sync local state when data changes
  useEffect(() => {
    setMaxConnections(config.connectionPool.maxConnections);
    setMinConnections(config.connectionPool.minConnections);
    setReadLatency(config.performance.readLatencyMs);
    setWriteLatency(config.performance.writeLatencyMs);
    setTransactionLatency(config.performance.transactionLatencyMs);
    setMaxQps(config.capacity.maxQueriesPerSecond);
    setErrorRate(config.errorRate);
  }, [data]);

  const updateConnectionPool = (updates: Partial<DatabaseNodeData['connectionPool']>) => {
    onUpdate({
      connectionPool: { ...config.connectionPool, ...updates },
    });
  };

  const updatePerformance = (updates: Partial<DatabaseNodeData['performance']>) => {
    onUpdate({
      performance: { ...config.performance, ...updates },
    });
  };

  return (
    <>
      {/* Database Type */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Type de base de données
        </span>
        <Separator />
        <Select
          value={config.databaseType}
          onValueChange={(value) => onUpdate({ databaseType: value as DatabaseType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postgresql">PostgreSQL</SelectItem>
            <SelectItem value="mysql">MySQL</SelectItem>
            <SelectItem value="mongodb">MongoDB</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Connection Pool */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Pool de connexions
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Connexions max</label>
              <span className="text-muted-foreground">{maxConnections}</span>
            </div>
            <Slider
              value={[maxConnections]}
              onValueChange={([value]) => setMaxConnections(value)}
              onValueCommit={([value]) => updateConnectionPool({ maxConnections: value })}
              min={1}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Connexions min</label>
              <span className="text-muted-foreground">{minConnections}</span>
            </div>
            <Slider
              value={[minConnections]}
              onValueChange={([value]) => setMinConnections(value)}
              onValueCommit={([value]) => updateConnectionPool({ minConnections: value })}
              min={0}
              max={20}
              step={1}
            />
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Latences
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Lecture</label>
              <span className="text-muted-foreground">{readLatency}ms</span>
            </div>
            <Slider
              value={[readLatency]}
              onValueChange={([value]) => setReadLatency(value)}
              onValueCommit={([value]) => updatePerformance({ readLatencyMs: value })}
              min={1}
              max={500}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Écriture</label>
              <span className="text-muted-foreground">{writeLatency}ms</span>
            </div>
            <Slider
              value={[writeLatency]}
              onValueChange={([value]) => setWriteLatency(value)}
              onValueCommit={([value]) => updatePerformance({ writeLatencyMs: value })}
              min={5}
              max={1000}
              step={5}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Transaction</label>
              <span className="text-muted-foreground">{transactionLatency}ms</span>
            </div>
            <Slider
              value={[transactionLatency]}
              onValueChange={([value]) => setTransactionLatency(value)}
              onValueCommit={([value]) => updatePerformance({ transactionLatencyMs: value })}
              min={10}
              max={2000}
              step={10}
            />
          </div>
        </div>
      </div>

      {/* Capacity */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Capacité
        </span>
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label>Max requêtes/sec</label>
            <span className="text-muted-foreground">{maxQps}</span>
          </div>
          <Slider
            value={[maxQps]}
            onValueChange={([value]) => setMaxQps(value)}
            onValueCommit={([value]) => onUpdate({ capacity: { maxQueriesPerSecond: value } })}
            min={10}
            max={10000}
            step={10}
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
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Pourcentage de requêtes qui échoueront
          </p>
        </div>
      </div>
    </>
  );
}

// ============================================
// Cache Configuration
// ============================================

interface CacheConfigProps {
  data: CacheNodeData;
  onUpdate: (updates: Partial<CacheNodeData>) => void;
}

function CacheConfig({ data, onUpdate }: CacheConfigProps) {
  const config = {
    ...defaultCacheNodeData,
    ...data,
    configuration: { ...defaultCacheNodeData.configuration, ...data.configuration },
    performance: { ...defaultCacheNodeData.performance, ...data.performance },
  };

  // Local state for sliders
  const [maxMemory, setMaxMemory] = useState(config.configuration.maxMemoryMB);
  const [maxKeys, setMaxKeys] = useState(config.configuration.maxKeys);
  const [defaultTTL, setDefaultTTL] = useState(config.configuration.defaultTTLSeconds);
  const [getLatency, setGetLatency] = useState(config.performance.getLatencyMs);
  const [setLatency, setSetLatency] = useState(config.performance.setLatencyMs);
  const [hitRatio, setHitRatio] = useState(config.initialHitRatio);
  const [hitVariance, setHitVariance] = useState(config.hitRatioVariance);
  const [warmUpDuration, setWarmUpDuration] = useState(config.warmUpDurationMs);

  // Sync local state when data changes
  useEffect(() => {
    setMaxMemory(config.configuration.maxMemoryMB);
    setMaxKeys(config.configuration.maxKeys);
    setDefaultTTL(config.configuration.defaultTTLSeconds);
    setGetLatency(config.performance.getLatencyMs);
    setSetLatency(config.performance.setLatencyMs);
    setHitRatio(config.initialHitRatio);
    setHitVariance(config.hitRatioVariance);
    setWarmUpDuration(config.warmUpDurationMs);
  }, [data]);

  const updateConfiguration = (updates: Partial<CacheNodeData['configuration']>) => {
    onUpdate({
      configuration: { ...config.configuration, ...updates },
    });
  };

  const updatePerformance = (updates: Partial<CacheNodeData['performance']>) => {
    onUpdate({
      performance: { ...config.performance, ...updates },
    });
  };

  return (
    <>
      {/* Cache Type */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Type de cache
        </span>
        <Separator />
        <Select
          value={config.cacheType}
          onValueChange={(value) => onUpdate({ cacheType: value as CacheType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="redis">Redis</SelectItem>
            <SelectItem value="memcached">Memcached</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Memory Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Configuration mémoire
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Mémoire max</label>
              <span className="text-muted-foreground">{maxMemory}MB</span>
            </div>
            <Slider
              value={[maxMemory]}
              onValueChange={([value]) => setMaxMemory(value)}
              onValueCommit={([value]) => updateConfiguration({ maxMemoryMB: value })}
              min={64}
              max={8192}
              step={64}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Max clés</label>
              <span className="text-muted-foreground">{maxKeys.toLocaleString()}</span>
            </div>
            <Slider
              value={[maxKeys]}
              onValueChange={([value]) => setMaxKeys(value)}
              onValueCommit={([value]) => updateConfiguration({ maxKeys: value })}
              min={1000}
              max={1000000}
              step={1000}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>TTL par défaut</label>
              <span className="text-muted-foreground">{defaultTTL}s</span>
            </div>
            <Slider
              value={[defaultTTL]}
              onValueChange={([value]) => setDefaultTTL(value)}
              onValueCommit={([value]) => updateConfiguration({ defaultTTLSeconds: value })}
              min={60}
              max={86400}
              step={60}
            />
          </div>
          <div className="space-y-2">
            <Label>Politique d'éviction</Label>
            <Select
              value={config.configuration.evictionPolicy}
              onValueChange={(value) => updateConfiguration({ evictionPolicy: value as EvictionPolicy })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lru">LRU (Least Recently Used)</SelectItem>
                <SelectItem value="lfu">LFU (Least Frequently Used)</SelectItem>
                <SelectItem value="fifo">FIFO (First In First Out)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Latences
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>GET</label>
              <span className="text-muted-foreground">{getLatency}ms</span>
            </div>
            <Slider
              value={[getLatency]}
              onValueChange={([value]) => setGetLatency(value)}
              onValueCommit={([value]) => updatePerformance({ getLatencyMs: value })}
              min={0.1}
              max={10}
              step={0.1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>SET</label>
              <span className="text-muted-foreground">{setLatency}ms</span>
            </div>
            <Slider
              value={[setLatency]}
              onValueChange={([value]) => setSetLatency(value)}
              onValueCommit={([value]) => updatePerformance({ setLatencyMs: value })}
              min={0.1}
              max={20}
              step={0.1}
            />
          </div>
        </div>
      </div>

      {/* Hit Ratio Simulation */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Simulation Hit/Miss
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Hit ratio initial</label>
              <span className="text-muted-foreground">{hitRatio}%</span>
            </div>
            <Slider
              value={[hitRatio]}
              onValueChange={([value]) => setHitRatio(value)}
              onValueCommit={([value]) => onUpdate({ initialHitRatio: value })}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Variance</label>
              <span className="text-muted-foreground">±{hitVariance}%</span>
            </div>
            <Slider
              value={[hitVariance]}
              onValueChange={([value]) => setHitVariance(value)}
              onValueCommit={([value]) => onUpdate({ hitRatioVariance: value })}
              min={0}
              max={30}
              step={1}
            />
          </div>
        </div>
      </div>

      {/* Warm-up Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Période de warm-up
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="warmup-enabled">Activer le warm-up</Label>
            <Switch
              id="warmup-enabled"
              checked={config.warmUpEnabled}
              onCheckedChange={(checked) => onUpdate({ warmUpEnabled: checked })}
            />
          </div>

          {config.warmUpEnabled && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label>Durée</label>
                <span className="text-muted-foreground">{warmUpDuration}ms</span>
              </div>
              <Slider
                value={[warmUpDuration]}
                onValueChange={([value]) => setWarmUpDuration(value)}
                onValueCommit={([value]) => onUpdate({ warmUpDurationMs: value })}
                min={1000}
                max={300000}
                step={1000}
              />
              <p className="text-xs text-muted-foreground">
                Pendant le warm-up, le hit ratio augmente progressivement
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================
// Load Balancer Configuration
// ============================================

interface LoadBalancerConfigProps {
  data: LoadBalancerNodeData;
  onUpdate: (updates: Partial<LoadBalancerNodeData>) => void;
}

function LoadBalancerConfig({ data, onUpdate }: LoadBalancerConfigProps) {
  const config = {
    ...defaultLoadBalancerNodeData,
    ...data,
    healthCheck: { ...defaultLoadBalancerNodeData.healthCheck, ...data.healthCheck },
  };

  // Local state for sliders
  const [healthCheckInterval, setHealthCheckInterval] = useState(config.healthCheck.intervalMs);
  const [healthCheckTimeout, setHealthCheckTimeout] = useState(config.healthCheck.timeoutMs);
  const [unhealthyThreshold, setUnhealthyThreshold] = useState(config.healthCheck.unhealthyThreshold);
  const [sessionTTL, setSessionTTL] = useState(config.sessionTTLSeconds);

  // Sync local state when data changes
  useEffect(() => {
    setHealthCheckInterval(config.healthCheck.intervalMs);
    setHealthCheckTimeout(config.healthCheck.timeoutMs);
    setUnhealthyThreshold(config.healthCheck.unhealthyThreshold);
    setSessionTTL(config.sessionTTLSeconds);
  }, [data]);

  const updateHealthCheck = (updates: Partial<LoadBalancerNodeData['healthCheck']>) => {
    onUpdate({
      healthCheck: { ...config.healthCheck, ...updates },
    });
  };

  return (
    <>
      {/* Algorithm */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Algorithme de répartition
        </span>
        <Separator />
        <Select
          value={config.algorithm}
          onValueChange={(value) => onUpdate({ algorithm: value as LoadBalancerAlgorithm })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round-robin">Round Robin</SelectItem>
            <SelectItem value="least-connections">Least Connections</SelectItem>
            <SelectItem value="ip-hash">IP Hash</SelectItem>
            <SelectItem value="weighted">Weighted</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {config.algorithm === 'round-robin' && 'Distribue les requêtes de manière équitable'}
          {config.algorithm === 'least-connections' && 'Route vers le serveur avec le moins de connexions'}
          {config.algorithm === 'ip-hash' && 'Routage cohérent basé sur l\'identifiant client'}
          {config.algorithm === 'weighted' && 'Distribution basée sur les poids des serveurs'}
        </p>
      </div>

      {/* Health Check */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Health Check
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="healthcheck-enabled">Activer</Label>
            <Switch
              id="healthcheck-enabled"
              checked={config.healthCheck.enabled}
              onCheckedChange={(checked) => updateHealthCheck({ enabled: checked })}
            />
          </div>

          {config.healthCheck.enabled && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label>Intervalle</label>
                  <span className="text-muted-foreground">{healthCheckInterval}ms</span>
                </div>
                <Slider
                  value={[healthCheckInterval]}
                  onValueChange={([value]) => setHealthCheckInterval(value)}
                  onValueCommit={([value]) => updateHealthCheck({ intervalMs: value })}
                  min={1000}
                  max={60000}
                  step={1000}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label>Timeout</label>
                  <span className="text-muted-foreground">{healthCheckTimeout}ms</span>
                </div>
                <Slider
                  value={[healthCheckTimeout]}
                  onValueChange={([value]) => setHealthCheckTimeout(value)}
                  onValueCommit={([value]) => updateHealthCheck({ timeoutMs: value })}
                  min={1000}
                  max={30000}
                  step={1000}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label>Seuil d'échec</label>
                  <span className="text-muted-foreground">{unhealthyThreshold}</span>
                </div>
                <Slider
                  value={[unhealthyThreshold]}
                  onValueChange={([value]) => setUnhealthyThreshold(value)}
                  onValueCommit={([value]) => updateHealthCheck({ unhealthyThreshold: value })}
                  min={1}
                  max={10}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Échecs consécutifs avant de marquer comme non sain
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sticky Sessions */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Sessions persistantes
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="sticky-sessions">Activer</Label>
            <Switch
              id="sticky-sessions"
              checked={config.stickySessions}
              onCheckedChange={(checked) => onUpdate({ stickySessions: checked })}
            />
          </div>

          {config.stickySessions && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label>Durée de session</label>
                <span className="text-muted-foreground">{sessionTTL}s</span>
              </div>
              <Slider
                value={[sessionTTL]}
                onValueChange={([value]) => setSessionTTL(value)}
                onValueCommit={([value]) => onUpdate({ sessionTTLSeconds: value })}
                min={60}
                max={86400}
                step={60}
              />
              <p className="text-xs text-muted-foreground">
                Les requêtes d'un même client sont routées vers le même serveur
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================
// Message Queue Configuration
// ============================================

interface MessageQueueConfigProps {
  data: MessageQueueNodeData;
  onUpdate: (updates: Partial<MessageQueueNodeData>) => void;
}

function MessageQueueConfig({ data, onUpdate }: MessageQueueConfigProps) {
  const config = {
    ...defaultMessageQueueNodeData,
    ...data,
    configuration: { ...defaultMessageQueueNodeData.configuration, ...data.configuration },
    performance: { ...defaultMessageQueueNodeData.performance, ...data.performance },
  };

  // Local state for sliders
  const [maxQueueSize, setMaxQueueSize] = useState(config.configuration.maxQueueSize);
  const [messageRetention, setMessageRetention] = useState(config.configuration.messageRetentionMs / 3600000); // hours
  const [deliveryDelay, setDeliveryDelay] = useState(config.configuration.deliveryDelayMs);
  const [publishLatency, setPublishLatency] = useState(config.performance.publishLatencyMs);
  const [consumeLatency, setConsumeLatency] = useState(config.performance.consumeLatencyMs);
  const [messagesPerSecond, setMessagesPerSecond] = useState(config.performance.messagesPerSecond);
  const [consumerCount, setConsumerCount] = useState(config.consumerCount);
  const [prefetchCount, setPrefetchCount] = useState(config.prefetchCount);
  const [maxRetries, setMaxRetries] = useState(config.maxRetries);

  // Sync local state when data changes
  useEffect(() => {
    setMaxQueueSize(config.configuration.maxQueueSize);
    setMessageRetention(config.configuration.messageRetentionMs / 3600000);
    setDeliveryDelay(config.configuration.deliveryDelayMs);
    setPublishLatency(config.performance.publishLatencyMs);
    setConsumeLatency(config.performance.consumeLatencyMs);
    setMessagesPerSecond(config.performance.messagesPerSecond);
    setConsumerCount(config.consumerCount);
    setPrefetchCount(config.prefetchCount);
    setMaxRetries(config.maxRetries);
  }, [data]);

  const updateConfiguration = (updates: Partial<MessageQueueNodeData['configuration']>) => {
    onUpdate({
      configuration: { ...config.configuration, ...updates },
    });
  };

  const updatePerformance = (updates: Partial<MessageQueueNodeData['performance']>) => {
    onUpdate({
      performance: { ...config.performance, ...updates },
    });
  };

  return (
    <>
      {/* Queue Type */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Type de file de messages
        </span>
        <Separator />
        <Select
          value={config.queueType}
          onValueChange={(value) => onUpdate({ queueType: value as MessageQueueType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rabbitmq">RabbitMQ</SelectItem>
            <SelectItem value="kafka">Apache Kafka</SelectItem>
            <SelectItem value="sqs">AWS SQS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mode */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Mode de file
        </span>
        <Separator />
        <Select
          value={config.mode}
          onValueChange={(value) => onUpdate({ mode: value as MessageQueueMode })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fifo">FIFO (Premier entré, premier sorti)</SelectItem>
            <SelectItem value="priority">File de priorité</SelectItem>
            <SelectItem value="pubsub">Pub/Sub (Publication/Abonnement)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {config.mode === 'fifo' && 'Les messages sont traités dans l\'ordre d\'arrivée'}
          {config.mode === 'priority' && 'Les messages sont traités par ordre de priorité'}
          {config.mode === 'pubsub' && 'Les messages sont diffusés à tous les abonnés'}
        </p>
      </div>

      {/* Configuration */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Configuration
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Taille max de la file</label>
              <span className="text-muted-foreground">{maxQueueSize.toLocaleString()}</span>
            </div>
            <Slider
              value={[maxQueueSize]}
              onValueChange={([value]) => setMaxQueueSize(value)}
              onValueCommit={([value]) => updateConfiguration({ maxQueueSize: value })}
              min={100}
              max={100000}
              step={100}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Rétention des messages</label>
              <span className="text-muted-foreground">{messageRetention}h</span>
            </div>
            <Slider
              value={[messageRetention]}
              onValueChange={([value]) => setMessageRetention(value)}
              onValueCommit={([value]) => updateConfiguration({ messageRetentionMs: value * 3600000 })}
              min={1}
              max={168}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Délai de livraison</label>
              <span className="text-muted-foreground">{deliveryDelay}ms</span>
            </div>
            <Slider
              value={[deliveryDelay]}
              onValueChange={([value]) => setDeliveryDelay(value)}
              onValueCommit={([value]) => updateConfiguration({ deliveryDelayMs: value })}
              min={0}
              max={60000}
              step={100}
            />
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Performance
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Latence publication</label>
              <span className="text-muted-foreground">{publishLatency}ms</span>
            </div>
            <Slider
              value={[publishLatency]}
              onValueChange={([value]) => setPublishLatency(value)}
              onValueCommit={([value]) => updatePerformance({ publishLatencyMs: value })}
              min={1}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Latence consommation</label>
              <span className="text-muted-foreground">{consumeLatency}ms</span>
            </div>
            <Slider
              value={[consumeLatency]}
              onValueChange={([value]) => setConsumeLatency(value)}
              onValueCommit={([value]) => updatePerformance({ consumeLatencyMs: value })}
              min={1}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Max messages/sec</label>
              <span className="text-muted-foreground">{messagesPerSecond}</span>
            </div>
            <Slider
              value={[messagesPerSecond]}
              onValueChange={([value]) => setMessagesPerSecond(value)}
              onValueCommit={([value]) => updatePerformance({ messagesPerSecond: value })}
              min={10}
              max={10000}
              step={10}
            />
          </div>
        </div>
      </div>

      {/* Consumers */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Consommateurs
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Nombre de consommateurs</label>
              <span className="text-muted-foreground">{consumerCount}</span>
            </div>
            <Slider
              value={[consumerCount]}
              onValueChange={([value]) => setConsumerCount(value)}
              onValueCommit={([value]) => onUpdate({ consumerCount: value })}
              min={1}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Prefetch count</label>
              <span className="text-muted-foreground">{prefetchCount}</span>
            </div>
            <Slider
              value={[prefetchCount]}
              onValueChange={([value]) => setPrefetchCount(value)}
              onValueCommit={([value]) => onUpdate({ prefetchCount: value })}
              min={1}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Nombre de messages pré-chargés par consommateur
            </p>
          </div>
          <div className="space-y-2">
            <Label>Mode d'acquittement</Label>
            <Select
              value={config.ackMode}
              onValueChange={(value) => onUpdate({ ackMode: value as 'auto' | 'manual' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatique</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Reliability */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Fiabilité
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="retry-enabled">Activer les réessais</Label>
            <Switch
              id="retry-enabled"
              checked={config.retryEnabled}
              onCheckedChange={(checked) => onUpdate({ retryEnabled: checked })}
            />
          </div>

          {config.retryEnabled && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label>Max réessais</label>
                <span className="text-muted-foreground">{maxRetries}</span>
              </div>
              <Slider
                value={[maxRetries]}
                onValueChange={([value]) => setMaxRetries(value)}
                onValueCommit={([value]) => onUpdate({ maxRetries: value })}
                min={1}
                max={10}
                step={1}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="dlq-enabled">File des messages morts (DLQ)</Label>
            <Switch
              id="dlq-enabled"
              checked={config.deadLetterEnabled}
              onCheckedChange={(checked) => onUpdate({ deadLetterEnabled: checked })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Les messages échoués sont envoyés dans une file séparée pour analyse
          </p>
        </div>
      </div>
    </>
  );
}

// ============================================
// API Gateway Configuration
// ============================================

interface AvailableService {
  id: string;
  serviceName: string;
  label: string;
}

interface ApiGatewayConfigProps {
  data: ApiGatewayNodeData;
  onUpdate: (updates: Partial<ApiGatewayNodeData>) => void;
  availableServices: AvailableService[];
}

function ApiGatewayConfig({ data, onUpdate, availableServices }: ApiGatewayConfigProps) {
  const config = {
    ...defaultApiGatewayNodeData,
    ...data,
    rateLimiting: { ...defaultApiGatewayNodeData.rateLimiting, ...data.rateLimiting },
    routing: { ...defaultApiGatewayNodeData.routing, ...data.routing },
    routeRules: data.routeRules || [],
  };

  // Local state for sliders
  const [authFailureRate, setAuthFailureRate] = useState(config.authFailureRate);
  const [requestsPerSecond, setRequestsPerSecond] = useState(config.rateLimiting.requestsPerSecond);
  const [burstSize, setBurstSize] = useState(config.rateLimiting.burstSize);
  const [timeout, setTimeout] = useState(config.routing.timeout);
  const [baseLatency, setBaseLatency] = useState(config.baseLatencyMs);
  const [errorRate, setErrorRate] = useState(config.errorRate);

  // Sync local state when data changes
  useEffect(() => {
    setAuthFailureRate(config.authFailureRate);
    setRequestsPerSecond(config.rateLimiting.requestsPerSecond);
    setBurstSize(config.rateLimiting.burstSize);
    setTimeout(config.routing.timeout);
    setBaseLatency(config.baseLatencyMs);
    setErrorRate(config.errorRate);
  }, [data]);

  const updateRateLimiting = (updates: Partial<ApiGatewayNodeData['rateLimiting']>) => {
    onUpdate({
      rateLimiting: { ...config.rateLimiting, ...updates },
    });
  };

  const updateRouting = (updates: Partial<ApiGatewayNodeData['routing']>) => {
    onUpdate({
      routing: { ...config.routing, ...updates },
    });
  };

  const addRouteRule = () => {
    const newRule: ApiGatewayRouteRule = {
      id: `rule-${Date.now()}`,
      pathPattern: '/api/*',
      targetServiceName: availableServices[0]?.serviceName || '',
      priority: config.routeRules.length,
    };
    onUpdate({ routeRules: [...config.routeRules, newRule] });
  };

  const updateRouteRule = (ruleId: string, updates: Partial<ApiGatewayRouteRule>) => {
    onUpdate({
      routeRules: config.routeRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ),
    });
  };

  const removeRouteRule = (ruleId: string) => {
    onUpdate({
      routeRules: config.routeRules.filter((rule) => rule.id !== ruleId),
    });
  };

  return (
    <>
      {/* Authentication */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Authentification
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type d'authentification</Label>
            <Select
              value={config.authType}
              onValueChange={(value) => onUpdate({ authType: value as ApiGatewayAuthType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                <SelectItem value="api-key">Clé API</SelectItem>
                <SelectItem value="jwt">JWT</SelectItem>
                <SelectItem value="oauth2">OAuth2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.authType !== 'none' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <label>Taux d'échec auth</label>
                <span className="text-muted-foreground">{authFailureRate}%</span>
              </div>
              <Slider
                value={[authFailureRate]}
                onValueChange={([value]) => setAuthFailureRate(value)}
                onValueCommit={([value]) => onUpdate({ authFailureRate: value })}
                min={0}
                max={50}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Simule des échecs d'authentification
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Rate Limiting */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Limitation de débit
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="ratelimit-enabled">Activer</Label>
            <Switch
              id="ratelimit-enabled"
              checked={config.rateLimiting.enabled}
              onCheckedChange={(checked) => updateRateLimiting({ enabled: checked })}
            />
          </div>

          {config.rateLimiting.enabled && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label>Requêtes/sec</label>
                  <span className="text-muted-foreground">{requestsPerSecond}</span>
                </div>
                <Slider
                  value={[requestsPerSecond]}
                  onValueChange={([value]) => setRequestsPerSecond(value)}
                  onValueCommit={([value]) => updateRateLimiting({ requestsPerSecond: value })}
                  min={1}
                  max={1000}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label>Taille du burst</label>
                  <span className="text-muted-foreground">{burstSize}</span>
                </div>
                <Slider
                  value={[burstSize]}
                  onValueChange={([value]) => setBurstSize(value)}
                  onValueCommit={([value]) => updateRateLimiting({ burstSize: value })}
                  min={1}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Nombre de requêtes autorisées en rafale
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Routing */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Routage
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="path-prefix">Préfixe de chemin</Label>
            <Input
              id="path-prefix"
              value={config.routing.pathPrefix}
              onChange={(e) => updateRouting({ pathPrefix: e.target.value })}
              placeholder="/api"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="strip-prefix">Retirer le préfixe</Label>
            <Switch
              id="strip-prefix"
              checked={config.routing.stripPrefix}
              onCheckedChange={(checked) => updateRouting({ stripPrefix: checked })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Timeout</label>
              <span className="text-muted-foreground">{timeout}ms</span>
            </div>
            <Slider
              value={[timeout]}
              onValueChange={([value]) => setTimeout(value)}
              onValueCommit={([value]) => updateRouting({ timeout: value })}
              min={1000}
              max={120000}
              step={1000}
            />
          </div>
        </div>
      </div>

      {/* Service Routing Rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Règles de routage
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 gap-1"
            onClick={addRouteRule}
            disabled={availableServices.length === 0}
          >
            <Plus className="h-3 w-3" />
            Ajouter
          </Button>
        </div>
        <Separator />

        {availableServices.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Aucun service disponible. Configurez d'abord le "Nom du service" sur vos serveurs HTTP.
          </p>
        ) : config.routeRules.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Aucune règle définie. Les requêtes seront routées vers le premier service connecté.
          </p>
        ) : (
          <div className="space-y-3">
            {config.routeRules.map((rule, index) => (
              <div
                key={rule.id}
                className="p-3 border rounded-lg space-y-3 bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeRouteRule(rule.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Pattern de route</Label>
                  <Input
                    value={rule.pathPattern}
                    onChange={(e) => updateRouteRule(rule.id, { pathPattern: e.target.value })}
                    placeholder="/users/*, /api/orders/*"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Service cible</Label>
                  <Select
                    value={rule.targetServiceName}
                    onValueChange={(value) => updateRouteRule(rule.id, { targetServiceName: value })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Sélectionner un service" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices.map((service) => (
                        <SelectItem key={service.id} value={service.serviceName}>
                          <div className="flex items-center gap-2">
                            <Server className="h-3 w-3" />
                            <span>{service.serviceName}</span>
                            <span className="text-muted-foreground text-xs">({service.label})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Les règles sont évaluées dans l'ordre. Utilisez * comme joker.
        </p>
      </div>

      {/* Performance */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Performance
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Latence de base</label>
              <span className="text-muted-foreground">{baseLatency}ms</span>
            </div>
            <Slider
              value={[baseLatency]}
              onValueChange={([value]) => setBaseLatency(value)}
              onValueCommit={([value]) => onUpdate({ baseLatencyMs: value })}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Taux d'erreur</label>
              <span className="text-muted-foreground">{errorRate}%</span>
            </div>
            <Slider
              value={[errorRate]}
              onValueChange={([value]) => setErrorRate(value)}
              onValueCommit={([value]) => onUpdate({ errorRate: value })}
              min={0}
              max={50}
              step={1}
            />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Fonctionnalités
        </span>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="cors-enabled">CORS</Label>
            <Switch
              id="cors-enabled"
              checked={config.corsEnabled}
              onCheckedChange={(checked) => onUpdate({ corsEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="logging-enabled">Logging</Label>
            <Switch
              id="logging-enabled"
              checked={config.loggingEnabled}
              onCheckedChange={(checked) => onUpdate({ loggingEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="compression-enabled">Compression</Label>
            <Switch
              id="compression-enabled"
              checked={config.compressionEnabled}
              onCheckedChange={(checked) => onUpdate({ compressionEnabled: checked })}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// Circuit Breaker Configuration
// ============================================

function CircuitBreakerConfig({ data, onUpdate }: { data: CircuitBreakerNodeData; onUpdate: (u: Partial<CircuitBreakerNodeData>) => void }) {
  const config = { ...defaultCircuitBreakerData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Circuit Breaker</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Seuil d'erreurs (ouverture)</Label>
          <Input type="number" value={config.failureThreshold} onChange={(e) => onUpdate({ failureThreshold: parseInt(e.target.value) || 5 })} />
        </div>
        <div className="space-y-2">
          <Label>Seuil de succes (fermeture)</Label>
          <Input type="number" value={config.successThreshold} onChange={(e) => onUpdate({ successThreshold: parseInt(e.target.value) || 3 })} />
        </div>
        <div className="space-y-2">
          <Label>Timeout (ms)</Label>
          <Input type="number" value={config.timeout} onChange={(e) => onUpdate({ timeout: parseInt(e.target.value) || 30000 })} />
        </div>
        <div className="space-y-2">
          <Label>Requetes en half-open</Label>
          <Input type="number" value={config.halfOpenMaxRequests} onChange={(e) => onUpdate({ halfOpenMaxRequests: parseInt(e.target.value) || 3 })} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// CDN Configuration
// ============================================

function CDNConfig({ data, onUpdate }: { data: CDNNodeData; onUpdate: (u: Partial<CDNNodeData>) => void }) {
  const config = { ...defaultCDNNodeData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">CDN</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={config.provider} onValueChange={(v) => onUpdate({ provider: v as CDNNodeData['provider'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cloudflare">Cloudflare</SelectItem>
              <SelectItem value="cloudfront">CloudFront</SelectItem>
              <SelectItem value="akamai">Akamai</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Cache Hit Ratio</Label>
            <span className="text-muted-foreground">{config.cacheHitRatio}%</span>
          </div>
          <Slider value={[config.cacheHitRatio]} onValueChange={([v]) => onUpdate({ cacheHitRatio: v })} max={100} step={1} />
        </div>
        <div className="space-y-2">
          <Label>Latence edge (ms)</Label>
          <Input type="number" value={config.edgeLatencyMs} onChange={(e) => onUpdate({ edgeLatencyMs: parseInt(e.target.value) || 5 })} />
        </div>
        <div className="space-y-2">
          <Label>Latence origin (ms)</Label>
          <Input type="number" value={config.originLatencyMs} onChange={(e) => onUpdate({ originLatencyMs: parseInt(e.target.value) || 50 })} />
        </div>
        <div className="space-y-2">
          <Label>TTL cache (s)</Label>
          <Input type="number" value={config.cacheTTLSeconds} onChange={(e) => onUpdate({ cacheTTLSeconds: parseInt(e.target.value) || 3600 })} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// WAF Configuration
// ============================================

function WAFConfig({ data, onUpdate }: { data: WAFNodeData; onUpdate: (u: Partial<WAFNodeData>) => void }) {
  const config = { ...defaultWAFNodeData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">WAF</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={config.provider} onValueChange={(v) => onUpdate({ provider: v as WAFNodeData['provider'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aws-waf">AWS WAF</SelectItem>
              <SelectItem value="cloudflare">Cloudflare</SelectItem>
              <SelectItem value="azure-waf">Azure WAF</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Taux de blocage</Label>
            <span className="text-muted-foreground">{config.blockRate}%</span>
          </div>
          <Slider value={[config.blockRate]} onValueChange={([v]) => onUpdate({ blockRate: v })} max={100} step={1} />
        </div>
        <div className="space-y-2">
          <Label>Latence inspection (ms)</Label>
          <Input type="number" value={config.inspectionLatencyMs} onChange={(e) => onUpdate({ inspectionLatencyMs: parseInt(e.target.value) || 2 })} />
        </div>
        <div className="space-y-3 pt-2">
          <span className="text-xs text-muted-foreground">Regles</span>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="waf-sql">SQL Injection</Label>
              <Switch id="waf-sql" checked={config.rules.sqlInjection} onCheckedChange={(c) => onUpdate({ rules: { ...config.rules, sqlInjection: c } })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="waf-xss">XSS</Label>
              <Switch id="waf-xss" checked={config.rules.xss} onCheckedChange={(c) => onUpdate({ rules: { ...config.rules, xss: c } })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="waf-rate">Rate Limiting</Label>
              <Switch id="waf-rate" checked={config.rules.rateLimiting} onCheckedChange={(c) => onUpdate({ rules: { ...config.rules, rateLimiting: c } })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="waf-ip">IP Blocking</Label>
              <Switch id="waf-ip" checked={config.rules.ipBlocking} onCheckedChange={(c) => onUpdate({ rules: { ...config.rules, ipBlocking: c } })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Firewall Configuration
// ============================================

function FirewallConfig({ data, onUpdate }: { data: FirewallNodeData; onUpdate: (u: Partial<FirewallNodeData>) => void }) {
  const config = { ...defaultFirewallData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Firewall</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Action par defaut</Label>
          <Select value={config.defaultAction} onValueChange={(v) => onUpdate({ defaultAction: v as 'allow' | 'deny' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="allow">Allow</SelectItem>
              <SelectItem value="deny">Deny</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Latence inspection (ms)</Label>
          <Input type="number" value={config.inspectionLatencyMs} onChange={(e) => onUpdate({ inspectionLatencyMs: parseInt(e.target.value) || 1 })} />
        </div>
        <div className="space-y-2">
          <Label>Ports autorises</Label>
          <Input value={config.allowedPorts.join(', ')} onChange={(e) => onUpdate({ allowedPorts: e.target.value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p)) })} placeholder="80, 443, 8080" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Serverless Configuration
// ============================================

function ServerlessConfig({ data, onUpdate }: { data: ServerlessNodeData; onUpdate: (u: Partial<ServerlessNodeData>) => void }) {
  const config = { ...defaultServerlessData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Serverless</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={config.provider} onValueChange={(v) => onUpdate({ provider: v as ServerlessNodeData['provider'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aws">AWS</SelectItem>
              <SelectItem value="azure">Azure</SelectItem>
              <SelectItem value="gcp">GCP</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Runtime</Label>
          <Input value={config.runtime} onChange={(e) => onUpdate({ runtime: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Memoire (MB)</Label>
          <Select value={String(config.memoryMB)} onValueChange={(v) => onUpdate({ memoryMB: parseInt(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="128">128 MB</SelectItem>
              <SelectItem value="256">256 MB</SelectItem>
              <SelectItem value="512">512 MB</SelectItem>
              <SelectItem value="1024">1024 MB</SelectItem>
              <SelectItem value="2048">2048 MB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cold Start (ms)</Label>
          <Input type="number" value={config.coldStartMs} onChange={(e) => onUpdate({ coldStartMs: parseInt(e.target.value) || 500 })} />
        </div>
        <div className="space-y-2">
          <Label>Warm Start (ms)</Label>
          <Input type="number" value={config.warmStartMs} onChange={(e) => onUpdate({ warmStartMs: parseInt(e.target.value) || 5 })} />
        </div>
        <div className="space-y-2">
          <Label>Concurrence max</Label>
          <Input type="number" value={config.concurrencyLimit} onChange={(e) => onUpdate({ concurrencyLimit: parseInt(e.target.value) || 100 })} />
        </div>
        <div className="space-y-2">
          <Label>Instances min / max</Label>
          <div className="flex gap-2">
            <Input type="number" value={config.minInstances} onChange={(e) => onUpdate({ minInstances: parseInt(e.target.value) || 0 })} placeholder="Min" />
            <Input type="number" value={config.maxInstances} onChange={(e) => onUpdate({ maxInstances: parseInt(e.target.value) || 100 })} placeholder="Max" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Container Configuration
// ============================================

function ContainerConfig({ data, onUpdate }: { data: ContainerNodeData; onUpdate: (u: Partial<ContainerNodeData>) => void }) {
  const config = { ...defaultContainerData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Container</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Image</Label>
          <Input value={config.image} onChange={(e) => onUpdate({ image: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Replicas</Label>
          <Input type="number" value={config.replicas} onChange={(e) => onUpdate({ replicas: parseInt(e.target.value) || 1 })} />
        </div>
        <div className="space-y-2">
          <Label>CPU Limit</Label>
          <Input value={config.cpuLimit} onChange={(e) => onUpdate({ cpuLimit: e.target.value })} placeholder="500m" />
        </div>
        <div className="space-y-2">
          <Label>Memory Limit</Label>
          <Input value={config.memoryLimit} onChange={(e) => onUpdate({ memoryLimit: e.target.value })} placeholder="512Mi" />
        </div>
        <div className="space-y-2">
          <Label>CPU Limit (cores)</Label>
          <Input type="number" step="0.5" min="0.5" value={config.cpuLimitCores ?? ''} onChange={(e) => onUpdate({ cpuLimitCores: parseFloat(e.target.value) || 1 })} placeholder="2" />
        </div>
        <div className="space-y-2">
          <Label>Memory Limit (MB)</Label>
          <Input type="number" min="64" step="64" value={config.memoryLimitMB ?? ''} onChange={(e) => onUpdate({ memoryLimitMB: parseInt(e.target.value) || 256 })} placeholder="512" />
        </div>
        <div className="space-y-2">
          <Label>Delai de reponse (ms)</Label>
          <Input type="number" value={config.responseDelayMs} onChange={(e) => onUpdate({ responseDelayMs: parseInt(e.target.value) || 20 })} />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Label htmlFor="container-autoscale">Auto-scaling</Label>
          <Switch id="container-autoscale" checked={config.autoScaling.enabled} onCheckedChange={(c) => onUpdate({ autoScaling: { ...config.autoScaling, enabled: c } })} />
        </div>
        {config.autoScaling.enabled && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Min</Label>
                <Input type="number" value={config.autoScaling.minReplicas} onChange={(e) => onUpdate({ autoScaling: { ...config.autoScaling, minReplicas: parseInt(e.target.value) || 1 } })} />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Max</Label>
                <Input type="number" value={config.autoScaling.maxReplicas} onChange={(e) => onUpdate({ autoScaling: { ...config.autoScaling, maxReplicas: parseInt(e.target.value) || 10 } })} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Target CPU</Label>
                <span className="text-muted-foreground">{config.autoScaling.targetCPU}%</span>
              </div>
              <Slider value={[config.autoScaling.targetCPU]} onValueChange={([v]) => onUpdate({ autoScaling: { ...config.autoScaling, targetCPU: v } })} max={100} step={5} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Service Discovery Configuration
// ============================================

function ServiceDiscoveryConfig({ data, onUpdate }: { data: ServiceDiscoveryNodeData; onUpdate: (u: Partial<ServiceDiscoveryNodeData>) => void }) {
  const config = { ...defaultServiceDiscoveryData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Service Discovery</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={config.provider} onValueChange={(v) => onUpdate({ provider: v as ServiceDiscoveryNodeData['provider'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="consul">Consul</SelectItem>
              <SelectItem value="eureka">Eureka</SelectItem>
              <SelectItem value="kubernetes">Kubernetes</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Latence lookup (ms)</Label>
          <Input type="number" value={config.lookupLatencyMs} onChange={(e) => onUpdate({ lookupLatencyMs: parseInt(e.target.value) || 2 })} />
        </div>
        <div className="space-y-2">
          <Label>Health check interval (ms)</Label>
          <Input type="number" value={config.healthCheckIntervalMs} onChange={(e) => onUpdate({ healthCheckIntervalMs: parseInt(e.target.value) || 10000 })} />
        </div>
        <div className="space-y-2">
          <Label>Cache TTL (ms)</Label>
          <Input type="number" value={config.cacheTTLMs} onChange={(e) => onUpdate({ cacheTTLMs: parseInt(e.target.value) || 5000 })} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// DNS Configuration
// ============================================

function DNSConfig({ data, onUpdate }: { data: DNSNodeData; onUpdate: (u: Partial<DNSNodeData>) => void }) {
  const config = { ...defaultDNSNodeData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">DNS</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Latence resolution (ms)</Label>
          <Input type="number" value={config.resolutionLatencyMs} onChange={(e) => onUpdate({ resolutionLatencyMs: parseInt(e.target.value) || 5 })} />
        </div>
        <div className="space-y-2">
          <Label>TTL (secondes)</Label>
          <Input type="number" value={config.ttlSeconds} onChange={(e) => onUpdate({ ttlSeconds: parseInt(e.target.value) || 300 })} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="dns-failover">Failover</Label>
          <Switch id="dns-failover" checked={config.failoverEnabled} onCheckedChange={(c) => onUpdate({ failoverEnabled: c })} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Cloud Storage Configuration
// ============================================

function CloudStorageConfig({ data, onUpdate }: { data: CloudStorageNodeData; onUpdate: (u: Partial<CloudStorageNodeData>) => void }) {
  const config = { ...defaultCloudStorageData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Cloud Storage</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={config.provider} onValueChange={(v) => onUpdate({ provider: v as CloudStorageNodeData['provider'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aws">AWS S3</SelectItem>
              <SelectItem value="azure">Azure Blob</SelectItem>
              <SelectItem value="gcp">GCS</SelectItem>
              <SelectItem value="generic">Generic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Storage Class</Label>
          <Select value={config.storageClass} onValueChange={(v) => onUpdate({ storageClass: v as CloudStorageNodeData['storageClass'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="infrequent">Infrequent Access</SelectItem>
              <SelectItem value="archive">Archive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Latence lecture (ms)</Label>
          <Input type="number" value={config.readLatencyMs} onChange={(e) => onUpdate({ readLatencyMs: parseInt(e.target.value) || 20 })} />
        </div>
        <div className="space-y-2">
          <Label>Latence ecriture (ms)</Label>
          <Input type="number" value={config.writeLatencyMs} onChange={(e) => onUpdate({ writeLatencyMs: parseInt(e.target.value) || 50 })} />
        </div>
        <div className="space-y-2">
          <Label>Max requetes/s</Label>
          <Input type="number" value={config.maxRequestsPerSecond} onChange={(e) => onUpdate({ maxRequestsPerSecond: parseInt(e.target.value) || 5500 })} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Network Zone Configuration
// ============================================

function NetworkZoneConfig({ data, onUpdate }: { data: NetworkZoneNodeData; onUpdate: (u: Partial<NetworkZoneNodeData>) => void }) {
  const config = { ...defaultNetworkZoneData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Zone Reseau</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Type de zone</Label>
          <Select value={config.zoneType} onValueChange={(v) => onUpdate({ zoneType: v as NetworkZoneNodeData['zoneType'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="dmz">DMZ</SelectItem>
              <SelectItem value="backend">Backend</SelectItem>
              <SelectItem value="data">Data</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Domaine</Label>
          <Input value={config.domain || ''} onChange={(e) => onUpdate({ domain: e.target.value })} placeholder="api.example.com" />
        </div>
        <div className="space-y-2">
          <Label>Latence inter-zone (ms)</Label>
          <Input type="number" value={config.interZoneLatency} onChange={(e) => onUpdate({ interZoneLatency: parseInt(e.target.value) || 0 })} />
          <p className="text-xs text-muted-foreground">Latence ajoutee pour les requetes sortant de cette zone</p>
        </div>
        <div className="space-y-2">
          <Label>Couleur</Label>
          <Input type="color" value={config.color} onChange={(e) => onUpdate({ color: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function HostServerConfig({ data, onUpdate, childNodes }: { data: HostServerNodeData; onUpdate: (u: Partial<HostServerNodeData>) => void; childNodes: Node[] }) {
  const config = { ...defaultHostServerData, ...data };
  const mappings = config.portMappings || [];

  const addPortMapping = () => {
    const newMapping: HostPortMapping = {
      id: `pm-${Date.now()}`,
      hostPort: 8080,
      containerNodeId: '',
      containerPort: 3000,
      protocol: 'tcp',
    };
    onUpdate({ portMappings: [...mappings, newMapping] });
  };

  const updateMapping = (id: string, updates: Partial<HostPortMapping>) => {
    onUpdate({
      portMappings: mappings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    });
  };

  const removeMapping = (id: string) => {
    onUpdate({ portMappings: mappings.filter((m) => m.id !== id) });
  };

  const containerChildren = childNodes.filter((n) => n.type === 'container');

  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Serveur Hote</span>
      <Separator />
      <div className="space-y-4">
        {/* Network */}
        <div className="space-y-2">
          <Label>Adresse IP</Label>
          <Input
            value={config.ipAddress}
            onChange={(e) => onUpdate({ ipAddress: e.target.value })}
            placeholder="192.168.1.10"
          />
        </div>
        <div className="space-y-2">
          <Label>Hostname</Label>
          <Input
            value={config.hostname || ''}
            onChange={(e) => onUpdate({ hostname: e.target.value || undefined })}
            placeholder="web-server-01"
          />
        </div>

        {/* Port Mappings */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Port Mappings</Label>
            <Button variant="ghost" size="sm" onClick={addPortMapping} className="h-6 px-2">
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          </div>
          {mappings.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucun mapping configure. Ajoutez un mapping pour router le trafic vers les containers.</p>
          )}
          {mappings.map((mapping, idx) => (
            <div key={mapping.id} className="p-2 rounded-md border bg-muted/30 space-y-1.5">
              {idx === 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-16 text-[10px] text-muted-foreground font-medium">Port hôte</span>
                  <span className="w-3" />
                  <span className="flex-1 text-[10px] text-muted-foreground font-medium">Container</span>
                  <span className="w-16 text-[10px] text-muted-foreground font-medium">Port ctn.</span>
                  <span className="w-16 text-[10px] text-muted-foreground font-medium">Protocole</span>
                  <span className="w-7" />
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  value={mapping.hostPort}
                  onChange={(e) => updateMapping(mapping.id, { hostPort: parseInt(e.target.value) || 0 })}
                  className="w-16 h-7 text-xs"
                  placeholder="8080"
                />
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Select
                  value={mapping.containerNodeId || '_none'}
                  onValueChange={(v) => updateMapping(mapping.id, { containerNodeId: v === '_none' ? '' : v })}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Container..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-- Aucun --</SelectItem>
                    {containerChildren.map((child, i) => {
                      const childLabel = (child.data as { label?: string }).label || child.id;
                      const isDuplicate = containerChildren.some((c, j) => j !== i && ((c.data as { label?: string }).label || c.id) === childLabel);
                      return (
                        <SelectItem key={child.id} value={child.id}>
                          {isDuplicate ? `${childLabel} (#${i + 1})` : childLabel}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={mapping.containerPort}
                  onChange={(e) => updateMapping(mapping.id, { containerPort: parseInt(e.target.value) || 0 })}
                  className="w-16 h-7 text-xs"
                  placeholder="3000"
                />
                <Select
                  value={mapping.protocol}
                  onValueChange={(v) => updateMapping(mapping.id, { protocol: v as 'tcp' | 'udp' })}
                >
                  <SelectTrigger className="h-7 text-xs w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMapping(mapping.id)}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          {containerChildren.length === 0 && mappings.length > 0 && (
            <p className="text-xs text-signal-warning">Aucun container enfant detecte. Placez des containers dans ce host server.</p>
          )}
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>Couleur</Label>
          <Input type="color" value={config.color} onChange={(e) => onUpdate({ color: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// API Service Configuration
// ============================================

function ApiServiceConfig({ data, onUpdate }: { data: ApiServiceNodeData; onUpdate: (u: Partial<ApiServiceNodeData>) => void }) {
  const config = { ...defaultApiServiceData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">API Service</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nom du service</Label>
          <Input value={config.serviceName} onChange={(e) => onUpdate({ serviceName: e.target.value })} placeholder="my-service" />
        </div>
        <div className="space-y-2">
          <Label>Base Path</Label>
          <Input value={config.basePath} onChange={(e) => onUpdate({ basePath: e.target.value })} placeholder="/api" />
        </div>
        <div className="space-y-2">
          <Label>Protocole</Label>
          <Select value={config.protocol} onValueChange={(v) => onUpdate({ protocol: v as ApiServiceProtocol })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rest">REST</SelectItem>
              <SelectItem value="grpc">gRPC</SelectItem>
              <SelectItem value="graphql">GraphQL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Temps de reponse (ms)</Label>
          <Input type="number" value={config.responseTime} onChange={(e) => onUpdate({ responseTime: parseInt(e.target.value) || 50 })} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Taux d&apos;erreur</Label>
            <span className="text-muted-foreground">{config.errorRate}%</span>
          </div>
          <Slider value={[config.errorRate]} onValueChange={([v]) => onUpdate({ errorRate: v })} max={100} step={1} />
        </div>
        <div className="space-y-2">
          <Label>Max requetes concurrentes</Label>
          <Input type="number" value={config.maxConcurrentRequests} onChange={(e) => onUpdate({ maxConcurrentRequests: parseInt(e.target.value) || 100 })} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Background Job Configuration
// ============================================

function BackgroundJobConfig({ data, onUpdate }: { data: BackgroundJobNodeData; onUpdate: (u: Partial<BackgroundJobNodeData>) => void }) {
  const config = { ...defaultBackgroundJobData, ...data };
  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Background Job</span>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Type de job</Label>
          <Select value={config.jobType} onValueChange={(v) => onUpdate({ jobType: v as BackgroundJobType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cron">Cron</SelectItem>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="batch">Batch</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {config.jobType === 'cron' && (
          <div className="space-y-2">
            <Label>Schedule (cron)</Label>
            <Input value={config.schedule || ''} onChange={(e) => onUpdate({ schedule: e.target.value })} placeholder="*/5 * * * *" />
          </div>
        )}
        <div className="space-y-2">
          <Label>Concurrence</Label>
          <Input type="number" min="1" value={config.concurrency} onChange={(e) => onUpdate({ concurrency: parseInt(e.target.value) || 1 })} />
        </div>
        <div className="space-y-2">
          <Label>Temps de traitement (ms)</Label>
          <Input type="number" value={config.processingTimeMs} onChange={(e) => onUpdate({ processingTimeMs: parseInt(e.target.value) || 500 })} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Taux d&apos;erreur</Label>
            <span className="text-muted-foreground">{config.errorRate}%</span>
          </div>
          <Slider value={[config.errorRate]} onValueChange={([v]) => onUpdate({ errorRate: v })} max={100} step={1} />
        </div>
        {config.jobType === 'batch' && (
          <div className="space-y-2">
            <Label>Taille du batch</Label>
            <Input type="number" min="1" value={config.batchSize ?? 100} onChange={(e) => onUpdate({ batchSize: parseInt(e.target.value) || 100 })} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Identity Provider Configuration
// ============================================

const IDP_PROTOCOL_LABELS: Record<IdPProtocol, string> = {
  oidc: 'OpenID Connect',
  saml: 'SAML 2.0',
  ldap: 'LDAP',
  oauth2: 'OAuth 2.0',
};

const IDP_TOKEN_FORMAT_LABELS: Record<IdPTokenFormat, string> = {
  jwt: 'JWT',
  opaque: 'Opaque',
  'saml-assertion': 'SAML Assertion',
};

function IdentityProviderConfig({ data, onUpdate }: { data: IdentityProviderNodeData; onUpdate: (u: Partial<IdentityProviderNodeData>) => void }) {
  const config = { ...defaultIdentityProviderData, ...data };
  const capabilities = IDP_PROVIDER_CAPABILITIES[config.providerType];

  // Quand le provider change, reset protocol/tokenFormat aux defaults du nouveau provider
  const handleProviderChange = (newProvider: IdentityProviderType) => {
    const newCaps = IDP_PROVIDER_CAPABILITIES[newProvider];
    const updates: Partial<IdentityProviderNodeData> = { providerType: newProvider };

    // Reset protocol si l'actuel n'est pas supporté par le nouveau provider
    if (!newCaps.protocols.includes(config.protocol)) {
      updates.protocol = newCaps.defaultProtocol;
    }
    // Reset tokenFormat si l'actuel n'est pas supporté
    if (!newCaps.tokenFormats.includes(config.tokenFormat)) {
      updates.tokenFormat = newCaps.defaultTokenFormat;
    }
    // SAML → forcer saml-assertion comme format
    if (updates.protocol === 'saml' || (!updates.protocol && config.protocol === 'saml')) {
      updates.tokenFormat = 'saml-assertion';
    }

    onUpdate(updates);
  };

  // Quand le protocole change, ajuster le format de token
  const handleProtocolChange = (newProtocol: IdPProtocol) => {
    const updates: Partial<IdentityProviderNodeData> = { protocol: newProtocol };
    if (newProtocol === 'saml') {
      updates.tokenFormat = 'saml-assertion';
    } else if (config.tokenFormat === 'saml-assertion') {
      updates.tokenFormat = capabilities.defaultTokenFormat;
    }
    onUpdate(updates);
  };

  // Formats disponibles en fonction du protocole
  const availableTokenFormats = config.protocol === 'saml'
    ? (['saml-assertion'] as IdPTokenFormat[])
    : capabilities.tokenFormats;

  return (
    <div className="space-y-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Identity Provider</span>
      <Separator />
      <div className="space-y-2">
        <Label>Fournisseur</Label>
        <Select value={config.providerType} onValueChange={(v) => handleProviderChange(v as IdentityProviderType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="keycloak">Keycloak</SelectItem>
            <SelectItem value="auth0">Auth0</SelectItem>
            <SelectItem value="cognito">Cognito</SelectItem>
            <SelectItem value="okta">Okta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Protocole</Label>
        <Select value={config.protocol} onValueChange={(v) => handleProtocolChange(v as IdPProtocol)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {capabilities.protocols.map((p) => (
              <SelectItem key={p} value={p}>{IDP_PROTOCOL_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Format de token</Label>
        <Select value={config.tokenFormat} onValueChange={(v) => onUpdate({ tokenFormat: v as IdPTokenFormat })} disabled={config.protocol === 'saml'}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableTokenFormats.map((f) => (
              <SelectItem key={f} value={f}>{IDP_TOKEN_FORMAT_LABELS[f]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div className="space-y-2">
        <Label>Latence validation token (ms)</Label>
        <Input type="number" min="1" max="50" value={config.tokenValidationLatencyMs} onChange={(e) => onUpdate({ tokenValidationLatencyMs: parseInt(e.target.value) || 5 })} />
      </div>
      <div className="space-y-2">
        <Label>Latence generation token (ms)</Label>
        <Input type="number" min="10" max="500" value={config.tokenGenerationLatencyMs} onChange={(e) => onUpdate({ tokenGenerationLatencyMs: parseInt(e.target.value) || 100 })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Cache de sessions</Label>
        <Switch checked={config.sessionCacheEnabled} onCheckedChange={(v) => onUpdate({ sessionCacheEnabled: v })} />
      </div>
      {config.sessionCacheEnabled && (
        <div className="space-y-2">
          <Label>TTL cache sessions (s)</Label>
          <Input type="number" min="60" max="86400" value={config.sessionCacheTTLSeconds} onChange={(e) => onUpdate({ sessionCacheTTLSeconds: parseInt(e.target.value) || 3600 })} />
        </div>
      )}
      <div className="flex items-center justify-between">
        <Label>MFA</Label>
        <Switch checked={config.mfaEnabled} onCheckedChange={(v) => onUpdate({ mfaEnabled: v })} />
      </div>
      {config.mfaEnabled && (
        <div className="space-y-2">
          <Label>Latence MFA (ms)</Label>
          <Input type="number" min="1000" max="10000" value={config.mfaLatencyMs} onChange={(e) => onUpdate({ mfaLatencyMs: parseInt(e.target.value) || 3000 })} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Rate limit login (/min)</Label>
        <Input type="number" min="1" max="1000" value={config.loginRateLimitPerMinute} onChange={(e) => onUpdate({ loginRateLimitPerMinute: parseInt(e.target.value) || 60 })} />
      </div>
      <div className="space-y-2">
        <Label>TTL tokens (s)</Label>
        <Input type="number" min="60" max="86400" value={config.tokenTTLSeconds} onChange={(e) => onUpdate({ tokenTTLSeconds: parseInt(e.target.value) || 3600 })} />
      </div>
      <div className="space-y-2">
        <Label>Taux d&apos;erreur (%)</Label>
        <Input type="number" min="0" max="100" value={config.errorRate} onChange={(e) => onUpdate({ errorRate: parseFloat(e.target.value) || 0 })} />
      </div>
    </div>
  );
}
