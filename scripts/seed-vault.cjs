const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .substring(0, 50);
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function writeText(filePath, data) {
  await fs.writeFile(filePath, data, 'utf-8');
}

async function createPrompt({ vaultRoot, categoryName, title, tags, content, author, favorite }) {
  const categoryPath = path.join(vaultRoot, categoryName);
  await ensureDir(categoryPath);

  const baseSlug = titleToSlug(title);
  let slug = baseSlug;
  let promptDir = path.join(categoryPath, slug);
  let counter = 1;

  while (await exists(promptDir)) {
    slug = `${baseSlug}_${counter}`;
    promptDir = path.join(categoryPath, slug);
    counter++;
  }

  await ensureDir(promptDir);

  const metaPath = path.join(promptDir, 'meta.json');
  const contentPath = path.join(promptDir, 'prompt.md');

  if (await exists(metaPath)) {
    return { skipped: true, promptDir };
  }

  const now = new Date().toISOString();
  const meta = {
    id: crypto.randomUUID(),
    title,
    slug,
    created_at: now,
    updated_at: now,
    tags: tags || [],
    version: '1.0.0',
    author: author || 'Seed',
    model_config: {
      default_model: 'gpt-4',
      temperature: 0.7,
      top_p: 1.0,
    },
    is_favorite: Boolean(favorite),
    category: categoryName,
    category_path: categoryPath,
  };

  await writeJson(metaPath, meta);
  await writeText(contentPath, content || '');

  return { skipped: false, promptDir };
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const rawVaultPath = process.env.VAULT_PATH && process.env.VAULT_PATH.trim();
  const vaultRoot = rawVaultPath
    ? path.resolve(rawVaultPath)
    : path.join(repoRoot, 'vault');

  await ensureDir(vaultRoot);
  await ensureDir(path.join(vaultRoot, 'trash'));

  const samples = [
    {
      categoryName: 'Coding',
      title: 'React System Architect',
      tags: ['react', 'architecture', 'expert'],
      favorite: true,
      content: `# Role: React Architect\n\nYou are an expert in scalable React patterns.\n\n## Task\n- Propose an architecture for a medium-sized app\n- Explain state management choices\n\n## Output format\n- Overview\n- Module boundaries\n- Data flow\n- Risks\n`,
    },
    {
      categoryName: 'Coding',
      title: 'SQL Query Optimizer',
      tags: ['sql', 'database', 'performance'],
      favorite: false,
      content: `# Role: SQL Optimizer\n\nAnalyze the following SQL query for performance bottlenecks.\n\n## Constraints\n- Prefer index-friendly predicates\n- Avoid unnecessary sorts\n\n## Provide\n- Issues\n- Suggested indexes\n- Rewritten query\n`,
    },
    {
      categoryName: 'Creative Writing',
      title: "Hero's Journey Generator",
      tags: ['story', 'structure', 'fiction'],
      favorite: true,
      content: `# Role: Story Generator\n\nGenerate a plot outline following the 12 steps of the Hero's Journey.\n\n## Input\n- Genre\n- Protagonist\n- Theme\n\n## Output\n- 12 steps outline\n- Key scenes\n- Character arc\n`,
    },
    {
      categoryName: 'Business',
      title: 'PRD Writer',
      tags: ['product', 'prd', 'planning'],
      favorite: false,
      content: `# Role: Product Manager\n\nWrite a concise PRD for the following feature.\n\n## Include\n- Problem\n- Goals/Non-goals\n- User stories\n- Success metrics\n- Rollout plan\n`,
    },
  ];

  const results = [];
  for (const s of samples) {
    // eslint-disable-next-line no-await-in-loop
    const r = await createPrompt({ vaultRoot, ...s });
    results.push(r);
  }

  const created = results.filter(r => !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;

  console.log('========================================');
  console.log('Vault seed completed');
  console.log(`Vault: ${vaultRoot}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (already existed): ${skipped}`);
  console.log('========================================');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
