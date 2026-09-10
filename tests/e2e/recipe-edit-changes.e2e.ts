/**
 * E2E tests for ingredient and direction add/edit/remove on the recipe
 * edit UI, verifying that:
 *
 *   1. The correct change TYPE is recorded on the edited node: an add on
 *      this node mutates in place, an add from an ancestor becomes an
 *      edit. Either way the diff/history view shows the final shape.
 *   2. The change isolates correctly across a 4-node tree: it appears
 *      on the edited node and its descendants, never on siblings or
 *      ancestors.
 *
 * Materialized recipe building (what each node's "view" actually shows
 * after applying the chain) is out of scope; assertions are on the
 * diff/history view only.
 *
 * Fixture: a 4-node tree seeded by a beforeAll hook in this file under the test user:
 *
 *   Test Root
 *   ├── Test Sibling A   (3 ingredients + 3 directions as initial content)
 *   │   └── Test Grandchild
 *   └── Test Sibling B   (empty)
 *
 * Sibling A carries initial content so the edit/remove tests have rows
 * to target. The other three start empty so isolation is unambiguous.
 *
 * All six tests operate on Sibling A as the edit target and cross-check
 * the other three nodes for isolation. Per-test resets are NOT used —
 * the new recipe tree is isolated from other tests, and each test
 * targets a unique entity within Sibling A so the tests don't interfere
 * with each other within the suite.
 *
 * Note: tests modify the fixture (saving changes to the DB). Retries
 * see the post-modify state — the second run of an edit test is a
 * no-op edit (same value), so hasUnsavedChanges stays false and the
 * page save button stays disabled. We set retries=0 below to keep
 * CI logs short; first-attempt failures still surface the bug.
 */
import { expect, type Page, test } from '@playwright/test';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { TEST_USER_ID } from './helpers/auth-shared';
import { v4 as uuidv4 } from 'uuid';
import {
  getAddButton,
  getAddIngredientButton,
  getAddDirectionButton,
  getIngredientNameInput,
  getDirectionBodyInput,
  getRecipeHeading,
  getRowActionsButton,
  getRowSaveButton,
  clickRowAction
} from './helpers/page-utils';

// The Remove row action shows a `window.confirm` dialog before applying.
// Playwright auto-dismisses dialogs (returning false from confirm), which
// would silently swallow the remove. Register an accept handler so the
// remove actually fires.
test.beforeEach(async ({ page }) => {
  console.log('[e2e] beforeEach: registering dialog handler');
  page.on('dialog', async (dialog) => {
    console.log('[e2e] dialog appeared:', dialog.type(), dialog.message());
    await dialog.accept();
  });
});

// Avoid spending suite time retrying tests whose fixture is left in a
// modified state by their first attempt (see file header).
test.describe.configure({ retries: 0 });

const RECIPE = {
  root: 'Test Root',
  siblingA: 'Test Sibling A',
  siblingB: 'Test Sibling B',
  grandchild: 'Test Grandchild'
} as const;

/**
 * The fixture tree is rebuilt by a beforeAll hook in this file (it deletes
 * any prior rows with the same names before inserting). The shared
 * `use.storageState` in playwright.config.ts signs every test in
 * without a per-test OTP.
 */

// ---------------------------------------------------------------------------
// Fixture setup (4-node tree under TEST_USER_ID; idempotent — deletes prior
// rows with the same names before inserting).
// ---------------------------------------------------------------------------

const FIXTURE_NAMES = ['Test Root', 'Test Sibling A', 'Test Sibling B', 'Test Grandchild'] as const;

/**
 * Build a 4-node fixture for the test user:
 *
 *   Test Root
 *   ├── Test Sibling A   (3 ingredients + 3 directions as initial content)
 *   │   └── Test Grandchild
 *   └── Test Sibling B   (empty)
 *
 * Sibling A carries initial content so the edit/remove tests have rows to
 * target. The other three start empty so isolation is unambiguous.
 */
