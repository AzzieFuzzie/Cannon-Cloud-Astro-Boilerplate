import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const menuCollection = defineCollection({
    loader: glob({ pattern: '**/*.json', base: './src/content/menu' }),
    schema: z.object({
        categoryName: z.string(),
        displayOrder: z.number().optional(),
        items: z.array(
            z.object({
                name: z.string(),
                description: z.string().optional(),
                price: z.string()
            })
        )
    })
});

export const collections = {
    menu: menuCollection
};
