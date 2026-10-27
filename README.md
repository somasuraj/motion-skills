# motion-skills

A Claude Code plugin with three skills that work together.

| Skill | Makes | Output |
|---|---|---|
| **motion-slides** | Animated explainer presentations: each concept slide is a short animation you click through; PowerPoint-style slides or a Prezi-style canvas, real 3D where it helps, five themes, speaker notes | One self-contained HTML file that presents offline |
| **motion-videos** | Animated films: explainers, motion graphics, promos, pieces timed to a voice-over or song, with a generated score | A self-contained HTML player that exports MP4 or GIF |
| **motion-diagrams** | Static diagrams with official icons, laid out automatically: AWS / Azure / Google Cloud / Kubernetes architecture (including an AWS reference-style AZ grid), DevOps toolchains with real tool logos, flowcharts, swimlanes, sequence, state, ER, C4, mind maps, roadmaps, org charts | SVG and PNG in light and dark, editable `.drawio` and `.excalidraw`, and an embed file for decks and films |

The skills reuse each other: a diagram built with `--formats …,embed` drops into a motion-slides deck or a
motion-videos film and builds up step by step (see `skills/motion-diagrams/references/embed.md`).

## Install

In Claude Code:

```
/plugin marketplace add somasuraj/motion-skills
/plugin install motion-skills@motion-skills
```

Then ask for what you want: "make an animated deck about…", "make a 30-second explainer video of…",
"draw the architecture of my Terraform", "a sequence diagram of our login flow".

The repo is private: Claude Code clones it with your own git credentials (`gh auth login` or an SSH key), so you
need read access.

### Other agents

Each skill under `skills/` is a plain folder with a `SKILL.md` (the open Agent Skills format), so any agent that
reads that format can use them. Clone the repo and copy (or symlink) the three folders into the agent's skills folder:

```bash
git clone git@github.com:somasuraj/motion-skills.git
cp -r motion-skills/skills/* <skills folder from the table>/
```

| Agent | Project folder | Personal folder (all projects) |
|---|---|---|
| Claude Code (without the plugin) | `.claude/skills/` | `~/.claude/skills/` |
| Claude.ai / Claude desktop | upload `motion-slides.skill`, `motion-videos.skill`, `motion-diagrams.skill` in Settings → Capabilities → Skills (needs code execution) | |
| OpenAI Codex | `.agents/skills/` | `~/.agents/skills/` |
| GitHub Copilot (VS Code, CLI) | `.github/skills/` | `~/.copilot/skills/` |
| Cursor (2.4+) | `.cursor/skills/` | none (project only) |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` |
| OpenCode | `.opencode/skills/` (also reads `.claude/skills/`, `.agents/skills/`) | `~/.config/opencode/skills/` |

Using several agents? Keep one copy in `.agents/skills/` and symlink the other folders to it. These paths change
between releases, so check your agent's docs if a skill isn't picked up. The agent must be able to run shell
commands: the skills build everything with the Python scripts below.

## Requirements

- Python 3.10+ with Playwright and Chromium: `pip install playwright pillow && python -m playwright install chromium`
- ffmpeg (motion-videos MP4 export from the command line only)
- Network once for Google Fonts in decks and films. motion-diagrams bundles its fonts and icons and builds offline;
  it goes online only to fetch the logo of a brand the bundled pack lacks (once per brand, then cached).

## motion-diagrams in short

```bash
python skills/motion-diagrams/scripts/build.py my-diagram.js --fix      # build + review round
python skills/motion-diagrams/scripts/icons.py "load balancer" github sonarqube
python skills/motion-diagrams/scripts/fetch_logo.py "Zitadel" --domain zitadel.com   # a brand the pack lacks: real logo from the web
python skills/motion-diagrams/scripts/scan_infra.py ./infra             # Terraform / CDK / CloudFormation / compose / k8s
```

Every build runs a review round: numbered issues (overlaps, crossings, detours, lines on lines, contrast in both
themes) with a fix for each and a `name.review.png` marking them; `--fix` tries layout variants. One script builds a
slide version and a document version (`--set aspect=none --set compact=true`).

## Bundled third-party material

motion-diagrams ships 8,506 icons (including 66 popular tools added from official sources; see `skills/motion-diagrams/assets/icons/ADDED.md`) so builds never download anything. For a brand the pack lacks, `fetch_logo.py` finds
its real logo (the vendor's site, gilbarbara/logos, Devicon, Simple Icons, its GitHub organisation, Wikimedia Commons),
cleans it, records the source and licence, and caches it in `~/.motion-diagrams/icons`; nothing fetched is added to this repo. They remain the property of their owners and are
included for drawing architecture diagrams, as their terms allow; use them unaltered. Full list and terms:
`skills/motion-diagrams/assets/icons/LICENSES.md`.

| Icons | Source | Terms |
|---|---|---|
| AWS service, resource and group icons | AWS Architecture Icons | AWS permits their use in architecture diagrams |
| Azure service icons | Microsoft Azure architecture icons | Microsoft permits use in architecture diagrams and documentation |
| Google Cloud icons | Google Cloud icons | Google permits use to depict Google Cloud in diagrams |
| Kubernetes resource icons | kubernetes/community | Apache-2.0 / CC-BY-4.0 |
| Tool and brand logos | gilbarbara/logos, Simple Icons | CC0; marks remain trademarks of their owners |
| Generic glyphs | Lucide | ISC |

Other bundled libraries: three.js (MIT), xterm.js (MIT), Monaco editor (MIT), ELK.js (EPL-2.0), Inter and JetBrains
Mono fonts (SIL OFL 1.1). Their licence files sit next to them under each skill's `assets/`.
