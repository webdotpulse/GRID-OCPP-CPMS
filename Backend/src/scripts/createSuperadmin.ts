import { prisma } from '../config/database.js';
import bcrypt from 'bcrypt';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npm run create-superadmin -- <email> <password>');
    process.exit(1);
  }

  const email = args[0];
  const password = args[1];

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.role !== 'superadmin' || !existingUser.emailVerified) {
        await prisma.user.update({
          where: { email },
          data: { role: 'superadmin', emailVerified: true },
        });
        console.log(`Updated existing user ${email} to Superadmin role!`);
      } else {
        console.log(`Superadmin user with email ${email} already exists.`);
      }
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'superadmin',
        userType: 'private',
        emailVerified: true,
      },
    });

    console.log(`Superadmin user ${user.email} created successfully!`);
  } catch (error) {
    console.error('Error creating superadmin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
