# Diagram format

Contents: 1. The script · 2. Graph kinds (architecture, flowchart, state, c4, org) · 3. Nodes and shapes ·
4. Groups and presets · 5. Edges · 6. Swimlane · 7. Sequence · 8. ER · 9. Mind map · 10. Timeline ·
11. Colours and tones · 12. What the checker reports · 13. Part ids (for embeds)

## 1. The script

One `.js` file that calls `Diagram.*`, run once by `scripts/build.py`. Plain JavaScript: loops and helper
functions are fine (`['a','b'].forEach(id => Diagram.edge('hub', id))`). No imports, no network.

```js
Diagram.config({
  title: 'Shop on AWS',        // shown in the SVG <title> and the editable files
  kind: 'architecture',        // architecture | flowchart | swimlane | sequence | state | er | c4 | mindmap | timeline | org
  direction: 'right',          // right (default) | down | left | up   (graph kinds; org defaults to down)
  spacing: 'normal',           // compact | normal | roomy
  iconSize: 56,                // icon nodes (px)
  placement: 'straight',       // graph kinds: keep long chains (pipeline steps) on one line; default balances edges  labelWidth: 150,             // wrap width for node labels (px); icon nodes default 150, boxes 190
});
```

`build.py` names the outputs after the script (`shop.js` → `shop/shop.svg`…); `--name` and `-o` change that.

Presentation options (every kind):

```js
Diagram.config({
  title: 'Production on Amazon EKS',
  subtitle: 'How a request reaches the app and its data',   // one line under the title
  header: true,                // the title block (default on); false for a bare drawing
  legend: { solid: 'request / data flow', dashed: 'async · control', dotted: 'association', badge: 'pipeline step' },
                               // shown when two or more line styles (or step badges) are used; true forces it, false hides it;
                               // or a list: [{ style: 'solid' | 'dashed' | 'dotted' | 'badge', label }]
  aspect: 'slides',            // only when the destination needs a shape: 'slides' / '16:9' · '4:3' · 'square' · 'poster'
                               // · or a number (width / height). Leave it out for documents (docx, wiki): natural shape.
  compact: true,               // tighter spacing, same orientation (good for a document page)
  portrait: true,              // grid layout only, and only when a tall picture is wanted: side bands move above and
                               // below and border nodes sit on the top border, so the drawing grows down, not across
});
```

## 1b. Grid layout (AWS reference style)

For cloud architectures with subnets across Availability Zones: tiers are columns, zones are rows (always in the order
declared, so AZ a sits above AZ b), and every tier x zone is a subnet cell with its CIDR.

```js
Diagram.config({ title: 'Production on Amazon EKS', kind: 'architecture', layout: 'grid', aspect: 'slides' });
Diagram.group('aws', { preset: 'aws.cloud' });
Diagram.node('r53', { label: 'Route 53', icon: 'aws/route-53', in: 'aws', band: 'left' });   // bands around the main child
Diagram.group('region', { preset: 'aws.region', label: 'Region · us-east-1', in: 'aws' });
Diagram.group('vpc', { preset: 'aws.vpc', label: 'VPC · 10.0.0.0/16', in: 'region', grid: true });  // the grid lives here
Diagram.zone('a', { label: 'Availability Zone a' });
Diagram.zone('b', { label: 'Availability Zone b' });
Diagram.tier('public', { label: 'Public subnet', preset: 'aws.subnet.public', cidr: { a: '10.0.0.0/24', b: '10.0.1.0/24' } });
Diagram.tier('data', { label: 'Private data subnet', preset: 'aws.subnet.private', cidr: { a: '10.0.20.0/24', b: '10.0.21.0/24' } });
Diagram.node('igw', { label: 'Internet gateway', icon: 'aws/res/vpc-internet-gateway', in: 'vpc', at: 'left' });  // on the border
Diagram.node('alb', { label: 'Application Load Balancer', icon: '…', tier: 'public' });  // spans the zones, between the AZ bands
Diagram.node('rdsA', { label: 'Amazon RDS', icon: 'aws/rds', cell: ['data', 'a'] });       // in one subnet cell
Diagram.group('svc', { label: 'Regional services', in: 'region', band: 'right', flow: 'column' });
Diagram.edge('data.a', 'data.b', { label: 'Multi-AZ replication', dashed: true });          // cell to cell
```

