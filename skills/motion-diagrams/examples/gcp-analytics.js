// A streaming analytics pipeline on Google Cloud.
Diagram.config({ title: 'Clickstream analytics', kind: 'architecture' });

Diagram.node('apps', { label: 'Apps and devices', sub: 'events', icon: 'generic/smartphone' });
Diagram.group('proj', { preset: 'gcp.project', label: 'Project · analytics-prod' });
Diagram.node('ps', { label: 'Pub/Sub', sub: 'ingest', icon: 'gcp/pubsub', in: 'proj' });
Diagram.node('df', { label: 'Dataflow', sub: 'stream ETL', icon: 'gcp/dataflow', in: 'proj' });
Diagram.node('bq', { label: 'BigQuery', sub: 'warehouse', icon: 'gcp/bigquery', in: 'proj' });
Diagram.node('gcs', { label: 'Cloud Storage', sub: 'raw archive', icon: 'gcp/cloud-storage', in: 'proj' });
Diagram.node('looker', { label: 'Looker', sub: 'dashboards', icon: 'gcp/looker' });

Diagram.edge('apps', 'ps', 'events');
Diagram.edge('ps', 'df');
Diagram.edge('df', 'bq', 'rows');
Diagram.edge('df', 'gcs', 'archive');
Diagram.edge('bq', 'looker');
