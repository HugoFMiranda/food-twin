// Seed script to generate random food data for testing
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to generate a random number between min and max
function randomNumber(min: number, max: number, decimals = 0): number {
    const num = Math.random() * (max - min) + min;
    return Number(num.toFixed(decimals));
}

// Function to generate a random food name
function generateFoodName(): string {
    const adjectives = ['Spicy', 'Sweet', 'Sour', 'Bitter', 'Savory', 'Creamy', 'Crunchy', 'Juicy', 'Grilled', 'Baked', 'Fried', 'Steamed', 'Roasted', 'Fresh', 'Smoked', 'Braised', 'Sautéed', 'Poached', 'Broiled', 'Slow-Cooked'];
    const foods = ['Chicken', 'Beef', 'Pork', 'Tofu', 'Tempeh', 'Rice', 'Pasta', 'Salad', 'Soup', 'Stew', 'Curry', 'Sandwich', 'Wrap', 'Bowl', 'Burger', 'Pizza', 'Taco', 'Burrito', 'Stir Fry', 'Quinoa', 'Lentils', 'Salmon', 'Tuna', 'Shrimp', 'Cod', 'Trout', 'Lamb', 'Duck', 'Turkey', 'Venison', 'Eggplant', 'Zucchini', 'Cauliflower', 'Broccoli', 'Kale', 'Spinach', 'Mushrooms', 'Potatoes', 'Sweet Potatoes', 'Carrots'];
    const extras = ['with Vegetables', 'with Sauce', 'with Cheese', 'with Herbs', 'with Spices', 'with Rice', 'with Noodles', 'with Potatoes', 'with Beans', 'with Avocado', 'with Nuts', 'with Seeds', 'with Berries', 'with Fruit', 'with Yogurt', 'with Honey', 'with Maple Syrup', 'with Olive Oil', 'with Coconut', 'with Lime', 'with Lemon', 'with Garlic', 'with Ginger', ''];

    const adjIndex = Math.floor(Math.random() * adjectives.length);
    const foodIndex = Math.floor(Math.random() * foods.length);
    const extraIndex = Math.floor(Math.random() * extras.length);

    let name = `${adjectives[adjIndex]} ${foods[foodIndex]}`;
    if (extras[extraIndex] !== '') {
        name += ` ${extras[extraIndex]}`;
    }

    return name;
}

// Function to generate a random food category
function generateCategory(): string {
    const categories = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Beverage', 'Appetizer', 'Side Dish', 'Main Course', 'Salad', 'Soup', 'Bakery', 'Dairy', 'Meat', 'Seafood', 'Vegetable', 'Fruit', 'Grain', 'Legume', 'Nut', 'Seed', 'Condiment', 'Sauce', 'Dressing', 'Smoothie', 'Juice', 'Tea', 'Coffee', 'Alcohol', 'Fermented'];
    const index = Math.floor(Math.random() * categories.length);
    // Use non-null assertion to tell TypeScript this will never be undefined
    return categories[index]!;
}

// Function to generate a random boolean with a given probability
function randomBoolean(probability = 0.5): boolean {
    return Math.random() < probability;
}

function generatePortions(foodName: string) {
    const portions = [];
    const portionCount = randomNumber(0, 3);

    const commonPortions = [
        { name: 'Cup', weight: randomNumber(100, 250, 0) },
        { name: 'Tablespoon', weight: randomNumber(10, 20, 0) },
        { name: 'Teaspoon', weight: randomNumber(3, 7, 0) },
        { name: 'Ounce', weight: randomNumber(25, 35, 0) },
        { name: 'Gram', weight: 1 },
        { name: 'Slice', weight: randomNumber(20, 100, 0) },
        { name: 'Piece', weight: randomNumber(50, 150, 0) },
        { name: 'Serving', weight: randomNumber(100, 300, 0) },
        { name: 'Bowl', weight: randomNumber(200, 400, 0) },
        { name: 'Plate', weight: randomNumber(300, 500, 0) }
    ];

    for (let i = 0; i < portionCount; i++) {
        const portionIndex = Math.floor(Math.random() * commonPortions.length);
        const portion = commonPortions[portionIndex];

        if (portion) {
            portions.push({
                amount: 1,
                portionDescription: portion.name,
                gramWeight: portion.weight,
                sequenceNumber: i + 1
            });

            commonPortions.splice(portionIndex, 1);
        }
    }

    return portions;
}

// Function to generate a random food entry
function generateFood(index: number) {
    const protein = randomNumber(0, 40, 1);
    const fat = randomNumber(0, 30, 1);
    const carbs = randomNumber(0, 100, 1);
    const calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
    const foodName = generateFoodName();

    return {
        fdcId: 1000000 + index,
        description: foodName,
        foodClass: randomBoolean(0.7) ? 'FinalFood' : 'Survey',
        category: generateCategory(),
        publicationDate: new Date(),
        isUserCreated: randomBoolean(0.2),
        isVegan: randomBoolean(0.35),
        protein,
        carbs,
        fat,
        calories,
        portions: {
            create: generatePortions(foodName)
        }
    };
}

// Main seeding function
async function seed() {
    console.log('Starting to seed random food data...');

    try {
        // Clear existing data - delete related records first to avoid foreign key constraints
        console.log('Clearing existing data...');
        await prisma.foodNutrient.deleteMany({});
        await prisma.measure.deleteMany({});
        await prisma.brand.deleteMany({});
        await prisma.foodPortion.deleteMany({});
        await prisma.food.deleteMany({});

        // Generate 100 random food entries
        const foodCount = 100;
        const foods = [];

        for (let i = 0; i < foodCount; i++) {
            foods.push(generateFood(i));
        }

        // Insert foods in batches
        console.log(`Creating ${foodCount} random food entries...`);

        for (const food of foods) {
            await prisma.food.create({
                data: food,
            });
        }

        console.log('Seeding completed successfully!');
    } catch (error) {
        console.error('Error during seeding:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seed function
seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    }); 