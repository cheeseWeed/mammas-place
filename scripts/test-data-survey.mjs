// Survey what's in prod Neon — counts per table + test-looking users.
// READ-ONLY. Run: node scripts/test-data-survey.mjs

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Names that match the Playwright test patterns we used today.
const TEST_NAME_PATTERNS = [
  /^pwtest/, /^mptst/, /^mktest/, /^smktst/, /^fxtst/, /^cardtst/,
  /^swfltst/, /^fnltst/, /^smfltst/, /^mptest/, /^pwsmoke/,
];

function isTestUser(name) {
  return TEST_NAME_PATTERNS.some((re) => re.test(name));
}

async function main() {
  const [
    askCount,
    earningCount,
    txnCount,
    orderCount,
    feedbackCount,
    giftCardCount,
    userCount,
  ] = await Promise.all([
    prisma.dadAsk.count(),
    prisma.mpEarning.count(),
    prisma.mpTransaction.count(),
    prisma.mpOrder.count(),
    prisma.feedback.count(),
    prisma.mpGiftCard.count(),
    prisma.driveUser.count(),
  ]);

  console.log('\nProd Neon table counts:');
  console.log(`  dadAsk:       ${askCount}`);
  console.log(`  mpEarning:    ${earningCount}`);
  console.log(`  mpTransaction:${txnCount}`);
  console.log(`  mpOrder:      ${orderCount}`);
  console.log(`  feedback:     ${feedbackCount}`);
  console.log(`  mpGiftCard:   ${giftCardCount}`);
  console.log(`  driveUser:    ${userCount}`);

  console.log('\nAll users:');
  const users = await prisma.driveUser.findMany({
    select: { name: true, displayName: true, balanceCents: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const u of users) {
    const flag = isTestUser(u.name) ? ' ← TEST' : '';
    console.log(`  ${u.name.padEnd(20)} bal=${(u.balanceCents / 100).toFixed(2)}MP  created=${u.createdAt.toISOString().slice(0, 10)}${flag}`);
  }

  const testNames = users.filter((u) => isTestUser(u.name)).map((u) => u.name);
  console.log(`\nTest-pattern users: ${testNames.length} matched`);
  console.log(testNames.join(', '));

  console.log('\nDad asks (last 20):');
  const asks = await prisma.dadAsk.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { userName: true, centsAsked: true, outcome: true, centsGranted: true, createdAt: true, reason: true },
  });
  for (const a of asks) {
    const flag = isTestUser(a.userName) ? ' ← TEST' : '';
    console.log(`  ${a.createdAt.toISOString().slice(0, 19)}  ${a.userName.padEnd(18)} asked=${(a.centsAsked/100).toFixed(2)} granted=${(a.centsGranted/100).toFixed(2)} ${a.outcome.padEnd(12)} reason="${a.reason.slice(0,40)}"${flag}`);
  }

  console.log('\nFeedback (last 10):');
  const fb = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { authorName: true, body: true, page: true, status: true, createdAt: true },
  });
  for (const f of fb) {
    console.log(`  ${f.createdAt.toISOString().slice(0,19)}  ${(f.authorName ?? '(anon)').padEnd(15)} status=${f.status.padEnd(8)} body="${f.body.slice(0,60)}"`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
