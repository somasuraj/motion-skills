// The data model behind an online shop.
Diagram.config({ title: 'Shop data model', kind: 'er' });

Diagram.table('customer', { columns: [['id', 'uuid', 'pk'], ['name', 'text'], ['email', 'text', 'uk']] });
Diagram.table('order', { columns: [['id', 'uuid', 'pk'], ['customer_id', 'uuid', 'fk'], ['placed_at', 'timestamptz'], ['status', 'text']] });
Diagram.table('order_item', { columns: [['id', 'uuid', 'pk'], ['order_id', 'uuid', 'fk'], ['product_id', 'uuid', 'fk'], ['quantity', 'int']] });
Diagram.table('product', { columns: [['id', 'uuid', 'pk'], ['sku', 'text', 'uk'], ['name', 'text'], ['price', 'numeric(10,2)']] });

Diagram.relation('customer.id', 'order.customer_id', '1:0..N');
Diagram.relation('order.id', 'order_item.order_id', '1:1..N');
Diagram.relation('product.id', 'order_item.product_id', '1:0..N');
