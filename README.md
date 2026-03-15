# BetaFinder

An AI-powered indoor bouldering beta-finding app. Upload a photo of a gym boulder problem, and BetaFinder analyzes the holds and generates a step-by-step animated tutorial showing the optimal sequence of moves.

## How It Works

1. **Upload** — User takes a photo of a gym boulder problem
2. **Analyze** — AI (OpenAI Vision) identifies holds by color, estimates wall angle, and maps hold positions
3. **Plan** — AI reasons about optimal beta: move sequence, body positioning, center of gravity, flagging, etc.
4. **Animate** — A stick-figure climber is rendered on top of the route photo, moving through each hold in sequence with robotic step-by-step transitions between moves

## Scope

- **Gym bouldering only** — color-coded holds on indoor walls
- **Step-by-step animation** — deliberate, tutorial-style robotic movements (not fluid/dynamic). This is intentional: clear, discrete moves are better for learning beta
- **No AI video generation** — animation is rendered client-side using canvas/skeleton overlay on the route photo

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 15 (App Router) | Full-stack React framework |
| Styling | Tailwind CSS + shadcn/ui | UI components and design system |
| AI Vision | OpenAI API (GPT-4o) | Hold detection, beta reasoning |
| Animation | HTML Canvas / Konva.js | Stick-figure climber animation overlay |
| Deployment | Vercel | Hosting and serverless functions |

### What's NOT needed at launch

| Concern | Decision | Reasoning |
|---------|----------|-----------|
| Database | Deferred | No user accounts or saved routes at MVP. State lives in the browser session |
| Cloud storage (S3) | Deferred | Images are sent directly to OpenAI API from the client via a server action. No need to persist images initially |
| Auth | Deferred | No user accounts at MVP |
| Payment | Deferred | Free to use initially |

## Core AI Pipeline

### Input
- A photo of a gym boulder problem
- (Optional) User-provided context: route grade, hold color, start/finish holds

### OpenAI Vision Analysis
The AI identifies:
- **Hold positions** — pixel coordinates of each hold on the wall
- **Hold colors** — to isolate the target route from other holds
- **Hold types** — jug, crimp, sloper, pinch, pocket, volume
- **Wall angle** — slab, vertical, slight overhang, roof
- **Start and top holds** — marked by tags or identified by position

### Beta Output (structured JSON)
```json
{
  "route": {
    "grade": "V4",
    "wallAngle": "slight overhang",
    "holdColor": "blue"
  },
  "holds": [
    { "id": 1, "x": 340, "y": 890, "type": "jug", "label": "start-left" },
    { "id": 2, "x": 520, "y": 870, "type": "jug", "label": "start-right" }
  ],
  "sequence": [
    {
      "move": 1,
      "description": "Match hands on start holds. Feet on smears below.",
      "leftHand": 1,
      "rightHand": 2,
      "leftFoot": null,
      "rightFoot": null,
      "body": { "hip": [430, 950], "centerOfGravity": "low" }
    }
  ]
}
```

### Animation Rendering
- Overlay a stick-figure skeleton on the route photo
- For each move in the sequence, transition limbs to the next hold positions
- Robotic interpolation (linear or eased) between positions
- Playback controls: play/pause, step forward/back, speed adjustment

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing / upload page
│   ├── analyze/
│   │   └── page.tsx          # Analysis + animation view
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts      # OpenAI Vision API endpoint
│   └── layout.tsx
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── ImageUpload.tsx       # Photo upload component
│   ├── RouteCanvas.tsx       # Canvas overlay for holds + climber
│   ├── ClimberSkeleton.tsx   # Stick-figure rendering
│   ├── BetaPlayer.tsx        # Playback controls for animation
│   └── MoveList.tsx          # Text list of moves alongside animation
├── lib/
│   ├── openai.ts             # OpenAI API client
│   ├── prompts.ts            # System prompts for hold detection + beta
│   └── animation.ts          # Interpolation and animation logic
└── types/
    └── beta.ts               # TypeScript types for holds, moves, etc.
```

## Getting Started

### Prerequisites
- Node.js 20+
- OpenAI API key

### Setup
```bash
git clone https://github.com/charliespy/BetaFinder.git
cd BetaFinder
npm install
cp .env.example .env.local
# Add your OPENAI_API_KEY to .env.local
npm run dev
```

## Future Enhancements (post-MVP)

- User accounts and saved routes
- Climber profile (height, ape index) to personalize beta
- Community: share and vote on beta for specific routes
- Gym integration: QR codes on routes linking to BetaFinder analysis
- Multiple beta suggestions (static vs dynamic styles)
- Foot hold detection and recommendation
