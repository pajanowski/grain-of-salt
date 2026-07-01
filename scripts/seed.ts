import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { v4 as uuidv4 } from 'uuid';
import { ingredients, directions, recipes } from '../src/lib/server/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await db.delete(directions);
  await db.delete(ingredients);
  await db.delete(recipes);

  // Create sample recipes
  const seedRecipes = [
    {
      id: uuidv4(),
      name: 'Classic Pancakes',
    },
    {
      id: uuidv4(),
      name: 'Simple Omelette',
    },
  ];

  await db.insert(recipes).values(seedRecipes);

  const recipe1Id = seedRecipes[0].id;
  const recipe2Id = seedRecipes[1].id;

  // Add ingredients
  const ingredientData = [
    // Pancakes
    { recipeId: recipe1Id, name: 'Flour', amount: '200', unit: 'g' },
    { recipeId: recipe1Id, name: 'Milk', amount: '300', unit: 'ml' },
    { recipeId: recipe1Id, name: 'Eggs', amount: '2', unit: '' },
    { recipeId: recipe1Id, name: 'Sugar', amount: '2', unit: 'tbsp' },
    // Omelette
    { recipeId: recipe2Id, name: 'Eggs', amount: '3', unit: '' },
    { recipeId: recipe2Id, name: 'Butter', amount: '1', unit: 'tbsp' },
    { recipeId: recipe2Id, name: 'Salt', amount: '1', unit: 'pinch' },
  ];

  await db.insert(ingredients).values(ingredientData);

  // Add directions
  const directionData = [
    // Pancakes
    { recipeId: recipe1Id, body: 'Mix flour and sugar in a large bowl.' },
    { recipeId: recipe1Id, body: 'Add milk and eggs, stir until smooth.' },
    { recipeId: recipe1Id, body: 'Heat a pan over medium heat, pour batter and cook until bubbles form.' },
    { recipeId: recipe1Id, body: 'Flip and cook for another minute. Serve warm.' },
    // Omelette
    { recipeId: recipe2Id, body: 'Beat eggs with salt.' },
    { recipeId: recipe2Id, body: 'Melt butter in a pan over medium heat.' },
    { recipeId: recipe2Id, body: 'Pour in eggs, cook, stirring gently until set.' },
    { recipeId: recipe2Id, body: 'Fold in half and serve.' },
  ];

  await db.insert(directions).values(directionData);

  console.log('✅ Seeded 2 recipes with ingredients and directions.');
}

seed()
  .catch(console.error)
  .finally(() => client.end());
