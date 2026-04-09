import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const adminSeed = {
  email: process.env.ADMIN_SEED_EMAIL ?? 'admin@local.dev',
  password: process.env.ADMIN_SEED_PASSWORD ?? 'Admin@123456',
  fullName: process.env.ADMIN_SEED_FULL_NAME ?? 'System Admin',
  phone: process.env.ADMIN_SEED_PHONE ?? '0900000000',
  address: process.env.ADMIN_SEED_ADDRESS ?? 'Head Office',
};

const categoriesSeed = [
  'Electronics',
  'Home & Kitchen',
  'Fashion',
  'Books',
  'Sports',
];

const productsSeed = [
  {
    name: 'Wireless Mouse M220',
    description: 'Silent wireless mouse with ergonomic design.',
    price: 24.99,
    stock: 120,
    imageUrl: 'https://images.pexels.com/photos/5082566/pexels-photo-5082566.jpeg',
    category: 'Electronics',
  },
  {
    name: 'Mechanical Keyboard K87',
    description: '87-key mechanical keyboard with red switches.',
    price: 59.9,
    stock: 80,
    imageUrl: 'https://images.pexels.com/photos/2115256/pexels-photo-2115256.jpeg',
    category: 'Electronics',
  },
  {
    name: 'Bluetooth Earbuds Pro',
    description: 'Noise-cancelling earbuds with 24h battery life.',
    price: 79.5,
    stock: 65,
    imageUrl: 'https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg',
    category: 'Electronics',
  },
  {
    name: '4K Monitor 27 inch',
    description: '27-inch UHD monitor for work and entertainment.',
    price: 289.0,
    stock: 42,
    imageUrl: 'https://images.pexels.com/photos/777001/pexels-photo-777001.jpeg',
    category: 'Electronics',
  },
  {
    name: 'Air Fryer 5L',
    description: 'Oil-free air fryer with digital control panel.',
    price: 99.0,
    stock: 55,
    imageUrl: 'https://images.pexels.com/photos/6996089/pexels-photo-6996089.jpeg',
    category: 'Home & Kitchen',
  },
  {
    name: 'Stainless Cookware Set',
    description: '10-piece stainless steel cookware set.',
    price: 129.99,
    stock: 40,
    imageUrl: 'https://images.pexels.com/photos/5824519/pexels-photo-5824519.jpeg',
    category: 'Home & Kitchen',
  },
  {
    name: 'Memory Foam Pillow',
    description: 'Orthopedic pillow for better neck support.',
    price: 34.5,
    stock: 150,
    imageUrl: 'https://images.pexels.com/photos/6580235/pexels-photo-6580235.jpeg',
    category: 'Home & Kitchen',
  },
  {
    name: 'Minimalist Desk Lamp',
    description: 'Adjustable LED desk lamp with warm and cool modes.',
    price: 28.0,
    stock: 95,
    imageUrl: 'https://images.pexels.com/photos/112811/pexels-photo-112811.jpeg',
    category: 'Home & Kitchen',
  },
  {
    name: 'Classic Cotton T-Shirt',
    description: 'Breathable 100% cotton everyday t-shirt.',
    price: 14.99,
    stock: 240,
    imageUrl: 'https://images.pexels.com/photos/428338/pexels-photo-428338.jpeg',
    category: 'Fashion',
  },
  {
    name: 'Slim Fit Jeans',
    description: 'Stretchable slim fit denim jeans.',
    price: 39.99,
    stock: 130,
    imageUrl: 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg',
    category: 'Fashion',
  },
  {
    name: 'Running Sneakers X1',
    description: 'Lightweight running sneakers for daily training.',
    price: 64.9,
    stock: 110,
    imageUrl: 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
    category: 'Fashion',
  },
  {
    name: 'Weekend Backpack 25L',
    description: 'Water-resistant backpack with laptop compartment.',
    price: 49.0,
    stock: 90,
    imageUrl: 'https://images.pexels.com/photos/2905238/pexels-photo-2905238.jpeg',
    category: 'Fashion',
  },
  {
    name: 'Clean Code Handbook',
    description: 'Practical guide for writing maintainable code.',
    price: 27.5,
    stock: 70,
    imageUrl: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg',
    category: 'Books',
  },
  {
    name: 'System Design Interview Notes',
    description: 'Concepts and examples for scalable architecture.',
    price: 31.2,
    stock: 65,
    imageUrl: 'https://images.pexels.com/photos/1370295/pexels-photo-1370295.jpeg',
    category: 'Books',
  },
  {
    name: 'Yoga Mat Comfort',
    description: 'Non-slip yoga mat for home workouts.',
    price: 22.0,
    stock: 140,
    imageUrl: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg',
    category: 'Sports',
  },
  {
    name: 'Adjustable Dumbbell 20kg',
    description: 'Space-saving adjustable dumbbell for strength training.',
    price: 119.0,
    stock: 35,
    imageUrl: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg',
    category: 'Sports',
  },
  {
    name: 'Smart Fitness Watch S5',
    description: 'Fitness tracking with heart-rate and sleep monitor.',
    price: 89.0,
    stock: 77,
    imageUrl: 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg',
    category: 'Sports',
  },
];

