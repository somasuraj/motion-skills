// Who does what in an expense claim: one lane per role.
Diagram.config({ title: 'Expense claim', kind: 'swimlane' });

Diagram.lane('emp', { label: 'Employee' });
Diagram.lane('mgr', { label: 'Manager' });
Diagram.lane('fin', { label: 'Finance' });

Diagram.node('submit', { shape: 'terminal', label: 'Submit expense', lane: 'emp' });
Diagram.node('review', { label: 'Review claim', lane: 'mgr' });
Diagram.node('policy', { shape: 'decision', label: 'Within policy?', lane: 'mgr' });
Diagram.node('fix', { label: 'Fix and resubmit', tone: 'bad', lane: 'emp' });
Diagram.node('verify', { label: 'Verify receipts', lane: 'fin' });
Diagram.node('pay', { label: 'Pay out', lane: 'fin' });
Diagram.node('done', { shape: 'terminal', label: 'Reimbursed', tone: 'good', lane: 'emp' });

Diagram.edge('submit', 'review');
Diagram.edge('review', 'policy');
Diagram.edge('policy', 'verify', { label: 'yes', tone: 'good' });
Diagram.edge('policy', 'fix', { label: 'no', tone: 'bad' });
Diagram.edge('fix', 'review', { dashed: true });
Diagram.edge('verify', 'pay');
Diagram.edge('pay', 'done');
