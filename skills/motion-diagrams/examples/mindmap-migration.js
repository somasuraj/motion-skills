// Planning a cloud migration.
Diagram.config({ title: 'Cloud migration', kind: 'mindmap' });

Diagram.mindmap({
  label: 'Cloud migration',
  children: [
    { label: 'Assess', children: ['App inventory', 'Dependencies', 'TCO model'] },
    { label: 'Plan', children: ['Wave plan', 'Landing zone'] },
    { label: 'Secure', children: ['IAM model', 'Encryption', 'Audit logging'] },
    { label: 'Migrate', children: ['Rehost', 'Replatform', { label: 'Refactor', children: ['Containers', 'Serverless'] }] },
    { label: 'Operate', children: ['Monitoring', 'Runbooks'] },
    { label: 'Optimise', children: ['Budgets', 'Rightsizing'] },
  ],
});
