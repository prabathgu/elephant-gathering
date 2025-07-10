# The Great Elephant Gathering

A conservation-themed mini game inspired by the real-world elephant gathering at Minneriya Reservoir in Sri Lanka.

## 🐘 About the Game

This game was created using Claude Code as a learning experiment. For anyone curious, this was the token usage to get to the initial state.
| Date       | Models     | Input | Output | Cache Create | Cache Read  | Total Tokens | Cost (USD) |
|------------|------------|-------|--------|---------------|--------------|---------------|-------------|
| 2025-07-07 | - sonnet-4 |    24 |  2,789 |        19,006 |      92,073  |       113,892 |      $0.14  |
| 2025-07-08 | - sonnet-4 |   394 |  8,771 |     1,023,512 |  12,753,778  |    13,786,455 |      $7.80  |
| 2025-07-09 | - sonnet-4 | 1,038 | 21,779 |     1,809,075 |  25,067,796  |    26,899,688 |     $14.63  |
| 2025-07-10 | - sonnet-4 |   132 |  4,237 |       199,224 |   4,146,595  |     4,350,188 |      $2.06  |
| **Total**  |            | 1,588 | 37,576 |     3,050,817 |  42,060,242  |    45,150,223 |    **$24.63** |

The sprites were created using chatgpt, and the background music was created using gabotechs/MusicGPT[https://github.com/gabotechs/MusicGPT]

## 🎮 How to Play

### Objective
- Guide elephant herds safely to the right side of the screen
- Protect farms and villages from damage
- Balance your budget while maximizing elephant conservation

### Controls
- **Mouse**: Click to place selected deterrents
- **Spacebar**: Progress through screens and start levels
- **Sound Toggle**: Click the 🔊 button to toggle audio

### Game Mechanics
- **Budget Management**: Start with Rs.500, earn Rs.10 for each elephant saved
- **Deterrent Types**: 
  - **Blocking**: Physically prevent elephant movement (Thorny Bush, Trench, Electric Fence)
  - **Area-Effect**: Create zones elephants prefer to avoid (Citrus Tree, Bee Hive)
- **Progressive Unlocks**: New deterrents become available at higher levels

### Losing Conditions
- 3 elephants lost per herd
- 3 farms damaged
- Any elephant caught by villagers

## 🛡️ Deterrent Types

| Deterrent | Type | Cost | Unlock Level | Description |
|-----------|------|------|--------------|-------------|
| Thorny Bush | Blocking | Rs.20 | Level 1 | Dense thorny barrier that physically blocks elephant movement |
| Citrus Tree | Area-Effect | Rs.40 | Level 2 | Citrus scent repels elephants in a wide area |
| Electric Fence | Blocking | Rs.100 | Level 2 | Electrified barrier that completely stops elephants |
| Bee Hive | Area-Effect | Rs.60 | Level 3 | Bees create fear in a large area |
| Trench | Blocking | Rs.80 | Level 3 | Deep trench that completely blocks elephant movement |

## 🏞️ Game Levels

The game has 5 levels with increasing numbers of farms and elephants.

Each level has 3 herds with increasing difficulty and elephant counts.

### Play Online
The game is hosted on GitHub pages and can be played directly in your web browser. Simply visit `https://prabathgu.github.io/elephant-gathering`

## 📜 License

This project is open source and available under the MIT License.
