import { describe, it, expect } from 'vitest';

describe('AvatarDeepDiveCard architecture', () => {
  it('component file does not contain useState for avatar', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      'src/components/stage3/AvatarDeepDiveCard.tsx', 'utf-8'
    );
    expect(source).not.toMatch(/const \[avatar,\s*setAvatar\]/);
  });

  it('component file does not self-trigger deepDiveAvatarStream', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      'src/components/stage3/AvatarDeepDiveCard.tsx', 'utf-8'
    );
    expect(source).not.toMatch(/deepDiveAvatarStream\s*\(/);
  });
});

describe('AIGeneratedAvatarWizard architecture', () => {
  it('uses a ref-based guard to prevent re-running deepdive', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      'src/components/stage3/AIGeneratedAvatarWizard.tsx', 'utf-8'
    );
    expect(source).toMatch(/deepDiveStarted.*useRef/);
    expect(source).toMatch(/\.has\(av\.id\)/);
  });
});