async function ensureCategory(name) {
  const existed = await prisma.category.findFirst({
    where: { name },
    select: { id: true },
  });

  if (existed) {
    return existed;
  }

  return prisma.category.create({
    data: { name },
    select: { id: true },
  });
}

async function upsertProduct(seed, categoryId) {
  const existed = await prisma.product.findFirst({
    where: {
      name: seed.name,
      categoryId,
    },
    select: { id: true },
  });

  if (existed) {
    await prisma.product.update({
      where: { id: existed.id },
      data: {
        description: seed.description,
        price: seed.price,
        stock: seed.stock,
        imageUrl: seed.imageUrl,
        isActive: true,
      },
    });
    return 'updated';
  }

  await prisma.product.create({
    data: {
      name: seed.name,
      description: seed.description,
      price: seed.price,
      stock: seed.stock,
      imageUrl: seed.imageUrl,
      categoryId,
      isActive: true,
    },
  });
  return 'created';
}

async function ensureAdminUser() {
  const saltRounds = Number(process.env.BCRYPT_SALT ?? 10);
  const hashedPassword = await bcrypt.hash(adminSeed.password, saltRounds);

  const admin = await prisma.user.upsert({
    where: { email: adminSeed.email },
    create: {
      email: adminSeed.email,
      password: hashedPassword,
      role: 'ADMIN',
      profile: {
        create: {
          fullName: adminSeed.fullName,
          phone: adminSeed.phone,
          address: adminSeed.address,
        },
      },
    },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      profile: {
        upsert: {
          create: {
            fullName: adminSeed.fullName,
            phone: adminSeed.phone,
            address: adminSeed.address,
          },
          update: {
            fullName: adminSeed.fullName,
            phone: adminSeed.phone,
            address: adminSeed.address,
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  return admin;
}

async function main() {
  console.log('Seeding admin, categories and products...');

  const admin = await ensureAdminUser();

  const categoryMap = new Map();

  for (const categoryName of categoriesSeed) {
    const category = await ensureCategory(categoryName);
    categoryMap.set(categoryName, category.id);
  }

  let created = 0;
  let updated = 0;

  for (const product of productsSeed) {
    const categoryId = categoryMap.get(product.category);
    if (!categoryId) {
      continue;
    }

    const result = await upsertProduct(product, categoryId);
    if (result === 'created') {
      created += 1;
    } else {
      updated += 1;
    }
  }

  const totalProducts = await prisma.product.count();
  const totalCategories = await prisma.category.count();
  const totalUsers = await prisma.user.count();

  console.log(`Admin ready: email=${admin.email}, role=${admin.role}`);
  console.log(`Seed complete. created=${created}, updated=${updated}`);
  console.log(
    `Current totals: users=${totalUsers}, categories=${totalCategories}, products=${totalProducts}`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
