// A year of platform work by track.
Diagram.config({ title: 'Platform roadmap 2027', kind: 'timeline', from: '2027-01', to: '2027-12' });

Diagram.track('platform', { label: 'Platform' });
Diagram.track('product', { label: 'Product' });
Diagram.track('data', { label: 'Data' });
Diagram.track('security', { label: 'Security' });

Diagram.bar('platform', 'Landing zone', '2027-01', '2027-03-20');
Diagram.bar('platform', 'EKS rollout', '2027-04', '2027-08-15');
Diagram.bar('product', 'Private beta', '2027-02-10', '2027-06');
Diagram.bar('product', 'Public beta', '2027-06-15', '2027-08-20');
Diagram.milestone('product', 'GA launch', '2027-09-10');
Diagram.bar('data', 'Lakehouse + BI dashboards', '2027-04-10', '2027-11-20');
Diagram.bar('security', 'IAM cleanup', '2027-01-20', '2027-04-10');
Diagram.bar('security', 'SOC 2 audit', '2027-09-20', '2027-12-20');
Diagram.marker('today', '2027-02-20');
