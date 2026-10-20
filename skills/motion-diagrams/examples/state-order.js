// The life of an order.
Diagram.config({ title: 'Order states', kind: 'state' });

Diagram.node('start', { shape: 'start' });
Diagram.node('pending', { label: 'Pending' });
Diagram.node('paid', { label: 'Paid' });
Diagram.node('shipped', { label: 'Shipped' });
Diagram.node('delivered', { label: 'Delivered', tone: 'good', final: true });
Diagram.node('cancelled', { label: 'Cancelled', tone: 'bad', final: true });
Diagram.node('refunded', { label: 'Refunded', tone: 'bad', final: true });
Diagram.node('end', { shape: 'end' });

Diagram.edge('start', 'pending', 'order placed');
Diagram.edge('pending', 'paid', 'payment ok');
Diagram.edge('pending', 'cancelled', '24 h, no payment');
Diagram.edge('paid', 'shipped', 'label printed');
Diagram.edge('paid', 'refunded', 'customer cancels');
Diagram.edge('shipped', 'shipped', 'tracking update');
Diagram.edge('shipped', 'delivered', 'delivered');
Diagram.edge('delivered', 'refunded', 'returned in 30 days');
Diagram.edge('delivered', 'end');
