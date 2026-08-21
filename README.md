# Man Utd Snapshot

PROJECT: One-Tap Manchester United News Center for Grandpa

CONTEXT

My grandfather is an elderly Manchester United fan who speaks only Macedonian

and Serbian. He has difficulty navigating smartphones — he gets lost with

searching, typing, and multi-step navigation. He currently uses an Android

smartphone. He wants to stay effortlessly up to date on his team.

JOB TO BE DONE

When my grandfather wants to check on Manchester United, he wants to open

one thing, with one tap, from his home screen, and immediately see a clear

snapshot of the team's current state — without searching, typing, choosing,

or reading English.

END GOAL

A single-purpose destination (accessible via a one-tap home screen shortcut)

that shows, in Macedonian:

- If a match is live or about to happen: the score and the lineup

- If no match is happening: the result of the last match, and information

  about the next upcoming match

- General current news/updates about the club

DESIGN CONSTRAINTS (outcomes, not solutions)

- Must be usable by someone with low smartphone literacy: no navigation,

  no menus to hunt through, no choices to make on arrival

- Must be entirely in Macedonian (or Serbian as an acceptable substitute),

  with correct football terminology — not raw machine-translated English

- Must load directly to the relevant content with nothing in between

- Content must stay current (this is a living news source, not a static page)

SUCCESS CRITERIA

My grandfather can, unprompted and unassisted, tap one icon on his home

screen and understand — within seconds — whatever is currently true about

Manchester United.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://united-vesti-krsto.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/15813d82-5a41-46a2-9306-cbe7b9d2f823).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
