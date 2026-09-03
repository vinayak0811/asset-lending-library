import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays, addDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Delete all data in reverse dependency order
  // to avoid foreign key constraint errors.
  await prisma.loanEvent.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.custodian.deleteMany();
  await prisma.catalogueItem.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data.');

  const passwordHash = await bcrypt.hash('password123', 10);

  // ============================================================
  // CREATE USERS
  // ============================================================

  // Full-access librarian: every permission, normal way of working.
  const alice = await prisma.user.create({
    data: {
      name: 'Alice Chen',
      email: 'librarian@example.com',
      passwordHash,
      role: 'LIBRARIAN',
      isDemo: false,
    },
  });

  // Restricted "demo" librarian: can see everything (dashboard, catalogue,
  // loans) but member names are blurred everywhere and item approval
  // actions (Approve & Issue / Decline / Direct Issue) are blocked,
  // both in the UI and server-side.
  const bob = await prisma.user.create({
    data: {
      name: 'Bob Martinez',
      email: 'librarian2@example.com',
      passwordHash,
      role: 'LIBRARIAN',
      isDemo: true,
    },
  });

  // Full-access member: normal way of working, can request loans.
  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Wilson',
      email: 'member@example.com',
      passwordHash,
      role: 'MEMBER',
      isDemo: false,
    },
  });

  // Restricted "demo" member: can see everything a member can (catalogue,
  // their own loans, dashboard) but cannot submit loan requests or take
  // any other write action — view only, both in the UI and server-side.
  const diana = await prisma.user.create({
    data: {
      name: 'Diana Patel',
      email: 'member2@example.com',
      passwordHash,
      role: 'MEMBER',
      isDemo: true,
    },
  });

  const eve = await prisma.user.create({
    data: {
      name: 'Eve Johnson',
      email: 'member3@example.com',
      passwordHash,
      role: 'MEMBER',
    },
  });

  console.log('Created users.');

  // ============================================================
  // CREATE CATALOGUE ITEMS
  // ============================================================

  // IMPORTANT:
  // Current Prisma schema uses "title", not "name".
  const itemsData = [
    {
      code: 'CAM-001',
      title: 'Canon EOS R5 Camera',
      description: 'Professional full-frame mirrorless camera',
      category: 'Audio/Visual',
    },
    {
      code: 'CAM-002',
      title: 'Sony A7III Camera',
      description: 'Full-frame mirrorless interchangeable lens camera',
      category: 'Audio/Visual',
    },
    {
      code: 'CAM-003',
      title: 'GoPro Hero 12 Action Camera',
      description: '4K action camera',
      category: 'Audio/Visual',
    },
    {
      code: 'PROJ-001',
      title: 'Epson PowerLite Projector',
      description: 'High brightness office projector',
      category: 'Audio/Visual',
    },
    {
      code: 'PROJ-002',
      title: 'BenQ 4K Home Projector',
      description: '4K HDR home theater projector',
      category: 'Audio/Visual',
    },
    {
      code: 'TOOL-001',
      title: 'DeWalt 20V Cordless Drill',
      description: 'Compact cordless drill/driver kit',
      category: 'Power Tools',
    },
    {
      code: 'TOOL-002',
      title: 'Makita Circular Saw',
      description: '7-1/4 inch circular saw',
      category: 'Power Tools',
    },
    {
      code: 'TOOL-003',
      title: 'Bosch Laser Level',
      description: 'Cross-line laser level',
      category: 'Power Tools',
    },
    {
      code: 'TOOL-004',
      title: 'Milwaukee Impact Driver',
      description: 'M18 1/4 in. hex impact driver',
      category: 'Power Tools',
    },
    {
      code: 'OUT-001',
      title: 'Coleman 4-Person Tent',
      description: 'Sundome 4-person camping tent',
      category: 'Outdoor Gear',
    },
    {
      code: 'OUT-002',
      title: 'Osprey 65L Backpack',
      description: "Atmos AG 65 men's backpacking backpack",
      category: 'Outdoor Gear',
    },
    {
      code: 'OFF-001',
      title: 'Brother Laser Printer',
      description: 'Monochrome laser printer',
      category: 'Office Equipment',
    },
    {
      code: 'OFF-002',
      title: 'Fellowes Paper Shredder',
      description: '12-sheet cross-cut shredder',
      category: 'Office Equipment',
    },
    {
      code: 'KIT-001',
      title: 'KitchenAid Stand Mixer',
      description: 'Artisan series 5-quart stand mixer',
      category: 'Kitchen',
    },
    {
      code: 'KIT-002',
      title: 'Instant Pot Duo 8-Quart',
      description: '7-in-1 electric pressure cooker',
      category: 'Kitchen',
    },
    {
      code: 'ARCH-001',
      title: 'Old VHS Camcorder',
      description: 'Vintage VHS camcorder',
      category: 'Audio/Visual',
      isArchived: true,
    },
  ];

  const items = await Promise.all(
    itemsData.map((item) =>
      prisma.catalogueItem.create({
        data: item,
      })
    )
  );

  const getItem = (code: string) => {
    const item = items.find((item) => item.code === code);

    if (!item) {
      throw new Error(`Catalogue item not found: ${code}`);
    }

    return item;
  };

  console.log('Created catalogue items.');

  // ============================================================
  // CREATE CUSTODIAN ASSIGNMENTS
  // ============================================================

  // IMPORTANT:
  // Current Prisma schema uses "itemId", not "catalogueItemId".
  await prisma.custodian.createMany({
    data: [
      {
        userId: alice.id,
        itemId: getItem('CAM-001').id,
      },
      {
        userId: alice.id,
        itemId: getItem('CAM-002').id,
      },
      {
        userId: alice.id,
        itemId: getItem('PROJ-001').id,
      },
      {
        userId: alice.id,
        itemId: getItem('TOOL-001').id,
      },
      {
        userId: alice.id,
        itemId: getItem('OUT-001').id,
      },
      {
        userId: bob.id,
        itemId: getItem('TOOL-002').id,
      },
      {
        userId: bob.id,
        itemId: getItem('TOOL-003').id,
      },
      {
        userId: bob.id,
        itemId: getItem('OFF-001').id,
      },
      {
        userId: bob.id,
        itemId: getItem('KIT-001').id,
      },
    ],
  });

  console.log('Created custodian assignments.');

  const now = new Date();

  // ============================================================
  // HELPER: CREATE LOAN + LOAN EVENTS
  // ============================================================

  async function createLoanWithEvents(
    itemCode: string,
    memberId: string,
    status: string,
    dueDate: Date | null,
    alertDismissed: boolean,
    events: {
      type: string;
      date: Date;
      actorId: string;
      notes?: string;
    }[]
  ) {
    // IMPORTANT:
    // Current Prisma schema uses:
    //   itemId
    //   borrowerId
    //
    // instead of:
    //   catalogueItemId
    //   memberId

    const loan = await prisma.loan.create({
      data: {
        itemId: getItem(itemCode).id,
        borrowerId: memberId,
        status,
        dueDate,
        alertDismissed,
      },
    });

    // Current Prisma schema uses:
    //   action
    //   timestamp
    //
    // instead of:
    //   type
    //   createdAt

    for (const event of events) {
      await prisma.loanEvent.create({
        data: {
          loanId: loan.id,
          actorId: event.actorId,
          action: event.type,
          notes: event.notes,
          timestamp: event.date,
        },
      });
    }
  }

  // ============================================================
  // LOAN 1
  // CAM-001 currently ISSUED to Charlie.
  // Due 5 days ago = OVERDUE.
  // ============================================================

  await createLoanWithEvents(
    'CAM-001',
    charlie.id,
    'ISSUED',
    subDays(now, 5),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 14),
        actorId: charlie.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 10),
        actorId: alice.id,
      },
    ]
  );

  // ============================================================
  // LOAN 2
  // TOOL-001 currently ISSUED to Diana.
  // Due in 7 days.
  // ============================================================

  await createLoanWithEvents(
    'TOOL-001',
    diana.id,
    'ISSUED',
    addDays(now, 7),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 5),
        actorId: diana.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 3),
        actorId: alice.id,
      },
    ]
  );

  // ============================================================
  // LOAN 3
  // PROJ-001 RETURNED by Eve.
  // ============================================================

  await createLoanWithEvents(
    'PROJ-001',
    eve.id,
    'RETURNED',
    subDays(now, 10),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 21),
        actorId: eve.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 17),
        actorId: alice.id,
      },
      {
        type: 'NOTE_ADDED',
        date: subDays(now, 10),
        actorId: alice.id,
        notes: 'Returned in good condition.',
      },
      {
        type: 'RETURNED',
        date: subDays(now, 7),
        actorId: alice.id,
      },
    ]
  );

  // ============================================================
  // LOAN 4
  // OUT-001 currently REQUESTED by Charlie.
  // ============================================================

  await createLoanWithEvents(
    'OUT-001',
    charlie.id,
    'REQUESTED',
    null,
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 1),
        actorId: charlie.id,
      },
    ]
  );

  // ============================================================
  // LOAN 5
  // CAM-002 LOST by Diana.
  // ============================================================

  await createLoanWithEvents(
    'CAM-002',
    diana.id,
    'LOST',
    subDays(now, 18),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 28),
        actorId: diana.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 24),
        actorId: alice.id,
      },
      {
        type: 'LOST',
        date: subDays(now, 14),
        actorId: alice.id,
        notes: 'Member reported it lost during trip.',
      },
    ]
  );

  // ============================================================
  // LOAN 6
  // TOOL-002 currently ISSUED to Eve.
  // Due 3 days ago = OVERDUE.
  // ============================================================

  await createLoanWithEvents(
    'TOOL-002',
    eve.id,
    'ISSUED',
    subDays(now, 3),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 20),
        actorId: eve.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 17),
        actorId: bob.id,
      },
    ]
  );

  // ============================================================
  // LOAN 7
  // OFF-001 RETURNED by Charlie.
  // ============================================================

  await createLoanWithEvents(
    'OFF-001',
    charlie.id,
    'RETURNED',
    subDays(now, 4),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 14),
        actorId: charlie.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 10),
        actorId: bob.id,
      },
      {
        type: 'RETURNED',
        date: subDays(now, 2),
        actorId: bob.id,
      },
    ]
  );

  // ============================================================
  // LOAN 8
  // KIT-001 currently ISSUED to Diana.
  // Due in 14 days.
  // ============================================================

  await createLoanWithEvents(
    'KIT-001',
    diana.id,
    'ISSUED',
    addDays(now, 14),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 2),
        actorId: diana.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 1),
        actorId: bob.id,
      },
    ]
  );

  // ============================================================
  // LOAN 9
  // PROJ-002 RETURNED by Eve.
  // ============================================================

  await createLoanWithEvents(
    'PROJ-002',
    eve.id,
    'RETURNED',
    subDays(now, 15),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 30),
        actorId: eve.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 28),
        actorId: alice.id,
      },
      {
        type: 'RETURNED',
        date: subDays(now, 14),
        actorId: alice.id,
      },
    ]
  );

  // ============================================================
  // LOAN 10
  // TOOL-003 RETURNED by Charlie.
  // ============================================================

  await createLoanWithEvents(
    'TOOL-003',
    charlie.id,
    'RETURNED',
    subDays(now, 22),
    false,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 35),
        actorId: charlie.id,
      },
      {
        type: 'ISSUED',
        date: subDays(now, 32),
        actorId: bob.id,
      },
      {
        type: 'RETURNED',
        date: subDays(now, 21),
        actorId: bob.id,
      },
    ]
  );

  // ============================================================
  // LOAN 11
  // CAM-003 requested by Diana, then DECLINED by Alice.
  // Demonstrates the request/decline workflow — the item is free
  // again immediately since a declined loan is not an open loan.
  // ============================================================

  await createLoanWithEvents(
    'CAM-003',
    diana.id,
    'DECLINED',
    null,
    true,
    [
      {
        type: 'REQUESTED',
        date: subDays(now, 3),
        actorId: diana.id,
      },
      {
        type: 'DECLINED',
        date: subDays(now, 2),
        actorId: alice.id,
        notes: 'Reserved for an upcoming workshop; please request again next week.',
      },
    ]
  );

  // ============================================================
  // COMPLETE
  // ============================================================

  console.log('Created loans and loan events.');

  console.log('Seed completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Summary:');
  console.log('- 5 Users (2 Librarians: 1 full-access, 1 restricted demo · 3 Members)');
  console.log('- 16 Catalogue Items');
  console.log('- 9 Custodian Assignments');
  console.log('- 11 Loans (2 Overdue, 2 On-time Issued, 1 Requested, 4 Returned, 1 Lost, 1 Declined)');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });