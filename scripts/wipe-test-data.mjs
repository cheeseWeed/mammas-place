// Destructive: wipe Dad-ask history + test users + test feedback.
// Run: node scripts/wipe-test-data.mjs

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TEST_NAME_PATTERNS = [
  /^pwtest/, /^mptst/, /^mktest/, /^smktst/, /^fxtst/, /^cardtst/,
  /^swfltst/, /^fnltst/, /^smfltst/, /^mptest/, /^pwsmoke/,
];

function isTestUser(name) {
  return TEST_NAME_PATTERNS.some((re) => re.test(name));
}

async function main() {
  // 1. Wipe ALL dad asks (clean slate for cadence — user wants fresh testing).
  const askDeleted = await prisma.dadAsk.deleteMany({});
  console.log(`Deleted ${askDeleted.count} dadAsk rows`);

  // 2. Find test users.
  const allUsers = await prisma.driveUser.findMany({ select: { name: true } });
  const testNames = allUsers.map((u) => u.name).filter(isTestUser);
  console.log(`Test users to delete: ${testNames.length} (${testNames.join(', ')})`);

  // 3. Delete test users — cascade will clean their MpTransaction, MpEarning,
  //    MpOrder, DadAsk (already wiped above), etc.
  if (testNames.length > 0) {
    const userDeleted = await prisma.driveUser.deleteMany({
      where: { name: { in: testNames } },
    });
    console.log(`Deleted ${userDeleted.count} driveUser rows (cascade wipes their txns/earnings)`);
  }

  // 4. Wipe feedback — both rows are test submissions.
  const fbDeleted = await prisma.feedback.deleteMany({});
  console.log(`Deleted ${fbDeleted.count} feedback rows`);

  // 5. Final counts.
  const [
    askCount, earningCount, txnCount, orderCount, fbCount, gcCount, userCount,
  ] = await Promise.all([
    prisma.dadAsk.count(),
    prisma.mpEarning.count(),
    prisma.mpTransaction.count(),
    prisma.mpOrder.count(),
    prisma.feedback.count(),
    prisma.mpGiftCard.count(),
    prisma.driveUser.count(),
  ]);

  console.log('\nFinal counts:');
  console.log(`  dadAsk:       ${askCount}`);
  console.log(`  mpEarning:    ${earningCount}`);
  console.log(`  mpTransaction:${txnCount}`);
  console.log(`  mpOrder:      ${orderCount}`);
  console.log(`  feedback:     ${fbCount}`);
  console.log(`  mpGiftCard:   ${gcCount}`);
  console.log(`  driveUser:    ${userCount}`);

  const remaining = await prisma.driveUser.findMany({
    select: { name: true, balanceCents: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('\nRemaining users (real):');
  for (const u of remaining) {
    console.log(`  ${u.name.padEnd(30)} bal=${(u.balanceCents / 100).toFixed(2)}MP`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
