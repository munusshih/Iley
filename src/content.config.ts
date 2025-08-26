import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
		}),
});

const projects = defineCollection({
	loader: file('src/data/projects.json', {
		parser: (text) => {
			const projects = JSON.parse(text);
			return projects.map((project, index) => {
				const id = project.projectName
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, '')
					|| `project-${index + 1}`;

				return {
					id,
					...project
				};
			});
		}
	}),
	schema: z.object({
		projectName: z.string().default(''),
		year: z.string().default(''),
		categories: z.string().default(''),
		shortDescription: z.string().default(''),
		description: z.string().default(''),
		credit: z.string().default(''),
		heroMoment: z.string().default(''),
		thumbnailImage: z.string().default(''),
		workImage1: z.string().default(''),
		workImage2: z.string().default(''),
		workImage3: z.string().default(''),
		workImage4: z.string().default(''),
		workImage5: z.string().default(''),
	}),
});

export const collections = { blog, projects };
