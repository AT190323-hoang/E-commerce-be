import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { RequestLoggingInterceptor } from '@/common/interceptors/request-logging.interceptor';
import { PrismaService } from '@/prisma/prisma.service';

async function setupAdminJs(app: any) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const [{ default: AdminJS }, adminJsExpressMod, adminJsPrismaMod] =
    await Promise.all([
      import('adminjs'),
      import('@adminjs/express'),
      import('@adminjs/prisma'),
    ]);

  const AdminJSExpress =
    (adminJsExpressMod as { default?: any }).default ?? adminJsExpressMod;
  const { Database, Resource, getModelByName } = adminJsPrismaMod as {
    Database: any;
    Resource: any;
    getModelByName: (name: string) => any;
  };

  AdminJS.registerAdapter({ Database, Resource });

  const prisma = app.get(PrismaService);
  const rootPath = '/admin';

  const admin = new AdminJS({
    rootPath,
    resources: [
      { resource: { model: getModelByName('User'), client: prisma } },
      { resource: { model: getModelByName('Category'), client: prisma } },
      { resource: { model: getModelByName('Product'), client: prisma } },
      { resource: { model: getModelByName('Order'), client: prisma } },
      { resource: { model: getModelByName('Payment'), client: prisma } },
      { resource: { model: getModelByName('Review'), client: prisma } },
    ],
    branding: {
      companyName: 'Ecommerce Admin',
      withMadeWithLove: false,
    },
  });

  const adminEmail = process.env.ADMINJS_EMAIL ?? 'admin@local.dev';
  const adminPassword = process.env.ADMINJS_PASSWORD ?? 'admin123';

  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: async (email: string, password: string) => {
        if (email === adminEmail && password === adminPassword) {
          return { email };
        }
        return null;
      },
      cookieName: 'adminjs',
      cookiePassword: process.env.ADMINJS_COOKIE_SECRET ?? 'adminjs-cookie-secret',
    },
    null,
    {
      secret: process.env.ADMINJS_SESSION_SECRET ?? 'adminjs-session-secret',
      resave: false,
      saveUninitialized: false,
    },
  );

  app.use(rootPath, router);
}



async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Register global exception filters (order matters: specific first, then catch-all)
  app.useGlobalFilters(new HttpExceptionFilter(), new AllExceptionsFilter());

  // Register global interceptors
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ecommerce Backend API')
    .setDescription('API documentation for auth and users modules')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, swaggerDocument);

  await setupAdminJs(app);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
