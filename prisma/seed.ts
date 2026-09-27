import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { encryptSecret } from "../src/lib/crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Dev-only shared password for every seeded account — change immediately for
// any real deployment. Printed at the end of the seed run as a reminder.
const DEV_PASSWORD = "blackcircle2026";

async function main() {
  console.log("Seeding Black Circle OS — matches the approved mockup data...");
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const agency = await prisma.agency.upsert({
    where: { slug: "black-circle" },
    create: { name: "Black Circle", slug: "black-circle" },
    update: {},
  });
  const agencyId = agency.id;

  const teamNord = await prisma.team.create({ data: { name: "Équipe Nord", agencyId } });
  const teamSud = await prisma.team.create({ data: { name: "Équipe Sud", agencyId } });
  const teamEst = await prisma.team.create({ data: { name: "Équipe Est", agencyId } });

  const admin = await prisma.user.create({
    data: { name: "Angels Pillonel", email: "pillonelflorezpaco@gmail.com", role: "SUPER_ADMIN", passwordHash },
    // agencyId intentionally omitted — NULL for SUPER_ADMIN
  });
  const julien = await prisma.user.create({
    data: { name: "Julien Marchand", email: "julien@blackcircle.agency", role: "VIDEO_EDITOR", teamId: teamNord.id, agencyId, passwordHash },
  });
  const lea = await prisma.user.create({
    data: { name: "Léa Roussel", email: "lea@blackcircle.agency", role: "VIDEO_EDITOR", teamId: teamSud.id, agencyId, passwordHash },
  });
  const paul = await prisma.user.create({
    data: { name: "Paul Vidal", email: "paul@blackcircle.agency", role: "ASSISTANT", teamId: teamEst.id, agencyId, passwordHash },
  });
  await prisma.user.create({
    data: { name: "Camille Ortiz", email: "camille@blackcircle.agency", role: "VIDEO_EDITOR", teamId: teamNord.id, agencyId, passwordHash },
  });
  await prisma.user.create({
    data: { name: "Sacha Ben", email: "sacha@blackcircle.agency", role: "AGENCY_MANAGER", agencyId, passwordHash },
  });

  const blotatoPool1 = await prisma.blotatoAccount.create({
    data: { label: "Blotato Pool #1", apiKey: encryptSecret("placeholder-not-a-real-key"), capLimit: 200, agencyId },
  });
  const blotatoPool2 = await prisma.blotatoAccount.create({
    data: { label: "Blotato Pool #2", apiKey: encryptSecret("placeholder-not-a-real-key"), capLimit: 200, agencyId },
  });

  const modelsData = [
    { name: "Aurora Media", teamId: teamNord.id, blotatoAccountId: blotatoPool1.id, status: "CRIT" as const, days: 2.1 },
    { name: "Kite & Co.", teamId: teamSud.id, blotatoAccountId: blotatoPool1.id, status: "WARN" as const, days: 3.8 },
    { name: "Studio Nova", teamId: teamNord.id, blotatoAccountId: blotatoPool1.id, status: "WARN" as const, days: 6.4 },
    { name: "Nord Studio", teamId: teamEst.id, blotatoAccountId: blotatoPool2.id, status: "OK" as const, days: 11.2 },
    { name: "Maison Verlan", teamId: teamSud.id, blotatoAccountId: blotatoPool2.id, status: "OK" as const, days: 9.0 },
    { name: "Rivage Studio", teamId: teamEst.id, blotatoAccountId: blotatoPool2.id, status: "OK" as const, days: 14.6 },
  ];

  const models = [];
  const socialAccounts: Awaited<ReturnType<typeof prisma.socialAccount.create>>[] = [];
  for (const m of modelsData) {
    const model = await prisma.model.create({
      data: { name: m.name, teamId: m.teamId, blotatoAccountId: m.blotatoAccountId, status: m.status, agencyId },
    });
    models.push({ ...model, days: m.days });

    for (const platform of ["INSTAGRAM", "TIKTOK", "YOUTUBE"] as const) {
      const sa = await prisma.socialAccount.create({
        data: {
          modelId: model.id,
          blotatoAccountId: m.blotatoAccountId,
          platform,
          blotatoAccountRef: `placeholder-${model.id}-${platform.toLowerCase()}`,
          displayName: `@${model.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
        },
      });
      socialAccounts.push(sa);
    }
  }

  const stages = ["RAW", "A_EDITER", "EN_EDITION", "PRET_POUR_REVIEW", "VALIDE", "PROGRAMME", "PUBLIE"] as const;
  const editors = [julien.id, lea.id, paul.id];
  const videoTitles = [
    "Interview fondateur — partie 1",
    "Behind the scenes tournage",
    "Q&A rapide 60s",
    "Astuce montage avant/après",
    'Reel "3 signes"',
    "Vlog studio — épisode 4",
    "Teaser lancement produit",
    "Reel motivation lundi",
    "Story highlight recap",
    'Reel "Pourquoi personne"',
    "Best-of semaine 27",
  ];

  let videoIndex = 0;
  const videos: Awaited<ReturnType<typeof prisma.video.create>>[] = [];
  for (const model of models) {
    for (let i = 0; i < 4; i++) {
      const stage = stages[(videoIndex + i) % stages.length];
      const video = await prisma.video.create({
        data: {
          title: videoTitles[videoIndex % videoTitles.length],
          modelId: model.id,
          stage,
          assignedEditorId: editors[videoIndex % editors.length],
          agencyId,
        },
      });
      videos.push(video);
      videoIndex++;
    }
  }

  // Posts: distribute across statuses/dates so the dashboard's period-scoped
  // stats (published this week/month, scheduled, failed) have real data.
  const now = Date.now();
  const day = 86_400_000;
  const postPlan: { daysAgo: number; status: "PUBLISHED" | "SCHEDULED" | "IN_PROGRESS" | "FAILED" }[] = [
    { daysAgo: 1, status: "PUBLISHED" }, { daysAgo: 2, status: "PUBLISHED" }, { daysAgo: 3, status: "PUBLISHED" },
    { daysAgo: 5, status: "PUBLISHED" }, { daysAgo: 6, status: "PUBLISHED" }, { daysAgo: 9, status: "PUBLISHED" },
    { daysAgo: 12, status: "PUBLISHED" }, { daysAgo: 15, status: "PUBLISHED" }, { daysAgo: 20, status: "PUBLISHED" },
    { daysAgo: 25, status: "PUBLISHED" }, { daysAgo: -2, status: "SCHEDULED" }, { daysAgo: -5, status: "SCHEDULED" },
    { daysAgo: -1, status: "IN_PROGRESS" }, { daysAgo: 1, status: "FAILED" }, { daysAgo: 4, status: "FAILED" },
  ];
  for (let i = 0; i < postPlan.length; i++) {
    const plan = postPlan[i];
    const video = videos[i % videos.length];
    const socialAccount = socialAccounts[i % socialAccounts.length];
    const post = await prisma.post.create({
      data: {
        videoId: video.id,
        socialAccountId: socialAccount.id,
        platform: socialAccount.platform,
        status: plan.status,
        scheduledTime: new Date(now - plan.daysAgo * day),
        publicUrl: plan.status === "PUBLISHED" ? "https://instagram.com/p/placeholder" : null,
        errorMessage: plan.status === "FAILED" ? "Upload failed: media processing timeout" : null,
        agencyId,
      },
    });
    if (plan.status === "PUBLISHED") {
      await prisma.postMetricSnapshot.create({
        data: {
          postId: post.id,
          views: 800 + i * 340,
          likes: 60 + i * 18,
          comments: 4 + i * 2,
          saves: 10 + i,
          shares: 3 + i,
          reach: 700 + i * 300,
          engagement: 60 + i * 18 + 4 + i * 2 + 10 + i + 3 + i,
        },
      });
    }
  }

  await prisma.integration.createMany({
    data: [
      { type: "GOOGLE_DRIVE", label: "Google Drive", status: "CONNECTED", lastSyncAt: new Date(), agencyId },
      { type: "N8N", label: "n8n", status: "CONNECTED", lastSyncAt: new Date(), agencyId },
      { type: "BLOTATO", label: "Blotato", status: "CONNECTED", lastSyncAt: new Date(), agencyId },
      { type: "TELEGRAM", label: "Telegram", status: "DISCONNECTED", agencyId },
      { type: "GOOGLE_CALENDAR", label: "Google Calendar (partagé)", status: "DISCONNECTED", agencyId },
      { type: "GOOGLE_SHEETS", label: "Google Sheets", status: "DISCONNECTED", agencyId },
      { type: "CUSTOM_API", label: "API personnalisée", status: "COMING_SOON", agencyId },
    ],
  });

  await prisma.activityLogEntry.createMany({
    data: [
      { eventType: "POST_SCHEDULED", message: "Publication programmée — Aurora Media — Instagram Reels", severity: "OK", modelId: models[0].id, agencyId },
      { eventType: "VIDEO_STAGE_CHANGED", message: "Julien M. a déplacé une vidéo vers Prêt pour review — Studio Nova", severity: "WARN", modelId: models[2].id, actorId: julien.id, agencyId },
      { eventType: "POST_FAILED", message: "Échec d'upload TikTok — Kite & Co.", severity: "CRIT", modelId: models[1].id, agencyId },
      { eventType: "POST_PUBLISHED", message: "Rendu Remotion terminé — 3 vidéos — Maison Verlan", severity: "OK", modelId: models[4].id, agencyId },
      { eventType: "MODEL_CREATED", message: "Nouveau model onboardé — Nord Studio", severity: "OK", modelId: models[3].id, agencyId },
    ],
  });

  console.log(`Seeded: ${models.length} models, ${videoIndex} videos, 6 users, 6 integrations.`);
  console.log(`\nDev login for every seeded user — password: ${DEV_PASSWORD}`);
  console.log(`Admin: pillonelflorezpaco@gmail.com / ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
