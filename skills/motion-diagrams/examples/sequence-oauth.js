// OAuth sign-in with an authorization code, then paged API calls.
Diagram.config({ title: 'Sign-in with authorization code', kind: 'sequence' });

Diagram.participant('browser', { label: 'Browser', icon: 'generic/monitor' });
Diagram.participant('app', { label: 'Web app' });
Diagram.participant('idp', { label: 'Amazon Cognito', icon: 'aws/cognito' });
Diagram.participant('api', { label: 'Orders API' });

Diagram.message('browser', 'app', 'GET /orders');
Diagram.reply('app', 'browser', '302 redirect to sign-in');
Diagram.message('browser', 'idp', 'sign in (user, password)');
Diagram.reply('idp', 'browser', 'authorization code');
Diagram.message('browser', 'app', 'callback ?code=…');
Diagram.message('app', 'idp', 'exchange code for tokens');
Diagram.reply('idp', 'app', 'ID + access token');
Diagram.block('loop', 'each page of results', () => {
  Diagram.message('app', 'api', 'GET /orders · Bearer token');
  Diagram.reply('api', 'app', '200 · orders[]');
});
Diagram.note('app', 'tokens cached for 1 h');
Diagram.reply('app', 'browser', 'render orders page');
