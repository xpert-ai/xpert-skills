import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, '..');
const skillsRoot = path.join(repoRoot, 'skills');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  const frontmatter = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    body: match[2].trim(),
  };
}

async function getDirectories(parentDir) {
  const entries = await readdir(parentDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDir, entry.name));
}

function relativePath(targetPath) {
  return path.relative(repoRoot, targetPath) || '.';
}

async function validateSkillDirectory(skillDir, seenNames, errors) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  const folderName = path.basename(skillDir);

  let fileInfo;
  try {
    fileInfo = await stat(skillFile);
  } catch {
    errors.push(`${relativePath(skillDir)}: missing SKILL.md`);
    return;
  }

  if (!fileInfo.isFile()) {
    errors.push(`${relativePath(skillFile)}: expected a file`);
    return;
  }

  const content = await readFile(skillFile, 'utf8');
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    errors.push(`${relativePath(skillFile)}: missing or malformed YAML frontmatter`);
    return;
  }

  const { frontmatter, body } = parsed;
  const name = frontmatter.name;
  const description = frontmatter.description;

  if (!name) {
    errors.push(`${relativePath(skillFile)}: missing required frontmatter field "name"`);
  } else {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      errors.push(`${relativePath(skillFile)}: name must use lowercase kebab-case`);
    }

    if (name !== folderName) {
      errors.push(`${relativePath(skillFile)}: name "${name}" must match folder name "${folderName}"`);
    }

    if (seenNames.has(name)) {
      errors.push(`${relativePath(skillFile)}: duplicate skill name "${name}"`);
    }
    seenNames.add(name);
  }

  if (!description) {
    errors.push(`${relativePath(skillFile)}: missing required frontmatter field "description"`);
  }

  if (!body) {
    errors.push(`${relativePath(skillFile)}: instructions body cannot be empty`);
  }
}

async function main() {
  const errors = [];
  const seenNames = new Set();

  let categoryDirs;
  try {
    categoryDirs = await getDirectories(skillsRoot);
  } catch (error) {
    console.error(`Unable to read skills directory: ${error.message}`);
    process.exit(1);
  }

  for (const categoryDir of categoryDirs) {
    const skillDirs = await getDirectories(categoryDir);
    if (skillDirs.length === 0) {
      errors.push(`${relativePath(categoryDir)}: category does not contain any skill folders`);
      continue;
    }

    for (const skillDir of skillDirs) {
      await validateSkillDirectory(skillDir, seenNames, errors);
    }
  }

  if (errors.length > 0) {
    console.error('Skill validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${seenNames.size} skill(s) successfully.`);
}

await main();