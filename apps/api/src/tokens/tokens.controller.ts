import { Controller, Get } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Controller('tokens')
export class TokensController {
  private readonly prisma = new PrismaClient();

  @Get()
  async getTokens() {
    const tokens = await this.prisma.token.findMany({
      orderBy: { symbol: 'asc' },
      select: {
        address: true,
        symbol: true,
        name: true,
        decimals: true,
        logoUri: true,
      },
    });

    return tokens.map(({ address, ...rest }) => ({
      contractAddress: address,
      ...rest,
    }));
  }
}
