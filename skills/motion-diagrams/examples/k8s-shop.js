// A service on Kubernetes with the official Kubernetes resource icons.
Diagram.config({ title: 'Shop on Kubernetes', kind: 'architecture' });

Diagram.node('users', { label: 'Users', sub: 'HTTPS', icon: 'generic/users' });
Diagram.group('cluster', { preset: 'k8s.cluster', label: 'Cluster · prod-eu' });
Diagram.group('ns', { preset: 'k8s.namespace', label: 'namespace · shop', in: 'cluster' });
Diagram.node('ing', { label: 'Ingress', sub: 'nginx', icon: 'k8s/ing', in: 'cluster' });
Diagram.node('svc', { label: 'Service', sub: 'ClusterIP', icon: 'k8s/svc', in: 'ns' });
Diagram.node('pod1', { label: 'Pod', sub: 'web-7f9c · a', icon: 'k8s/pod', in: 'ns' });
Diagram.node('pod2', { label: 'Pod', sub: 'web-7f9c · b', icon: 'k8s/pod', in: 'ns' });
Diagram.node('cm', { label: 'ConfigMap', sub: 'app settings', icon: 'k8s/cm', in: 'ns' });
Diagram.node('prom', { label: 'Prometheus', sub: 'metrics', icon: 'logo/prometheus', in: 'cluster' });
Diagram.node('pg', { label: 'PostgreSQL', sub: 'managed', icon: 'logo/postgresql' });

Diagram.edge('users', 'ing');
Diagram.edge('ing', 'svc');
Diagram.edge('svc', 'pod1');
Diagram.edge('svc', 'pod2');
Diagram.edge('cm', 'pod1', { dashed: true });
Diagram.edge('pod1', 'pg', 'SQL');
Diagram.edge('pod2', 'pg');
Diagram.edge('prom', 'pod2', { label: 'scrape', dashed: true });