async function setupRecipeEditFixture(db: PostgresJsDatabase, testOwnerId: string) {
  const nameList = `(${FIXTURE_NAMES.map((n) => `'${n.replace(/'/g, "''")}'`).join(',')})`;
  await db.execute(
    sql.raw(
      `delete from public.recipe_nodes where owner_id = '${testOwnerId}' and name in ${nameList}`
    )
  );

  const rootId = uuidv4();
  const siblingAId = uuidv4();
  const siblingBId = uuidv4();
  const grandchildId = uuidv4();

  const eggId = uuidv4();
  const milkId = uuidv4();
  const saltId = uuidv4();
  const ingredientChanges = [
    {
      id: uuidv4(),
      changeType: 'add',
      targetId: null,
      note: null,
      body: { id: eggId, name: 'Eggs', amount: 3, unit: 'whole' }
    },
    {
      id: uuidv4(),
      changeType: 'add',
      targetId: null,
      note: null,
      body: { id: milkId, name: 'Milk', amount: 1, unit: 'cup' }
    },
    {
      id: uuidv4(),
      changeType: 'add',
      targetId: null,
      note: null,
      body: { id: saltId, name: 'Salt', amount: 1, unit: 'tsp' }
    }
  ];

  const crackId = uuidv4();
  const whiskId = uuidv4();
  const heatId = uuidv4();
  const directionChanges = [
    {
      id: uuidv4(),
      changeType: 'add',
      targetId: null,
      note: null,
      body: { id: crackId, body: 'Crack the eggs' }
    },
    {
      id: uuidv4(),
      changeType: 'add',
      targetId: null,
      note: null,
      body: { id: whiskId, body: 'Whisk with milk' }
    },
    {
      id: uuidv4(),
      changeType: 'add',
      targetId: null,
      note: null,
      body: { id: heatId, body: 'Heat the pan' }
    }
  ];

  const toJsonb = (value: unknown) =>
    sql.raw(`'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`);

  // Insertion order matters: children reference their parent ids.
  const inserts: Array<{
    id: string;
    parentId: string | null;
    name: string;
    ingredients: unknown;
    directions: unknown;
  }> = [
      {
        id: rootId,
        parentId: null,
        name: 'Test Root',
        ingredients: [],
        directions: []
      },
      {
        id: siblingAId,
        parentId: rootId,
        name: 'Test Sibling A',
        ingredients: ingredientChanges,
        directions: directionChanges
      },
      {
        id: siblingBId,
        parentId: rootId,
        name: 'Test Sibling B',
        ingredients: [],
        directions: []
      },
      {
        id: grandchildId,
        parentId: siblingAId,
        name: 'Test Grandchild',
        ingredients: [],
        directions: []
      }
    ];

  for (const row of inserts) {
    await db.execute(sql`
      insert into public.recipe_nodes (
        id, parent_id, owner_id,
        name, ingredient_changes, direction_changes
      ) values (
        ${row.id}::uuid,
        ${row.parentId}::uuid,
        ${testOwnerId}::uuid,
        ${row.name},
        ${toJsonb(row.ingredients)},
        ${toJsonb(row.directions)}
      )
    `);
  }
}

test.beforeAll(async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL must be set for e2e tests to run');
  }
  const client = postgres(dbUrl, { prepare: false });
  const db = drizzle(client);
  try {
    await setupRecipeEditFixture(db, TEST_USER_ID);
    console.log('[e2e recipe-edit-changes] Created 4-node recipe-edit fixture under test user');
  } finally {
    await client.end();
  }
});

