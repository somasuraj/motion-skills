# Diagram craft

A diagram earns its place when someone understands the system faster than by reading. Everything here
serves that.

## The one question

Before any node, write (to yourself) the question the diagram answers: "How does a request reach the
database?", "What happens when an expense is rejected?", "Which team owns what?". Every node, group and edge must
help answer it. Two questions make two diagrams.

## Choosing the kind

| The user wants to show | Kind |
|---|---|
| Parts of a system and how they connect, deployed where | architecture |
| Steps and decisions in a process | flowchart |
| The same, and who does each step | swimlane |
| Who talks to whom, in what order (APIs, auth, handshakes) | sequence |
| The states one thing moves through | state |
| Tables, keys and relationships | er |
| A system in its environment (people, external systems), or its containers | c4 |
| Ideas around one topic | mindmap |
| Work over time | timeline |
| Reporting lines | org |

## Architecture

- **Flow left to right**: the user or client on the left, data stores on the right. Use `direction: 'down'` for tall
  stacks (a layered platform, a network from internet down to subnets).
- **Boundaries are information.** Draw a group only where it changes meaning: cloud/account, region, VPC/VNet,
  public vs private subnet, cluster/namespace, on-premises. Don't wrap everything in "AWS Cloud" unless there are
  things outside it to contrast.
- **Official icons, the vendor's own names**: "Amazon S3", "Azure Key Vault", "Cloud Run". Put what *this* instance is
  for in `sub` ("static assets", "orders db", "AZ a").
- **Label edges with what flows** when the line alone is ambiguous (protocol, message, data); leave obvious ones bare.
  Dashed for async, optional or control-plane relations (monitoring, config, "provisions").
- **Show redundancy once**, then mark it: two Fargate nodes "AZ a / AZ b" read better than six.
- Overview ≤ 15 nodes; detailed ≤ 30. Past that, split by layer or by flow.
- **Tools**: a DevOps diagram is a pipeline: source → build → quality → package → registry → deploy → runtime, with
  notifications and infra-as-code off to the side (dashed).

## Flowchart and swimlane

- Start and end are `terminal`; questions are `decision` with a "?" and two labelled exits (`yes` tone good, `no` tone
  bad); actions are boxes starting with a verb ("Review claim").
- One flow direction; loops back are dashed with a label ("fix and push").
- Swimlanes: one lane per role or system, in the order work passes between them; keep a role's steps in its lane.

## Sequence

- Participants left to right in the order they first act. Calls solid, replies dashed. A reply's label is the result
  ("200 · orders[]"), not "response".
- `loop`, `alt`, `opt` blocks only where they change understanding; notes for facts the arrows can't show
  ("tokens cached for 1 h").
- ≤ 15 messages; more is two diagrams (setup, then steady state).

## State, ER, C4

- **State**: states are nouns or adjectives ("Paid", "Shipped"); transitions are events ("payment ok"). Mark final
  states (`final: true`) and use the good/bad tones for success and failure ends.
- **ER**: tables as they are named in the schema; show keys and the columns that carry relationships; omit audit
  columns unless they matter. Cardinality on every relation.
- **C4**: context diagrams show people, the system and external systems only; container diagrams add a
  `c4.boundary` group. Every box has a one-line description in `sub`; every relation says what and how.

## Mind map, timeline, org

- **Mind map**: 4–7 first-level branches of short nouns, 2–4 leaves each; deeper only where it adds meaning.
- **Timeline**: one track per team or stream; bar labels are outcomes ("EKS rollout"); one milestone or marker
  that matters (GA, today), not one per month.
- **Org**: names and roles as given; fictional names when the user wants an example; one tone per branch.

## Text

- Labels ≤ 4 words; `sub` ≤ 4 words. Sentence case. No trailing punctuation.
- The user's names and terms as given. Abbreviations the audience uses (VPC, ALB, SQL) are fine; invented ones are not.
- Never print secrets, real account ids, internal hostnames or IPs from code unless the user wants them shown;
  use placeholders.

## Pre-delivery checklist

- [ ] `build.py` printed VERIFIED (or only warnings you looked at and accepted).
- [ ] You looked at `name.png` and `name-dark.png`: nothing crowded, no long detours, labels readable.
- [ ] The diagram answers its one question; nothing on it is decoration.
- [ ] Every product has its official icon; no vendor's icon on another vendor's product; generic glyphs only for
  unbranded things.
- [ ] Boundaries are the real ones (account, region, network, cluster, team), labelled.
- [ ] Edges that need a label have one; dashed means something consistent.
- [ ] Names, numbers and ids are the user's or clearly placeholders.
- [ ] You said which file is for what and where they are.
