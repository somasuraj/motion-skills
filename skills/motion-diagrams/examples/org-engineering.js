// An engineering org, three levels. Names are fictional.
Diagram.config({ title: 'Engineering', kind: 'org' });

Diagram.node('cto', { label: 'Priya Shah', sub: 'CTO', tone: 'accent' });
Diagram.node('plat', { label: 'Leo Martin', sub: 'Platform lead', tone: 'cat0' });
Diagram.node('prod', { label: 'Ana Costa', sub: 'Product lead', tone: 'cat1' });
Diagram.node('data', { label: 'Sam Okafor', sub: 'Data lead', tone: 'cat3' });
Diagram.node('infra', { label: 'Kim Lee', sub: 'Infra team', tone: 'cat0' });
Diagram.node('sre', { label: 'Raj Patel', sub: 'SRE team', tone: 'cat0' });
Diagram.node('web', { label: 'Mia Chen', sub: 'Web team', tone: 'cat1' });
Diagram.node('mobile', { label: 'Tom Berg', sub: 'Mobile team', tone: 'cat1' });
Diagram.node('pipes', { label: 'Zoe Adams', sub: 'Pipelines', tone: 'cat3' });
Diagram.node('bi', { label: 'Omar Haddad', sub: 'Analytics', tone: 'cat3' });

['plat', 'prod', 'data'].forEach(id => Diagram.edge('cto', id, { arrow: 'none' }));
[['plat', 'infra'], ['plat', 'sre'], ['prod', 'web'], ['prod', 'mobile'], ['data', 'pipes'], ['data', 'bi']]
  .forEach(([a, b]) => Diagram.edge(a, b, { arrow: 'none' }));
