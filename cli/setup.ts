#!/usr/bin/env tsx
import prompts from 'prompts';
import { writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import path from 'path';

interface CoachConfig {
  company: string;
  role: string;
  branding: {
    primaryColor: string;
    companyUrl: string;
  };
  personas: string[];
}

async function main() {
  console.log('\nWelcome to AI Interview Coach Setup!\n');

  const response = await prompts(
    [
      {
        type: 'text',
        name: 'company',
        message: 'What company are you interviewing at?',
        initial: 'Acme Corp',
        validate: (value: string) => value.trim().length > 0 || 'Company name is required',
      },
      {
        type: 'text',
        name: 'role',
        message: 'What role are you interviewing for?',
        initial: 'VP Product',
        validate: (value: string) => value.trim().length > 0 || 'Role is required',
      },
      {
        type: 'select',
        name: 'primaryColor',
        message: 'Primary color theme',
        choices: [
          { title: 'Blue', value: 'blue' },
          { title: 'Green', value: 'green' },
          { title: 'Purple', value: 'purple' },
          { title: 'Orange', value: 'orange' },
        ],
        initial: 0,
      },
      {
        type: 'text',
        name: 'companyUrl',
        message: 'Company website URL (optional)',
        initial: '',
      },
    ],
    {
      onCancel: () => {
        console.log('\nSetup cancelled.');
        process.exit(0);
      },
    }
  );

  const config: CoachConfig = {
    company: response.company.trim(),
    role: response.role.trim(),
    branding: {
      primaryColor: response.primaryColor,
      companyUrl: response.companyUrl.trim(),
    },
    personas: [],
  };

  console.log('\nCreating your coach configuration...');

  // Write coach.config.json
  const configPath = path.join(process.cwd(), 'coach.config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('  coach.config.json created');

  // Ensure personas directory exists
  const personasDir = path.join(process.cwd(), 'personas');
  if (!existsSync(personasDir)) {
    mkdirSync(personasDir, { recursive: true });
  }

  // Copy example personas if personas/ is empty or doesn't have user files
  const exampleDir = path.join(process.cwd(), 'personas', 'example');
  if (existsSync(exampleDir)) {
    const existingFiles = readdirSync(personasDir).filter(
      (f) => f !== 'example' && f.endsWith('.md')
    );
    if (existingFiles.length === 0) {
      const exampleFiles = readdirSync(exampleDir).filter((f) => f.endsWith('.md'));
      for (const file of exampleFiles) {
        const src = path.join(exampleDir, file);
        const dest = path.join(personasDir, file);
        copyFileSync(src, dest);
      }
      console.log(`  ${exampleFiles.length} example personas copied to personas/`);
    } else {
      console.log('  Existing personas preserved');
    }
  }

  console.log('\nNext steps:');
  console.log('  1. Customize personas in the personas/ directory');
  console.log('  2. Add your ANTHROPIC_API_KEY to .env.local');
  console.log('  3. Run `npm run dev` to start practicing\n');

  // Create .env.local if it doesn't exist
  const envPath = path.join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    writeFileSync(envPath, 'ANTHROPIC_API_KEY=sk-ant-xxx\n');
    console.log('  .env.local created — add your API key before running');
  }
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