- `band: 'left' | 'right' | 'top' | 'bottom'` places a node or group beside its group's main child (the one that holds
  the grid); a group of plain nodes lays them out in a row, or a column with `flow: 'column'`.
- Nodes in a cell stack in a column, each facing the next tier with its own line; `stack: 'row'` on a tier lines them up.
- Edges are routed around every node and label: between tiers they leave sideways; between zones in the first or last
  tier they run as a bracket down the outside of the cells; group titles are knocked out (lines pass behind them).
- An edge end can be a node, a group, or a cell written `'tier.zone'`. `sides: ['E', 'W']` forces the ports.

## 2. Graph kinds

`architecture`, `flowchart`, `state`, `c4` and `org` share one engine: ELK "layered" with orthogonal edges,
compound groups, edge labels placed on their line. Declaration order matters: nodes and edges are kept in the
order you write them wherever the layout allows, so write the story in reading order.

- **architecture**: icon nodes (icon with the label under it; to its right when `direction: 'down'`), groups for
  boundaries, labelled edges.
- **flowchart**: shapes (box, decision, terminal, io, db, doc…), yes/no edges with `tone`.
- **state**: `shape: 'start'` and `'end'` pseudo-states, rounded states, `final: true` for a heavy border, self-loops
  (`Diagram.edge('shipped', 'shipped', 'tracking update')`).
- **c4**: `shape: 'person' | 'system' | 'external' | 'container' | 'component' | 'database'` with `sub` as the
  description and `tech` for containers (`[Container: Node.js]`); boundaries are groups with `preset: 'c4.boundary'`.
- **org**: cards with initials (or `icon`), `sub` as the role, `tone` per branch; edges `{arrow: 'none'}`; drawn top-down
  with bus connectors.

Layout hints: `layer: 'first' | 'last'` on a node pins it to the first or last column (row when going down).

## 3. Nodes and shapes

```js
Diagram.node(id, { label, sub, icon, shape, tone, in, layer, final, size, maxWidth, minWidth, w, h, initials, tech });
Diagram.node('alb', 'Load balancer');          // a string second argument is the label
```

| option | meaning |
|---|---|
| `label` | main text (defaults to the id); `\n` forces a line break; long text wraps |
| `sub` | second line in the dim colour (a role, a detail, "primary", "AZ a") |
| `icon` | icon id from `scripts/icons.py`; in an architecture diagram a node with an icon and no `shape` is an icon node; in other kinds the icon sits inside the shape, left of the text |
| `shape` | `icon` · `box` (default without icon) · `decision` · `terminal` · `io` · `db` · `doc` · `circle` · `note` · `state` · `start` · `end` · `choice` · `card` · C4 shapes |
| `tone` | colour of a shape: `accent` `good` `bad` `warn` `data` `muted` `neutral`, `cat0`…`cat7`, or a hex (see §11). On a `generic/` icon it colours the tile |
| `in` | the group it sits in |
| `size` | icon size for this node |
| `w`, `h`, `minWidth`, `maxWidth` | force a shape size or wrap width |

A box with an icon (`{ label: 'Build image', icon: 'logo/docker-icon' }` in a flowchart, or `shape: 'box'` in an
architecture diagram) shows a small icon left of the text, good for flowcharts that name tools.

**Steps card** (a CI/CD job, a runbook, a checklist): one node listing numbered steps, each with its tool's icon, so a
pipeline stays one readable block and edges leave it labelled with their step number.

```js
Diagram.node('app', { shape: 'steps', label: 'App pipeline', sub: 'GitHub Actions · on push to main', icon: 'logo/github-actions',
  steps: [{ label: 'Checkout', icon: 'logo/git-icon' }, { label: 'Docker build', icon: 'logo/docker-icon' }, 'Plain step'] });
Diagram.edge('app', 'ecr', { label: 'docker push', step: 2 });   // leaves from row 2
```
Steps are numbered (`numbered: false` drops the numbers); `tone` colours the border. An edge with `step: n` leaves the
card at row n, so each line starts at the step that causes it. `Diagram.config({ stepBadges: true })` also puts a numbered
badge on those lines (off by default).

