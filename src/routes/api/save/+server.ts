import { writeFile } from 'fs/promises';
import type { RequestHandler } from './$types';
import { request } from 'http';

export const POST: RequestHandler = async ({ request }) => {
  return new Response();
}

export const PUT: RequestHandler = async ({ request }) => {
  const data = await request.formData();
  const recipe = data.get('recipe') as string;
  const fileName = data.get('fileName') as string;
  await writeFile(`src/lib/assets/${fileName}`, recipe);
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