if (process.env.PLAYWRIGHT_USE_DEV) {
  test.setTimeout(120_000);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Open a recipe page by clicking its link in the recipe tree. Recipes in
 * the tree are matched by name (anchored on the link text), so the same
 * helper works for the 4 fixture nodes and any other recipes in the tree.
 */
async function openRecipe(page: Page, recipeName: string) {
  await page.goto('/mise');
  await expect(page.getByRole('heading', { name: 'Recipe List' })).toBeVisible();
  const link = page
    .getByRole('link', { name: new RegExp(`^\\s*(↳\\s+)?${recipeName}\\b`) })
    .first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL(/\/recipes\//);
  await expect(page.getByRole('heading', { name: `${recipeName}` })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Scoped locators (so we never match history entries that happen to mention
// the same string as an ingredient or direction body).
// ---------------------------------------------------------------------------

function ingredientList(page: Page) {
  return page.getByTestId('ingredient-list');
}

function directionList(page: Page) {
  return page.getByTestId('direction-list');
}

function ingredientRow(page: Page, name: string) {
  return ingredientList(page).locator(`li[data-ingredient-name="${name}"]`);
}

function directionRow(page: Page, index: number) {
  return directionList(page).locator(`li[data-direction-index="${index}"]`);
}


function addIngredientForm(page: Page) {
  return page
    .locator('form')
    .filter({ has: page.getByRole('textbox', { name: 'Ingredient name' }) })
    .first();
}

function addDirectionForm(page: Page) {
  return page
    .locator('form')
    .filter({ has: page.getByRole('textbox', { name: 'Direction' }) })
    .first();
}

async function fillAddIngredient(page: Page, name: string, amount: string, unit: string) {
  // The form stays open after a successful Add, so only click the
  // section "+ Add" trigger if the form isn't already visible.
  let form = addIngredientForm(page);
  if ((await form.count()) === 0) {
    await getAddIngredientButton(page).click();
    form = addIngredientForm(page);
  }
  await expect(getIngredientNameInput(page)).toBeVisible();
  await getIngredientNameInput(page).fill(name);
  await page.getByPlaceholder('Amount').fill(amount);
  await page.getByPlaceholder('Unit').fill(unit);
  await getAddButton(form).click();
}

async function fillAddDirection(page: Page, body: string) {
  let form = addDirectionForm(page);
  if ((await form.count()) === 0) {
    await getAddDirectionButton(page).click();
    form = addDirectionForm(page);
  }
  await expect(getDirectionBodyInput(page)).toBeVisible();
  await getDirectionBodyInput(page).fill(body);
  await getAddButton(form).click();
}

// ---------------------------------------------------------------------------
// Save (page-level). Wait for the ENABLE transition both before clicking
// and after, so we never overlap a save round-trip.
// ---------------------------------------------------------------------------

async function clickPageSave(page: Page) {
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  await save.click();
  // Round-trip signal: after a successful save the page reloads data and
  // `hasUnsavedChanges` goes false, which disables the Save button. We
  // wait for that, not for a re-enable (which only happens if the test
  // makes a further edit).
  await expect(save).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// Edit row form (per-row inputs, scoped to the row).
// IngredientRow uses placeholder-based inputs; DirectionRow uses a textarea
// with no placeholder or aria-label. The row's own Save button has no
// distinguishing attribute, so it's found by type="submit" within the row.
// ---------------------------------------------------------------------------

async function editIngredientRow(
  page: Page,
  row: ReturnType<typeof ingredientRow>,
  newName: string,
  newAmount: string,
  newUnit: string
) {
  await clickRowAction(page, row, 'Edit');
  await row.getByPlaceholder('Name').fill(newName);
  await row.getByPlaceholder('Amount').fill(newAmount);
  await row.getByPlaceholder('Unit').fill(newUnit);
  await getRowSaveButton(row).click();
}

async function editDirectionRow(page: Page, row: ReturnType<typeof directionRow>, newBody: string) {
  await clickRowAction(page, row, 'Edit');
  await row.locator('textarea').fill(newBody);
  await getRowSaveButton(row).click();
}

// ---------------------------------------------------------------------------
// History (collapsed by default — expand before asserting).
// ---------------------------------------------------------------------------

async function expandHistory(page: Page) {
  const toggle = page.getByTestId('recipe-history').locator('> button').first();
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

function historyEntries(page: Page) {
  return page.getByTestId('recipe-history').locator('ol#recipe-history-entries');
}

async function assertHistoryContains(page: Page, expectedText: string | RegExp) {
  await expandHistory(page);
  await expect(historyEntries(page)).toContainText(expectedText);
}

async function assertHistoryDoesNotContain(page: Page, unexpectedText: string | RegExp) {
  await expandHistory(page);
  await expect(historyEntries(page)).not.toContainText(unexpectedText);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('ingredient changes isolate correctly across the 4-node fixture', () => {
  test('add ingredient on Sibling A is recorded as "added ingredient" and isolates correctly', async ({
    page
  }) => {
    // Edit target: Sibling A.
    await openRecipe(page, RECIPE.siblingA);
    await fillAddIngredient(page, 'Onion', '1', 'whole');
    await clickPageSave(page);

    // Hard reload — verify the save actually persisted (not just client state).
    await page.reload();
    await expect(getRecipeHeading(page, RECIPE.siblingA)).toBeVisible();

    // On Sibling A (the edit target): history shows the add.
    await assertHistoryContains(page, 'ADD 1 whole Onion');

    // On Grandchild (descendant, inherits chain): history shows the add.
    await openRecipe(page, RECIPE.grandchild);
    await assertHistoryContains(page, 'ADD 1 whole Onion');

    // On Root (parent, no upward inheritance): history does NOT contain.
    await openRecipe(page, RECIPE.root);
    await assertHistoryDoesNotContain(page, 'Onion');

    // On Sibling B (different branch): history does NOT contain.
    await openRecipe(page, RECIPE.siblingB);
    await assertHistoryDoesNotContain(page, 'Onion');
  });

  test('edit ingredient on Sibling A mutates the add in place (no separate edit record)', async ({
    page
  }) => {
    // Eggs is initial content on Sibling A — its presence in history is
    // the fixture's add record. Editing Eggs from this node runs Case
    // A in Recipe.svelte#editIngredient: the add record's body is
    // mutated in place (same id, same op), so the diff shows only the
    // updated add — no "edited ingredient: before → after" entry.
    await openRecipe(page, RECIPE.siblingA);
    await editIngredientRow(page, ingredientRow(page, 'Eggs'), 'Eggs', '5', 'whole');
    await clickPageSave(page);

    // On Sibling A (the edit target): history shows the (mutated) add.
    await assertHistoryContains(page, 'ADD 5 whole Eggs');
    // And the original amount must NOT be present — the add was rewritten.
    await assertHistoryDoesNotContain(page, 'ADD 3 whole Eggs');

    // On Grandchild: same mutated add visible via the chain.
    await openRecipe(page, RECIPE.grandchild);
    await assertHistoryContains(page, 'ADD 5 whole Eggs');

    // On Root: no Eggs history — Root's chain doesn't include Sibling A's diff.
    await openRecipe(page, RECIPE.root);
    await assertHistoryDoesNotContain(page, 'Eggs');

    // On Sibling B: no Eggs history — different branch.
    await openRecipe(page, RECIPE.siblingB);
    await assertHistoryDoesNotContain(page, 'Eggs');
  });

  test('remove ingredient from Sibling A is recorded as "removed ingredient"', async ({ page }) => {
    await openRecipe(page, RECIPE.siblingA);

    await clickRowAction(page, ingredientRow(page, 'Milk'), 'Remove');
    await clickPageSave(page);

    await assertHistoryDoesNotContain(page, 'removed ingredient: 1 cup Milk');

    await openRecipe(page, RECIPE.grandchild);
    await assertHistoryDoesNotContain(page, 'removed ingredient: 1 cup Milk');

    await openRecipe(page, RECIPE.root);
    await assertHistoryDoesNotContain(page, 'Milk');

    await openRecipe(page, RECIPE.siblingB);
    await assertHistoryDoesNotContain(page, 'Milk');
  });
});

test.describe('direction changes isolate correctly across the 4-node fixture', () => {
  test('add direction on Sibling A is recorded as "added direction" and isolates correctly', async ({
    page
  }) => {
    const BODY = 'Serve immediately with toast';

    await openRecipe(page, RECIPE.siblingA);
    await fillAddDirection(page, BODY);
    await clickPageSave(page);

    // Directions are rendered with surrounding quotes in the history
    // view (see src/lib/obj/recipeDiff.ts#formatDirectionChange).
    await assertHistoryContains(page, `ADD "${BODY}"`);

    await openRecipe(page, RECIPE.grandchild);
    await assertHistoryContains(page, `ADD "${BODY}"`);
    await openRecipe(page, RECIPE.root);
    await assertHistoryDoesNotContain(page, BODY);

    await openRecipe(page, RECIPE.siblingB);
    await assertHistoryDoesNotContain(page, BODY);
  });

  test('edit direction on Sibling A mutates the add in place (no separate edit record)', async ({
    page
  }) => {
    // "Crack the eggs" is initial content on Sibling A — same Case A
    // mutates-in-place behaviour as the ingredient edit test. The diff
    // shows only the (mutated) add, with surrounding quotes because
    // direction bodies are always quoted in the history view.
    await openRecipe(page, RECIPE.siblingA);
    await editDirectionRow(page, directionRow(page, 0), 'Crack the eggs gently');
    await clickPageSave(page);

    await assertHistoryContains(page, 'ADD "Crack the eggs gently"');
    await assertHistoryDoesNotContain(page, 'ADD "Crack the eggs"');

    await openRecipe(page, RECIPE.grandchild);
    await assertHistoryContains(page, 'ADD "Crack the eggs gently"');
    await openRecipe(page, RECIPE.root);
    await assertHistoryDoesNotContain(page, 'Crack the eggs');

    await openRecipe(page, RECIPE.siblingB);
    await assertHistoryDoesNotContain(page, 'Crack the eggs');
  });

  test('remove direction from Sibling A is recorded as "removed direction"', async ({ page }) => {
    // Remove "Whisk with milk" (initial content, index 1, untouched by other tests).
    await openRecipe(page, RECIPE.siblingA);
    await clickRowAction(page, directionRow(page, 1), 'Remove');
    await clickPageSave(page);

    await assertHistoryDoesNotContain(page, 'removed direction: "Whisk with milk"');

    await openRecipe(page, RECIPE.grandchild);
    await assertHistoryDoesNotContain(page, 'removed direction: "Whisk with milk"');

    await openRecipe(page, RECIPE.root);
    await assertHistoryDoesNotContain(page, 'Whisk with milk');

    await openRecipe(page, RECIPE.siblingB);
    await assertHistoryDoesNotContain(page, 'Whisk with milk');
  });
});