Icon families: `aws/<service>` (coloured tile, drawn as is), `aws/res/<resource>`, `aws/group/<group>`, `azure/…`,
`gcp/…`, `k8s/<kind>` (pod, svc, ing, deploy, sts, ds, cm, secret, pvc, pv, ns, node, job, cronjob, hpa, sa, role…),
`logo/…` and `si/…` (brand marks, shown on a white rounded tile so they read on both themes), `generic/…` (Lucide
glyphs, white on a tile coloured by `tone`, slate by default).

## 4. Groups and presets

```js
Diagram.group(id, { label, preset, in, color, fill, dash, icon });
```

`preset` sets the vendor's own boundary style (colour, dashed or solid, fill, badge icon); `label` overrides its text.

| preset | looks like |
|---|---|
| `aws.cloud` `aws.region` `aws.az` `aws.vpc` `aws.subnet.public` `aws.subnet.private` `aws.account` `aws.asg` `aws.sg` `aws.datacenter` `aws.ec2` `aws.spot` `aws.server` | AWS architecture-icon group styles with their official badges |
| `azure.subscription` `azure.rg` `azure.vnet` `azure.subnet` | Azure boundaries with Azure badges |
| `gcp.project` `gcp.region` `gcp.zone` `gcp.vpc` | Google Cloud boundaries |
| `k8s.cluster` `k8s.namespace` `k8s.node` | Kubernetes cluster (logo), namespace and node badges |
| `c4.boundary` | dashed C4 system/container boundary |
| `onprem` | corporate data center |
| (none) | plain boundary; set `color` (a tone or hex), `fill: 'tint' | 'panel' | 'none'`, `dash: true`, `icon` |

Groups nest with `in`. Edges may connect nodes in different groups, and may target a group itself.

## 5. Edges

```js
Diagram.edge(from, to, { label, dashed, dotted, tone, arrow, width });
Diagram.edge('cdn', 'alb', 'HTTPS');            // a string third argument is the label
```

- `label`: short, what flows ("HTTPS", "orders", "SQL", "yes"); drawn as a pill on the line.
- `dashed: true` for async, optional, control-plane or "watches" relations; `dotted: true` for weaker links.
- `tone`: colours the line and label (`good`/`bad` for yes/no paths, `accent` for the main path).
- `arrow`: `'end'` (default) · `'both'` · `'none'` · `'start'`. Edges also steer the layout (the `from` node goes
  before the `to` node), so for a relation that runs against the main flow (egress through a NAT gateway, a callback)
  write it in flow order and set `arrow: 'start'`: `Diagram.edge('nat', 'pods', {label: 'egress', arrow: 'start'})`.
- Several links to the same set of services read better as one edge to their group with a combined label.

## 6. Swimlane

```js
Diagram.config({ title: 'Expense claim', kind: 'swimlane' });
Diagram.lane('emp', { label: 'Employee', tone: 'accent' });
Diagram.node('submit', { shape: 'terminal', label: 'Submit expense', lane: 'emp' });
Diagram.edge('submit', 'review');
```

Lanes run left to right in the order declared; every node needs `lane`. Columns come from the flow (each step to the
right of what leads to it); `col: n` on a node forces its column. Edges are routed around nodes and across lanes.

## 7. Sequence

```js
Diagram.config({ title: 'Sign-in', kind: 'sequence', numbered: true });
Diagram.participant('browser', { label: 'Browser', sub: 'SPA', icon: 'generic/monitor' });
Diagram.message('browser', 'app', 'GET /orders');            // a call (solid); activates the target
Diagram.reply('app', 'browser', '302 redirect');              // a return (dashed); ends the activation
Diagram.message('app', 'app', 'validate token');              // self-call
Diagram.message('app', 'queue', 'publish', { async: true });  // no activation
Diagram.note('app', 'tokens cached for 1 h');                 // or note(['app', 'api'], '…') across several
Diagram.block('alt', 'token valid', () => { … ; Diagram.else('expired'); … });   // loop | alt | opt | par | critical
```

Participants are spaced so every message label fits; numbering (default on) puts a numbered badge on each message.

## 8. ER

