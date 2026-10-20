// A CI/CD toolchain drawn with the tools' own logos.
Diagram.config({ title: 'Delivery pipeline', kind: 'architecture' });

Diagram.node('gh', { label: 'GitHub', sub: 'repository', icon: 'logo/github-icon' });
Diagram.group('ci', { label: 'CI · GitHub Actions', icon: 'logo/github-actions', color: 'dim', fill: 'panel' });
Diagram.node('build', { label: 'Build and test', sub: 'GitHub Actions', icon: 'logo/github-actions', in: 'ci' });
Diagram.node('sonar', { label: 'SonarQube', sub: 'quality gate', icon: 'si/sonarqube', in: 'ci' });
Diagram.node('docker', { label: 'Docker', sub: 'build image', icon: 'logo/docker-icon', in: 'ci' });
Diagram.node('slack', { label: 'Slack', sub: 'alerts', icon: 'logo/slack-icon', in: 'ci' });
Diagram.node('tf', { label: 'Terraform', sub: 'infra as code', icon: 'logo/terraform-icon' });
Diagram.group('aws', { preset: 'aws.cloud' });
Diagram.node('ecr', { label: 'Amazon ECR', sub: 'registry', icon: 'aws/elastic-container-registry', in: 'aws' });
Diagram.node('argo', { label: 'Argo CD', sub: 'GitOps', icon: 'logo/argo-icon', in: 'aws' });
Diagram.node('eks', { label: 'Amazon EKS', sub: 'cluster', icon: 'aws/elastic-kubernetes-service', in: 'aws' });

Diagram.edge('gh', 'build', 'push');
Diagram.edge('build', 'sonar', 'scan');
Diagram.edge('sonar', 'docker', 'gate ok');
Diagram.edge('build', 'slack', { label: 'notify', dashed: true });
Diagram.edge('docker', 'ecr', 'push');
Diagram.edge('ecr', 'argo', 'new tag');
Diagram.edge('argo', 'eks', 'deploy');
Diagram.edge('tf', 'eks', { label: 'provisions', dashed: true });
