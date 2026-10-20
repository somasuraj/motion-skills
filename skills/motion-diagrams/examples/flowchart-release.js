// A release flow with two decisions and failure paths.
Diagram.config({ title: 'Release flow', kind: 'flowchart' });

Diagram.node('push', { shape: 'terminal', label: 'Push to main' });
Diagram.node('build', { label: 'Build image', icon: 'logo/docker-icon' });
Diagram.node('tests', { shape: 'decision', label: 'Tests pass?' });
Diagram.node('stage', { label: 'Deploy staging' });
Diagram.node('ok', { shape: 'decision', label: 'Approved?' });
Diagram.node('prod', { label: 'Deploy prod', tone: 'good' });
Diagram.node('notify', { label: 'Notify author', tone: 'bad' });
Diagram.node('close', { label: 'Close release', tone: 'bad' });

Diagram.edge('push', 'build');
Diagram.edge('build', 'tests');
Diagram.edge('tests', 'stage', { label: 'yes', tone: 'good' });
Diagram.edge('tests', 'notify', { label: 'no', tone: 'bad' });
Diagram.edge('stage', 'ok');
Diagram.edge('ok', 'prod', { label: 'yes', tone: 'good' });
Diagram.edge('ok', 'close', { label: 'no', tone: 'bad' });
Diagram.edge('notify', 'push', { label: 'fix and push', dashed: true });
