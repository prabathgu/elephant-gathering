I want to create a web game based on elephant conservation focusing on human elephant conflict. At a high level this game will feature herds of elephants migrating through an area populated with farms, houses and villagers. The elephants can damage the farms, which will lead to villagers attacking them and driving them away, leading them to abandon the migration. They player takes on the role of a conservationist, placing a number of deterrents that will stop elephants from approaching the farms (and reducing chances of conflict with villagers). The objective is to get the maximum number of elephants to complete their migration successfully.

## Game play
1. The elephants move in herds. Each herd will have 10 to 20 elephants.
2. They will enter the screen on the left edge and slowly migrate to the right edge.
2. They can move in random directions while migrating while keeping herd cohesion. I.e. the herd will slowly migrate to the right of the screen (say that left to right migration will take about 5 minutes). But individual elephants or even the herd can move in any random direction for a while before resuming with the migration. 
3. If they come across a deterrent, they'll try to avoid / go around it. Each deterrent type will have different properties which will be given later.
4. If they come near a farm, they'll be drawn to it. When they are on the farm, they can damage it which will trigger villagers coming out of houses and trying to chase them away.
5. If a farm is damaged, a villager will be spawned from the nearest house to the farm. Once the villager is spawned, they will move to confront the nearest elephant.
6. If the villagers confront an elephant, there is a high chance that elephant will abandon the migration and start moving back to the left edge of the screen. These elephants will be considered to have abandoned the migration.
7. After the villager confronts an elephant, they will return to the house and dissapear.
8. You're given an inital budget to start off with, and can place deterrents using that budget. 
9. There will be about 12 waves of herds for a level.

## Detailed specifications

### Game area 
This will be a fixed size (eg:- 1200x600 pixels). This can be tiled fully with the tiles from sprites folder (background_1.png through background_9.png). 

### Elephants
Use sprite in sprites/elephant.png when moving left to right. When moving right to left, reverse the sprite.

### Farms
Sprite: sprites/farm.png
A number of farms will be generated randomly in the game area at the start of the game. 

### Houses
Sprite: sprites/house_1.png or house_2.png
A number of houses will be generated somewhat close to the farms.

### Villagers
Sprite: sprites/villager_1.png or villager_2.png
No villagers will be visible at the start of the game. They will be spawned if elephants damage farms.

### Deterrents

There are five deterrent types with varying properties:

1. **Electric Fence**
   - Cost: $100
   - Effectiveness: 95%
   - Duration: 2 minutes
   - Range: 80 pixels
   - Sprite: sprites/electric_fence.png

2. **Trench**
   - Cost: $80
   - Effectiveness: 85%
   - Duration: 3 minutes
   - Range: 60 pixels
   - Sprite: sprites/trench.png

3. **Bee Hive**
   - Cost: $60
   - Effectiveness: 90%
   - Duration: 1 minute
   - Range: 100 pixels
   - Sprite: sprites/bee_hive.png

4. **Citris Tree**
   - Cost: $40
   - Effectiveness: 70%
   - Duration: 1.5 minutes
   - Range: 70 pixels
   - Sprite: sprites/citrus_tree.png

5. **Thorny Bush**
   - Cost: $20
   - Effectiveness: 50%
   - Duration: 3.33 minutes
   - Range: 50 pixels
   - Sprite: sprites/thorns.png
