// A three-tier web app on AWS: DNS and CDN in front, a load balancer, containers in two AZs, a database and a cache.
Diagram.config({ title: 'Shop on AWS', kind: 'architecture', direction: 'right' });

Diagram.node('users', { label: 'Users', sub: 'browser / mobile', icon: 'generic/users' });
Diagram.node('dns', { label: 'Route 53', sub: 'DNS', icon: 'aws/route-53' });
Diagram.node('cdn', { label: 'CloudFront', sub: 'CDN + WAF', icon: 'aws/cloudfront' });
Diagram.node('assets', { label: 'Amazon S3', sub: 'static assets', icon: 'aws/simple-storage-service' });

Diagram.group('region', { preset: 'aws.region', label: 'Region · eu-west-1' });
Diagram.group('vpc', { preset: 'aws.vpc', label: 'VPC · 10.0.0.0/16', in: 'region' });
Diagram.group('public', { preset: 'aws.subnet.public', in: 'vpc' });
Diagram.group('app', { preset: 'aws.subnet.private', label: 'App subnets', in: 'vpc' });
Diagram.group('data', { preset: 'aws.subnet.private', label: 'Data subnets', in: 'vpc' });

Diagram.node('alb', { label: 'Application Load Balancer', icon: 'aws/res/elastic-load-balancing-application-load-balancer', in: 'public' });
Diagram.node('api1', { label: 'ECS Fargate', sub: 'API · AZ a', icon: 'aws/fargate', in: 'app' });
Diagram.node('api2', { label: 'ECS Fargate', sub: 'API · AZ b', icon: 'aws/fargate', in: 'app' });
Diagram.node('db', { label: 'Aurora PostgreSQL', sub: 'primary', icon: 'aws/aurora', in: 'data' });
Diagram.node('cache', { label: 'ElastiCache', sub: 'Redis sessions', icon: 'aws/elasticache', in: 'data' });

Diagram.edge('users', 'dns');
Diagram.edge('dns', 'cdn');
Diagram.edge('cdn', 'alb', 'HTTPS');
Diagram.edge('cdn', 'assets', 'static');
Diagram.edge('alb', 'api1');
Diagram.edge('alb', 'api2');
Diagram.edge('app', 'data', 'SQL · sessions');
