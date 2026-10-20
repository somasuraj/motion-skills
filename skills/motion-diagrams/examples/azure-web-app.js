// An Azure web app: Front Door in front, App Service in a VNet, a queue and a function for fulfilment.
Diagram.config({ title: 'Shop on Azure', kind: 'architecture' });

Diagram.node('users', { label: 'Users', sub: 'web', icon: 'generic/users' });
Diagram.node('fd', { label: 'Front Door', sub: 'CDN + WAF', icon: 'azure/front-door-and-cdn-profiles' });
Diagram.group('rg', { preset: 'azure.rg', label: 'Resource group · rg-shop-prod' });
Diagram.group('vnet', { preset: 'azure.vnet', label: 'VNet · 10.1.0.0/16', in: 'rg' });
Diagram.node('app', { label: 'App Service', sub: 'web app', icon: 'azure/app-services', in: 'vnet' });
Diagram.node('bus', { label: 'Service Bus', sub: 'orders queue', icon: 'azure/azure-service-bus', in: 'vnet' });
Diagram.node('fn', { label: 'Function App', sub: 'fulfilment', icon: 'azure/function-apps', in: 'vnet' });
Diagram.node('sql', { label: 'Azure SQL', sub: 'orders db', icon: 'azure/sql-database', in: 'vnet' });
Diagram.node('blob', { label: 'Blob Storage', sub: 'invoices', icon: 'azure/storage-accounts', in: 'vnet' });
Diagram.node('kv', { label: 'Key Vault', sub: 'secrets', icon: 'azure/key-vaults', in: 'rg' });
Diagram.node('ai', { label: 'App Insights', sub: 'monitoring', icon: 'azure/application-insights', in: 'rg' });

Diagram.edge('users', 'fd');
Diagram.edge('fd', 'app', 'HTTPS');
Diagram.edge('app', 'sql');
Diagram.edge('app', 'bus', 'orders');
Diagram.edge('bus', 'fn', 'trigger');
Diagram.edge('fn', 'blob');
Diagram.edge('fn', 'kv', { label: 'secrets', dashed: true });
Diagram.edge('app', 'ai', { label: 'telemetry', dashed: true });
