import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClerkService {
  private clerk;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clerk = createClerkClient({
      secretKey: config.get<string>('CLERK_SECRET_KEY'),
    });
  }

  async verifyToken(token: string) {
    try {
      return await this.clerk.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Resolve Clerk userId → internal User, create on first login
  async resolveUser(clerkId: string, tenantSlug?: string) {
    let user = await this.prisma.user.findUnique({ where: { clerkId } });
    if (user) return user;

    // First login — fetch profile from Clerk, provision in DB
    const clerkUser = await this.clerk.users.getUser(clerkId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email;

    // Find or create tenant based on email domain or slug param
    let tenant = tenantSlug
      ? await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } })
      : await this.prisma.tenant.findFirst({ where: { slug: email.split('@')[1]?.split('.')[0] } });

    if (!tenant) {
      const slug = email.split('@')[1]?.split('.')[0] ?? 'default';
      tenant = await this.prisma.tenant.create({
        data: { name: `${name}'s Organization`, slug: `${slug}-${Date.now()}` },
      });
    }

    user = await this.prisma.user.create({
      data: { clerkId, email, name, tenantId: tenant.id, role: 'PILOT' },
    });

    return user;
  }
}
