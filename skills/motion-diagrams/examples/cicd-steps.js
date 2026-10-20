// CI/CD as steps cards: each edge leaves the step that causes it, with a numbered badge.
Diagram.config({
  title: 'Delivery pipelines to Amazon EKS',
  subtitle: 'From a Jira issue to production: one push, two GitHub Actions pipelines',
  kind: 'architecture', direction: 'right', spacing: 'roomy', placement: 'balanced', aspect: 'slides',
  legend: { solid: 'deploy / data', dashed: 'status · auth · provisioning', dotted: 'association', badge: 'pipeline step' },
});

Diagram.node('dev', { label: 'Developer', sub: 'branch PROJ-123-…', icon: 'generic/laptop' });
Diagram.node('repo', { label: 'GitHub', sub: 'repository · main', icon: 'logo/github-icon' });

Diagram.node('app', {
  shape: 'steps', label: 'App pipeline', sub: 'GitHub Actions · app/** on main', icon: 'logo/github-actions',
  steps: [
    { label: 'Checkout', icon: 'logo/git-icon' },
    { label: 'Build and unit tests', icon: 'generic/flask-conical' },
    { label: 'SonarQube quality gate', icon: 'si/sonarqube' },
    { label: 'Docker build', icon: 'logo/docker-icon' },
    { label: 'Trivy image scan', icon: 'si/trivy' },
    { label: 'AWS login (OIDC)', icon: 'aws/identity-and-access-management' },
    { label: 'Push image to ECR', icon: 'aws/elastic-container-registry' },
    { label: 'helm upgrade to EKS', icon: 'logo/helm' },
    { label: 'Update Jira and Confluence', icon: 'logo/atlassian' },
  ],
});
Diagram.node('infra', {
  shape: 'steps', label: 'Infra pipeline', sub: 'GitHub Actions · infra/** on main', icon: 'logo/github-actions',
  steps: [
    { label: 'terraform fmt and validate', icon: 'logo/terraform-icon' },
    { label: 'terraform plan', icon: 'logo/terraform-icon' },
    { label: 'Manual approval', icon: 'generic/user-check' },
    { label: 'terraform apply', icon: 'logo/terraform-icon' },
  ],
});

Diagram.group('aws', { preset: 'aws.cloud' });
Diagram.node('iam', { label: 'IAM role', sub: 'GitHub OIDC trust', icon: 'aws/identity-and-access-management', in: 'aws' });
Diagram.node('ecr', { label: 'Amazon ECR', sub: 'app images', icon: 'aws/elastic-container-registry', in: 'aws' });
Diagram.node('eks', { label: 'Amazon EKS', sub: 'prod cluster', icon: 'aws/elastic-kubernetes-service', in: 'aws' });

Diagram.group('atl', { label: 'Atlassian Cloud', icon: 'logo/atlassian', color: '#0052CC' });
Diagram.node('jira', { label: 'Jira', sub: 'PROJ-123 · deployments', icon: 'logo/jira', in: 'atl' });
Diagram.node('conf', { label: 'Confluence', sub: 'release notes page', icon: 'logo/confluence', in: 'atl' });

Diagram.edge('dev', 'repo', 'push / merge');
Diagram.edge('repo', 'app', 'app/** changed');
Diagram.edge('repo', 'infra', 'infra/** changed');
Diagram.edge('repo', 'jira', { label: 'commits and PRs linked', dashed: true });
Diagram.edge('app', 'iam', { label: 'assume role', dashed: true, step: 6 });
Diagram.edge('app', 'ecr', { label: 'docker push', step: 7 });
Diagram.edge('app', 'eks', { label: 'helm upgrade', step: 8 });
Diagram.edge('app', 'atl', { label: 'deployment status, release notes', step: 9 });
Diagram.edge('infra', 'aws', { label: 'apply · VPC, EKS, IAM, ECR', dashed: true, step: 4 });
