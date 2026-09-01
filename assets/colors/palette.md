# LeiCraft_MC color palette

## Neutral / background

| Name | Tailwind | Hex | Usage |
| --- | --- | --- | --- |
| `slate-950` | `bg-slate-950` | `#020617` | main app background (`main-bg-color`) |
| `slate-900` | `bg-slate-900` | `#0f172a` | elevated cards, navbars |
| `slate-800` | `bg-slate-800` | `#1e293b` | borders, dividers |
| `slate-400` | `text-slate-400` | `#94a3b8` | secondary text |
| `slate-200` | `text-slate-200` | `#e2e8f0` | primary text |
| `white` | `text-white` | `#ffffff` | headings, strong emphasis |

## Project primaries

| Project | Tailwind | Hex | Usage |
| --- | --- | --- | --- |
| LeiOS, Delivr, LeiCraft_MC sites | `sky` | `#0ea5e9` | CTAs, active states, links |
| NowIP | `emerald` | `#10b981` | CTAs, active states, links |
| MindCode | `orange` | `#f97316` | CTAs, active states, links |

## Mark color

The LeiCraft_MC mark uses `sky-400` (`#38bdf8`) by default. Project logos replace this with the
project primary.

## Usage

- Set `neutral: slate` in `app.config.ts` for every project.
- Set `primary` to the project identity color.
- Use `slate-950` as the base background.
- Keep color usage intentional; do not introduce extra accent colors without a reason.
