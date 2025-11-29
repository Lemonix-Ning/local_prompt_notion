const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

const VAULT_ROOT = process.env.VAULT_PATH || path.join(__dirname, '../../sample-vault');
const TRASH_DIR = path.join(VAULT_ROOT, 'trash');
const VISITS_FILE = path.join(TRASH_DIR, '.trash-visits.json');
const DEFAULT_THRESHOLD = 10;

async function readVisits() {
  try {
    const raw = await fs.readFile(VISITS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

async function writeVisits(visits) {
  await fs.mkdir(TRASH_DIR, { recursive: true });
  await fs.writeFile(VISITS_FILE, JSON.stringify(visits, null, 2), 'utf-8');
}

async function listTrashItems() {
  await fs.mkdir(TRASH_DIR, { recursive: true });
  const entries = await fs.readdir(TRASH_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

router.get('/status', async (req, res, next) => {
  try {
    const thresholdRaw = req.query.threshold;
    const threshold = Number.isFinite(Number(thresholdRaw)) ? Number(thresholdRaw) : DEFAULT_THRESHOLD;

    const visits = await readVisits();
    const items = await listTrashItems();

    for (const name of Object.keys(visits)) {
      if (!items.includes(name)) {
        delete visits[name];
      }
    }

    const counts = {};
    for (const itemName of items) {
      counts[itemName] = Number(visits[itemName]) || 0;
    }

    await writeVisits(visits);

    res.json({
      success: true,
      data: {
        threshold,
        counts,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/visit', async (req, res, next) => {
  try {
    const thresholdRaw = req.query.threshold;
    const threshold = Number.isFinite(Number(thresholdRaw)) ? Number(thresholdRaw) : DEFAULT_THRESHOLD;

    const visits = await readVisits();
    const items = await listTrashItems();

    for (const name of Object.keys(visits)) {
      if (!items.includes(name)) {
        delete visits[name];
      }
    }

    const deleted = [];
    const updatedCounts = {};

    for (const itemName of items) {
      const nextCount = (Number(visits[itemName]) || 0) + 1;

      if (nextCount >= threshold) {
        const itemPath = path.join(TRASH_DIR, itemName);
        await fs.rm(itemPath, { recursive: true, force: true });
        deleted.push({ name: itemName, visits: nextCount });
        delete visits[itemName];
      } else {
        visits[itemName] = nextCount;
        updatedCounts[itemName] = nextCount;
      }
    }

    await writeVisits(visits);

    res.json({
      success: true,
      data: {
        threshold,
        visitedCount: items.length,
        deleted,
        counts: updatedCounts,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