```js
Diagram.config({ title: 'Shop data model', kind: 'er' });
Diagram.table('order', { label: 'order', tone: 'data', columns: [['id', 'uuid', 'pk'], ['customer_id', 'uuid', 'fk'], ['placed_at', 'timestamptz']] });
Diagram.relation('customer.id', 'order.customer_id', '1:0..N');   // from-end : to-end
```

Cardinalities: `1`, `0..1`, `N` (also `*`, `M`), `1..N`, `0..N`; crow's-foot marks are drawn at the column's row. Keys:
`pk`, `fk`, `uk` (or any short tag). Relations attach to the columns named; `label` adds a pill.

## 9. Mind map

```js
Diagram.config({ title: 'Cloud migration', kind: 'mindmap', side: 'both' });   // side: 'right' puts every branch right
Diagram.mindmap({ label: 'Cloud migration', children: [
  { label: 'Assess', tone: 'cat0', children: ['App inventory', { label: 'Refactor', children: ['Containers'] }] },
  'Plain branch' ] });
```

First-level branches get a colour each (`cat0…cat7`, or `tone`) and alternate sides to balance; deeper levels are
underlined text on curves.

## 10. Timeline

```js
Diagram.config({ title: 'Roadmap 2027', kind: 'timeline', from: '2027-01', to: '2027-12', unit: 'quarter', width: 1200 });
Diagram.track('platform', { label: 'Platform', tone: 'cat0' });
Diagram.bar('platform', 'EKS rollout', '2027-04', '2027-08-15', { tone: 'cat2' });
Diagram.milestone('platform', 'GA', '2027-09-10');
Diagram.marker('today', '2027-02-20');
```

Dates: `2027-03`, `2027-03-15` or `Q2 2027`. `unit`: month | quarter | year (chosen from the span when omitted).
A bar's label goes inside when it fits, otherwise just after the bar.

## 11. Colours and tones

Two themes are always built: **light** (white ground) and **dark** (near-black ground). Every colour is a theme token,
so both are designed, not inverted. Tokens: `ink` (text), `dim` (secondary text), `edge` (lines), `line` (hairlines),
`panel` (light fill), `accent`, `good`, `bad`, `warn`, `data`, `cat0`…`cat7` (categorical), and `X.fill` for a tint of
any of them on the ground (`accent.fill`, `#8C4FFF.fill`). A hex colour stays the same in both themes: use it only for
colours that mean the same everywhere (a vendor's group colour). Vendor icons are never recoloured; a few AWS icons have
official dark-mode variants, used automatically in the dark theme.

## 12. The review round

Every build checks the result and prints numbered issues, each with its location and the fix to apply, plus
`name.review.png` (numbered markers on the diagram) and `name.review.txt`.

| kind | level | meaning |
|---|---|---|
| overlap, overflow, text-collision, canvas | error | overlapping nodes or labels, text too big for its shape, text over text, drawn off the canvas |
| contrast | error under 3:1, else warning | text against what it sits on, in both themes |
| edge-node, edge-text | warning | a line through a node or a label it doesn't belong to |
| crossing, stacked | warning | two lines cross; two lines run on top of each other |
| detour, bends | warning | a line far longer than the distance it covers; more than four turns |

`--fix` builds the variants the script leaves open (`placement`: default / balanced / straight; `spacing: 'roomy'`), keeps
the lowest-scoring one (errors weigh most, then lines through nodes, detours, stacked lines, crossings) and prints the
setting to add to `Diagram.config`. "VERIFIED" means no issues; the checker can't judge whether the diagram tells the
right story, which is what looking at the PNGs is for.

## 13. Part ids (for embeds)

Every drawn thing belongs to a part, used by `references/embed.md` to reveal it: `node:<id>`, `group:<id>`,
`edge:<from>><to>` (a second edge between the same pair is `#2`), `lane:<id>`, `participant:<id>`, `msg:<n>`,
`note:<n>`, `block:<n>`, `table:<id>`, `rel:<n>`, `topic:<id>`, `track:<id>`, `bar:<n>`, `milestone:<n>`, `marker:<n>`,
`axis`. The `.embed.js` file lists them in drawing order (`MotionDiagrams.get(name).parts`).
