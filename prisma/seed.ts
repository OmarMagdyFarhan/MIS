/**
 * Prisma seed — populates the database with sample data for development.
 *
 * Run:  npx tsx prisma/seed.ts
 * Or:   pnpm db:seed
 *
 * @module prisma/seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding database...\n");

  // Create active corpus version
  const corpus = await prisma.corpusVersion.upsert({
    where: { version: 1 },
    update: {},
    create: { version: 1, status: "active" },
  });
  console.log(`✅  CorpusVersion v${corpus.version} (${corpus.status})`);

  // Seed sample evidence messages
  const sampleMessages = [
    { text: "I love the product but the price is a bit high for my budget.", sentiment: "positive" },
    { text: "Setup was confusing at first, took me a week to figure it out.", sentiment: "negative" },
    { text: "The results are amazing! Saved me 10 hours a week.", sentiment: "positive" },
    { text: "I wish there was better customer support available on weekends.", sentiment: "negative" },
    { text: "Not sure if this works for my industry — I'm in healthcare.", sentiment: "neutral" },
    { text: "Would love a trial period before committing to the full price.", sentiment: "neutral" },
    { text: "The onboarding checklist helped a lot. Super clear.", sentiment: "positive" },
    { text: "Worried about my data privacy — where is it stored?", sentiment: "negative" },
  ];

  let msgCount = 0;
  for (const msg of sampleMessages) {
    await prisma.evidenceMessage.create({
      data: { ...msg, corpusVersionId: corpus.id },
    });
    msgCount++;
  }
  console.log(`✅  ${msgCount} evidence messages seeded`);

  // Seed sample cluster
  const cluster = await prisma.cluster.create({
    data: {
      name: "Pricing Concerns",
      theme: "Customers express concern about price relative to perceived value",
      messageCount: 2,
      cohesionScore: 0.82,
      corpusVersionId: corpus.id,
    },
  });
  console.log(`✅  Cluster: "${cluster.name}"`);

  // Seed sample avatar
  const avatar = await prisma.avatar.create({
    data: {
      name: "The Value-Conscious Buyer",
      description:
        "A professional buyer who sees the value in the product but needs to justify the cost to their finance team. Price-sensitive but outcome-focused.",
      claims: [
        "I need to see ROI within 3 months",
        "My budget is approved but tight",
        "I need a business case to present upward",
      ],
      clusterId: cluster.id,
      taskType: "structure",
      temperature: 0.0,
    },
  });
  console.log(`✅  Avatar: "${avatar.name}" (taskType: ${avatar.taskType}, temp: ${avatar.temperature})`);

  console.log("\n🎉  Seed complete!\n");
}

main()
  .catch(err => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
