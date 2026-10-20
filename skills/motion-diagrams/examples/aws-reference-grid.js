// An AWS reference-style grid: tiers as columns, Availability Zones as rows, CIDRs on each subnet cell.
// Region, CIDRs and instance sizes are placeholders.
Diagram.config({
  title: 'Production on Amazon EKS',
  subtitle: 'How a request reaches the app and its data · us-east-1, two Availability Zones · pods in both AZs use the primaries in AZ a',
  kind: 'architecture', layout: 'grid', aspect: 'slides',
});

Diagram.node('users', { label: 'Users', sub: 'browser / mobile', icon: 'generic/users' });

Diagram.group('aws', { preset: 'aws.cloud' });
Diagram.node('r53', { label: 'Route 53', sub: 'DNS', icon: 'aws/route-53', in: 'aws', band: 'left' });
Diagram.node('cf', { label: 'CloudFront', sub: 'CDN', icon: 'aws/cloudfront', in: 'aws', band: 'left' });
Diagram.node('waf', { label: 'AWS WAF', sub: 'web ACL', icon: 'aws/waf', in: 'aws', band: 'left' });

Diagram.group('region', { preset: 'aws.region', label: 'Region · us-east-1', in: 'aws' });
Diagram.group('vpc', { preset: 'aws.vpc', label: 'VPC · 10.0.0.0/16', in: 'region', grid: true });
Diagram.zone('a', { label: 'Availability Zone a' });
Diagram.zone('b', { label: 'Availability Zone b' });
Diagram.tier('public', { label: 'Public subnet', preset: 'aws.subnet.public', cidr: { a: '10.0.0.0/24', b: '10.0.1.0/24' } });
Diagram.tier('app', { label: 'Private app subnet', preset: 'aws.subnet.private', cidr: { a: '10.0.10.0/24', b: '10.0.11.0/24' } });
Diagram.tier('data', { label: 'Private data subnet', preset: 'aws.subnet.private', cidr: { a: '10.0.20.0/24', b: '10.0.21.0/24' } });

Diagram.node('igw', { label: 'Internet gateway', icon: 'aws/res/vpc-internet-gateway', in: 'vpc', at: 'left' });
Diagram.node('alb', { label: 'Application Load Balancer', sub: 'AWS LB Controller', icon: 'aws/res/elastic-load-balancing-application-load-balancer', tier: 'public' });
Diagram.node('natA', { label: 'NAT gateway', icon: 'aws/res/vpc-nat-gateway', cell: ['public', 'a'] });
Diagram.node('natB', { label: 'NAT gateway', icon: 'aws/res/vpc-nat-gateway', cell: ['public', 'b'] });
Diagram.node('nodeA', { label: 'EKS worker node', sub: 'm6i.large', icon: 'aws/res/ec2-instance', cell: ['app', 'a'] });
Diagram.node('podA', { label: 'app pods', sub: 'Deployment', icon: 'k8s/pod', cell: ['app', 'a'] });
Diagram.node('podB', { label: 'app pods', sub: 'Deployment', icon: 'k8s/pod', cell: ['app', 'b'] });
Diagram.node('nodeB', { label: 'EKS worker node', sub: 'm6i.large', icon: 'aws/res/ec2-instance', cell: ['app', 'b'] });
Diagram.node('rdsA', { label: 'Amazon RDS', sub: 'PostgreSQL primary', icon: 'aws/rds', cell: ['data', 'a'] });
Diagram.node('redisA', { label: 'ElastiCache', sub: 'Redis primary', icon: 'aws/res/elasticache-elasticache-for-redis', cell: ['data', 'a'] });
Diagram.node('rdsB', { label: 'Amazon RDS', sub: 'Multi-AZ standby', icon: 'aws/rds', cell: ['data', 'b'] });
Diagram.node('redisB', { label: 'ElastiCache', sub: 'Redis replica', icon: 'aws/res/elasticache-elasticache-for-redis', cell: ['data', 'b'] });

Diagram.group('svc', { label: 'Regional services', color: 'dim', in: 'region', band: 'right', flow: 'column' });
Diagram.node('eks', { label: 'Amazon EKS', sub: 'control plane', icon: 'aws/elastic-kubernetes-service', in: 'svc' });
Diagram.node('ecr', { label: 'Amazon ECR', sub: 'app images', icon: 'aws/elastic-container-registry', in: 'svc' });
Diagram.node('sm', { label: 'Secrets Manager', sub: 'DB and API secrets', icon: 'aws/secrets-manager', in: 'svc' });
Diagram.node('cw', { label: 'CloudWatch', sub: 'logs and metrics', icon: 'aws/cloudwatch', in: 'svc' });

Diagram.edge('users', 'r53', 'DNS lookup');
Diagram.edge('users', 'cf', 'HTTPS');
Diagram.edge('waf', 'cf', { label: 'protects', dashed: true });
Diagram.edge('cf', 'igw');
Diagram.edge('igw', 'alb');
Diagram.edge('alb', 'podA', 'target group');
Diagram.edge('alb', 'podB');
Diagram.edge('podA', 'rdsA', 'SQL');
Diagram.edge('podA', 'redisA', 'cache');
Diagram.edge('data.a', 'data.b', { label: 'Multi-AZ replication (RDS, Redis)', dashed: true });
Diagram.edge('natA', 'nodeA', { label: 'egress', dashed: true, arrow: 'start' });
Diagram.edge('natB', 'nodeB', { label: 'egress', dashed: true, arrow: 'start' });
Diagram.edge('vpc', 'svc', { label: 'control plane · images · secrets · logs', dashed: true, arrow: 'both' });
