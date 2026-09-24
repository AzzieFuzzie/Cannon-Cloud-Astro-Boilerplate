import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const menuCollection = defineCollection({
    loader: glob({ pattern: '**/*.json', base: './src/content/menu' }),
    schema: ({ image }) =>
        z.object({
            categoryName: z.string(),
            displayOrder: z.number().optional(),
            items: z.array(
                z.object({
                    name: z.string(),
                    description: z.string().optional(),
                    price: z.string()
                    // If you ever want CloudCannon images here to auto-optimize via Astro:
                    // image: image().optional()
                })
            )
        })
});

export const collections = {
    menu: menuCollection
};
