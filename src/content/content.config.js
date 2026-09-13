import { defineCollection, z } from 'astro:content';

const menuCollection = defineCollection({
    type: 'data',
    schema: z.object({
        categoryName: z.string(),
        displayOrder: z.number().optional(),
        items: z.array(
            z.object({
                name: z.string(),
                description: z.string().optional(),
                price: z.string(),
                dietary: z.array(z.string()).optional()
            })
        )
    })
});

export const collections = {
    menu: menuCollection
};
