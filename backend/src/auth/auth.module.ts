import { Body, Controller, Get, Injectable, Module, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

export class LoginDto {
  /** رقم المستخدم، أو البريد الإلكتروني كبديل. */
  @IsString() @MinLength(1) username!: string;
  @IsString() @MinLength(1) password!: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** نقرأ المستخدم من القاعدة في كل طلب لضمان أن الحساب لا يزال فعّالاً ودوره حديث. */
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const u = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!u || !u.active) throw new UnauthorizedException();
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      departmentId: u.departmentId,
      branchId: u.branchId,
    };
  }
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(dto: LoginDto) {
    const id = dto.username.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: id }, { email: id.toLowerCase() }] },
      include: { department: true, branch: true },
    });
    const ok = user && user.active && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) throw new UnauthorizedException('رقم المستخدم أو كلمة المرور غير صحيحة');
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user: this.profile(user) };
  }

  async me(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { department: true, branch: true },
    });
    return this.profile(user);
  }

  private profile(u: {
    id: string; email: string; username: string | null; fullName: string; role: string;
    department: { id: string; name: string } | null; branch: { id: string; name: string } | null;
  }) {
    return {
      id: u.id, email: u.email, username: u.username, fullName: u.fullName, role: u.role,
      department: u.department, branch: u.branch,
    };
  }
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '12h' } as never,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
