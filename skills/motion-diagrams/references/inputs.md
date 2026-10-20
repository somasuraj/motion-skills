# Building from existing material

The script is always written by you (Claude); these are the routes from what the user has to that script.

## Infrastructure code (CloudFormation, SAM, CDK, Terraform, docker-compose, Kubernetes)

1. `python scripts/scan_infra.py <repo or files>` lists resources with their types, suggested official icons and
   the references between them (Ref/GetAtt/Sub, Terraform attribute references, `depends_on`, Service selectors,
   Ingress backends, ConfigMap/Secret mounts). Plumbing (IAM, policies, permissions, route tables, log groups) is
   listed as skipped. For CDK, synthesize first (`npx cdk synth`) and scan `cdk.out/`.
2. Decide the story with the user's "Detail" answer: an overview keeps the request path and data stores; detailed adds
   networking boundaries, queues, secrets, observability.
3. Turn references into **meaningful** edges: a reference from a function to a table means "the function reads/writes
   the table" (edge function → table); an event source mapping means "the queue triggers the function" (edge queue →
   function, label "trigger"). Don't draw an edge per reference; draw one per relationship a reader cares about.
4. Boundaries from the code: VPCs/subnets (`aws.vpc`, `aws.subnet.*`), resource groups and VNets (`azure.*`),
   projects (`gcp.project`), clusters and namespaces (`k8s.*`). Account, region and environment from variables or
   stack names; if unknown, leave the region out rather than invent one.
5. Labels are the resource's role, not its logical id: `sub: 'orders table'` rather than `OrdersTable8A3C2F`.
6. Never put secrets, ARNs, account numbers or IPs on the diagram unless asked.

## Mermaid

| Mermaid | Diagram script |
|---|---|
| `flowchart LR` / `TD` | `kind: 'flowchart'`, `direction: 'right'` / `'down'` |
| `A[Text]` · `A(Text)` · `A([Text])` · `A{Text}` · `A[(Text)]` · `A[/Text/]` · `A((Text))` | `box` · `box` · `terminal` · `decision` · `db` · `io` · `circle` |
| `A --> B` · `A -.-> B` · `A ==> B` · `A -- text --> B` / `A -->|text| B` | `edge` · `{dashed: true}` · `{width: 2.5}` · `{label: 'text'}` |
| `subgraph X [Title] … end` | `Diagram.group('X', {label: 'Title'})` and `in: 'X'` on its nodes |
| `sequenceDiagram`: `participant A as Name` · `A->>B: msg` · `B-->>A: msg` · `Note over A,B: x` · `loop`/`alt`/`else`/`opt`/`par` | `participant` · `message` · `reply` · `note(['A','B'], x)` · `block(kind, label, () => …)` with `Diagram.else` |
| `stateDiagram-v2`: `[*] --> S` · `S --> [*]` · `S --> T: event` | `shape: 'start'` / `'end'` nodes, edges with the event as label |
| `erDiagram`: `A ||--o{ B : places` with attribute blocks | `table` with columns; `relation('A.id', 'B.a_id', '1:0..N')` with `label: 'places'` |
| `mindmap` | `kind: 'mindmap'`, the indentation as `children` |
| `gantt` / `timeline` | `kind: 'timeline'`: sections → tracks, tasks → bars, milestones → milestones |
| `C4Context` | `kind: 'c4'`, `Person` → `person`, `System` → `system`, `System_Ext` → `external`, `Rel` → edges |
| `classDef` / `style` colours | `tone` where the colour carries meaning (error, success); otherwise drop it |

Keep the user's text exactly. Where Mermaid named a product ("Lambda", "Postgres"), add its official icon.

## PlantUML

| PlantUML | Diagram script |
|---|---|
| `@startuml` sequence: `actor`/`participant`/`database A as "Name"`, `A -> B: msg`, `A --> B: msg`, `alt/else/end`, `loop … end`, `note over` | `participant` (database → `icon: 'generic/database'` or the product's icon), `message`, `reply`, `block`, `note` |
| activity: `start`, `:action;`, `if (q?) then (yes) … else (no) … endif`, `stop`, `|Lane|` | flowchart (or swimlane when `|Lane|` partitions exist): terminal, boxes, decision with yes/no edges |
| component/deployment: `[Comp]`, `node`, `cloud`, `database`, `package { }`, `A --> B : label` | architecture: groups for `node`/`cloud`/`package`, nodes with official icons |
| `!include <awslib/...>` / `AWSPuml` sprites (`Lambda(fn, "Name", "desc")`) | the matching `aws/…` icon via `icons.py`, `sub` from the description |
| `!include C4_Context.puml`, `Person()`, `System()`, `System_Ext()`, `Rel()`, `System_Boundary()` | `kind: 'c4'` shapes, edges, `c4.boundary` group |
| class diagram | `kind: 'er'` when it is a data model (classes → tables, fields → columns, associations → relations) |

## A photo, screenshot or sketch of a diagram

1. Read the image carefully: list every box (text exactly as written, including abbreviations), every arrow (from, to,
   label, direction, dashed?), every boundary and what is inside it.
2. Identify products from their logo or name and give them official icons; keep hand-written labels as `label`.
3. Pick the kind from the shape of the drawing (boxes and arrows → architecture or flowchart; lifelines → sequence).
4. Rebuild with the layout engine rather than copying positions; keep the original's left-to-right or top-down
   reading direction and grouping.
5. Where something is unreadable, ask once, listing the unclear items; or mark it `(?)` in the label and say so.
