// C4 system context: who uses the system and what it depends on.
Diagram.config({ title: 'Online store · system context', kind: 'c4' });

Diagram.node('customer', { shape: 'person', label: 'Customer', sub: 'Buys products online' });
Diagram.node('agent', { shape: 'person', label: 'Support agent', sub: 'Handles refunds' });
Diagram.node('store', { shape: 'system', label: 'Online Store', sub: 'Lets customers browse and order products' });
Diagram.node('pay', { shape: 'external', label: 'Payment provider', sub: 'Card payments' });
Diagram.node('mail', { shape: 'external', label: 'Email service', sub: 'Sends order receipts' });

Diagram.edge('customer', 'store', 'browses and buys [HTTPS]');
Diagram.edge('agent', 'store', 'manages orders');
Diagram.edge('store', 'pay', 'charges cards [REST]');
Diagram.edge('store', 'mail', 'sends receipts');
